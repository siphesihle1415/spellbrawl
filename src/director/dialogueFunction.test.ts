import { afterEach, describe, expect, it, vi } from "vitest";
import dialogue from "../../netlify/functions/dialogue.mts";

const monster = { name: "Embermaw", title: "The Starved Flame", theme: "FIRE" };

const request = (body: unknown = { round: "EMBERMAW", monster }) =>
  new Request("http://localhost/.netlify/functions/dialogue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("dialogue function", () => {
  it("returns no lines without calling an API in standalone mode", async () => {
    vi.stubEnv("LLM_DIRECTOR_PROVIDER", "static");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await dialogue(request(), {} as never);

    expect(await response.json()).toEqual({ lines: null, source: "static" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns AI-generated lines when the provider responds with valid output", async () => {
    vi.stubEnv("LLM_DIRECTOR_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const lines = [
      "The rehearsal is over. Now the flame bites back with everything it has left.",
      "We learned your rhythm during the practice bout.",
      "And we brought twice the fire to answer it.",
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      output_text: JSON.stringify({ lines }),
    })));

    const response = await dialogue(request(), {} as never);

    expect(await response.json()).toEqual({ lines, source: "ai" });
  });

  it("falls back when the model output has the wrong line count", async () => {
    vi.stubEnv("LLM_DIRECTOR_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      content: [{ type: "text", text: JSON.stringify({ lines: ["Only one line here, far too short a script."] }) }],
    })));

    const response = await dialogue(request(), {} as never);

    expect(await response.json()).toEqual({ lines: null, source: "fallback" });
  });

  it("falls back when the model output contains an empty line", async () => {
    vi.stubEnv("LLM_DIRECTOR_PROVIDER", "ollama");
    vi.stubEnv("OLLAMA_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      message: { content: JSON.stringify({ lines: ["", "Second line is long enough to pass.", "Third line is long enough to pass."] }) },
    })));

    const response = await dialogue(request(), {} as never);

    expect(await response.json()).toEqual({ lines: null, source: "fallback" });
  });

  it("falls back when the model returns malformed JSON", async () => {
    vi.stubEnv("LLM_DIRECTOR_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ output_text: "not json" })));

    const response = await dialogue(request(), {} as never);

    expect(await response.json()).toEqual({ lines: null, source: "fallback" });
  });

  it("rejects requests with an invalid body", async () => {
    vi.stubEnv("LLM_DIRECTOR_PROVIDER", "static");

    const response = await dialogue(request({ round: "NOT_A_ROUND", monster }), {} as never);

    expect(response.status).toBe(400);
  });

  it("rejects non-POST requests", async () => {
    const response = await dialogue(new Request("http://localhost/.netlify/functions/dialogue"), {} as never);
    expect(response.status).toBe(405);
  });
});
