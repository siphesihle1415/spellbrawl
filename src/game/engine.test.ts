import { describe, expect, it } from "vitest";
import { gameReducer, initialGameState } from "./engine";

const started = () => gameReducer(initialGameState(), { type: "START" });

describe("gameReducer", () => {
  it("casts Firebolt after FIST then OPEN_PALM", () => {
    const primed = gameReducer(started(), { type: "GESTURE", playerId: "PLAYER_A", gesture: "FIST", at: 100 });
    expect(primed.message).toContain("Firebolt charged");
    const hit = gameReducer(primed, { type: "GESTURE", playerId: "PLAYER_A", gesture: "OPEN_PALM", at: 2_900 });
    expect(hit.enemyHp).toBe(2);
    expect(hit.effect?.kind).toBe("FIREBOLT");
    expect(hit.players.PLAYER_A.shieldedUntil).toBe(0);
    expect(hit.players.PLAYER_A.fistPrimedUntil).toBe(0);

    const shielded = gameReducer(hit, { type: "GESTURE", playerId: "PLAYER_A", gesture: "OPEN_PALM", at: 3_000 });
    expect(shielded.effect?.kind).toBe("SHIELD");
  });

  it("blocks an enemy attack with an open palm", () => {
    const shielded = gameReducer(started(), { type: "GESTURE", playerId: "PLAYER_A", gesture: "OPEN_PALM", at: 100 });
    const blocked = gameReducer(shielded, { type: "ENEMY_ATTACK", at: 500 });
    expect(blocked.sharedHp).toBe(5);
  });

  it("counts every enemy attack windup, and resolves damage separately on impact", () => {
    const shielded = gameReducer(started(), { type: "GESTURE", playerId: "PLAYER_A", gesture: "OPEN_PALM", at: 100 });
    const windedUp = gameReducer(shielded, { type: "ENEMY_ATTACK_WINDUP", at: 400 });
    expect(windedUp.enemyAttackCount).toBe(1);
    const blocked = gameReducer(windedUp, { type: "ENEMY_ATTACK", at: 500 });
    expect(blocked.enemyAttackCount).toBe(1);
    expect(blocked.sharedHp).toBe(5);

    const landed = gameReducer(gameReducer(started(), { type: "ENEMY_ATTACK_WINDUP", at: 400 }), { type: "ENEMY_ATTACK", at: 500 });
    expect(landed.enemyAttackCount).toBe(1);
    expect(landed.sharedHp).toBe(4);
  });

  it("requires a second player to point before breaking the Warden shield", () => {
    let state = started();
    for (let index = 0; index < 3; index += 1) {
      const at = index * 2_000;
      state = gameReducer(state, { type: "GESTURE", playerId: "PLAYER_A", gesture: "FIST", at });
      state = gameReducer(state, { type: "GESTURE", playerId: "PLAYER_A", gesture: "OPEN_PALM", at: at + 200 });
    }
    expect(state.round).toBe("SHARD_WARDEN");
    state = gameReducer(state, { type: "GESTURE", playerId: "PLAYER_B", gesture: "POINT", at: 7_000 });
    state = gameReducer(state, { type: "GESTURE", playerId: "PLAYER_A", gesture: "FIST", at: 7_100 });
    state = gameReducer(state, { type: "GESTURE", playerId: "PLAYER_A", gesture: "OPEN_PALM", at: 7_200 });
    expect(state.phase).toBe("ACTIVE");
  });

  it("completes the Hexwyrm co-op sequence", () => {
    let state = started();
    let at = 100;
    const gesture = (playerId: "PLAYER_A" | "PLAYER_B", value: "FIST" | "OPEN_PALM" | "POINT" | "PINCH") => {
      state = gameReducer(state, { type: "GESTURE", playerId, gesture: value, at });
      at += 100;
    };

    for (let hit = 0; hit < 3; hit += 1) { gesture("PLAYER_A", "FIST"); gesture("PLAYER_A", "OPEN_PALM"); }
    gesture("PLAYER_B", "POINT"); gesture("PLAYER_A", "FIST"); gesture("PLAYER_A", "OPEN_PALM");
    for (let hit = 0; hit < 4; hit += 1) { gesture("PLAYER_A", "FIST"); gesture("PLAYER_A", "OPEN_PALM"); }
    expect(state.round).toBe("HEXWYRM");

    gesture("PLAYER_A", "OPEN_PALM"); gesture("PLAYER_B", "OPEN_PALM");
    gesture("PLAYER_A", "POINT"); gesture("PLAYER_B", "PINCH");
    gesture("PLAYER_A", "POINT"); gesture("PLAYER_B", "PINCH");
    gesture("PLAYER_A", "FIST"); gesture("PLAYER_A", "OPEN_PALM");
    gesture("PLAYER_A", "FIST"); gesture("PLAYER_B", "PINCH"); gesture("PLAYER_A", "OPEN_PALM");

    expect(state.status).toBe("VICTORY");
    expect(state.enemyHp).toBe(0);
  });

  it("emits presentation effects for hits, shields, and projectiles", () => {
    let state = started();
    state = gameReducer(state, { type: "GESTURE", playerId: "PLAYER_A", gesture: "OPEN_PALM", at: 100 });
    expect(state.effect?.kind).toBe("SHIELD");
    state = gameReducer(state, { type: "ENEMY_ATTACK", at: 4_000 });
    expect(state.effect?.kind).toBe("PLAYER_HIT");
    state = gameReducer(state, { type: "GESTURE", playerId: "PLAYER_A", gesture: "FIST", at: 4_100 });
    state = gameReducer(state, { type: "GESTURE", playerId: "PLAYER_A", gesture: "OPEN_PALM", at: 4_200 });
    expect(state.effect).toMatchObject({ kind: "FIREBOLT", playerId: "PLAYER_A" });
  });

  it("clears a player's displayed gesture without changing their combat windows", () => {
    const gesturing = gameReducer(started(), { type: "GESTURE", playerId: "PLAYER_A", gesture: "FIST", at: 100 });
    const cleared = gameReducer(gesturing, { type: "GESTURE_END", playerId: "PLAYER_A" });

    expect(cleared.players.PLAYER_A.lastGesture).toBeUndefined();
    expect(cleared.players.PLAYER_A.fistPrimedUntil).toBe(3_100);
  });

  it("adopts a synced state verbatim", () => {
    const remoteState = { ...started(), enemyHp: 1, message: "Remote update" };
    const result = gameReducer(initialGameState(), { type: "SYNC", state: remoteState });
    expect(result).toEqual(remoteState);
  });
});
