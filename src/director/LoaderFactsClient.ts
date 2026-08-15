import { clientRuntimeConfig } from "../config/runtime";
import { fallbackLoaderFacts } from "./loaderFacts";

type LoaderFactsResult = {
  facts: string[];
  source: "ai" | "static" | "fallback";
};

function decodeLoaderFacts(input: unknown): LoaderFactsResult | null {
  if (typeof input !== "object" || input === null) return null;
  const candidate = input as { facts?: unknown; source?: unknown };
  if (!Array.isArray(candidate.facts) || candidate.facts.some((fact) => typeof fact !== "string")) return null;
  if (candidate.facts.length < 3 || candidate.facts.some((fact) => fact.length > 240)) return null;
  if (candidate.source !== "ai" && candidate.source !== "static" && candidate.source !== "fallback") return null;
  return { facts: candidate.facts, source: candidate.source };
}

export async function requestLoaderFacts(): Promise<LoaderFactsResult> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), clientRuntimeConfig.directorRequestTimeoutMs);
  try {
    const response = await fetch("/.netlify/functions/loader-facts", { method: "POST", signal: controller.signal });
    if (!response.ok) throw new Error(`Loader facts returned ${response.status}`);
    const result = decodeLoaderFacts(await response.json());
    if (!result) throw new Error("Loader facts returned invalid content");
    return result;
  } catch {
    return { facts: [...fallbackLoaderFacts], source: "fallback" };
  } finally {
    window.clearTimeout(timeout);
  }
}
