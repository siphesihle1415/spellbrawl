# SpellBrawl

This directory defines the smallest playable proof of concept for SpellBrawl.

The game is built around four things:

1. A player can use webcam hand gestures to cast spells.
2. Two devices can join one room and exchange semantic game events.
3. A deterministic combat engine can run the three-round encounter.
4. A validated LLM-generated run configuration can change names, themes, and clues without owning game mechanics.

## Documents

- [Scope](scope.md) — what is in and out of the game.
- [Architecture](architecture.md) — runtime boundaries and data flow.
- [Implementation plan](plan.md) — time-boxed build sequence and checkpoints.
- [Contracts](contracts.md) — shared events, state, gestures, and encounter configuration.
- [Validation](validation.md) — acceptance checks, demo rehearsal, and fallback behavior.

## Success condition

Two people on separate devices can create and join a room, use `FIST → OPEN_PALM` to cast Firebolt, use `OPEN_PALM` to defend, complete Embermaw and Shard Warden, perform the Hexwyrm co-op mechanics, and finish with Starfall.

## Current implementation

The initial local vertical slice is available at the repository root.

```bash
npm install
npm run dev
```

Click **Start**, then enable the camera to cast with hand tracking. Keyboard shortcuts `1`–`4` remain available for local testing and map to `FIST`, `OPEN_PALM`, `POINT`, and `PINCH` in that order.

Implemented now: deterministic three-round combat, shared HP, enemy attacks, co-op recipes, a basic R3F arena, MediaPipe hand landmarks, normalized gesture geometry, temporal confirmation, keyboard fallback controls, tests, and a multiplayer adapter contract. Cross-device room transport is the next integration step.
