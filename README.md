# SpellBrawl

A two-player co-op browser game where players cast spells with hand gestures, coordinate against three enemies, and finish the Hexwyrm with a fusion attack.

## Run the POC

```bash
npm install
npm run dev
```

The initial implementation includes the deterministic three-round combat loop, a React Three Fiber arena, webcam preview, keyboard/debug gesture controls, and integration boundaries for MediaPipe and multiplayer.

Use keys `1`–`6` for Player A and `Shift+1`–`Shift+6` for the simulated Player B. The keys map to `FIST`, `THRUST`, `OPEN_PALM`, `POINT`, `PINCH`, and `HANDS_APART`.

## Commands

```bash
npm test
npm run build
```

See [the POC documentation](poc/README.md) for the scope, architecture, implementation plan, contracts, and validation checklist.
