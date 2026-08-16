import { describe, expect, it } from "vitest";
import { encounters } from "./config";
import { DIALOGUE_LINE_COUNT, gameReducer, initialGameState } from "./engine";
import type { GameState, RoundId } from "./types";

const fighting = (round: RoundId = "EMBERMAW", extra: Partial<GameState> = {}): GameState => ({
  ...initialGameState(),
  status: "PLAYING",
  round,
  roundNumber: round === "EMBERMAW" ? 1 : round === "SHARD_WARDEN" ? 2 : 3,
  phase: round === "SHARD_WARDEN" ? "SHIELDED" : round === "HEXWYRM" ? "BREATH_ATTACK" : "ACTIVE",
  enemyHp: encounters[round].hp,
  enemyMaxHp: encounters[round].hp,
  ...extra,
});

describe("gameReducer", () => {
  it("starts with a protected tutorial and lets either player's gestures finish dialogue", () => {
    let state = gameReducer(initialGameState(), { type: "START" });
    expect(state).toMatchObject({ status: "DIALOGUE", tutorial: true, round: "EMBERMAW", dialogueStep: 0 });
    for (let index = 0; index < DIALOGUE_LINE_COUNT; index += 1) {
      state = gameReducer(state, { type: "GESTURE", playerId: index % 2 ? "PLAYER_B" : "PLAYER_A", gesture: "POINT", at: index * 100 });
    }
    expect(state.status).toBe("PLAYING");
    expect(state.message).toContain("Practice fight begins");
  });

  it("casts Firebolt after FIST then OPEN_PALM without accidentally shielding", () => {
    const primed = gameReducer(fighting(), { type: "GESTURE", playerId: "PLAYER_A", gesture: "FIST", at: 100 });
    const hit = gameReducer(primed, { type: "GESTURE", playerId: "PLAYER_A", gesture: "OPEN_PALM", at: 2_900 });
    expect(hit.enemyHp).toBe(2);
    expect(hit.effect?.kind).toBe("FIREBOLT");
    expect(hit.players.PLAYER_A).toMatchObject({ shieldedUntil: 0, fistPrimedUntil: 0 });
  });

  it("blocks an enemy attack with an open palm", () => {
    const shielded = gameReducer(fighting(), { type: "GESTURE", playerId: "PLAYER_A", gesture: "OPEN_PALM", at: 100 });
    const blocked = gameReducer(shielded, { type: "ENEMY_ATTACK", at: 500 });
    expect(blocked.sharedHp).toBe(5);
    expect(blocked.effect?.kind).toBe("SHIELD");
  });

  it("prevents tutorial attacks from killing the players", () => {
    const state = gameReducer(fighting("EMBERMAW", { tutorial: true, sharedHp: 1 }), { type: "ENEMY_ATTACK", at: 500 });
    expect(state.sharedHp).toBe(1);
    expect(state.status).toBe("PLAYING");
  });

  it("holds on final words, reveals completion, and advances only after both votes", () => {
    let state = fighting("EMBERMAW", { tutorial: true, enemyHp: 1 });
    state = gameReducer(state, { type: "GESTURE", playerId: "PLAYER_A", gesture: "FIST", at: 100 });
    state = gameReducer(state, { type: "GESTURE", playerId: "PLAYER_A", gesture: "OPEN_PALM", at: 200 });
    expect(state.status).toBe("MONSTER_DEFEATED");
    state = gameReducer(state, { type: "SHOW_ROUND_COMPLETE" });
    expect(state.status).toBe("ROUND_COMPLETE");
    state = gameReducer(state, { type: "CONTINUE_READY", playerId: "PLAYER_A" });
    expect(state.status).toBe("ROUND_COMPLETE");
    state = gameReducer(state, { type: "CONTINUE_READY", playerId: "PLAYER_B" });
    expect(state).toMatchObject({ status: "DIALOGUE", tutorial: false, round: "EMBERMAW" });
  });

  it("requires a second player to point before breaking the Warden shield", () => {
    let state = fighting("SHARD_WARDEN");
    state = gameReducer(state, { type: "GESTURE", playerId: "PLAYER_B", gesture: "POINT", at: 100 });
    state = gameReducer(state, { type: "GESTURE", playerId: "PLAYER_A", gesture: "FIST", at: 200 });
    state = gameReducer(state, { type: "GESTURE", playerId: "PLAYER_A", gesture: "OPEN_PALM", at: 300 });
    expect(state.phase).toBe("ACTIVE");
    expect(state.effect?.kind).toBe("ARMOR_BREAK");
  });

  it("completes the Hexwyrm co-op sequence and holds its defeat animation", () => {
    let state = fighting("HEXWYRM");
    let at = 100;
    const gesture = (playerId: "PLAYER_A" | "PLAYER_B", value: "FIST" | "OPEN_PALM" | "POINT" | "PINCH") => {
      state = gameReducer(state, { type: "GESTURE", playerId, gesture: value, at });
      at += 100;
    };
    gesture("PLAYER_A", "OPEN_PALM"); gesture("PLAYER_B", "OPEN_PALM");
    gesture("PLAYER_A", "POINT"); gesture("PLAYER_B", "PINCH");
    gesture("PLAYER_A", "POINT"); gesture("PLAYER_B", "PINCH");
    gesture("PLAYER_A", "FIST"); gesture("PLAYER_A", "OPEN_PALM");
    gesture("PLAYER_A", "FIST"); gesture("PLAYER_B", "PINCH"); gesture("PLAYER_A", "OPEN_PALM");
    expect(state.status).toBe("MONSTER_DEFEATED");
    expect(state.effect?.kind).toBe("STARFALL");
    expect(gameReducer(state, { type: "SHOW_ROUND_COMPLETE" }).status).toBe("VICTORY");
  });

  it("clears a displayed gesture without changing combat windows", () => {
    const gesturing = gameReducer(fighting(), { type: "GESTURE", playerId: "PLAYER_A", gesture: "FIST", at: 100 });
    const cleared = gameReducer(gesturing, { type: "GESTURE_END", playerId: "PLAYER_A" });
    expect(cleared.players.PLAYER_A.lastGesture).toBeUndefined();
    expect(cleared.players.PLAYER_A.fistPrimedUntil).toBe(3_100);
  });
});
