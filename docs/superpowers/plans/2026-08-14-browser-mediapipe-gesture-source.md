# Browser MediaPipe Gesture Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the need for keyboard debug input with a real webcam-driven `GestureSource` for Player A, classifying MediaPipe hand landmarks in-browser into the six SpellBrawl gestures.

**Architecture:** A pure `gestureClassifier.ts` module ports the finger-geometry checks from the existing Python prototype (`hand-gesture/src/gestures/detector.py`) into normalized-ratio TypeScript, extended with two new checks (`HANDS_APART`, `THRUST`) the Python code never needed. A `gestureStability.ts` module debounces raw per-frame classifications into edge-triggered confirmations (~120ms hold). `MediaPipeGestureSource.ts` wires both together against `@mediapipe/tasks-vision`'s `HandLandmarker` running against the existing webcam `<video>` element, implementing the pre-existing `GestureSource` interface untouched. `WebcamPreview.tsx` starts this source once the camera is live and draws a skeleton overlay for feedback.

**Tech Stack:** TypeScript, React 19, Vitest, `@mediapipe/tasks-vision@1.0.1` (browser/WASM MediaPipe Tasks API).

## Global Constraints

- Webcam frames and raw hand landmarks must never leave the device (per `poc/architecture.md`) — nothing in this plan sends them anywhere; classification runs entirely client-side.
- Gestures are confirmed only after ~100–150ms of continuous stability before being emitted (per `poc/contracts.md`); this plan uses 120ms.
- The `Gesture` enum is exactly `FIST | OPEN_PALM | POINT | PINCH | HANDS_APART | THRUST` (`src/game/types.ts`) — do not add or rename values.
- Player B stays on keyboard-simulated input; this plan only wires Player A's camera.
- Do not modify anything under `hand-gesture/` — it remains a separate, working Python desktop tool.
- Follow the existing module boundary: hand-tracking code lives in `src/hand/`, emits confirmed gestures only, and has no knowledge of combat rules (`gameReducer` and `App.tsx` remain the only consumers of confirmed gestures).

---

### Task 1: Pose classifier — FIST / OPEN_PALM / POINT

**Files:**
- Create: `src/hand/gestureClassifier.ts`
- Test: `src/hand/gestureClassifier.test.ts`

**Interfaces:**
- Consumes: `Gesture` type from `src/game/types.ts`.
- Produces: `Landmark` type (`{ x: number; y: number; z: number }`), `PoseResult` type (`{ gesture: Gesture; confidence: number }`), and `classifyPose(hands: Landmark[][]): PoseResult | null`, all exported from `src/hand/gestureClassifier.ts`. Later tasks extend `classifyPose` in this same file and add `classifyThrust`.

- [ ] **Step 1: Write the failing tests**

