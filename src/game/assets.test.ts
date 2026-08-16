import { describe, expect, it } from "vitest";
import { ARENA_SCENE_URL, arenaAssetUrlsForRound, AUDIO_ASSET_URLS, STARTUP_ASSET_URLS } from "./assets";
import { ROUND_ANIMATION_URLS } from "./monsters";

describe("arena asset manifests", () => {
  it("loads only the arena and Embermaw animations at startup", () => {
    expect(STARTUP_ASSET_URLS).toEqual([ARENA_SCENE_URL, ...ROUND_ANIMATION_URLS.EMBERMAW, ...AUDIO_ASSET_URLS]);
    expect(AUDIO_ASSET_URLS).toContain("/audio/gamesong.mp3");
    expect(STARTUP_ASSET_URLS).not.toContain(ROUND_ANIMATION_URLS.SHARD_WARDEN[0]);
    expect(STARTUP_ASSET_URLS).not.toContain(ROUND_ANIMATION_URLS.HEXWYRM[0]);
  });

  it("returns only the assets needed by the requested round", () => {
    expect(arenaAssetUrlsForRound("SHARD_WARDEN")).toEqual([ARENA_SCENE_URL, ...ROUND_ANIMATION_URLS.SHARD_WARDEN]);
    expect(arenaAssetUrlsForRound("HEXWYRM")).toEqual([ARENA_SCENE_URL, ...ROUND_ANIMATION_URLS.HEXWYRM]);
  });
});
