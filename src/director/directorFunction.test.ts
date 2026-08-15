import { afterEach, describe, expect, it, vi } from "vitest";
import director from "../../netlify/functions/director.mts";
import loaderFacts from "../../netlify/functions/loader-facts.mts";
import { defaultRunConfiguration } from "./defaultConfig";
import { fallbackLoaderFacts } from "./loaderFacts";

const request = () => new Request("http://localhost/.netlify/functions/director", { method: "POST" });
const factsRequest = () => new Request("http://localhost/.netlify/functions/loader-facts", { method: "POST" });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("loader facts function", () => {
  it("returns loading-screen facts without calling an API in standalone mode", async () => {
    vi.stubEnv("LLM_DIRECTOR_PROVIDER", "static");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await loaderFacts(factsRequest(), {} as never);

    expect(await response.json()).toEqual({ facts: fallbackLoaderFacts, source: "static" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the selected provider for generated facts", async () => {
    vi.stubEnv("LLM_DIRECTOR_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      output_text: JSON.stringify({ facts: [
        "Embermaw sleeps beneath volcanic stone until the arena's first spark wakes its hunger.",
        "Shard Warden counts the echoes in every crystal chamber before it chooses a challenger.",
        "The Hexwyrm bends rift-light into a path only two united spellcasters can safely follow.",
      ] }),
    })));

    const response = await loaderFacts(factsRequest(), {} as never);

    expect((await response.json()).source).toBe("ai");
  });
});

describe("director function", () => {
  it("returns a standalone run without calling an API", async () => {
    vi.stubEnv("LLM_DIRECTOR_PROVIDER", "static");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await director(request(), {} as never);
    expect(await response.json()).toEqual({ configuration: defaultRunConfiguration, source: "static" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses Ollama Cloud when selected", async () => {
    vi.stubEnv("LLM_DIRECTOR_PROVIDER", "ollama");
    vi.stubEnv("OLLAMA_API_KEY", "test-key");
    vi.stubEnv("OLLAMA_DIRECTOR_MODEL", "test-model");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      message: { content: `\`\`\`json\n${JSON.stringify(defaultRunConfiguration)}\n\`\`\`` },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await director(request(), {} as never);
    expect(await response.json()).toEqual({ configuration: defaultRunConfiguration, source: "ai" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://ollama.com/api/chat");
    const options = fetchMock.mock.calls[0][1];
    expect(options.headers.authorization).toBe("Bearer test-key");
    expect(JSON.parse(options.body as string)).toMatchObject({ model: "test-model", stream: false });
  });

  it("uses OpenAI Structured Outputs when selected", async () => {
    vi.stubEnv("LLM_DIRECTOR_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      output: [{
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(defaultRunConfiguration) }],
      }],
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await director(request(), {} as never);
    expect(await response.json()).toEqual({ configuration: defaultRunConfiguration, source: "ai" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.text.format).toMatchObject({ type: "json_schema", strict: true });
    expect(body.text.format.schema.$schema).toBeUndefined();
  });

  it("falls back when model output does not pass the fixed vocabulary schema", async () => {
    vi.stubEnv("LLM_DIRECTOR_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      content: [{
        type: "text",
        text: JSON.stringify({
          ...defaultRunConfiguration,
          embermaw: { ...defaultRunConfiguration.embermaw, theme: "ACID" },
        }),
      }],
    })));

    const response = await director(request(), {} as never);
    expect(await response.json()).toEqual({ configuration: defaultRunConfiguration, source: "fallback" });
  });
});
