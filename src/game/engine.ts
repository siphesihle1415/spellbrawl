import { encounters } from "./config";
import type { GameAction, GameState, Gesture, PlayerId, TimedGesture } from "./types";

const COMBO_WINDOW = 1_500;
const FIREBOLT_WINDOW = 3_000;
// A raised palm must still be "shielded" when the host's ENEMY_ATTACK resolves. For a remote
// guest, the windup cue arrives after network latency and their palm-raise travels back over
// the same link before the host timestamps it — that round trip eats directly into their
// reaction budget, while the host (zero-latency, same clock) keeps the full window. Sized above
// the longest attack's impact delay (Hexwyrm, 3,120ms — see ATTACK_IMPACT_DELAY_MS in
// game/monsters.ts) so a guest who reacts the instant they see the cue stays covered even on a
// laggy connection, instead of losing the block purely to latency they can't control.
export const SHIELD_WINDOW_MS = 3_500;
const MEMORY_WINDOW = 2_000;
export const DIALOGUE_LINE_COUNT = 3;

const withEffect = (
  state: GameState,
  kind: NonNullable<GameState["effect"]>["kind"],
  playerId?: PlayerId,
): GameState => ({
  ...state,
  effect: { id: (state.effect?.id ?? 0) + 1, kind, playerId },
});

const emptyPlayers = () => ({
  PLAYER_A: { shieldedUntil: 0, fistPrimedUntil: 0 },
  PLAYER_B: { shieldedUntil: 0, fistPrimedUntil: 0 },
});

export const initialGameState = (): GameState => ({
  status: "LOBBY",
  round: "EMBERMAW",
  roundNumber: 1,
  phase: "ACTIVE",
  sharedHp: 5,
  enemyHp: encounters.EMBERMAW.hp,
  enemyMaxHp: encounters.EMBERMAW.hp,
  armorBreaks: 0,
  enemyAttackCount: 0,
  tutorial: false,
  dialogueStep: 0,
  continueReady: { PLAYER_A: false, PLAYER_B: false },
  players: emptyPlayers(),
  recentGestures: [],
  message: "Gather both spellcasters, then begin.",
});

const remember = (
  history: TimedGesture[],
  playerId: PlayerId,
  gesture: Gesture,
  at: number,
) => [...history.filter((item) => at - item.at <= MEMORY_WINDOW), { playerId, gesture, at }];

const hasGesture = (
  history: TimedGesture[],
  gesture: Gesture,
  since: number,
  exceptPlayer?: PlayerId,
) => history.some(
  (item) => item.gesture === gesture && item.at >= since && item.playerId !== exceptPlayer,
);

const enterRound = (state: GameState, round: "EMBERMAW" | "SHARD_WARDEN" | "HEXWYRM", tutorial = false): GameState => {
  const encounter = encounters[round];
  return {
    ...state,
    status: "DIALOGUE",
    round,
    roundNumber: round === "EMBERMAW" ? 1 : round === "SHARD_WARDEN" ? 2 : 3,
    phase: round === "EMBERMAW" ? "ACTIVE" : round === "SHARD_WARDEN" ? "SHIELDED" : "BREATH_ATTACK",
    enemyHp: tutorial ? 2 : encounter.hp,
    enemyMaxHp: tutorial ? 2 : encounter.hp,
    armorBreaks: 0,
    tutorial,
    dialogueStep: 0,
    continueReady: { PLAYER_A: false, PLAYER_B: false },
    players: emptyPlayers(),
    recentGestures: [],
    message: tutorial ? "Practice begins after the introductions." : `${encounter.name} has entered the arena.`,
    effect: { id: (state.effect?.id ?? 0) + 1, kind: "ENEMY_EMERGE" },
  };
};

