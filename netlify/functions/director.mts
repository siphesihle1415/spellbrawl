import type { Config, Context } from "@netlify/functions";
import { defaultRunConfiguration } from "../../src/director/defaultConfig";
import { generateProviderConfiguration } from "../../src/director/providers";
import { loadDirectorRuntimeConfig } from "../../src/director/serverConfig";
import type { RunConfiguration } from "../../src/director/schema";

function json(configuration: RunConfiguration, source: "ai" | "static" | "fallback") {
  return Response.json(
    { configuration, source },
    { headers: { "cache-control": "no-store" } },
  );
}

export default async (request: Request, _context: Context) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, {
      status: 405,
      headers: { allow: "POST" },
    });
  }

  const runtimeConfig = loadDirectorRuntimeConfig(process.env);
  if (runtimeConfig.provider === "static") {
    return json(runtimeConfig.staticConfiguration, "static");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), runtimeConfig.timeoutMs);
  const configuration = await generateProviderConfiguration(runtimeConfig, controller.signal);
  clearTimeout(timeout);
  return configuration
    ? json(configuration, "ai")
    : json(defaultRunConfiguration, "fallback");
};

export const config: Config = {
  method: "POST",
};
