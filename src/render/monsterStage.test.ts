import { describe, expect, it } from "vitest";
import type { RoundId } from "../game/types";
import { MONSTER_REST_Z, monsterImpactPoint } from "./monsterStage";

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

