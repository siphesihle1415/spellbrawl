import type { GameState } from "./types";

const rebaseDeadline = (deadline: number, sentAt: number, receivedAt: number) =>
  deadline > sentAt ? receivedAt + (deadline - sentAt) : 0;

export function rebaseSyncedState(state: GameState, sentAt: number, receivedAt: number): GameState {
  return {
    ...state,
    players: {
      PLAYER_A: {
        ...state.players.PLAYER_A,
        shieldedUntil: rebaseDeadline(state.players.PLAYER_A.shieldedUntil, sentAt, receivedAt),
        fistPrimedUntil: rebaseDeadline(state.players.PLAYER_A.fistPrimedUntil, sentAt, receivedAt),
      },
      PLAYER_B: {
        ...state.players.PLAYER_B,
        shieldedUntil: rebaseDeadline(state.players.PLAYER_B.shieldedUntil, sentAt, receivedAt),
        fistPrimedUntil: rebaseDeadline(state.players.PLAYER_B.fistPrimedUntil, sentAt, receivedAt),
      },
    },
    recentGestures: state.recentGestures.map((gesture) => ({
      ...gesture,
      at: receivedAt + (gesture.at - sentAt),
    })),
  };
}
