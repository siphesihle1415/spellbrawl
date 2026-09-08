import { logEvent } from "./diagnostics";
import type { DirectorRuntimeConfig } from "./serverConfig";
import { fallbackLoaderFacts } from "./loaderFacts";
import {
  decodeRunConfiguration,
  runConfigurationJsonSchema,
  type RunConfiguration,
} from "./schema";
import type { RoundId } from "../game/types";

const { $schema: _schemaDialect, ...directorOutputSchema } = runConfigurationJsonSchema;

const systemPrompt = [
  "You are the SpellBrawl Director.",
  "Select a coherent dramatic identity for a three-round co-op fantasy battle.",
  "Never alter combat rules, HP, timing, damage, phases, or gesture mechanics.",
  "Return only one JSON object matching the supplied schema, with no Markdown or explanation.",
].join(" ");

const userPrompt = [
  "Create one varied but tonally coherent SpellBrawl run configuration.",
  `JSON Schema: ${JSON.stringify(directorOutputSchema)}`,
].join("\n");

const factsSystemPrompt = [
  "You are the SpellBrawl Director.",
  "Write concise, evocative, family-friendly field notes about SpellBrawl's monsters, arenas, co-op magic, and rifts.",
  "Do not invent mechanics, damage, rules, or real-world claims.",
  "Return only one JSON object matching the supplied schema, with no Markdown or explanation.",
].join(" ");

const factsOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["facts"],
  properties: {
    facts: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: { type: "string", minLength: 30, maxLength: 220 },
    },
  },
};

const factsUserPrompt = [
  "Generate three to five varied field notes for the loading screen.",
  `JSON Schema: ${JSON.stringify(factsOutputSchema)}`,
].join("\n");

export type DialogueMonster = { name: string; title: string; theme: string };

const dialogueSystemPrompt = [
  "You are the SpellBrawl Director.",
  "Never alter combat rules, HP, timing, damage, phases, or gesture mechanics.",
  "Write exactly three short spoken lines for a co-op fantasy battle encounter: line 1 spoken by the monster, lines 2 and 3 spoken by the two co-op players responding, matching the game's \"we act as one\" tone.",
  "Return only one JSON object matching the supplied schema, with no Markdown or explanation.",
].join(" ");

const dialogueRoundBeats: Record<RoundId, string> = {
  EMBERMAW: "the practice round is over, the real fight begins",
  SHARD_WARDEN: "no spell may cross the crystal threshold",
  HEXWYRM: "the void opens, the players must finish it together",
};

const dialogueOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["lines"],
  properties: {
    lines: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string", minLength: 20, maxLength: 100 },
    },
  },
};

function dialogueUserPrompt(round: RoundId, monster: DialogueMonster): string {
  return [
    `Monster: ${monster.name}, "${monster.title}" (${monster.theme} theme).`,
    `Dramatic beat: ${dialogueRoundBeats[round]}.`,
    "Write the monster's opening line, then two lines of co-op player response.",
    `JSON Schema: ${JSON.stringify(dialogueOutputSchema)}`,
  ].join("\n");
}

function decodeText(text: string | null): RunConfiguration | null {
  if (!text) return null;
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace < firstBrace) return null;
  try {
    return decodeRunConfiguration(JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)));
  } catch {
    return null;
  }
}

function decodeFacts(text: string | null): string[] | null {
  if (!text) return null;
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace < firstBrace) return null;
  try {
    const candidate = JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as { facts?: unknown };
    if (!Array.isArray(candidate.facts) || candidate.facts.length < 3 || candidate.facts.length > 5) return null;
    if (candidate.facts.some((fact) => typeof fact !== "string" || fact.length < 30 || fact.length > 220)) return null;
    return candidate.facts;
  } catch {
    return null;
  }
}

function decodeDialogueLines(text: string | null): string[] | null {
  if (!text) return null;
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace < firstBrace) return null;
  try {
    const candidate = JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as { lines?: unknown };
    if (!Array.isArray(candidate.lines) || candidate.lines.length !== 3) return null;
    if (candidate.lines.some((line) => typeof line !== "string" || line.length < 20 || line.length > 100)) return null;
    return candidate.lines;
  } catch {
    return null;
  }
}

class ProviderFailure extends Error {
  constructor(readonly reason: string, readonly status?: number) {
    super(reason);
  }
}

