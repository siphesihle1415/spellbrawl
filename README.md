# SpellBrawl

A two-player co-op browser game where players cast spells with hand gestures, coordinate against three enemies, and finish the Hexwyrm with a fusion attack.

## Run the POC

```bash
npm install
npm run dev
```

The initial implementation includes the deterministic three-round combat loop, a React Three Fiber arena, camera-based MediaPipe gesture tracking without a visible webcam feed, keyboard/debug gesture controls, and a multiplayer integration boundary.

Use keys `1`–`6` for Player A and `Shift+1`–`Shift+6` for the simulated Player B. The keys map to `FIST`, `THRUST`, `OPEN_PALM`, `POINT`, `PINCH`, and `HANDS_APART`.

## Commands

```bash
npm test
npm run build
```

## LLM Director

The room host requests one presentation configuration from a Netlify Function and shares the validated result with the guest. The Director may select only curated enemy names, titles, elemental themes, and finisher copy; combat rules, health, damage, phases, and gesture recipes remain deterministic.

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

See [the POC documentation](poc/README.md) for the scope, architecture, implementation plan, contracts, and validation checklist.
