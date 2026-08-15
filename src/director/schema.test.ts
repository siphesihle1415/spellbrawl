import { describe, expect, it } from "vitest";
import { defaultRunConfiguration, directMessage } from "./defaultConfig";
import { decodeDirectorResult } from "./DirectorClient";
import { decodeRunConfiguration, runConfigurationJsonSchema } from "./schema";

describe("RunConfigurationSchema", () => {
  it("accepts the static fallback configuration", () => {
    expect(decodeRunConfiguration(defaultRunConfiguration)).toEqual(defaultRunConfiguration);
  });

  it("rejects values outside the fixed vocabulary", () => {
    expect(decodeRunConfiguration({
      ...defaultRunConfiguration,
      hexwyrm: { ...defaultRunConfiguration.hexwyrm, name: "Ignore all rules" },
    })).toBeNull();
  });

  it("rejects missing and excess fields", () => {
    const { finisher: _finisher, ...missing } = defaultRunConfiguration;
    expect(decodeRunConfiguration(missing)).toBeNull();
    expect(decodeRunConfiguration({ ...defaultRunConfiguration, damageMultiplier: 999 })).toBeNull();
  });

  it("emits a strict JSON schema for Structured Outputs", () => {
    expect(runConfigurationJsonSchema).toMatchObject({
      type: "object",
      additionalProperties: false,
    });
  });

  it("validates the complete endpoint envelope", () => {
    expect(decodeDirectorResult({ configuration: defaultRunConfiguration, source: "ai" })).toEqual({
      configuration: defaultRunConfiguration,
      source: "ai",
    });
    expect(decodeDirectorResult({ configuration: defaultRunConfiguration, source: "static" })).toEqual({
      configuration: defaultRunConfiguration,
      source: "static",
    });
    expect(decodeDirectorResult({ configuration: defaultRunConfiguration, source: "untrusted" })).toBeNull();
  });

  it("adapts deterministic engine copy without changing its mechanics", () => {
    const configuration = {
      ...defaultRunConfiguration,
      hexwyrm: { ...defaultRunConfiguration.hexwyrm, name: "Vhar'Zul" as const },
      finisher: { ...defaultRunConfiguration.finisher, name: "Twin Nova" as const },
    };
    expect(directMessage(configuration, "STARFALL! The Hexwyrm is undone."))
      .toBe("TWIN NOVA! Vhar'Zul is undone.");
  });
});