Create `src/hand/gestureClassifier.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { classifyPose, type Landmark } from "./gestureClassifier";

type FingerState = "up" | "down";

function makeHand({
  index,
  middle,
  ring,
  pinky,
  thumbNear,
}: {
  index: FingerState;
  middle: FingerState;
  ring: FingerState;
  pinky: FingerState;
  thumbNear: boolean;
}): Landmark[] {
  const hand: Landmark[] = new Array(21).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0 }));
  hand[0] = { x: 0.5, y: 0.9, z: 0 }; // wrist

  const fingers: Array<{ mcp: number; pip: number; dip: number; tip: number; x: number; state: FingerState }> = [
    { mcp: 5, pip: 6, dip: 7, tip: 8, x: 0.45, state: index },
    { mcp: 9, pip: 10, dip: 11, tip: 12, x: 0.5, state: middle },
    { mcp: 13, pip: 14, dip: 15, tip: 16, x: 0.55, state: ring },
    { mcp: 17, pip: 18, dip: 19, tip: 20, x: 0.6, state: pinky },
  ];

  for (const finger of fingers) {
    hand[finger.mcp] = { x: finger.x, y: 0.65, z: 0 };
    hand[finger.pip] = { x: finger.x, y: finger.state === "up" ? 0.5 : 0.68, z: 0 };
    hand[finger.dip] = { x: finger.x, y: finger.state === "up" ? 0.4 : 0.7, z: 0 };
    hand[finger.tip] = { x: finger.x, y: finger.state === "up" ? 0.25 : 0.72, z: 0 };
  }

  hand[1] = { x: 0.4, y: 0.8, z: 0 };
  hand[2] = { x: 0.38, y: 0.75, z: 0 };
  hand[3] = { x: 0.36, y: 0.7, z: 0 };
  hand[4] = thumbNear ? { x: 0.45, y: 0.66, z: 0 } : { x: 0.3, y: 0.68, z: 0 };

  return hand;
}

describe("classifyPose", () => {
  it("returns null when no hands are present", () => {
    expect(classifyPose([])).toBeNull();
  });

  it("classifies an open palm", () => {
    const hand = makeHand({ index: "up", middle: "up", ring: "up", pinky: "up", thumbNear: false });
    expect(classifyPose([hand])?.gesture).toBe("OPEN_PALM");
  });

  it("classifies a fist", () => {
    const hand = makeHand({ index: "down", middle: "down", ring: "down", pinky: "down", thumbNear: false });
    expect(classifyPose([hand])?.gesture).toBe("FIST");
  });

  it("classifies a point", () => {
    const hand = makeHand({ index: "up", middle: "down", ring: "down", pinky: "down", thumbNear: false });
    expect(classifyPose([hand])?.gesture).toBe("POINT");
  });

  it("returns null for an unrecognized finger combination", () => {
    const hand = makeHand({ index: "up", middle: "up", ring: "down", pinky: "down", thumbNear: false });
    expect(classifyPose([hand])).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/hand/gestureClassifier.test.ts`
Expected: FAIL — `gestureClassifier.ts` does not exist yet (module not found).

- [ ] **Step 3: Implement the pose classifier**

Create `src/hand/gestureClassifier.ts`:

```ts
import type { Gesture } from "../game/types";

export type Landmark = { x: number; y: number; z: number };
export type PoseResult = { gesture: Gesture; confidence: number };

const WRIST = 0;
const INDEX_TIP = 8;
const MIDDLE_TIP = 12;
const RING_TIP = 16;
const PINKY_TIP = 20;
const INDEX_MCP = 5;
const MIDDLE_MCP = 9;
const RING_MCP = 13;
const PINKY_MCP = 17;

function dist(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function isFingerExtended(hand: Landmark[], tipIndex: number, mcpIndex: number): boolean {
  return hand[tipIndex].y < hand[mcpIndex].y;
}

function handScale(hand: Landmark[]): number {
  return dist(hand[WRIST], hand[MIDDLE_MCP]);
}

function classifySingleHand(hand: Landmark[]): PoseResult | null {
  const indexUp = isFingerExtended(hand, INDEX_TIP, INDEX_MCP);
  const middleUp = isFingerExtended(hand, MIDDLE_TIP, MIDDLE_MCP);
  const ringUp = isFingerExtended(hand, RING_TIP, RING_MCP);
  const pinkyUp = isFingerExtended(hand, PINKY_TIP, PINKY_MCP);

  if (indexUp && middleUp && ringUp && pinkyUp) return { gesture: "OPEN_PALM", confidence: 0.9 };
  if (!indexUp && !middleUp && !ringUp && !pinkyUp) return { gesture: "FIST", confidence: 0.9 };
  if (indexUp && !middleUp && !ringUp && !pinkyUp) return { gesture: "POINT", confidence: 0.9 };

  return null;
}

export function classifyPose(hands: Landmark[][]): PoseResult | null {
  if (hands.length === 0) return null;
  return classifySingleHand(hands[0]);
}

// exported for reuse by handScale-dependent checks added in later tasks
export { dist, handScale };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hand/gestureClassifier.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/hand/gestureClassifier.ts src/hand/gestureClassifier.test.ts
git commit -m "feat: classify FIST/OPEN_PALM/POINT from hand landmarks"
```

