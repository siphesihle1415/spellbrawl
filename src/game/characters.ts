import type { PlayerId } from "./types";

export type CharacterId = "ARCANE_SENTINEL" | "STORMFORGED_VANGUARD";

export type Character = {
  id: CharacterId;
  name: string;
  modelUrl: string;
};

export const CHARACTER_ROSTER: Record<CharacterId, Character> = {
  ARCANE_SENTINEL: {
    id: "ARCANE_SENTINEL",
    name: "Arcane Sentinel",
    modelUrl: "/models/characters/arcane-sentinel.glb",
  },
  STORMFORGED_VANGUARD: {
    id: "STORMFORGED_VANGUARD",
    name: "Stormforged Vanguard",
    modelUrl: "/models/characters/stormforged-vanguard.glb",
  },
};

export type CharacterSelections = Partial<Record<PlayerId, CharacterId>>;

export function takenBy(selections: CharacterSelections, characterId: CharacterId): PlayerId | undefined {
  return (Object.keys(selections) as PlayerId[]).find((playerId) => selections[playerId] === characterId);
}

export function bothPicked(selections: CharacterSelections): selections is Record<PlayerId, CharacterId> {
  return selections.PLAYER_A !== undefined && selections.PLAYER_B !== undefined;
}
