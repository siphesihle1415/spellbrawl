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

export const SHARD_WARDEN_ANIMATION_URLS = {
  walking: "/models/monsters/shard-warden-walking.glb",
  skill03: "/models/monsters/shard-warden-skill-03.glb",
  tripleComboAttack: "/models/monsters/shard-warden-triple-combo-attack.glb",
  shotInTheBackAndFall: "/models/monsters/shard-warden-shot-in-the-back-and-fall.glb",
} as const;

export const SHARD_WARDEN_ANIMATED_TRANSFORM: { scale: number; position: [number, number, number] } = {
  scale: 0.2,
  position: [0, 0.3, 0],
};

export const HEXWYRM_ANIMATION_URLS = {
  walking: "/models/monsters/hexwyrm-walking.glb",
  zombieScream: "/models/monsters/hexwyrm-zombie-scream.glb",
  crouchChargeAndThrow: "/models/monsters/hexwyrm-crouch-charge-and-throw.glb",
  shotAndFallBackward: "/models/monsters/hexwyrm-shot-and-fall-backward.glb",
} as const;

export const HEXWYRM_ANIMATED_TRANSFORM: { scale: number; position: [number, number, number] } = {
  scale: 0.2,
  position: [0, 0.3, 0],
};

// The animated clip URLs a round's enemy needs before it can actually appear on screen. Used to
// gate the attack cadence on the enemy model being loaded, rather than firing attacks the instant
// the round changes (see engine.ts enterRound, which flips `round` synchronously) while the GLTFs
// for the new monster are still in flight.
export const ROUND_ANIMATION_URLS: Record<RoundId, string[]> = {
  EMBERMAW: Object.values(EMBERMAW_ANIMATION_URLS),
  SHARD_WARDEN: Object.values(SHARD_WARDEN_ANIMATION_URLS),
  HEXWYRM: Object.values(HEXWYRM_ANIMATION_URLS),
};

// Delay between the enemy attack windup (attack clip starts) and the impact resolving
// (shield check + shared HP loss), so the hit lands when the swing visually connects. The
// source clips have no embedded hit-frame markers, so this is the midpoint of each clip's
// real duration (jumping-punch 2.73s, triple-combo-attack 4.37s, crouch-charge-and-throw 7.73s).
// Hexwyrm's clip is played back at HEXWYRM_ATTACK_TIME_SCALE (1.25x, see Arena.tsx) to fit the
// 7s attack cadence, so its midpoint (3900ms at native speed) is scaled down to match: 3900 / 1.25.
export const ATTACK_IMPACT_DELAY_MS: Record<RoundId, number> = {
  EMBERMAW: 1400,
  SHARD_WARDEN: 2200,
  HEXWYRM: 3120,
};
