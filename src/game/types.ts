export type PlayerId = "PLAYER_A" | "PLAYER_B";

export type Gesture =
  | "FIST"
  | "OPEN_PALM"
  | "POINT"
  | "PINCH"
  | "HANDS_APART";

export type RoundId = "EMBERMAW" | "SHARD_WARDEN" | "HEXWYRM";

export type Phase =
  | "ACTIVE"
  | "SHIELDED"
  | "BREATH_ATTACK"
  | "ARMOR_PHASE"
  | "CORE_PHASE"
  | "FUSION_FINISHER";

export type GameStatus = "LOBBY" | "PLAYING" | "VICTORY" | "DEFEAT";

export type TimedGesture = {
  playerId: PlayerId;
  gesture: Gesture;
  at: number;
};

export type PlayerState = {
  lastGesture?: Gesture;
  shieldedUntil: number;
  fistPrimedUntil: number;
};

export type GameState = {
  status: GameStatus;
  round: RoundId;
  roundNumber: number;
  phase: Phase;
  sharedHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  armorBreaks: number;
  enemyAttackCount: number;
  players: Record<PlayerId, PlayerState>;
  recentGestures: TimedGesture[];
  message: string;
};

export type GameAction =
  | { type: "START" }
  | { type: "RESET" }
  | { type: "SYNC"; state: GameState }
  | { type: "GESTURE"; playerId: PlayerId; gesture: Gesture; at: number }
  | { type: "ENEMY_ATTACK_WINDUP"; at: number }
  | { type: "ENEMY_ATTACK"; at: number };
