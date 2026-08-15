import type { Config, Context } from "@netlify/functions";
import { fallbackLoaderFacts } from "../../src/director/loaderFacts";
import { generateProviderFacts } from "../../src/director/providers";
import { loadDirectorRuntimeConfig } from "../../src/director/serverConfig";

function json(facts: string[], source: "ai" | "static" | "fallback") {
  return Response.json({ facts, source }, { headers: { "cache-control": "no-store" } });
}

export default async (request: Request, _context: Context) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: { allow: "POST" } });
  }

  const runtimeConfig = loadDirectorRuntimeConfig(process.env);
  if (runtimeConfig.provider === "static") return json([...fallbackLoaderFacts], "static");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), runtimeConfig.timeoutMs);
  const facts = await generateProviderFacts(runtimeConfig, controller.signal);
  clearTimeout(timeout);
  return facts ? json(facts, "ai") : json([...fallbackLoaderFacts], "fallback");
};

export const config: Config = { method: "POST" };
