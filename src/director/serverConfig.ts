import { defaultRunConfiguration } from "./defaultConfig";
import { decodeRunConfiguration, type RunConfiguration } from "./schema";

export type DirectorProvider = "static" | "ollama" | "anthropic" | "openai";

export type DirectorRuntimeConfig = {
  provider: DirectorProvider;
  timeoutMs: number;
  baseUrl: string;
  apiKey?: string;
  model?: string;
  staticConfiguration: RunConfiguration;
};

type Environment = Record<string, string | undefined>;

const providerDefaults: Record<Exclude<DirectorProvider, "static">, { baseUrl: string; model: string }> = {
  ollama: { baseUrl: "https://ollama.com", model: "gpt-oss:20b" },
  anthropic: { baseUrl: "https://api.anthropic.com", model: "claude-haiku-4-5" },
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-5.4-nano" },
};

function parseProvider(value: string | undefined): DirectorProvider {
  return value === "static" || value === "anthropic" || value === "openai" || value === "ollama"
    ? value
    : "ollama";
}

function parseTimeout(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1_000 && parsed <= 30_000 ? parsed : 15_000;
}

function parseStaticConfiguration(value: string | undefined): RunConfiguration {
  if (!value) return defaultRunConfiguration;
  try {
    return decodeRunConfiguration(JSON.parse(value)) ?? defaultRunConfiguration;
  } catch {
    return defaultRunConfiguration;
  }
}

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function loadDirectorRuntimeConfig(environment: Environment): DirectorRuntimeConfig {
  const provider = parseProvider(environment.LLM_DIRECTOR_PROVIDER?.trim().toLowerCase());
  const staticConfiguration = parseStaticConfiguration(environment.LLM_DIRECTOR_STATIC_CONFIG);
  const timeoutMs = parseTimeout(environment.LLM_DIRECTOR_TIMEOUT_MS);

  if (provider === "static") {
    return { provider, timeoutMs, baseUrl: "", staticConfiguration };
  }

  const prefix = provider.toUpperCase();
  const defaults = providerDefaults[provider];
  return {
    provider,
    timeoutMs,
    baseUrl: withoutTrailingSlash(environment[`${prefix}_BASE_URL`]?.trim() || defaults.baseUrl),
    apiKey: environment[`${prefix}_API_KEY`]?.trim() || undefined,
    model: environment[`${prefix}_DIRECTOR_MODEL`]?.trim() || defaults.model,
    staticConfiguration,
  };
}
