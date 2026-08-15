import { describe, expect, it } from "vitest";
import { defaultRunConfiguration } from "./defaultConfig";
import { loadDirectorRuntimeConfig } from "./serverConfig";

describe("loadDirectorRuntimeConfig", () => {
  it("defaults to Ollama Cloud and supports provider-specific overrides", () => {
    expect(loadDirectorRuntimeConfig({})).toMatchObject({
      provider: "ollama",
      baseUrl: "https://ollama.com",
      model: "gpt-oss:20b",
    });
    expect(loadDirectorRuntimeConfig({
      LLM_DIRECTOR_PROVIDER: "anthropic",
      ANTHROPIC_BASE_URL: "https://gateway.example/",
      ANTHROPIC_DIRECTOR_MODEL: "configured-model",
    })).toMatchObject({
      provider: "anthropic",
      baseUrl: "https://gateway.example",
      model: "configured-model",
    });
  });

  it("loads a validated standalone configuration from the environment", () => {
    const custom = {
      ...defaultRunConfiguration,
      embermaw: { ...defaultRunConfiguration.embermaw, name: "Ashclaw" as const },
    };
    expect(loadDirectorRuntimeConfig({
      LLM_DIRECTOR_PROVIDER: "static",
      LLM_DIRECTOR_STATIC_CONFIG: JSON.stringify(custom),
    }).staticConfiguration).toEqual(custom);
  });

  it("uses safe defaults for invalid configuration values", () => {
    expect(loadDirectorRuntimeConfig({
      LLM_DIRECTOR_PROVIDER: "unknown",
      LLM_DIRECTOR_TIMEOUT_MS: "999999",
      LLM_DIRECTOR_STATIC_CONFIG: "not-json",
    })).toMatchObject({
      provider: "ollama",
      timeoutMs: 15_000,
      staticConfiguration: defaultRunConfiguration,
    });
  });
});
