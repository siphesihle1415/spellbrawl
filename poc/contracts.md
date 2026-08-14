# POC Contracts

## Gesture enum

```ts
type Gesture =
  | "FIST"
  | "OPEN_PALM"
  | "POINT"
  | "PINCH"
  | "HANDS_APART"
  | "THRUST";
```

`THRUST` is a motion gesture. Other gestures are stable poses. A gesture is emitted only after approximately 100–150 ms of temporal stability, with confidence included for local feedback.

## Client-to-room events

```ts
type RoomEvent =
  | { type: "PLAYER_READY"; playerId: string }
  | { type: "GESTURE"; playerId: string; gesture: Gesture; at: number }
  | { type: "AIM"; playerId: string; x: number; y: number }
  | { type: "SPELL_CAST"; playerId: string; spell: "FIREBOLT" | "SHIELD" | "STARFALL"; at: number };
```

Do not transmit webcam frames, raw landmarks, or high-frequency unfiltered observations.

## Encounter state

```ts
type RoundId = "EMBERMAW" | "SHARD_WARDEN" | "HEXWYRM";
type BossPhase = "INTRO" | "BREATH_ATTACK" | "ARMOR_PHASE" | "CORE_PHASE" | "FUSION_FINISHER" | "VICTORY";

type GameState = {
  round: RoundId;
  phase: string;
  players: Record<string, { hp: number; shielded: boolean; connected: boolean }>;
  enemy: { name: string; hp: number; maxHp: number; shielded: boolean; coreExposed: boolean };
  bossPhase?: BossPhase;
  finisherProgress?: { fistHeldBy?: string; handsApartBy?: string };
};
```

## Encounter rules

- Embermaw starts at 3 HP and has no special mechanic.
- Shard Warden requires `POINT` from one player and `FIST → THRUST` from the other within a short timing window while its shield is active.
- Hexwyrm's breath attack requires both players to use `OPEN_PALM` within roughly one second.
- Hexwyrm armor breaks when one player uses `POINT` and the other uses `PINCH`; repeat twice.
- Starfall requires Player A to hold `FIST`, Player B to use `HANDS_APART`, and Player A to use `THRUST`.
- The engine, not the LLM, owns all damage and phase transitions.

## AI encounter configuration

The AI may provide only fixed-vocabulary values: names, titles, elemental themes, weaknesses, gesture recipes, spell names, and clues. The decoder must reject unknown values, missing required rounds, invalid gesture recipes, and unsafe lengths. A static default configuration is used on timeout, parse failure, or validation failure.
