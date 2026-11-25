# Private check (test)

Shows API health and your Tailscale login at `#/apps/private-check`. Internal, **private** (never in the public build), backend: core `/api/health` and `/api/session` only.

- `manifest.ts`: registry entry (`visibility: "private"`). `App.tsx`: one Card with a facts list, inside `NeedsApi`.
- `session.ts`: `describeSessionError` turns /api/session error codes into a plain sentence.
- `private-check.css`: layout only, tokens only.

Rules:

- Saves nothing. Proof that the private build, same-origin API and identity work; replace it once a real private app exists.
- From server-pc itself `/api/session` answers `self_request` by design; the app says so instead of erroring.
- Keep `data-testid="private-check-login"` (App.test.tsx).

Test: `npm run check:app -- private-check`. Check dist: `node scripts/check-dist.mjs public` after a public build.