---

### Task 2: Add PINCH and HANDS_APART classification

**Files:**
- Modify: `src/hand/gestureClassifier.ts`
- Modify: `src/hand/gestureClassifier.test.ts`

**Interfaces:**
- Consumes: `Landmark`, `dist`, `handScale` from Task 1 (same file).
- Produces: `classifyPose` now also returns `PINCH` (single hand, thumb-index tips close relative to hand scale) and `HANDS_APART` (two hands present, wrist-to-wrist distance far relative to hand scale). Signature unchanged from Task 1.

- [ ] **Step 1: Write the failing tests**

Append to `src/hand/gestureClassifier.test.ts` (add import of `Landmark` already present; add these cases inside a new `describe` block below the existing one):

```ts
function shiftHand(hand: Landmark[], dx: number, dy: number): Landmark[] {
  return hand.map((point) => ({ x: point.x + dx, y: point.y + dy, z: point.z }));
}

describe("classifyPose — pinch and hands apart", () => {
  it("classifies a pinch when thumb and index tips are close", () => {
    const hand = makeHand({ index: "down", middle: "down", ring: "down", pinky: "down", thumbNear: true });
    expect(classifyPose([hand])?.gesture).toBe("PINCH");
  });

  it("classifies hands apart when two hands are far from each other", () => {
    const openPalm = makeHand({ index: "up", middle: "up", ring: "up", pinky: "up", thumbNear: false });
    const hands = [shiftHand(openPalm, -0.5, 0), shiftHand(openPalm, 0.5, 0)];
    expect(classifyPose(hands)?.gesture).toBe("HANDS_APART");
  });

  it("falls back to single-hand classification when two hands are close together", () => {
    const openPalm = makeHand({ index: "up", middle: "up", ring: "up", pinky: "up", thumbNear: false });
    const hands = [shiftHand(openPalm, -0.05, 0), shiftHand(openPalm, 0.05, 0)];
    expect(classifyPose(hands)?.gesture).toBe("OPEN_PALM");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/hand/gestureClassifier.test.ts`
Expected: FAIL — the 3 new tests fail (`PINCH`/`HANDS_APART` not yet returned; two-hand fallback not yet implemented).

- [ ] **Step 3: Implement pinch and hands-apart checks**

In `src/hand/gestureClassifier.ts`, add the constant and thumb tip index near the top (with the other landmark constants):

```ts
const THUMB_TIP = 4;
const PINCH_RATIO_THRESHOLD = 0.4;
const HANDS_APART_RATIO_THRESHOLD = 3.5;
```

Replace `classifySingleHand` with a version that checks pinch first:

```ts
function classifySingleHand(hand: Landmark[]): PoseResult | null {
  const scale = handScale(hand);
  const pinchRatio = dist(hand[THUMB_TIP], hand[INDEX_TIP]) / scale;

  if (pinchRatio < PINCH_RATIO_THRESHOLD) {
    const confidence = Math.min(1, 1 - pinchRatio / PINCH_RATIO_THRESHOLD);
    return { gesture: "PINCH", confidence };
  }

  const indexUp = isFingerExtended(hand, INDEX_TIP, INDEX_MCP);
  const middleUp = isFingerExtended(hand, MIDDLE_TIP, MIDDLE_MCP);
  const ringUp = isFingerExtended(hand, RING_TIP, RING_MCP);
  const pinkyUp = isFingerExtended(hand, PINKY_TIP, PINKY_MCP);

  if (indexUp && middleUp && ringUp && pinkyUp) return { gesture: "OPEN_PALM", confidence: 0.9 };
  if (!indexUp && !middleUp && !ringUp && !pinkyUp) return { gesture: "FIST", confidence: 0.9 };
  if (indexUp && !middleUp && !ringUp && !pinkyUp) return { gesture: "POINT", confidence: 0.9 };

  return null;
}
```

