# SpellBrawl POC

This directory defines the smallest playable proof of concept for SpellBrawl.

The POC proves four things:

1. A player can use webcam hand gestures to cast spells.
2. Two devices can join one room and exchange semantic game events.
3. A deterministic combat engine can run the three-round encounter.
4. A validated LLM-generated run configuration can change names, themes, and clues without owning game mechanics.

## Documents

- [Scope](scope.md) — what is in and out of the POC.
- [Architecture](architecture.md) — runtime boundaries and data flow.
- [Implementation plan](plan.md) — time-boxed build sequence and checkpoints.
- [Contracts](contracts.md) — shared events, state, gestures, and encounter configuration.
- [Validation](validation.md) — acceptance checks, demo rehearsal, and fallback behavior.

## POC success condition

Two people on separate devices can create and join a room, use `FIST → THRUST` to cast Firebolt, use `OPEN_PALM` to defend, complete Embermaw and Shard Warden, perform the Hexwyrm co-op mechanics, and finish with Starfall.

## Current implementation

The initial local vertical slice is available at the repository root.

```bash
npm install
npm run dev
```

Click **Begin POC**, then use the gesture buttons. Keyboard shortcuts `1`–`6` control Player A and `Shift+1`–`Shift+6` control the simulated Player B. The controls map to `FIST`, `THRUST`, `OPEN_PALM`, `POINT`, `PINCH`, and `HANDS_APART` in that order.

Implemented now: deterministic three-round combat, shared HP, enemy attacks, co-op recipes, a basic R3F arena, browser MediaPipe hand-gesture recognition for Player A, keyboard-simulated Player B, tests, and adapter contracts for multiplayer. A cross-device room service is the next integration step.
