import { clientRuntimeConfig } from "../config/runtime";
import type { RoundId } from "../game/types";
import type { DialogueMonster } from "./providers";

export type DialogueSource = "ai" | "static" | "fallback";

export type DialogueResult = {
  lines: string[] | null;
  source: DialogueSource;
};

function decodeDialogueResult(input: unknown): DialogueResult | null {
  if (typeof input !== "object" || input === null) return null;
  const candidate = input as { lines?: unknown; source?: unknown };
  if (candidate.source !== "ai" && candidate.source !== "static" && candidate.source !== "fallback") return null;
  if (candidate.lines === null) return { lines: null, source: candidate.source };
  if (
    !Array.isArray(candidate.lines)
    || candidate.lines.length !== 3
    || candidate.lines.some((line) => typeof line !== "string" || line.length === 0)
  ) return null;
  return { lines: candidate.lines, source: candidate.source };
}

export async function requestRoundDialogue(round: RoundId, monster: DialogueMonster): Promise<DialogueResult> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), clientRuntimeConfig.directorRequestTimeoutMs);
  try {
    const response = await fetch("/.netlify/functions/dialogue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ round, monster }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Dialogue returned ${response.status}`);
    const result = decodeDialogueResult(await response.json());
    if (!result) throw new Error("Dialogue returned invalid content");
    return result;
  } catch {
    return { lines: null, source: "fallback" };
  } finally {
    window.clearTimeout(timeout);
  }
}
