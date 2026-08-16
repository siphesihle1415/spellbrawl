import { describe, expect, it } from "vitest";
import { playerCameraX } from "./playerCamera";

describe("playerCameraX", () => {
  it("places Player 1 left and Player 2 right of the same stage", () => {
    expect(playerCameraX(0, "PLAYER_A", false)).toBeLessThan(0);
    expect(playerCameraX(0, "PLAYER_B", false)).toBeGreaterThan(0);
    expect(playerCameraX(1.4, "PLAYER_A", false)).toBeCloseTo(0.98);
    expect(playerCameraX(1.4, "PLAYER_B", false)).toBeCloseTo(1.82);
    expect(playerCameraX(0, "PLAYER_B", false) - playerCameraX(0, "PLAYER_A", false)).toBeLessThan(1);
  });

  it("keeps scene preview centered", () => {
    expect(playerCameraX(-1.4, "PLAYER_A", true)).toBe(-1.4);
  });
});
