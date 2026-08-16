import { describe, expect, it } from "vitest";
import { initialGameState } from "./engine";
import { liveRoundDisplay, resolveRoundReveal, ROUND_NUMBER } from "./roundReveal";
import type { GameState } from "./types";

const playing = (round: GameState["round"], overrides: Partial<GameState> = {}): GameState => ({
  ...initialGameState(),
  status: "PLAYING",
  round,
  roundNumber: ROUND_NUMBER[round],
  ...overrides,
});

describe("liveRoundDisplay", () => {
  it("mirrors the live state 1:1", () => {
    const state = playing("SHARD_WARDEN", { enemyHp: 3, enemyMaxHp: 5, phase: "ACTIVE", message: "hi" });
    expect(liveRoundDisplay(state)).toEqual({
      round: "SHARD_WARDEN",
      roundNumber: 2,
      status: "PLAYING",
      enemyHp: 3,
      enemyMaxHp: 5,
      phase: "ACTIVE",
      message: "hi",
    });
  });
});

describe("resolveRoundReveal", () => {
  it("returns null when neither round nor status changed", () => {
    const state = playing("EMBERMAW");
    expect(resolveRoundReveal(state, state)).toBeNull();
  });

  it("holds the defeated round's info, with HP forced to 0, when the round advances", () => {
    const previous = playing("EMBERMAW", { enemyHp: 1, enemyMaxHp: 4, phase: "ACTIVE", message: "Firebolt strikes true!" });
    const next = playing("SHARD_WARDEN", { enemyHp: 5, enemyMaxHp: 5, phase: "SHIELDED", message: "The Warden is shielded: one POINTS while the other casts Firebolt." });

    const reveal = resolveRoundReveal(previous, next);

    expect(reveal).not.toBeNull();
    expect(reveal!.holdMs).toBe(2500);
    expect(reveal!.frozen).toEqual({
      round: "EMBERMAW",
      roundNumber: 1,
      status: "PLAYING",
      enemyHp: 0,
      enemyMaxHp: 4,
      phase: "ACTIVE",
      message: "Firebolt strikes true!",
    });
  });

  it("holds Shard Warden's info for its (longer) duration when advancing to Hexwyrm", () => {
    const previous = playing("SHARD_WARDEN", { enemyHp: 1, enemyMaxHp: 6 });
    const next = playing("HEXWYRM", { enemyHp: 8, enemyMaxHp: 8 });

    const reveal = resolveRoundReveal(previous, next);

    expect(reveal).not.toBeNull();
    expect(reveal!.holdMs).toBe(5500);
    expect(reveal!.frozen.round).toBe("SHARD_WARDEN");
    expect(reveal!.frozen.enemyHp).toBe(0);
  });

  it("holds Hexwyrm's info when status enters VICTORY, even though its round never changes", () => {
    const previous = playing("HEXWYRM", { enemyHp: 1, enemyMaxHp: 6, phase: "FUSION_FINISHER", message: "Bind the star: ..." });
    const next: GameState = { ...previous, status: "VICTORY", enemyHp: 0, message: "STARFALL! The Hexwyrm is undone." };

    const reveal = resolveRoundReveal(previous, next);

    expect(reveal).not.toBeNull();
    expect(reveal!.holdMs).toBe(4000);
    expect(reveal!.frozen.status).toBe("PLAYING");
    expect(reveal!.frozen.round).toBe("HEXWYRM");
    expect(reveal!.frozen.enemyHp).toBe(0);
  });

  it("does not hold a DEFEAT — players losing isn't a boss dying", () => {
    const previous = playing("SHARD_WARDEN", { sharedHp: 1 });
    const next: GameState = { ...previous, status: "DEFEAT", sharedHp: 0 };

    expect(resolveRoundReveal(previous, next)).toBeNull();
  });

  it("does not hold a RESET out of Hexwyrm back to the lobby", () => {
    const previous = playing("HEXWYRM", { status: "DEFEAT" });
    const next = initialGameState();

    expect(resolveRoundReveal(previous, next)).toBeNull();
  });
});
