import type { RoundId } from "../game/types";
import type { DirectorTheme, RunConfiguration } from "./schema";

export const defaultRunConfiguration: RunConfiguration = {
  embermaw: {
    name: "Embermaw",
    title: "The Starved Flame",
    theme: "FIRE",
  },
  shardWarden: {
    name: "Shard Warden",
    title: "Keeper of the Rift",
    theme: "FROST",
  },
  hexwyrm: {
    name: "The Hexwyrm",
    title: "Devourer Beyond the Veil",
    theme: "VOID",
  },
  finisher: {
    name: "Starfall",
    clue: "Player A holds FIST. Player B PINCHES the rift. Player A finishes with OPEN PALM.",
  },
};

export const themeColors: Record<DirectorTheme, string> = {
  FIRE: "#ff5d2e",
  FROST: "#6de6ff",
  STORM: "#8c7bff",
  VOID: "#bc73ff",
};

export function encounterForRound(configuration: RunConfiguration, round: RoundId) {
  const encounter = round === "EMBERMAW"
    ? configuration.embermaw
    : round === "SHARD_WARDEN"
      ? configuration.shardWarden
      : configuration.hexwyrm;

  return { ...encounter, color: themeColors[encounter.theme] };
}

export function directMessage(configuration: RunConfiguration, message: string): string {
  return message
    .replaceAll("Embermaw", configuration.embermaw.name)
    .replaceAll("the Warden", configuration.shardWarden.name)
    .replaceAll("The Warden", configuration.shardWarden.name)
    .replaceAll("The Hexwyrm", configuration.hexwyrm.name)
    .replaceAll("Hexwyrm", configuration.hexwyrm.name.replace(/^The /, ""))
    .replaceAll("STARFALL", configuration.finisher.name.toUpperCase());
}
