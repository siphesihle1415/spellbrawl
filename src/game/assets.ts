import { ROUND_ANIMATION_URLS } from "./monsters";
import type { RoundId } from "./types";

export const ARENA_SCENE_URL = "/models/spellbrawl-three-rooms-open-lighting.glb";
export const AUDIO_ASSET_URLS = [
  "/audio/gamesong.mp3",
  "/audio/fireball.mp3",
  "/audio/shield.mp3",
  "/audio/damage.mp3",
  "/audio/nextlevel.mp3",
  "/audio/gameover.mp3",
] as const;

export function arenaAssetUrlsForRound(round: RoundId): string[] {
  return [ARENA_SCENE_URL, ...ROUND_ANIMATION_URLS[round]];
}

// The first screen renders Embermaw, so these assets must be parsed before the
// startup curtain can truthfully report that the arena is ready. Audio is
// preloaded separately and never gates or errors this curtain: browsers can
// stall or fail media fetches for reasons that have nothing to do with the
// arena being playable.
export const STARTUP_ASSET_URLS = arenaAssetUrlsForRound("EMBERMAW");