Replace `classifyPose` with a version that checks two-hand `HANDS_APART` before falling back to the primary hand:

```ts
export function classifyPose(hands: Landmark[][]): PoseResult | null {
  if (hands.length === 0) return null;

  if (hands.length >= 2) {
    const scale = (handScale(hands[0]) + handScale(hands[1])) / 2;
    const ratio = dist(hands[0][WRIST], hands[1][WRIST]) / scale;
    if (ratio >= HANDS_APART_RATIO_THRESHOLD) {
      const confidence = Math.min(1, ratio / (HANDS_APART_RATIO_THRESHOLD * 1.5));
      return { gesture: "HANDS_APART", confidence };
    }
  }

  return classifySingleHand(hands[0]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hand/gestureClassifier.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/hand/gestureClassifier.ts src/hand/gestureClassifier.test.ts
git commit -m "feat: classify PINCH and HANDS_APART from hand landmarks"
```

---

### Task 3: THRUST motion classifier

**Files:**
- Modify: `src/hand/gestureClassifier.ts`
- Modify: `src/hand/gestureClassifier.test.ts`

**Interfaces:**
- Consumes: nothing new from other files.
- Produces: `FistSample` type (`{ scale: number; at: number }`) and `classifyThrust(history: FistSample[]): boolean`, exported from `src/hand/gestureClassifier.ts`. `MediaPipeGestureSource` (Task 5) maintains the `FistSample[]` ring buffer (appending a sample whenever `classifyPose` returns `FIST`, clearing it otherwise) and calls this function each frame.

- [ ] **Step 1: Write the failing tests**

Append to `src/hand/gestureClassifier.test.ts`:

```ts
import { classifyThrust, type FistSample } from "./gestureClassifier";

describe("classifyThrust", () => {
  it("returns false with fewer than two samples", () => {
    expect(classifyThrust([])).toBe(false);
    expect(classifyThrust([{ scale: 0.2, at: 0 }])).toBe(false);
  });

  it("returns true when hand scale grows quickly within the window", () => {
    const history: FistSample[] = [
      { scale: 0.2, at: 0 },
      { scale: 0.32, at: 200 },
    ];
    expect(classifyThrust(history)).toBe(true);
  });

  it("returns false when growth is too slow", () => {
    const history: FistSample[] = [
      { scale: 0.2, at: 0 },
      { scale: 0.22, at: 200 },
    ];
    expect(classifyThrust(history)).toBe(false);
  });

  it("ignores growth that happened outside the recent window", () => {
    const history: FistSample[] = [
      { scale: 0.1, at: 0 },
      { scale: 0.3, at: 1_000 },
    ];
    expect(classifyThrust(history)).toBe(false);
  });
});
```

