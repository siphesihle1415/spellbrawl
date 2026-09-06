import { describe, expect, it } from "vitest";
import type { RoundId } from "../game/types";
import { EMBERMAW_ANIMATED_TRANSFORM, HEXWYRM_ANIMATED_TRANSFORM, SHARD_WARDEN_ANIMATED_TRANSFORM } from "../game/monsters";
import { MONSTER_GROUND_Y, MONSTER_REST_Z, monsterImpactPoint } from "./monsterStage";

// Body extents measured with a Box3 around each rendered rig in the running app, Float wobble
// included: the mesh sits within ~0.15 of its room centre, spans y 0.66-1.05, and reaches ~0.09
// either side of its rest position in z. Kept a little tighter than the measurements so a passing
// impact point is comfortably inside the torso rather than clipping an outstretched limb.
const BODY = { halfWidth: 0.12, minY: 0.72, maxY: 1.0, halfDepth: 0.08 };
const ROOM_X: Record<RoundId, number> = { EMBERMAW: 0, SHARD_WARDEN: 1.4, HEXWYRM: -1.4 };

describe("monsterImpactPoint", () => {
  for (const round of ["EMBERMAW", "SHARD_WARDEN", "HEXWYRM"] as const) {
    it(`lands inside ${round}'s body where it stands`, () => {
      const roomX = ROOM_X[round];
      const [x, y, z] = monsterImpactPoint(round, roomX);
      expect(Math.abs(x - roomX)).toBeLessThanOrEqual(BODY.halfWidth);
      expect(y).toBeGreaterThanOrEqual(BODY.minY);
      expect(y).toBeLessThanOrEqual(BODY.maxY);
      expect(Math.abs(z - MONSTER_REST_Z[round])).toBeLessThanOrEqual(BODY.halfDepth);
    });
  }
});

// Raycast onto the arena mesh in the running app, straight down through each monster's rest spot.
// The three rooms do not share a floor height, which is why one hardcoded y left Embermaw sunk
// into its stage disc and Hexwyrm hovering 0.135 above its own.
const FLOOR_Y: Record<RoundId, number> = { EMBERMAW: 0.734, SHARD_WARDEN: 0.615, HEXWYRM: 0.548 };
// How far each rig's lowest foot bone sits below its animated group's origin, measured per frame
// in the running app. Read off the skeleton, not a bounding box: Shard Warden and Hexwyrm export
// with mesh bounds that do not track their skeleton at all (a Box3 around them spans 0.071 for a
// model 0.35 tall), so grounding on that box buried both of them ~0.055 into the floor.
const FEET_BELOW_ORIGIN: Record<RoundId, number> = { EMBERMAW: -0.003, SHARD_WARDEN: 0, HEXWYRM: -0.003 };
const GROUP_OFFSET_Y: Record<RoundId, number> = {
  EMBERMAW: EMBERMAW_ANIMATED_TRANSFORM.position[1],
  SHARD_WARDEN: SHARD_WARDEN_ANIMATED_TRANSFORM.position[1],
  HEXWYRM: HEXWYRM_ANIMATED_TRANSFORM.position[1],
};

describe("MONSTER_GROUND_Y", () => {
  for (const round of ["EMBERMAW", "SHARD_WARDEN", "HEXWYRM"] as const) {
    it(`stands ${round} on its own room's floor`, () => {
      const feet = MONSTER_GROUND_Y[round] + GROUP_OFFSET_Y[round] - FEET_BELOW_ORIGIN[round];
      expect(feet).toBeCloseTo(FLOOR_Y[round], 2);
    });
  }
});

describe("MONSTER_REST_Z", () => {
  it("keeps every monster the same distance from the camera", () => {
    // On-screen size falls off with distance, so a monster parked further back reads as a smaller
    // creature even when the models are the same height in world space (all three measure ~0.35).
    // Shard Warden used to rest 0.25 behind the other two and rendered 222px tall against their
    // 320px — a third smaller, purely from perspective.
    const restZ = Object.values(MONSTER_REST_Z);
    expect(Math.max(...restZ) - Math.min(...restZ)).toBeLessThanOrEqual(0.05);
  });
});