async function post(url: string, body: unknown, signal: AbortSignal, headers: HeadersInit = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal,
  });
  logEvent("llm.response", {
    status: response.status,
    providerRequestId: response.headers.get("request-id") ?? response.headers.get("x-request-id") ?? undefined,
  }, response.ok ? "info" : "warn");
  if (!response.ok) throw new ProviderFailure("http_error", response.status);
  return response;
}

// GPT-OSS requires a reasoning level, not think:false. Other Ollama models
// retain their defaults; not all models support the same thinking options.
function ollamaThinking(model: string | undefined) {
  return model?.startsWith("gpt-oss:") || model === "gpt-oss" ? { think: "low" } : {};
}

async function generateWithOllama(config: DirectorRuntimeConfig, signal: AbortSignal) {
  const response = await post(
    `${config.baseUrl}/api/chat`,
    {
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: false,
      ...ollamaThinking(config.model),
      options: { temperature: 0 },
    },
    signal,
    { authorization: `Bearer ${config.apiKey}` },
  );
  const payload = await response.json() as { message?: { content?: string } };
  return decodeText(payload.message?.content ?? null);
}

async function generateWithAnthropic(config: DirectorRuntimeConfig, signal: AbortSignal) {
  const response = await post(
    `${config.baseUrl}/v1/messages`,
    {
      model: config.model,
      max_tokens: 700,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    },
    signal,
    {
      "x-api-key": config.apiKey!,
      "anthropic-version": "2023-06-01",
    },
  );
  const payload = await response.json() as { content?: Array<{ type?: string; text?: string }> };
  return decodeText(payload.content?.find((item) => item.type === "text")?.text ?? null);
}

async function generateWithOpenAI(config: DirectorRuntimeConfig, signal: AbortSignal) {
  const response = await post(
    `${config.baseUrl}/responses`,
    {
      model: config.model,
      instructions: systemPrompt,
      input: userPrompt,
      text: {
        format: {
          type: "json_schema",
          name: "spellbrawl_run_configuration",
          strict: true,
          schema: directorOutputSchema,
        },
      },
      max_output_tokens: 700,
    },
    signal,
    { authorization: `Bearer ${config.apiKey}` },
  );
  const payload = await response.json() as {
    output_text?: string;
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  };
  const outputText = payload.output_text ?? payload.output
    ?.find((item) => item.type === "message")
    ?.content?.find((item) => item.type === "output_text" || item.type === "text")?.text;
  return decodeText(outputText ?? null);
}

async function generateConfiguration(
  config: DirectorRuntimeConfig,
  signal: AbortSignal,
): Promise<RunConfiguration | null> {
  if (config.provider === "static") return config.staticConfiguration;
  if (!config.apiKey || !config.model) return null;

  if (config.provider === "ollama") return await generateWithOllama(config, signal);
  if (config.provider === "anthropic") return await generateWithAnthropic(config, signal);
  return await generateWithOpenAI(config, signal);
}

async function generateFacts(
  config: DirectorRuntimeConfig,
  signal: AbortSignal,
): Promise<string[] | null> {
  if (config.provider === "static") return [...fallbackLoaderFacts];
  if (!config.apiKey || !config.model) return null;

  if (config.provider === "ollama") {
    const response = await post(`${config.baseUrl}/api/chat`, {
      model: config.model,
      messages: [{ role: "system", content: factsSystemPrompt }, { role: "user", content: factsUserPrompt }],
      stream: false,
      ...ollamaThinking(config.model),
    }, signal, { authorization: `Bearer ${config.apiKey}` });
    const payload = await response.json() as { message?: { content?: string } };
    return decodeFacts(payload.message?.content ?? null);
  }
  if (config.provider === "anthropic") {
    const response = await post(`${config.baseUrl}/v1/messages`, {
      model: config.model,
      max_tokens: 500,
      temperature: 0.8,
      system: factsSystemPrompt,
      messages: [{ role: "user", content: factsUserPrompt }],
    }, signal, { "x-api-key": config.apiKey!, "anthropic-version": "2023-06-01" });
    const payload = await response.json() as { content?: Array<{ type?: string; text?: string }> };
    return decodeFacts(payload.content?.find((item) => item.type === "text")?.text ?? null);
  }
  const response = await post(`${config.baseUrl}/responses`, {
    model: config.model,
    instructions: factsSystemPrompt,
    input: factsUserPrompt,
    text: { format: { type: "json_schema", name: "spellbrawl_loader_facts", strict: true, schema: factsOutputSchema } },
    max_output_tokens: 500,
  }, signal, { authorization: `Bearer ${config.apiKey}` });
  const payload = await response.json() as { output_text?: string; output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> };
  const outputText = payload.output_text ?? payload.output?.find((item) => item.type === "message")?.content?.find((item) => item.type === "output_text" || item.type === "text")?.text;
  return decodeFacts(outputText ?? null);
}

