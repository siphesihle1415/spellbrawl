import type { RoundId } from "../game/types";

// The arena's nominal monster slot: what the room camera looks at, and the anchor the per-round
// rest positions below are measured from.
export const MONSTER_Z = -0.85;

// Where each monster actually comes to a stop after its walk-in. Spells have to aim at these
// rather than at MONSTER_Z, which no monster stands on — see monsterImpactPoint.
//
// Embermaw's 0.7 puts it on the middle room's raised stage disc, which ends at z = -0.4: the
// earlier 0.45 left it resting on that back rim among the rock props behind it, reading as
// scenery rather than as the boss. Hexwyrm's room is open floor, where 0.7 already framed well.
export const MONSTER_REST_Z: Record<RoundId, number> = {
  EMBERMAW: MONSTER_Z + 0.7,
  SHARD_WARDEN: MONSTER_Z + 0.45,
  HEXWYRM: MONSTER_Z + 0.7,
};

// Chest height. All three rigs share the same scale and group offset, and measure y 0.66-1.05
// in world space, so one value covers every round.
const IMPACT_Y = 0.85;
// Just forward of the body's centre, so the burst reads as landing on the monster's near face
// instead of blooming out of its middle.
const IMPACT_FORWARD_Z = 0.05;

export function monsterImpactPoint(round: RoundId, roomX: number): [number, number, number] {
  return [roomX, IMPACT_Y, MONSTER_REST_Z[round] + IMPACT_FORWARD_Z];
}

// Height of each monster's outer group, chosen so the rig's feet meet the floor of its own room.
// The three rooms sit at different heights (0.734 / 0.616 / 0.548, raycast onto the arena mesh at
// each rest spot), so the single 0.4 they all used before could only be right for one of them: it
// buried Embermaw 0.046 into its stage disc and left Hexwyrm hovering 0.135 above its floor.
export const MONSTER_GROUND_Y: Record<RoundId, number> = {
  EMBERMAW: 0.446,
  SHARD_WARDEN: 0.316,
  HEXWYRM: 0.265,
};