(Add `classifyThrust` and `FistSample` to the existing `import { classifyPose, type Landmark } from "./gestureClassifier";` line at the top instead of a second import statement.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/hand/gestureClassifier.test.ts`
Expected: FAIL — `classifyThrust`/`FistSample` not exported yet.

- [ ] **Step 3: Implement THRUST classification**

Add to `src/hand/gestureClassifier.ts`:

```ts
export type FistSample = { scale: number; at: number };

const THRUST_WINDOW_MS = 250;
const THRUST_GROWTH_RATIO = 1.4;

export function classifyThrust(history: FistSample[]): boolean {
  if (history.length < 2) return false;

  const latest = history[history.length - 1];
  const windowStart = latest.at - THRUST_WINDOW_MS;
  const earliestInWindow = history.find((sample) => sample.at >= windowStart);

  if (!earliestInWindow || earliestInWindow === latest || earliestInWindow.scale <= 0) return false;

  return latest.scale / earliestInWindow.scale >= THRUST_GROWTH_RATIO;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hand/gestureClassifier.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add src/hand/gestureClassifier.ts src/hand/gestureClassifier.test.ts
git commit -m "feat: classify THRUST from fist hand-scale growth"
```

---

### Task 4: Gesture stability (hold-to-confirm) module

**Files:**
- Create: `src/hand/gestureStability.ts`
- Test: `src/hand/gestureStability.test.ts`

**Interfaces:**
- Consumes: `Gesture` type from `src/game/types.ts`.
- Produces: `GestureStabilizer` class with `observe(candidate: { gesture: Gesture; confidence: number } | null, at: number): { gesture: Gesture; confidence: number; at: number } | null`. `MediaPipeGestureSource` (Task 5) owns one instance per camera and calls `observe` once per frame.

- [ ] **Step 1: Write the failing tests**

Create `src/hand/gestureStability.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { GestureStabilizer } from "./gestureStability";

describe("GestureStabilizer", () => {
  it("does not confirm before the hold window elapses", () => {
    const stabilizer = new GestureStabilizer();
    stabilizer.observe({ gesture: "FIST", confidence: 0.9 }, 0);
    const result = stabilizer.observe({ gesture: "FIST", confidence: 0.9 }, 100);
    expect(result).toBeNull();
  });

  it("confirms once the gesture has been held past the hold window", () => {
    const stabilizer = new GestureStabilizer();
    stabilizer.observe({ gesture: "FIST", confidence: 0.9 }, 0);
    const result = stabilizer.observe({ gesture: "FIST", confidence: 0.9 }, 130);
    expect(result).toEqual({ gesture: "FIST", confidence: 0.9, at: 130 });
  });

  it("does not re-confirm the same gesture while it stays held", () => {
    const stabilizer = new GestureStabilizer();
    stabilizer.observe({ gesture: "FIST", confidence: 0.9 }, 0);
    stabilizer.observe({ gesture: "FIST", confidence: 0.9 }, 130);
    const result = stabilizer.observe({ gesture: "FIST", confidence: 0.9 }, 260);
    expect(result).toBeNull();
  });

  it("never confirms a gesture that is released before the hold window elapses", () => {
    const stabilizer = new GestureStabilizer();
    stabilizer.observe({ gesture: "FIST", confidence: 0.9 }, 0);
    stabilizer.observe(null, 50);
    const result = stabilizer.observe({ gesture: "FIST", confidence: 0.9 }, 80);
    expect(result).toBeNull();
  });

  it("can confirm the same gesture again after it is released and re-held", () => {
    const stabilizer = new GestureStabilizer();
    stabilizer.observe({ gesture: "FIST", confidence: 0.9 }, 0);
    stabilizer.observe({ gesture: "FIST", confidence: 0.9 }, 130);
    stabilizer.observe(null, 300);
    stabilizer.observe({ gesture: "FIST", confidence: 0.9 }, 350);
    const result = stabilizer.observe({ gesture: "FIST", confidence: 0.9 }, 480);
    expect(result).toEqual({ gesture: "FIST", confidence: 0.9, at: 480 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/hand/gestureStability.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the stabilizer**

Create `src/hand/gestureStability.ts`:

```ts
import type { Gesture } from "../game/types";

const HOLD_MS = 120;

type Candidate = { gesture: Gesture; confidence: number } | null;
type Confirmed = { gesture: Gesture; confidence: number; at: number };

export class GestureStabilizer {
  private candidateGesture: Gesture | null = null;
  private candidateSince = 0;
  private firedGesture: Gesture | null = null;

  observe(candidate: Candidate, at: number): Confirmed | null {
    const gesture = candidate?.gesture ?? null;

    if (gesture !== this.candidateGesture) {
      this.candidateGesture = gesture;
      this.candidateSince = at;
    }

    if (gesture === null) {
      this.firedGesture = null;
      return null;
    }

    if (gesture === this.firedGesture) return null;

    if (at - this.candidateSince >= HOLD_MS) {
      this.firedGesture = gesture;
      return { gesture, confidence: candidate!.confidence, at };
    }

    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hand/gestureStability.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/hand/gestureStability.ts src/hand/gestureStability.test.ts
git commit -m "feat: add hold-to-confirm gesture stabilizer"
```

---

### Task 5: MediaPipeGestureSource

**Files:**
- Modify: `package.json` (add dependency)
- Create: `src/hand/MediaPipeGestureSource.ts`

**Interfaces:**
- Consumes: `GestureSource`, `ConfirmedGesture` from `src/hand/GestureSource.ts`; `Landmark`, `PoseResult`, `FistSample`, `classifyPose`, `classifyThrust` from `src/hand/gestureClassifier.ts` (Tasks 1–3); `GestureStabilizer` from `src/hand/gestureStability.ts` (Task 4).
- Produces: `class MediaPipeGestureSource implements GestureSource`, constructed as `new MediaPipeGestureSource(video: HTMLVideoElement, options?: { onFrame?: (hands: Landmark[][], pose: PoseResult | null) => void })`. `WebcamPreview.tsx` (Task 6) constructs and starts/stops this class and uses `onFrame` to drive the skeleton overlay.

This task has no automated tests — it wires a live `HandLandmarker` against a WASM runtime and a real `<video>` element, which cannot be meaningfully exercised outside a browser with a webcam (per the design doc's testing section). It is verified manually in Task 6, once it is wired into the UI.

- [ ] **Step 1: Install the dependency**

Run: `npm install @mediapipe/tasks-vision@1.0.1`
Expected: `package.json` and `package-lock.json` gain the new dependency; command exits 0.

- [ ] **Step 2: Implement the gesture source**

Create `src/hand/MediaPipeGestureSource.ts`:

```ts
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { ConfirmedGesture, GestureSource } from "./GestureSource";
import { classifyPose, classifyThrust, type FistSample, type Landmark, type PoseResult } from "./gestureClassifier";
import { GestureStabilizer } from "./gestureStability";

const WASM_BASE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const FIST_HISTORY_MS = 400;
const FIST_SCALE_A = 0;
const FIST_SCALE_B = 9; // wrist, middle_mcp — same pair gestureClassifier.handScale() uses

type Options = {
  onFrame?: (hands: Landmark[][], pose: PoseResult | null) => void;
};

export class MediaPipeGestureSource implements GestureSource {
  private landmarker: HandLandmarker | null = null;
  private fistHistory: FistSample[] = [];
  private stabilizer = new GestureStabilizer();
  private running = false;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly options: Options = {},
  ) {}

  async start(onGesture: (gesture: ConfirmedGesture) => void): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: 2,
    });

    this.running = true;
    this.video.requestVideoFrameCallback(() => this.tick(onGesture));
  }

  stop(): void {
    this.running = false;
    this.landmarker?.close();
    this.landmarker = null;
    this.fistHistory = [];
  }

  private tick(onGesture: (gesture: ConfirmedGesture) => void): void {
    if (!this.running || !this.landmarker) return;

    const at = Math.round(performance.now());
    const result = this.landmarker.detectForVideo(this.video, at);
    const hands = result.landmarks as Landmark[][];

    const pose = classifyPose(hands);
    this.options.onFrame?.(hands, pose);

    if (pose?.gesture === "FIST") {
      const scale = Math.hypot(
        hands[0][FIST_SCALE_A].x - hands[0][FIST_SCALE_B].x,
        hands[0][FIST_SCALE_A].y - hands[0][FIST_SCALE_B].y,
      );
      this.fistHistory = [...this.fistHistory, { scale, at }].filter(
        (sample) => at - sample.at <= FIST_HISTORY_MS,
      );
    } else {
      this.fistHistory = [];
    }

    const candidate = classifyThrust(this.fistHistory) ? { gesture: "THRUST" as const, confidence: 0.9 } : pose;
    const confirmed = this.stabilizer.observe(candidate, at);
    if (confirmed) {
      onGesture({ playerId: "PLAYER_A", gesture: confirmed.gesture, confidence: confirmed.confidence, at: confirmed.at });
    }

    this.video.requestVideoFrameCallback(() => this.tick(onGesture));
  }
}
```

- [ ] **Step 3: Type-check the project**

Run: `npx tsc -b --noEmit`
Expected: no errors. (This confirms `MediaPipeGestureSource` correctly implements `GestureSource` and all imports resolve — it does not execute the code.)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/hand/MediaPipeGestureSource.ts
git commit -m "feat: add browser MediaPipe gesture source"
```

---

### Task 6: Wire the gesture source into WebcamPreview and App

**Files:**
- Modify: `src/hand/WebcamPreview.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `MediaPipeGestureSource` (Task 5), `Landmark`/`PoseResult` (Tasks 1–3), `Gesture`/`PlayerId` (`src/game/types.ts`).
- Produces: `WebcamPreview` now takes a required `onGesture: (gesture: Gesture, confidence: number) => void` prop. `App.tsx` passes `(gesture) => castGesture("PLAYER_A", gesture)`.

- [ ] **Step 1: Replace WebcamPreview.tsx**

Replace the full contents of `src/hand/WebcamPreview.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import type { Gesture } from "../game/types";
import type { Landmark } from "./gestureClassifier";
import { MediaPipeGestureSource } from "./MediaPipeGestureSource";

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

function drawHands(canvas: HTMLCanvasElement, hands: Landmark[][], label: string | null) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const hand of hands) {
    ctx.strokeStyle = "#4fd1c5";
    ctx.lineWidth = 2;
    for (const [start, end] of HAND_CONNECTIONS) {
      const a = hand[start];
      const b = hand[end];
      ctx.beginPath();
      ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
      ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
      ctx.stroke();
    }
    for (const point of hand) {
      ctx.fillStyle = "#f6e05e";
      ctx.beginPath();
      ctx.arc(point.x * canvas.width, point.y * canvas.height, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (label) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "16px sans-serif";
    ctx.fillText(label, 10, 20);
  }
}

type Status = "idle" | "starting" | "blocked" | "tracking" | "tracking-failed";

export function WebcamPreview({
  onGesture,
}: {
  onGesture: (gesture: Gesture, confidence: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<MediaPipeGestureSource | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    return () => {
      sourceRef.current?.stop();
      const stream = videoRef.current?.srcObject;
      if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const startTracking = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    try {
      const source = new MediaPipeGestureSource(video, {
        onFrame: (hands, pose) => drawHands(canvas, hands, pose?.gesture ?? null),
      });
      sourceRef.current = source;
      await source.start((confirmed) => onGesture(confirmed.gesture, confirmed.confidence));
      setStatus("tracking");
    } catch {
      setStatus("tracking-failed");
    }
  };

  const enableCamera = async () => {
    setStatus("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      await startTracking();
    } catch {
      setStatus("blocked");
    }
  };

  const statusLabel: Record<Status, string> = {
    idle: "Keyboard gestures are active.",
    starting: "Starting camera…",
    tracking: "Hand tracking active.",
    blocked: "Camera blocked — retry.",
    "tracking-failed": "Hand tracking unavailable — using keyboard gestures.",
  };

  return (
    <section className="camera-card">
      <div className="camera-frame">
        <video ref={videoRef} muted playsInline aria-label="Local webcam preview" />
        <canvas ref={canvasRef} width={640} height={480} className="hand-overlay" />
        {status !== "tracking" && (
          <button type="button" onClick={enableCamera} disabled={status === "starting"}>
            {status === "starting" ? "Starting camera…" : status === "blocked" ? "Camera blocked — retry" : "Enable webcam"}
          </button>
        )}
      </div>
      <div>
        <span className={`status-dot ${status}`} />
        {statusLabel[status]}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Wire App.tsx to pass the onGesture handler**

In `src/App.tsx`, change the `<WebcamPreview />` usage (currently `<WebcamPreview />` with no props) to:

```tsx
<WebcamPreview onGesture={(gesture) => castGesture("PLAYER_A", gesture)} />
```

- [ ] **Step 3: Add overlay and status-dot styles**

In `src/styles.css`, add after the existing `.camera-frame video { ... }` rule:

```css
.camera-frame canvas.hand-overlay { position: absolute; inset: 0; width: 100%; height: 100%; transform: scaleX(-1); pointer-events: none; }
```

And after the existing `.status-dot.blocked { ... }` rule:

```css
.status-dot.tracking { background: #60e9a2; box-shadow: 0 0 8px #60e9a2; }
.status-dot.tracking-failed { background: #ff9a4a; }
```

- [ ] **Step 4: Type-check and run the existing test suite**

Run: `npx tsc -b --noEmit && npx vitest run`
Expected: no type errors; all existing tests (including `src/game/engine.test.ts`, `src/hand/gestureClassifier.test.ts`, `src/hand/gestureStability.test.ts`) still pass.

- [ ] **Step 5: Manually verify in the browser**

Run: `npm run dev`, open the printed local URL.

1. Click **Begin POC**, then click **Enable webcam** on the Player A camera card and allow camera access.
2. Confirm the status dot turns green with "Hand tracking active." and a skeleton overlay tracks your hand.
3. Make a fist, then thrust your hand toward the camera — confirm a Firebolt lands on the enemy (HP drops, "Firebolt strikes true!" message).
4. Show an open palm — confirm the shared-link shield activates (`Arcane shield raised.` message) and blocks the next `Simulate enemy attack` click.
5. Point with your index finger — confirm the gesture is reflected (watch the recentGestures-driven message text change, or temporarily add a console.log of confirmed gestures if the effect isn't visually obvious outside Shard Warden).
6. Deny camera permission once (in a fresh browser profile or via site settings) and confirm the card falls back to "Camera blocked — retry." without crashing the page.

This step has no machine-checkable pass/fail condition — record what you observed instead of asserting success blindly, per the project's verification standard.

- [ ] **Step 6: Commit**

```bash
git add src/hand/WebcamPreview.tsx src/App.tsx src/styles.css
git commit -m "feat: drive Player A gestures from webcam hand tracking"
```

---

### Task 7: Update documentation

**Files:**
- Modify: `README.md`
- Modify: `poc/README.md`

**Interfaces:** None — documentation only.

- [ ] **Step 1: Update README.md**

In `README.md`, change:

```md
The initial implementation includes the deterministic three-round combat loop, a React Three Fiber arena, webcam preview, keyboard/debug gesture controls, and integration boundaries for MediaPipe and multiplayer.
```

to:

```md
The initial implementation includes the deterministic three-round combat loop, a React Three Fiber arena, browser MediaPipe hand-gesture recognition for Player A, keyboard/debug gesture controls for Player B, and integration boundaries for multiplayer.
```

- [ ] **Step 2: Update poc/README.md**

In `poc/README.md`, change:

```md
Implemented now: deterministic three-round combat, shared HP, enemy attacks, co-op recipes, a basic R3F arena, webcam preview, tests, and adapter contracts for hand tracking and multiplayer. MediaPipe gesture classification and a cross-device room service are the next integration steps.
```

to:

```md
Implemented now: deterministic three-round combat, shared HP, enemy attacks, co-op recipes, a basic R3F arena, browser MediaPipe hand-gesture recognition for Player A, keyboard-simulated Player B, tests, and adapter contracts for multiplayer. A cross-device room service is the next integration step.
```

- [ ] **Step 3: Commit**

```bash
git add README.md poc/README.md
git commit -m "docs: reflect browser MediaPipe hand tracking as implemented"
```
