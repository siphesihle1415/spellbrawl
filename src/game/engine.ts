import { encounters } from "./config";
import type { GameAction, GameState, Gesture, PlayerId, TimedGesture } from "./types";

const COMBO_WINDOW = 1_500;
const SHIELD_WINDOW = 1_200;
const MEMORY_WINDOW = 2_000;

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

const enterRound = (state: GameState, round: "SHARD_WARDEN" | "HEXWYRM"): GameState => {
  const encounter = encounters[round];
  return {
    ...state,
    round,
    roundNumber: round === "SHARD_WARDEN" ? 2 : 3,
    phase: round === "SHARD_WARDEN" ? "SHIELDED" : "BREATH_ATTACK",
    enemyHp: encounter.hp,
    enemyMaxHp: encounter.hp,
    armorBreaks: 0,
    players: emptyPlayers(),
    recentGestures: [],
    message: round === "SHARD_WARDEN"
      ? "The Warden is shielded: one POINTS while the other casts Firebolt."
      : "The Hexwyrm inhales: both players raise OPEN PALM!",
  };
};

const applyDamage = (state: GameState, damage: number): GameState => {
  const enemyHp = Math.max(0, state.enemyHp - damage);
  if (enemyHp > 0) return { ...state, enemyHp, message: "Firebolt strikes true!" };
  if (state.round === "EMBERMAW") return enterRound(state, "SHARD_WARDEN");
  if (state.round === "SHARD_WARDEN") return enterRound(state, "HEXWYRM");
  return { ...state, enemyHp: 0, status: "VICTORY", message: "STARFALL! The Hexwyrm is undone." };
};

const handleBossGesture = (
  state: GameState,
  playerId: PlayerId,
  gesture: Gesture,
  at: number,
  history: TimedGesture[],
): GameState => {
  if (state.phase === "BREATH_ATTACK") {
    if (gesture === "OPEN_PALM" && hasGesture(history, "OPEN_PALM", at - 1_000, playerId)) {
      return { ...state, phase: "ARMOR_PHASE", recentGestures: [], message: "Co-op barrier! Break the armor with POINT + PINCH." };
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
      ? { ...state, phase: "CORE_PHASE", armorBreaks, recentGestures: [], message: "Core exposed! Strike it with Firebolt." }
      : { ...state, armorBreaks, recentGestures: [], message: "Armor shattered once. Repeat POINT + PINCH!" };
  }

  if (state.phase === "CORE_PHASE" && gesture === "THRUST" && state.players[playerId].fistPrimedUntil >= at) {
    return { ...state, phase: "FUSION_FINISHER", recentGestures: [], message: "Bind the star: A holds FIST, B tears the rift with HANDS APART." };
  }

  if (state.phase === "FUSION_FINISHER") {
    const hasAFist = gesture === "FIST" && playerId === "PLAYER_A"
      ? true
      : hasGesture(history, "FIST", at - 2_000) && history.some((item) => item.playerId === "PLAYER_A" && item.gesture === "FIST");
    const hasBRift = gesture === "HANDS_APART" && playerId === "PLAYER_B"
      ? true
      : history.some((item) => item.playerId === "PLAYER_B" && item.gesture === "HANDS_APART" && item.at >= at - 2_000);
    if (playerId === "PLAYER_A" && gesture === "THRUST" && hasAFist && hasBRift) {
      return applyDamage({ ...state, recentGestures: history }, state.enemyHp);
    }
    return { ...state, recentGestures: history };
  }

  return { ...state, recentGestures: history };
};

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (action.type === "RESET") return initialGameState();
  if (action.type === "START") return { ...initialGameState(), status: "PLAYING", message: "Embermaw attacks! Cast FIST → THRUST." };
  if (state.status !== "PLAYING") return state;

  if (action.type === "ENEMY_ATTACK") {
    const protectedPlayers = Object.values(state.players).filter((player) => player.shieldedUntil >= action.at).length;
    if (protectedPlayers > 0) return { ...state, message: "Arcane shield absorbs the attack." };
    const sharedHp = Math.max(0, state.sharedHp - 1);
    return sharedHp === 0
      ? { ...state, sharedHp, status: "DEFEAT", message: "The link is broken. Regroup and try again." }
      : { ...state, sharedHp, message: "Enemy attack lands! Raise an OPEN PALM to defend." };
  }

  const { playerId, gesture, at } = action;
  const history = remember(state.recentGestures, playerId, gesture, at);
  const player = state.players[playerId];
  const players = {
    ...state.players,
    [playerId]: {
      ...player,
      lastGesture: gesture,
      shieldedUntil: gesture === "OPEN_PALM" ? at + SHIELD_WINDOW : player.shieldedUntil,
      fistPrimedUntil: gesture === "FIST" ? at + COMBO_WINDOW : player.fistPrimedUntil,
    },
  };
  const next = { ...state, players, recentGestures: history };

  if (state.round === "HEXWYRM") return handleBossGesture(next, playerId, gesture, at, history);
  if (gesture === "OPEN_PALM") return { ...next, message: "Arcane shield raised." };

  const firebolt = gesture === "THRUST" && player.fistPrimedUntil >= at;
  if (!firebolt) return next;

  if (state.round === "SHARD_WARDEN" && state.phase === "SHIELDED") {
    if (!hasGesture(history, "POINT", at - COMBO_WINDOW, playerId)) {
      return { ...next, message: "The Firebolt scatters. Another player must POINT first." };
    }
    return { ...next, phase: "ACTIVE", recentGestures: [], message: "Shield broken! The Warden's core is exposed." };
  }

  return applyDamage(next, 1);
}
