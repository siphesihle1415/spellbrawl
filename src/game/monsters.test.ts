import { describe, expect, it } from "vitest";
import { DEFEAT_HOLD_MS, EMBERMAW_ANIMATION_URLS, HEXWYRM_ANIMATION_URLS, HEXWYRM_VICTORY_HOLD_MS, SHARD_WARDEN_ANIMATION_URLS } from "./monsters";

describe("EMBERMAW_ANIMATION_URLS", () => {
  it("points at the four compressed animation clips under public/models/monsters", () => {
    expect(EMBERMAW_ANIMATION_URLS).toEqual({
      walking: "/models/monsters/embermaw-walking.glb",
      zombieScream: "/models/monsters/embermaw-zombie-scream.glb",
      jumpingPunch: "/models/monsters/embermaw-jumping-punch.glb",
      fallingDown: "/models/monsters/embermaw-falling-down.glb",
    });
  });
});

describe("SHARD_WARDEN_ANIMATION_URLS", () => {
  it("points at the four compressed animation clips under public/models/monsters", () => {
    expect(SHARD_WARDEN_ANIMATION_URLS).toEqual({
      walking: "/models/monsters/shard-warden-walking.glb",
      skill03: "/models/monsters/shard-warden-skill-03.glb",
      tripleComboAttack: "/models/monsters/shard-warden-triple-combo-attack.glb",
      shotInTheBackAndFall: "/models/monsters/shard-warden-shot-in-the-back-and-fall.glb",
    });
  });
});

describe("HEXWYRM_ANIMATION_URLS", () => {
  it("points at the four compressed animation clips under public/models/monsters", () => {
    expect(HEXWYRM_ANIMATION_URLS).toEqual({
      walking: "/models/monsters/hexwyrm-walking.glb",
      zombieScream: "/models/monsters/hexwyrm-zombie-scream.glb",
      crouchChargeAndThrow: "/models/monsters/hexwyrm-crouch-charge-and-throw.glb",
      shotAndFallBackward: "/models/monsters/hexwyrm-shot-and-fall-backward.glb",
    });
  });
});

describe("DEFEAT_HOLD_MS", () => {
  it("holds Embermaw and Shard Warden's defeat before revealing the next round", () => {
    expect(DEFEAT_HOLD_MS.EMBERMAW).toBe(2500);
    expect(DEFEAT_HOLD_MS.SHARD_WARDEN).toBe(5500);
  });

  it("has no entry for Hexwyrm — it has no next round to reveal", () => {
    expect(DEFEAT_HOLD_MS.HEXWYRM).toBeUndefined();
  });
});

describe("HEXWYRM_VICTORY_HOLD_MS", () => {
  it("is a positive duration", () => {
    expect(HEXWYRM_VICTORY_HOLD_MS).toBeGreaterThan(0);
  });
});
