import type { RoundId } from "./types";

export type Encounter = {
  id: RoundId;
  name: string;
  title: string;
  hp: number;
  color: string;
};

export const encounters: Record<RoundId, Encounter> = {
  EMBERMAW: {
    id: "EMBERMAW",
    name: "Embermaw",
    title: "The Starved Flame",
    hp: 3,
    color: "#ff5d2e",
  },
  SHARD_WARDEN: {
    id: "SHARD_WARDEN",
    name: "Shard Warden",
    title: "Keeper of the Rift",
    hp: 4,
    color: "#6de6ff",
  },
  HEXWYRM: {
    id: "HEXWYRM",
    name: "The Hexwyrm",
    title: "Devourer Beyond the Veil",
    hp: 5,
    color: "#bc73ff",
  },
};
