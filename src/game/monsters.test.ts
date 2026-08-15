import { describe, expect, it } from "vitest";
import { ACTIVE_MONSTER_VARIANT, EMBERMAW_ANIMATION_URLS, MONSTER_VARIANTS, activeMonsterModelUrl, resolveVariant } from "./monsters";

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
