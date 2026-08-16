# Game Validation and Demo Checklist

## Functional checks

- [ ] Production URL loads on two separate devices.
- [ ] Player can create a room and receive a short room code.
- [ ] Second player can join and both identities are visible.
- [ ] Webcam permission denial produces a clear fallback message.
- [ ] `FIST`, `OPEN_PALM`, `POINT`, and `PINCH` show stable local feedback.
- [ ] A confirmed `FIST → OPEN_PALM` casts Firebolt exactly once.
- [ ] `OPEN_PALM` blocks the enemy attack while active.
- [ ] Player HP, enemy HP, damage, defeat, victory, and reset converge on both clients.
- [ ] Shard Warden shield break requires the two-player coordination window.
- [ ] Hexwyrm barrier, armor break, and Starfall work across devices.
- [ ] Disconnection or stale events do not soft-lock the encounter.

## AI boundary checks

- [ ] Valid generated configuration renders names and clues.
- [ ] Invalid JSON falls back to defaults.
- [ ] Unknown names/gestures/themes are rejected by the schema.
- [ ] AI timeout does not delay entering the playable run.
- [ ] Mechanics remain identical with AI disabled.

## Performance and usability checks

- [ ] Gesture feedback remains understandable in poor-but-usable lighting.
- [ ] The UI distinguishes local gesture, remote gesture, and confirmed spell.
- [ ] The camera and VFX do not hide the boss phase or HP state.
- [ ] The game remains responsive during particles and the finisher sequence.
- [ ] The demo can be completed in five minutes after both players join.

## Rehearsal script

1. Open the deployed URL on two laptops and create/join a room.
2. Confirm remote gesture display with `FIST`.
3. Beat Embermaw using Firebolt and shields.
4. Coordinate Shard Warden shield break, then defeat it.
5. Block Hexwyrm's breath together.
6. Perform two armor breaks.
7. Player 1 holds `FIST`, Player 2 uses `PINCH`, then Player 1 raises `OPEN_PALM` to trigger Starfall.
8. If AI or webcam tracking fails, use the default encounter config and the documented gesture fallback/debug controls.
