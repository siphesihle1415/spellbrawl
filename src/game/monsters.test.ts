import { describe, expect, it } from "vitest";
import { ACTIVE_MONSTER_VARIANT, DEFEAT_HOLD_MS, EMBERMAW_ANIMATION_URLS, HEXWYRM_ANIMATION_URLS, HEXWYRM_VICTORY_HOLD_MS, MONSTER_VARIANTS, SHARD_WARDEN_ANIMATION_URLS, activeMonsterModelUrl, resolveVariant } from "./monsters";

describe("resolveVariant", () => {
  const variants = [
    { id: "x", modelUrl: "/x.glb" },
    { id: "y", modelUrl: "/y.glb" },
  ];

  it("returns the variant matching activeId", () => {
    expect(resolveVariant(variants, "y")).toEqual({ id: "y", modelUrl: "/y.glb" });
  });

  it("falls back to the first variant when activeId doesn't match any", () => {
    expect(resolveVariant(variants, "does-not-exist")).toEqual({ id: "x", modelUrl: "/x.glb" });
  });
});

describe("activeMonsterModelUrl", () => {
  it("resolves the active variant for every round from MONSTER_VARIANTS/ACTIVE_MONSTER_VARIANT", () => {
    (Object.keys(MONSTER_VARIANTS) as (keyof typeof MONSTER_VARIANTS)[]).forEach((round) => {
      const expected = MONSTER_VARIANTS[round].find((v) => v.id === ACTIVE_MONSTER_VARIANT[round]);
      expect(expected).toBeDefined();
      expect(activeMonsterModelUrl(round)).toBe(expected!.modelUrl);
    });
  });
});

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
