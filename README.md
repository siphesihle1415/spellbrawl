<p align="center">
  <img src="docs/assets/spellbrawl-logo.svg" alt="SpellBrawl" width="520" />
</p>

A two-player co-op browser game where players cast spells with hand gestures, coordinate against three enemies, and finish the Hexwyrm with a fusion attack. 

## Run the game

```bash
npm install
npm run dev
```

`npm run dev` starts all three local services together:

- Cloudflare room worker at `127.0.0.1:8787`
- Vite application server at `127.0.0.1:5173`
- Netlify proxy and Director Function at [http://localhost:8888](http://localhost:8888)

Open port `8888`, not the Vite port, so calls to `/.netlify/functions/director` are available. To test multiplayer on one computer, open the same URL in two browser windows, create a room in one, and join with the displayed code in the other.

The initial implementation includes the deterministic three-round combat loop, a React Three Fiber arena, camera-based MediaPipe gesture tracking without a visible webcam feed, keyboard/debug gesture controls, and a multiplayer integration boundary.

Each player can use keys `1`–`4` for local testing. They map to `FIST`, `OPEN_PALM`, `POINT`, and `PINCH`; gestures are attributed to that browser's assigned player. See [MOVES.md](MOVES.md) for every gesture recipe, per-encounter mechanics, and the Hexwyrm's phase sequence.

## Commands

```bash
npm test
npm run test:e2e
npm run build
```

## LLM Director

Three Netlify Functions share one provider/fallback pipeline (`src/director/providers.ts`):

- `director` — the room host requests one presentation configuration and shares the validated result with the guest. The Director may select only curated enemy names, titles, elemental themes, and finisher copy; combat rules, health, damage, phases, and gesture recipes remain deterministic.
- `loader-facts` — flavor facts shown on the asset-loading screen.
- `dialogue` — combat lines for each real encounter (Embermaw, Shard Warden, Hexwyrm), requested per round and synced from host to guest. Tutorial dialogue stays fully static and does not call this function.

Every function falls back to a built-in static script if the provider is unset, times out, or returns output that fails validation, so the game always starts and plays normally offline.

The active implementation is selected entirely through `LLM_DIRECTOR_PROVIDER`:

| Value | Required configuration | Behavior |
|---|---|---|
| `ollama` | `OLLAMA_API_KEY`, `OLLAMA_DIRECTOR_MODEL` | Uses Ollama Cloud. This is the default. |
| `anthropic` | `ANTHROPIC_API_KEY`, `ANTHROPIC_DIRECTOR_MODEL` | Uses the Anthropic Messages API. |
| `openai` | `OPENAI_API_KEY`, `OPENAI_DIRECTOR_MODEL` | Uses the OpenAI Responses API with Structured Outputs. |
| `static` | Optional `LLM_DIRECTOR_STATIC_CONFIG` | Uses a standalone, schema-validated JSON configuration without calling an API. |

Provider base URLs, server/client timeouts, and the multiplayer worker host are also environment-driven. See [.env.example](.env.example) for every supported setting. Switching the deployed Director to Ollama, for example, requires only:

```bash
netlify env:set LLM_DIRECTOR_PROVIDER ollama
```

For standalone mode, set `LLM_DIRECTOR_PROVIDER=static`. `LLM_DIRECTOR_STATIC_CONFIG` may contain a one-line JSON object matching `RunConfigurationSchema`; if it is omitted or invalid, the built-in configuration is used.

Use `netlify dev` when testing the Director locally. If credentials are missing, the request times out, or output fails Effect Schema validation, the function returns the built-in configuration and the game starts normally. Provider keys remain server-side and must never use a `VITE_` prefix.

Repository-level CI secrets can be synchronized from a local ignored `.env` file with `gh secret set -f .env`. GitHub secrets and Netlify runtime variables are separate stores; set the same runtime values in Netlify when deploying the function.

## Netlify

The repository includes `netlify.toml`. Netlify must run `npm run build` and publish `dist`; publishing the repository root will not serve the compiled Vite application.

### Debugging AI responses on Netlify

`director`, `dialogue`, and `loader-facts` are Netlify Functions, not Edge Functions. In the Netlify project, open **Logs & Metrics > Functions**, select the function and deployment, and filter by the `x-spellbrawl-request-id` response header from your browser's Network tab. See [Netlify's function log instructions](https://docs.netlify.com/build/functions/logs/).

Every invocation logs `function.start` and `function.complete` (or `function.error`). Provider calls log `llm.start`, `llm.response`, then `llm.complete` or `llm.fallback`. Records include the request ID, function name, operation, provider/model, duration, HTTP status where available, and the response source. `llm.skipped` means no provider request was made: its reason identifies `static_provider`, `missing_api_key`, or `missing_model`. Fallback reasons distinguish `timeout`, `http_error`, `network_error`, `invalid_json`, and `invalid_output`. Logs omit credentials, prompts, response bodies, and raw error messages.

The release/mvp4 investigation found that production could return AI configuration successfully while loader facts returned fallback after approximately the 15-second server deadline. The old implementation hid the cause. Separately, dialogue responses were discarded after normal React rerenders because encounter object identity cancelled the pending effect. The hook now reuses its pending request and reattaches after cleanup.

Ollama GPT-OSS requests use `think: "low"` to reduce reasoning latency; GPT-OSS cannot disable thinking entirely ([Ollama documentation](https://docs.ollama.com/capabilities/thinking)). `LLM_DIRECTOR_TIMEOUT_MS` remains configurable from 1,000 to 30,000 ms, defaulting to 15,000. The browser defaults to 35,000 ms to allow the maximum server deadline plus overhead. If overriding `VITE_DIRECTOR_TIMEOUT_MS`, keep it longer than the server timeout. Lower reasoning is a latency mitigation, not a guarantee that the provider will meet the deadline.

Release deployments synchronize provider variables to Netlify's **production** context. To configure Anthropic for **Deploy Previews**, manually run `deploy-release.yml` with `configure_preview=true` on a trusted branch containing this workflow. This runs the Netlify CLI with existing GitHub secrets and skips production deployment. Rebuild the preview after configuration completes. Without preview credentials in the **Functions** scope, the result is `llm.skipped` with `missing_api_key`. The host requests the run configuration; round dialogue is requested by the host outside the tutorial. Loader facts are requested by the loading screens.

See [the game documentation](docs/README.md) for the scope, architecture, implementation plan, contracts, and validation checklist.
