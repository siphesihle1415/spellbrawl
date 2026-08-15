import { decodeRunConfiguration, type RunConfiguration } from "./schema";
import { clientRuntimeConfig } from "../config/runtime";

export type DirectorSource = "ai" | "static" | "fallback";

export type DirectorResult = {
  configuration: RunConfiguration;
  source: DirectorSource;
};

let pendingRequest: Promise<DirectorResult> | undefined;

export function decodeDirectorResult(input: unknown): DirectorResult | null {
  if (typeof input !== "object" || input === null) return null;
  const candidate = input as { configuration?: unknown; source?: unknown };
  const configuration = decodeRunConfiguration(candidate.configuration);
  if (
    !configuration
    || (candidate.source !== "ai" && candidate.source !== "static" && candidate.source !== "fallback")
  ) return null;
  return { configuration, source: candidate.source };
}

async function fetchRunConfiguration(): Promise<DirectorResult> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), clientRuntimeConfig.directorRequestTimeoutMs);

  try {
    const response = await fetch("/.netlify/functions/director", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "co-op" }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Director returned ${response.status}`);
    const result = decodeDirectorResult(await response.json());
    if (!result) throw new Error("Director returned an invalid configuration");
    return result;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function requestRunConfiguration(): Promise<DirectorResult> {
  pendingRequest ??= fetchRunConfiguration();
  return pendingRequest;
}