async function generateDialogue(
  config: DirectorRuntimeConfig,
  round: RoundId,
  monster: DialogueMonster,
  signal: AbortSignal,
): Promise<string[] | null> {
  if (config.provider === "static") return null;
  if (!config.apiKey || !config.model) return null;

  const userPrompt = dialogueUserPrompt(round, monster);

  if (config.provider === "ollama") {
    const response = await post(`${config.baseUrl}/api/chat`, {
      model: config.model,
      messages: [{ role: "system", content: dialogueSystemPrompt }, { role: "user", content: userPrompt }],
      stream: false,
      ...ollamaThinking(config.model),
    }, signal, { authorization: `Bearer ${config.apiKey}` });
    const payload = await response.json() as { message?: { content?: string } };
    return decodeDialogueLines(payload.message?.content ?? null);
  }
  if (config.provider === "anthropic") {
    const response = await post(`${config.baseUrl}/v1/messages`, {
      model: config.model,
      max_tokens: 400,
      temperature: 0.8,
      system: dialogueSystemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }, signal, { "x-api-key": config.apiKey!, "anthropic-version": "2023-06-01" });
    const payload = await response.json() as { content?: Array<{ type?: string; text?: string }> };
    return decodeDialogueLines(payload.content?.find((item) => item.type === "text")?.text ?? null);
  }
  const response = await post(`${config.baseUrl}/responses`, {
    model: config.model,
    instructions: dialogueSystemPrompt,
    input: userPrompt,
    text: { format: { type: "json_schema", name: "spellbrawl_dialogue", strict: true, schema: dialogueOutputSchema } },
    max_output_tokens: 400,
  }, signal, { authorization: `Bearer ${config.apiKey}` });
  const payload = await response.json() as { output_text?: string; output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> };
  const outputText = payload.output_text ?? payload.output?.find((item) => item.type === "message")?.content?.find((item) => item.type === "output_text" || item.type === "text")?.text;
  return decodeDialogueLines(outputText ?? null);
}

export { directorOutputSchema };

async function observeGeneration<T>(
  operation: string,
  config: DirectorRuntimeConfig,
  signal: AbortSignal,
  generate: () => Promise<T | null>,
): Promise<T | null> {
  const metadata = { operation, provider: config.provider, model: config.model, timeoutMs: config.timeoutMs };
  if (config.provider === "static") {
    logEvent("llm.skipped", { ...metadata, reason: "static_provider" });
    return generate();
  }
  if (!config.apiKey || !config.model) {
    logEvent("llm.skipped", { ...metadata, reason: !config.apiKey ? "missing_api_key" : "missing_model" }, "warn");
    return null;
  }
  const started = Date.now();
  logEvent("llm.start", { ...metadata, ...ollamaThinking(config.provider === "ollama" ? config.model : undefined) });
  try {
    const result = await generate();
    logEvent(result === null ? "llm.fallback" : "llm.complete", {
      ...metadata, durationMs: Date.now() - started,
      reason: result === null ? "invalid_output" : undefined,
    }, result === null ? "warn" : "info");
    return result;
  } catch (error) {
    logEvent("llm.fallback", {
      ...metadata, durationMs: Date.now() - started,
      reason: signal.aborted ? "timeout" : error instanceof ProviderFailure ? error.reason
        : error instanceof SyntaxError ? "invalid_json" : "network_error",
      status: error instanceof ProviderFailure ? error.status : undefined,
    }, "warn");
    return null;
  }
}

export function generateProviderConfiguration(config: DirectorRuntimeConfig, signal: AbortSignal) {
  return observeGeneration("configuration", config, signal, () => generateConfiguration(config, signal));
}

export function generateProviderFacts(config: DirectorRuntimeConfig, signal: AbortSignal) {
  return observeGeneration("facts", config, signal, () => generateFacts(config, signal));
}

export function generateProviderDialogue(config: DirectorRuntimeConfig, round: RoundId, monster: DialogueMonster, signal: AbortSignal) {
  return observeGeneration("dialogue", config, signal, () => generateDialogue(config, round, monster, signal));
}