# Browser MediaPipe Gesture Source — Design

## Problem

`hand-gesture/` is a working Python desktop app (OpenCV window + MediaPipe Tasks Python + `pyautogui`) that detects a pinch and a two-finger pose and fires OS-level mouse/keyboard actions. It cannot run inside a browser tab, so it cannot directly power SpellBrawl.

SpellBrawl's client already defines the integration boundary it expects (`src/hand/GestureSource.ts`):

```ts
export interface GestureSource {
  start(onGesture: (gesture: ConfirmedGesture) => void): Promise<void>;
  stop(): void;
}
```

`poc/architecture.md` and `poc/contracts.md` call out MediaPipe gesture classification as the next integration step, require gestures to be confirmed after ~100–150ms of stability, and require that webcam frames and raw landmarks never leave the device. The game needs six gestures (`FIST`, `OPEN_PALM`, `POINT`, `PINCH`, `HANDS_APART`, `THRUST`); the Python code only ever implemented two (pinch, two-finger).

## Goal

Implement a `GestureSource` backed by MediaPipe running in the browser (WASM), reusing the *landmark geometry* the Python code already validated (finger-up checks, pinch distance) rather than the Python process itself, and extend that geometry to cover all six gestures the game needs.

## Non-goals

- Modifying or removing `hand-gesture/` — it remains a separate, working desktop utility.
- Player B / remote camera support — Player B stays on keyboard-simulated input until multiplayer (a separate POC step) exists.
- Gesture recording, calibration UI, or configurable thresholds.
- Running Python anywhere in the browser flow (ruled out during design discussion: a local companion server would break the "webcam stays on device" architecture and wouldn't work for a deployed/remote player).

## Architecture

```text
<video> (WebcamPreview, existing)
        ↓ frames
MediaPipeGestureSource (HandLandmarker, VIDEO mode)
        ↓ raw landmarks (1-2 hands)
gestureClassifier.classifyFrame()
        ↓ { gesture, confidence } | null, per frame
gestureStability (100-150ms hold-to-confirm)
        ↓ ConfirmedGesture
onGesture callback → App.castGesture("PLAYER_A", gesture)
        ↓
gameReducer (existing, unchanged)
```

This mirrors the existing keyboard-debug path (`App.tsx`'s `keyGestures` → `castGesture`), just with a webcam-driven producer instead of `keydown` events. The `GestureSource` interface means the game engine and reducer are untouched.

## Components

### `@mediapipe/tasks-vision` (new dependency)

Browser/WASM build of the same MediaPipe Tasks API `hand_tracker.py` uses. The `hand_landmarker.task` model file is fetched from Google's CDN at first run (same URL pattern as `download_model()` in `hand_tracker.py`) and left to the browser's HTTP cache — not committed to the repo, avoiding asset bloat.

### `src/hand/gestureClassifier.ts` (new)

Pure function: `classifyFrame(hands: NormalizedLandmark[][]) → { gesture: Gesture; confidence: number } | null`.

Ports from `hand-gesture/src/gestures/detector.py`:
- `_finger_up` (tip.y vs. MCP.y) → drives `FIST` (all curled), `OPEN_PALM` (all extended), `POINT` (index extended, rest curled).
- Thumb-index tip distance → drives `PINCH`, but normalized as a **ratio** (`dist(thumbTip, indexTip) / dist(wrist, middleMcp)`) instead of the Python version's fixed-threshold raw distance, per the ratio approach in `spellbrawl-24-hour-plan.md`. A fixed threshold assumes constant distance from the camera, which doesn't hold in an arbitrary browser setup.

New geometry, not present in the Python code:
- `HANDS_APART` — requires two hands detected simultaneously; wrist-to-wrist distance ratio (normalized the same way) above a threshold.
- `THRUST` — a `FIST`-shaped hand whose bounding-box scale (or landmark z) grows rapidly toward the camera across a short frame window. This is the one gesture needing motion history rather than a single-frame pose, since nothing in the Python code performed motion classification.

### `src/hand/gestureStability.ts` (new)

Per-player hold-to-confirm debounce: a classified gesture must be observed continuously for ~100–150ms before it's emitted as a `ConfirmedGesture`, per `poc/contracts.md`. Structurally the same edge-trigger/cooldown bookkeeping as `GestureDetector`'s `_pinch_active`/`triggered` fields and `KeyboardController`'s `_cooled_down()` in the Python code, reimplemented against wall-clock timestamps from `requestVideoFrameCallback`.

### `src/hand/MediaPipeGestureSource.ts` (new)

Implements `GestureSource`. Owns the `HandLandmarker` instance (`VIDEO` running mode, `numHands: 2`), pulls frames from a `<video>` element via `requestVideoFrameCallback`, runs each frame through `classifyFrame` → `gestureStability`, and invokes `onGesture` on confirmation. `stop()` releases the landmarker and cancels the frame loop.

### `src/hand/WebcamPreview.tsx` (modified)

Once the camera stream reaches `ready`, construct and `start()` a `MediaPipeGestureSource` against the `<video>` element, forwarding confirmed gestures to the same `castGesture("PLAYER_A", …)` path `App.tsx` already wires keyboard input through. Add a `<canvas>` overlay drawing the hand skeleton and current gesture label, mirroring `HandTracker.draw()` + `draw_debug_info()` from `main.py`. Add a load-failure state (landmarker/model fails to load) that falls back to keyboard-only input with a visible message, alongside the existing `blocked` (camera permission denied) state.

## Data flow / state ownership

Unchanged from `poc/architecture.md`: the hand module (now including the new files above) emits confirmed gestures and confidence only. It has no knowledge of combat rules. `App.tsx` and `gameReducer` remain the sole owners of spell/combat logic. No landmarks or video leave the device — this was already true and nothing here changes it.

## Error handling

- Camera permission denied: existing `blocked` state in `WebcamPreview`, unchanged.
- `HandLandmarker` fails to load (model fetch fails, WASM unsupported): new state, falls back to keyboard-only input, visible message — does not break the page or block Player A from playing via keyboard.
- No hand detected in frame: `classifyFrame` returns `null`; no gesture emitted (same as Python's `else: mouse.reset()` branch — absence of a hand is a valid, non-error state).

## Testing

- `gestureClassifier.ts` is pure and unit-tested with hand-authored landmark fixtures (vitest, matching the style of `src/game/engine.test.ts`) — e.g. a fist-shaped landmark set classifies as `FIST`, a pinch-shaped one as `PINCH`, two separated hands as `HANDS_APART`.
- `gestureStability.ts` is unit-tested with fake timers: a gesture held past the hold window confirms once; one released early never confirms.
- `MediaPipeGestureSource.ts` and the live webcam/skeleton-overlay wiring are verified manually (webcam + real hands) — not meaningfully unit-testable.

## Open questions / deferred

- Exact numeric thresholds (pinch ratio, hands-apart ratio, thrust velocity/scale delta) will be tuned empirically during implementation against real webcam footage, the way the Python code's `pinch_threshold=0.05` was presumably tuned. Not fixed by this design.
