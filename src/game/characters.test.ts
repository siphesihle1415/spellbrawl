import { describe, expect, it } from "vitest";
import { bothPicked, takenBy } from "./characters";

describe("takenBy", () => {
  it("returns undefined when no player has picked the character", () => {
    expect(takenBy({}, "ARCANE_SENTINEL")).toBeUndefined();
  });

  it("returns the player id that picked the character", () => {
    expect(takenBy({ PLAYER_A: "ARCANE_SENTINEL" }, "ARCANE_SENTINEL")).toBe("PLAYER_A");
  });

  it("does not match a different character", () => {
    expect(takenBy({ PLAYER_A: "ARCANE_SENTINEL" }, "STORMFORGED_VANGUARD")).toBeUndefined();
  });
});

describe("bothPicked", () => {
  it("is false when no one has picked", () => {
    expect(bothPicked({})).toBe(false);
  });

  it("is false when only one player has picked", () => {
    expect(bothPicked({ PLAYER_A: "ARCANE_SENTINEL" })).toBe(false);
  });

  it("is true when both players have picked", () => {
    expect(bothPicked({ PLAYER_A: "ARCANE_SENTINEL", PLAYER_B: "STORMFORGED_VANGUARD" })).toBe(true);
  });

  it("is true even when both players pick the same character", () => {
    expect(bothPicked({ PLAYER_A: "ARCANE_SENTINEL", PLAYER_B: "ARCANE_SENTINEL" })).toBe(true);
  });
});
