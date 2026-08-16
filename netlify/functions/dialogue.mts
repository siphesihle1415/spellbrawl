import type { Config, Context } from "@netlify/functions";
import { generateProviderDialogue, type DialogueMonster } from "../../src/director/providers";
import { loadDirectorRuntimeConfig } from "../../src/director/serverConfig";
import type { RoundId } from "../../src/game/types";

const validRounds: RoundId[] = ["EMBERMAW", "SHARD_WARDEN", "HEXWYRM"];

type RequestBody = { round: RoundId; monster: DialogueMonster };

function isValidBody(body: unknown): body is RequestBody {
  if (typeof body !== "object" || body === null) return false;
  const candidate = body as { round?: unknown; monster?: unknown };
  if (typeof candidate.round !== "string" || !validRounds.includes(candidate.round as RoundId)) return false;
  const monster = candidate.monster as { name?: unknown; title?: unknown; theme?: unknown } | undefined;
  return typeof monster?.name === "string" && typeof monster?.title === "string" && typeof monster?.theme === "string";
}

function json(lines: string[] | null, source: "ai" | "static" | "fallback") {
  return Response.json({ lines, source }, { headers: { "cache-control": "no-store" } });
}

export default async (request: Request, _context: Context) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: { allow: "POST" } });
  }

  const body = await request.json().catch(() => null);
  if (!isValidBody(body)) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const runtimeConfig = loadDirectorRuntimeConfig(process.env);
  if (runtimeConfig.provider === "static") return json(null, "static");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), runtimeConfig.timeoutMs);
  const lines = await generateProviderDialogue(runtimeConfig, body.round, body.monster, controller.signal);
  clearTimeout(timeout);
  return lines ? json(lines, "ai") : json(null, "fallback");
};

export const config: Config = { method: "POST" };
