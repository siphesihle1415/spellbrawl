import { describe, expect, it } from "vitest";
import { defaultRunConfiguration } from "../director/defaultConfig";
import { encounterDialogue } from "./dialogue";
import { initialGameState } from "./engine";

const state = { ...initialGameState(), status: "DIALOGUE" as const, tutorial: false, round: "EMBERMAW" as const };

describe("encounterDialogue aiLines override", () => {
  it("replaces line text with aiLines while keeping speakers and order", () => {
    const aiLines = ["AI opening line from the monster.", "AI reply from player one.", "AI reply from player two."];
    const staticLines = encounterDialogue(state, defaultRunConfiguration);

    const result = encounterDialogue(state, defaultRunConfiguration, aiLines);

    expect(result.map((line) => line.speaker)).toEqual(staticLines.map((line) => line.speaker));
    expect(result.map((line) => line.text)).toEqual(aiLines);
  });

  it("falls back to the static script when aiLines is undefined", () => {
    expect(encounterDialogue(state, defaultRunConfiguration, undefined))
      .toEqual(encounterDialogue(state, defaultRunConfiguration));
  });

  it("falls back to the static script when aiLines has the wrong length", () => {
    expect(encounterDialogue(state, defaultRunConfiguration, ["only one line"]))
      .toEqual(encounterDialogue(state, defaultRunConfiguration));
  });

  it("falls back to the static script when aiLines contains a non-string value", () => {
    const invalid = ["fine", 42, "fine"] as unknown as string[];
    expect(encounterDialogue(state, defaultRunConfiguration, invalid))
      .toEqual(encounterDialogue(state, defaultRunConfiguration));
  });
});