const applyDamage = (state: GameState, damage: number, playerId?: PlayerId): GameState => {
  const enemyHp = Math.max(0, state.enemyHp - damage);
  if (enemyHp > 0) return withEffect({ ...state, enemyHp, message: "Firebolt strikes true!" }, "FIREBOLT", playerId);
  const finalWords = state.tutorial
    ? "Embermaw: Your bond has teeth. Now face the true hunt."
    : state.round === "EMBERMAW"
      ? "Embermaw: The flame remembers your names…"
      : state.round === "SHARD_WARDEN"
        ? "Shard Warden: The rift will not remain unguarded…"
        : "The Hexwyrm: Even fallen, I echo beyond the veil…";
  return withEffect({ ...state, enemyHp: 0, status: "MONSTER_DEFEATED", message: finalWords }, state.round === "HEXWYRM" ? "STARFALL" : "FIREBOLT", playerId);
};

const handleBossGesture = (
  state: GameState,
  playerId: PlayerId,
  gesture: Gesture,
  at: number,
  history: TimedGesture[],
  firebolt: boolean,
): GameState => {
  if (state.phase === "BREATH_ATTACK") {
    if (gesture === "OPEN_PALM" && hasGesture(history, "OPEN_PALM", at - 1_000, playerId)) {
      return withEffect({ ...state, phase: "ARMOR_PHASE", recentGestures: [], message: "Co-op barrier! Break the armor with POINT + PINCH." }, "BARRIER");
    }
    return { ...state, recentGestures: history, message: "Both palms must rise within one second." };
  }

  if (state.phase === "ARMOR_PHASE") {
    const pairComplete =
      (gesture === "POINT" && hasGesture(history, "PINCH", at - COMBO_WINDOW, playerId)) ||
      (gesture === "PINCH" && hasGesture(history, "POINT", at - COMBO_WINDOW, playerId));
    if (!pairComplete) return { ...state, recentGestures: history };
    const armorBreaks = state.armorBreaks + 1;
    return armorBreaks >= 2
      ? withEffect({ ...state, phase: "CORE_PHASE", armorBreaks, recentGestures: [], message: "Core exposed! Strike it with Firebolt." }, "ARMOR_BREAK", playerId)
      : withEffect({ ...state, armorBreaks, recentGestures: [], message: "Armor shattered once. Repeat POINT + PINCH!" }, "ARMOR_BREAK", playerId);
  }

  if (state.phase === "CORE_PHASE" && firebolt) {
    return { ...state, phase: "FUSION_FINISHER", recentGestures: [], message: "Bind the star: Player 1 holds FIST, Player 2 PINCHES, then Player 1 opens their palm." };
  }

  if (state.phase === "FUSION_FINISHER") {
    const hasAFist = gesture === "FIST" && playerId === "PLAYER_A"
      ? true
      : hasGesture(history, "FIST", at - 2_000) && history.some((item) => item.playerId === "PLAYER_A" && item.gesture === "FIST");
    const hasBRift = gesture === "PINCH" && playerId === "PLAYER_B"
      ? true
      : history.some((item) => item.playerId === "PLAYER_B" && item.gesture === "PINCH" && item.at >= at - 2_000);
    if (playerId === "PLAYER_A" && gesture === "OPEN_PALM" && hasAFist && hasBRift) {
      return applyDamage({ ...state, recentGestures: history }, state.enemyHp, playerId);
    }
    return { ...state, recentGestures: history };
  }

  return { ...state, recentGestures: history };
};

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (action.type === "RESET") return initialGameState();
  if (action.type === "START") return enterRound(initialGameState(), "EMBERMAW", true);
  if (action.type === "SYNC") return action.state;
  if (action.type === "GESTURE_END") {
    return {
      ...state,
      players: {
        ...state.players,
        [action.playerId]: { ...state.players[action.playerId], lastGesture: undefined },
      },
    };
  }
  if (action.type === "SHOW_ROUND_COMPLETE" && state.status === "MONSTER_DEFEATED") {
    return state.round === "HEXWYRM" && !state.tutorial
      ? { ...state, status: "VICTORY", message: "STARFALL! The Hexwyrm is undone. The rift is sealed." }
      : { ...state, status: "ROUND_COMPLETE", continueReady: { PLAYER_A: false, PLAYER_B: false }, message: state.tutorial ? "Practice complete. Both players must choose Continue." : `${encounters[state.round].name} defeated. Choose your path together.` };
  }
  if (action.type === "CONTINUE_READY" && state.status === "ROUND_COMPLETE") {
    const continueReady = { ...state.continueReady, [action.playerId]: true };
    if (!continueReady.PLAYER_A || !continueReady.PLAYER_B) return { ...state, continueReady };
    if (state.tutorial) return enterRound({ ...state, continueReady }, "EMBERMAW");
    if (state.round === "EMBERMAW") return enterRound({ ...state, continueReady }, "SHARD_WARDEN");
    return enterRound({ ...state, continueReady }, "HEXWYRM");
  }
  if (state.status === "DIALOGUE" && action.type === "GESTURE") {
    if (state.dialogueStep + 1 < DIALOGUE_LINE_COUNT) {
      return { ...state, dialogueStep: state.dialogueStep + 1, players: { ...state.players, [action.playerId]: { ...state.players[action.playerId], lastGesture: action.gesture } } };
    }
    return {
      ...state,
      status: "PLAYING",
      dialogueStep: DIALOGUE_LINE_COUNT,
      players: { ...state.players, [action.playerId]: { ...state.players[action.playerId], lastGesture: action.gesture } },
      message: state.tutorial ? "Practice fight begins — your shared health cannot fall." : "The fight begins now!",
    };
  }
  if (state.status !== "PLAYING") return state;

  if (action.type === "ENEMY_ATTACK_WINDUP") {
    return { ...state, enemyAttackCount: state.enemyAttackCount + 1, message: "The enemy winds up an attack! Raise an OPEN PALM to defend." };
  }

  if (action.type === "ENEMY_ATTACK") {
    const protectedPlayers = Object.values(state.players).filter((player) => player.shieldedUntil >= action.at).length;
    if (protectedPlayers > 0) return withEffect({ ...state, message: "Arcane shield absorbs the attack." }, "SHIELD");
    if (state.tutorial) return withEffect({ ...state, message: "Practice ward restored your link. Try OPEN PALM before the next hit." }, "PLAYER_HIT");
    const sharedHp = Math.max(0, state.sharedHp - 1);
    return sharedHp === 0
      ? withEffect({ ...state, sharedHp, status: "DEFEAT", message: "The link is broken. Regroup and try again." }, "PLAYER_HIT")
      : withEffect({ ...state, sharedHp, message: "Enemy attack lands! Raise an OPEN PALM to defend." }, "PLAYER_HIT");
  }

  if (action.type !== "GESTURE") return state;

  const { playerId, gesture, at } = action;
  const history = remember(state.recentGestures, playerId, gesture, at);
  const player = state.players[playerId];
  const firebolt = gesture === "OPEN_PALM" && player.fistPrimedUntil >= at;
  const players = {
    ...state.players,
    [playerId]: {
      ...player,
      lastGesture: gesture,
      shieldedUntil: gesture === "OPEN_PALM" && !firebolt ? at + SHIELD_WINDOW_MS : player.shieldedUntil,
      fistPrimedUntil: gesture === "FIST" ? at + FIREBOLT_WINDOW : firebolt ? 0 : player.fistPrimedUntil,
    },
  };
  const next = { ...state, players, recentGestures: history };

  if (state.round === "HEXWYRM") return handleBossGesture(next, playerId, gesture, at, history, firebolt);

  if (!firebolt) {
    if (gesture === "OPEN_PALM") return withEffect({ ...next, message: "Arcane shield raised." }, "SHIELD", playerId);
    if (gesture === "FIST") return { ...next, message: "Firebolt charged — open your palm to release!" };
    return next;
  }

  if (state.round === "SHARD_WARDEN" && state.phase === "SHIELDED") {
    if (!hasGesture(history, "POINT", at - COMBO_WINDOW, playerId)) {
      return { ...next, message: "The Firebolt scatters. Another player must POINT first." };
    }
    return withEffect({ ...next, phase: "ACTIVE", recentGestures: [], message: "Shield broken! The Warden's core is exposed." }, "ARMOR_BREAK", playerId);
  }

  return applyDamage(next, 1, playerId);
}
