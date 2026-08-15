import type { DirectorRuntimeConfig } from "./serverConfig";
import {
  decodeRunConfiguration,
  runConfigurationJsonSchema,
  type RunConfiguration,
} from "./schema";

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

async function post(url: string, body: unknown, signal: AbortSignal, headers: HeadersInit = {}) {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal,
  });
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
      options: { temperature: 0 },
    },
    signal,
    { authorization: `Bearer ${config.apiKey}` },
  );
  if (!response.ok) return null;
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
  if (!response.ok) return null;
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
  if (!response.ok) return null;
  const payload = await response.json() as {
    output_text?: string;
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  };
  const outputText = payload.output_text ?? payload.output
    ?.find((item) => item.type === "message")
    ?.content?.find((item) => item.type === "output_text" || item.type === "text")?.text;
  return decodeText(outputText ?? null);
}

export async function generateProviderConfiguration(
  config: DirectorRuntimeConfig,
  signal: AbortSignal,
): Promise<RunConfiguration | null> {
  if (config.provider === "static") return config.staticConfiguration;
  if (!config.apiKey || !config.model) return null;

  try {
    if (config.provider === "ollama") return await generateWithOllama(config, signal);
    if (config.provider === "anthropic") return await generateWithAnthropic(config, signal);
    return await generateWithOpenAI(config, signal);
  } catch {
    return null;
  }
}

export { directorOutputSchema };
