import { describe, expect, it } from "vitest";
import { initialGameState } from "./engine";
import { rebaseSyncedState } from "./syncClock";

describe("rebaseSyncedState", () => {
  it("preserves remaining spell durations across unrelated browser clocks", () => {
    const state = initialGameState();
    state.players.PLAYER_A.shieldedUntil = 11_200;
    state.players.PLAYER_A.fistPrimedUntil = 12_500;
    state.players.PLAYER_B.shieldedUntil = 9_500;
    state.recentGestures = [{ playerId: "PLAYER_A", gesture: "OPEN_PALM", at: 9_800 }];

    const rebased = rebaseSyncedState(state, 10_000, 850);

    expect(rebased.players.PLAYER_A.shieldedUntil).toBe(2_050);
    expect(rebased.players.PLAYER_A.fistPrimedUntil).toBe(3_350);
    expect(rebased.players.PLAYER_B.shieldedUntil).toBe(0);
    expect(rebased.recentGestures[0].at).toBe(650);
  });
});
