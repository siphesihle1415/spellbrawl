import type { RoundId } from "./types";

export type MonsterVariant = { id: string; modelUrl: string };

export const MONSTER_VARIANTS: Record<RoundId, MonsterVariant[]> = {
  EMBERMAW: [{ id: "embermaw-a", modelUrl: "/models/monsters/embermaw-a.glb" }],
  SHARD_WARDEN: [{ id: "shard-warden-a", modelUrl: "/models/monsters/shard-warden-a.glb" }],
  HEXWYRM: [{ id: "hexwyrm-a", modelUrl: "/models/monsters/hexwyrm-a.glb" }],
};

// The one thing to edit to change which variant renders per round.
export const ACTIVE_MONSTER_VARIANT: Record<RoundId, string> = {
  EMBERMAW: "embermaw-a",
  SHARD_WARDEN: "shard-warden-a",
  HEXWYRM: "hexwyrm-a",
};

export const MONSTER_TRANSFORM: Record<RoundId, { scale: number; position: [number, number, number] }> = {
  EMBERMAW: { scale: 0.25, position: [0, 0.34, 0] },
  SHARD_WARDEN: { scale: 0.25, position: [0, 0.34, 0] },
  HEXWYRM: { scale: 0.25, position: [0, 0.34, 0] },
};

export function resolveVariant(variants: MonsterVariant[], activeId: string): MonsterVariant {
  return variants.find((variant) => variant.id === activeId) ?? variants[0];
}

export function activeMonsterModelUrl(round: RoundId): string {
  return resolveVariant(MONSTER_VARIANTS[round], ACTIVE_MONSTER_VARIANT[round]).modelUrl;
}

export const EMBERMAW_ANIMATION_URLS = {
  walking: "/models/monsters/embermaw-walking.glb",
  zombieScream: "/models/monsters/embermaw-zombie-scream.glb",
  jumpingPunch: "/models/monsters/embermaw-jumping-punch.glb",
  fallingDown: "/models/monsters/embermaw-falling-down.glb",
} as const;

export const EMBERMAW_ANIMATED_TRANSFORM: { scale: number; position: [number, number, number] } = {
  scale: 0.2,
  position: [0, 0.3, 0],
};
