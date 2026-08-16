# Game Scope

## In scope

- React + TypeScript browser client.
- React Three Fiber / Three.js arena with placeholder-first visuals.
- Webcam hand tracking through MediaPipe.
- Reliable gesture recognition for `FIST`, `OPEN_PALM`, `POINT`, and `PINCH`.
- Exactly two players per room.
- Room creation and room-code joining.
- Semantic multiplayer events only; never webcam video or per-frame landmarks.
- Shared player HP, enemy HP, attacks, shields, round transitions, victory, and game over.
- Three encounters:
  - Embermaw: basic attack and shield tutorial.
  - Shard Warden: coordinated shield break.
  - Hexwyrm: barrier, armor break, and Starfall finisher.
- LLM-generated encounter names, titles, themes, spell names, and clues.
- Effect Schema validation at the AI boundary.
- Vercel deployment and two-device testing.

## Out of scope

- More than two players.
- Free-form spell creation or LLM-controlled mechanics.
- Streaming webcam video or raw hand landmarks to the server.
- Persistent accounts, matchmaking, chat, replays, or progression outside one run.
- Production-grade anti-cheat, analytics, accessibility certification, or mobile optimization.
- A large asset pipeline. Placeholder geometry and synthesized/basic audio are acceptable.

## Fixed gameplay vocabulary

| Spell | Recipe | Effect |
|---|---|---|
| Firebolt | `FIST → OPEN_PALM` | Damages an exposed enemy |
| Arcane Shield | `OPEN_PALM` | Blocks incoming damage |
| Starfall | Player A holds `FIST`; Player B uses `PINCH`; Player A uses `OPEN_PALM` | Ends the Hexwyrm encounter |
