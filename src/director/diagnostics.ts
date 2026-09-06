import { AsyncLocalStorage } from "node:async_hooks";
import type { Context } from "@netlify/functions";

type Fields = Record<string, string | number | boolean | undefined>;
const requests = new AsyncLocalStorage<Fields>();

// Only pass diagnostic metadata here: never prompts, bodies, credentials, or raw errors.
export function logEvent(event: string, fields: Fields = {}, level: "info" | "warn" | "error" = "info") {
  console[level](JSON.stringify({ timestamp: new Date().toISOString(), ...requests.getStore(), event, ...fields }));
}

export function withFunctionLogging(
  name: string,
  handler: (request: Request, context: Context) => Promise<Response>,
) {
  return (request: Request, context: Context): Promise<Response> => {
    const requestId = context.requestId || crypto.randomUUID();
    return requests.run({ function: name, requestId }, async () => {
      const started = Date.now();
      logEvent("function.start", { method: request.method });
      try {
        const response = await handler(request, context);
        response.headers.set("x-spellbrawl-request-id", requestId);
        const body = await response.clone().json().catch(() => null);
        logEvent("function.complete", {
          status: response.status,
          durationMs: Date.now() - started,
          source: body?.source,
        }, response.status >= 400 ? "warn" : "info");
        return response;
      } catch {
        logEvent("function.error", { durationMs: Date.now() - started, reason: "unexpected_error" }, "error");
        return Response.json({ error: "Internal server error" }, {
          status: 500,
          headers: { "x-spellbrawl-request-id": requestId, "cache-control": "no-store" },
        });
      }
    });
  };
}
