# Game Implementation Plan

The order is optimized to produce a playable fallback early. Each checkpoint should be demoable before moving on.

| Time | Work | Exit checkpoint |
|---|---|---|
| 0–2h | Scaffold React/TypeScript, R3F, MediaPipe, Effect, multiplayer, and Vercel deployment | URL loads a basic Three.js scene |
| 2–5h | Webcam, landmarks, normalized geometry, smoothing, gesture HUD | `FIST`, `OPEN_PALM`, `POINT`, and `THRUST` work in normal lighting |
| 5–8h | Create/join room, two-player identity, event transport, remote gesture display | Device B displays Device A's confirmed gesture |
| 8–11h | Combat reducer, Firebolt, shield, HP, enemy attacks, win/lose, reset | Two players can beat one enemy or lose |
| 11–14h | Reusable encounter state machine and three-round progression | Placeholder visuals transition through all rounds |
| 14–17h | Hexwyrm barrier, armor break, Starfall timing and cinematic state sequence | Two devices can finish the boss together |
| 17–19h | LLM Director, fixed vocabulary, Effect Schema validation, fallback config | Invalid/failed AI output cannot break a run |
| 19–22h | VFX, bloom, particles, camera shake, audio, readable HUD | The critical actions are visually obvious |
| 22–24h | Two-device test, deployment checks, bug fixes, rehearsal | A clean five-minute demo completes end to end |

## Build order inside the game engine

1. Define the shared state and event contracts.
2. Implement Embermaw with placeholder rendering.
3. Add spell-recognition timing and server/client reconciliation.
4. Generalize encounter rules into phases and round definitions.
5. Add Shard Warden coordination.
6. Add Hexwyrm phases and finisher.
7. Attach visuals and audio to state transitions.

## Fallback priorities

If time is lost, preserve this order:

1. One complete multiplayer combat loop.
2. All three rounds with placeholder art.
3. Hexwyrm mechanics and Starfall.
4. Hand-tracking reliability and clear feedback.
5. AI customization.
6. Visual/audio polish.
