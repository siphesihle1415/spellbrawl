import { describe, expect, it } from "vitest";
import { gameReducer, initialGameState } from "../game/engine";
import { tookNonFatalHit } from "./monsterReaction";

const at = (status: "LOBBY" | "DIALOGUE" | "PLAYING", enemyHp: number, round: "EMBERMAW" | "SHARD_WARDEN" = "EMBERMAW") => ({ status, round, enemyHp } as const);

describe("tookNonFatalHit", () => {
  it("reacts to a spell landing mid-fight", () => {
    expect(tookNonFatalHit(at("PLAYING", 3), at("PLAYING", 2), "EMBERMAW")).toBe(true);
  });

  it("stays quiet when the tutorial fight starts below the lobby's hp", () => {
    const lobby = initialGameState();
    const started = gameReducer(lobby, { type: "START" });
    expect(started.enemyHp).toBeLessThan(lobby.enemyHp);
    expect(tookNonFatalHit(lobby, started, "EMBERMAW")).toBe(false);
  });

  it("leaves the killing blow to the defeat clip", () => {
    expect(tookNonFatalHit(at("PLAYING", 1), at("PLAYING", 0), "EMBERMAW")).toBe(false);
  });

  it("ignores hp belonging to another round's monster", () => {
    expect(tookNonFatalHit(at("PLAYING", 3), at("PLAYING", 2, "SHARD_WARDEN"), "EMBERMAW")).toBe(false);
  });
});
