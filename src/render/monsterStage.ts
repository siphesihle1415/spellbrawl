import type { RoundId } from "../game/types";

// The arena's nominal monster slot: what the room camera looks at, and the anchor the per-round
// rest positions below are measured from.
export const MONSTER_Z = -0.85;

// Where the room camera sits. Lives here because the stage geometry below is measured against it.
export const CAMERA_SPAWN_Z = 0.35;

// Where each monster actually comes to a stop after its walk-in. Spells have to aim at these
// rather than at MONSTER_Z, which no monster stands on — see monsterImpactPoint.
//
// Embermaw's 0.7 puts it on the middle room's raised stage disc, which ends at z = -0.4: the
// earlier 0.45 left it resting on that back rim among the rock props behind it, reading as
// scenery rather than as the boss. Hexwyrm's room is open floor, where 0.7 already framed well.
//
// Distance from the camera also sets apparent size — the models are within 1.5% of each other in
// world height, so a monster parked further back simply looks like a smaller creature. Embermaw
// and Hexwyrm share 0.7 and read at about the same size. Shard Warden deliberately does not: its
// room's dais is centred at z = -0.375 rather than under the 0.7 mark, and standing it on the
// front lip to match the others' size looked worse from both player cameras than standing it in
// the middle of the platform does. Composition won; it renders about a third smaller.
export const MONSTER_REST_Z: Record<RoundId, number> = {
  EMBERMAW: MONSTER_Z + 0.7,
  SHARD_WARDEN: MONSTER_Z + 0.475,
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
//
// Calibrated against each rig's lowest foot bone as actually rendered, which only became stable
// once the models stopped being wrapped in drei's <Float>: its rotation rocked them by up to
// 0.066, moving the contact point every frame. Use the skeleton for this, never a bounding box —
// see FEET_BELOW_ORIGIN in the test for why the box lies about two of the three rigs.
export const MONSTER_GROUND_Y: Record<RoundId, number> = {
  EMBERMAW: 0.431,
  SHARD_WARDEN: 0.315,
  HEXWYRM: 0.245,
};

// A shield is judged on screen, so what has to stay constant between rooms is the angle it
// subtends, not its world radius: the rooms are viewed from different distances, so one fixed
// radius drew a 58 degree bubble around Shard Warden and a 77 degree one around Hexwyrm. Shard
// Warden's 0.4 is the reference because that is the one that looked right.
const SHIELD_RADIUS_PER_UNIT_DISTANCE = 0.4 / (CAMERA_SPAWN_Z - MONSTER_REST_Z.SHARD_WARDEN);

export function monsterShieldRadius(round: RoundId): number {
  return SHIELD_RADIUS_PER_UNIT_DISTANCE * (CAMERA_SPAWN_Z - MONSTER_REST_Z[round]);
}

// Height of each shielded monster's topmost head bone above its animated group's origin, measured
// in the running app. Relative to the origin, not world space, so it survives the monster being
// re-seated on a different room's floor.
const HEAD_TOP_ABOVE_ORIGIN: Record<"SHARD_WARDEN" | "HEXWYRM", number> = { SHARD_WARDEN: 0.597, HEXWYRM: 0.579 };
// Shard Warden's bubble sits 0.143 above its head — 36% of its own radius — and reads right. Held
// as a fraction of the radius so a smaller bubble rides correspondingly lower rather than being
// pushed off the top of a monster it is meant to enclose.
const SHIELD_HEAD_CLEARANCE = 0.143 / 0.4;

export function monsterShieldCentreY(round: "SHARD_WARDEN" | "HEXWYRM"): number {
  const radius = monsterShieldRadius(round);
  return HEAD_TOP_ABOVE_ORIGIN[round] + SHIELD_HEAD_CLEARANCE * radius - radius;
}

// Floor height under each monster's rest spot, raycast onto the arena mesh. The three rooms sit at
// different heights, so effects that belong on the ground need this rather than one shared level.
export const MONSTER_FLOOR_Y: Record<RoundId, number> = {
  EMBERMAW: 0.734,
  SHARD_WARDEN: 0.615,
  HEXWYRM: 0.548,
};

// Starfall drops a column from the sky with its shockwave ring at the base, so it is aimed at the
// monster's feet rather than at its chest the way monsterImpactPoint is.
export function starfallImpactPoint(round: RoundId, roomX: number): [number, number, number] {
  return [roomX, MONSTER_FLOOR_Y[round], MONSTER_REST_Z[round]];
}
