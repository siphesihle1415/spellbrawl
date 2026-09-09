# Repository and game audit — 2026-09-09

Base: release/mvp4 at dc44354.

## Fixed findings

- **Mobile playground controls were covered.** At 390px, the spellbook intercepted clicks on Breath Barrier and Armor Phase. Stack the heading and selector naturally; keep a compact Help entry beside the camera on mobile. All seven spells remain selectable.
- **Move help was not keyboard-modal.** Tab could focus the camera controls behind the overlay. Use a native modal dialog and restore focus to Help when dismissed.
- **Full rooms left a third player connecting indefinitely.** The transport resolved on WebSocket open before the server accepted the connection. Wait for ROLE_ASSIGNED, handle the room-full close, and allow retry. Disable entering practice during an in-flight connection.
- **The Hexwyrm core hit had no Firebolt effect.** Emit the effect when transitioning to the finisher phase so both clients receive sound and visuals.
- **Room relay edge cases could corrupt play.** Ignore non-object JSON and unknown/invalid input events, attach the assigned identity even when playerId is omitted, restrict dialogue synchronization to the host, and assign vacant roles without duplicating the surviving guest.

## Coverage

Validation passed: 102 unit tests, all 13 Playwright tests, the production build, and the Netlify Functions TypeScript check. The mobile test was rerun successfully after the final camera-width adjustment. Screenshots at 320, 390, and 760px were reviewed.

Reviewed the application lifecycle, game reducer and progression, rendering/asset loading, audio, hand-tracking lifecycle, UI/CSS, room transport and worker relay, director clients/functions/providers, deployment configuration, and dependency audit output. Ran the production build and unit suite. Browser coverage includes real monster assets and both camera perspectives, two-client room/camera setup, gestures and audio, practice spells, AI dialogue rerenders, startup loading/music, mobile controls, help focus, room rejection/retry, and the full multiplayer progression.

Browser gameplay uses the local Vite app and Cloudflare worker. Multiplayer gesture tests use the existing lightweight keyboard/camera mode; real model rendering is covered separately. These checks do not verify physical hand recognition, device speakers, Safari/iOS, production network conditions, or live paid LLM calls. Function/provider behavior is covered by mocked unit tests.

## Follow-up findings

- `npm audit` reports five development dependency findings (three high, two moderate), representing the Sharp/Miniflare/Wrangler chain and Vitest/mocker. `npm audit --omit=dev` reports zero. Review [Sharp's advisory](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c) and [Vitest's advisory](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) in a tooling upgrade: npm proposes Vitest 5 and a Wrangler version outside the current range. No forced dependency changes were applied in this gameplay patch.
- The production bundle still emits the existing >500kB chunk warning (roughly 1.54MB JS before gzip). Splitting rendering/hand-tracking code merits a separate performance change with cold-load measurements.
- Startup asset failure intentionally leaves the startup curtain visible, with no retry UI; the existing test explicitly requires that behavior. This remains a recovery limitation and should be reconsidered as a product decision.
