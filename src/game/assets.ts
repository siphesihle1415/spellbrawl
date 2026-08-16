import { ROUND_ANIMATION_URLS } from "./monsters";
import type { RoundId } from "./types";

export const ARENA_SCENE_URL = "/models/spellbrawl-three-rooms-open-lighting.glb";

export function arenaAssetUrlsForRound(round: RoundId): string[] {
  return [ARENA_SCENE_URL, ...ROUND_ANIMATION_URLS[round]];
}

// The first screen renders Embermaw, so these assets must be parsed before the
// startup curtain can truthfully report that the arena is ready.
export const STARTUP_ASSET_URLS = arenaAssetUrlsForRound("EMBERMAW");
