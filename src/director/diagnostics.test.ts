import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import director from "../../netlify/functions/director.mts";
import dialogue from "../../netlify/functions/dialogue.mts";
import facts from "../../netlify/functions/loader-facts.mts";
import { defaultRunConfiguration } from "./defaultConfig";
import { fallbackLoaderFacts } from "./loaderFacts";

let events: Array<Record<string, unknown>>;
beforeEach(() => {
  events = [];
  for (const level of ["info", "warn", "error"] as const) {
    vi.spyOn(console, level).mockImplementation((entry) => events.push(JSON.parse(entry)));
  }
  vi.stubEnv("LLM_DIRECTOR_PROVIDER", "ollama");
  vi.stubEnv("OLLAMA_API_KEY", "do-not-log-this-key");
  vi.stubEnv("OLLAMA_DIRECTOR_MODEL", "gpt-oss:20b");
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const request = () => new Request("https://example.com/.netlify/functions/director", { method: "POST" });
const context = { requestId: "netlify-request-123" } as never;

describe("function and provider diagnostics", () => {
  it("correlates success and requests low GPT-OSS reasoning for all three operations", async () => {
    const lines = ["The fire rises to meet your challenge.", "We stand together before your flames.", "And together we will end this trial."];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ message: { content: JSON.stringify(defaultRunConfiguration) } }))
      .mockResolvedValueOnce(Response.json({ message: { content: JSON.stringify({ facts: fallbackLoaderFacts }) } }))
      .mockResolvedValueOnce(Response.json({ message: { content: JSON.stringify({ lines }) } }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await director(request(), context);
    await facts(request(), { requestId: "facts-request" } as never);
    await dialogue(new Request(request(), { body: JSON.stringify({
      round: "EMBERMAW", monster: { name: "Embermaw", title: "The Starved Flame", theme: "FIRE" },
    }) }), { requestId: "dialogue-request" } as never);
    expect(response.headers.get("x-spellbrawl-request-id")).toBe("netlify-request-123");
    expect(events.filter((event) => event.requestId === "netlify-request-123").map((event) => event.event))
      .toEqual(["function.start", "llm.start", "llm.response", "llm.complete", "function.complete"]);
    expect(events.filter((event) => event.event === "llm.complete")).toHaveLength(3);
    for (const [, options] of fetchMock.mock.calls) expect(JSON.parse(options.body).think).toBe("low");
    expect(JSON.stringify(events)).not.toContain("do-not-log-this-key");
    expect(JSON.stringify(events)).not.toContain(lines[0]);
  });

  it("records HTTP failure status without logging the provider error body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("secret upstream error", { status: 401 })));
    const response = await director(request(), context);
    expect((await response.json()).source).toBe("fallback");
    expect(events).toContainEqual(expect.objectContaining({ event: "llm.fallback", reason: "http_error", status: 401 }));
    expect(JSON.stringify(events)).not.toContain("secret upstream error");
  });

  it("distinguishes missing credentials from an attempted LLM call", async () => {
    vi.stubEnv("OLLAMA_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await director(request(), context);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(events).toContainEqual(expect.objectContaining({ event: "llm.skipped", reason: "missing_api_key" }));
    expect(events.some((event) => event.event === "llm.start")).toBe(false);
  });

  it("logs invalid output separately from malformed provider JSON", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({ message: { content: "not a configuration" } }))
      .mockResolvedValueOnce(new Response("not JSON")));
    await director(request(), context);
    await director(request(), context);
    expect(events.filter((event) => event.event === "llm.fallback").map((event) => event.reason))
      .toEqual(["invalid_output", "invalid_json"]);
  });

  it("logs timeouts and returns fallback without leaking the thrown error", async () => {
    vi.useFakeTimers();
    vi.stubEnv("LLM_DIRECTOR_TIMEOUT_MS", "1000");
    vi.stubGlobal("fetch", vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("secret transport detail")));
    })));
    const pending = director(request(), context);
    await vi.advanceTimersByTimeAsync(1000);
    expect((await (await pending).json()).source).toBe("fallback");
    expect(events).toContainEqual(expect.objectContaining({ event: "llm.fallback", reason: "timeout" }));
    expect(JSON.stringify(events)).not.toContain("secret transport detail");
  });

  it("logs rejected function requests without invoking a provider", async () => {
    const response = await dialogue(request(), context);
    expect(response.status).toBe(400);
    expect(events.map((event) => event.event)).toEqual(["function.start", "function.complete"]);
    expect(events[1]).toMatchObject({ status: 400, requestId: "netlify-request-123" });
  });

  it("keeps concurrent request IDs isolated", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return Response.json({ message: { content: JSON.stringify(defaultRunConfiguration) } });
    }));
    await Promise.all([director(request(), context), director(request(), { requestId: "other-request" } as never)]);
    for (const requestId of ["netlify-request-123", "other-request"]) {
      expect(events.filter((event) => event.requestId === requestId).map((event) => event.event))
        .toEqual(["function.start", "llm.start", "llm.response", "llm.complete", "function.complete"]);
    }
  });
});
