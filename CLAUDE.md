# CLAUDE.md

Commons Front End: a personal home for Ve's small apps and utilities, on GitHub
Pages (https://vekbui96.github.io/commons/). The backend is a separate repo,
**Commons API** (`vekbui96/commons-api`, `D:\projects\commons-api`), not
deployed yet. Architecture and the add-an-app steps are in `README.md`; the
shared contract is `docs/api-contract.md`.

## Rules

- Stack matches CardLens: TypeScript, Vite + React, Vitest.
- **Adding an app = a folder + a manifest.** `src/apps/<id>/manifest.ts`
  (+ `App.tsx` if internal). Never hand-edit a list of apps; the registry
  discovers them.
- **All API calls go through `src/api/client.ts`**, base URL from
  `VITE_COMMONS_API`. Unset means no backend: check `hasApi()` and hide backend
  features. No `fetch` to the API anywhere else.
- **Contract changes go in both repos.** Edit `docs/api-contract.md` here and in
  `D:\projects\commons-api\docs\api-contract.md` together.
- **This page is public.** No tailnet hostnames (`*.ts.net`), the ops dashboard,
  LAN addresses or secrets anywhere in `src/`. A registry test enforces the host
  rule. `VITE_` values end up in the public bundle.
- `private` apps stay hidden until the API has auth.
- Styling goes through `src/styles/tokens.css` variables; keep it plain,
  light + dark, phone first. No cards nested inside cards.

## Commands

- `npm run verify` before every commit (format check, typecheck, lint, tests; CI runs the same).
- `npm run format` after scripted or bulk edits.
- **Never build or deploy from Git Bash**: MSYS rewrites `/commons/`-style paths and
  breaks every asset. Use PowerShell or the workflow.

## Deploy

- Push to `main` (or `gh workflow run deploy-pages.yml --repo vekbui96/commons`).
- **A blank SPA returns 200.** After a deploy, load the page in a browser at phone
  and desktop widths and look at it.
- Every GitHub comment an agent posts as vekbui96 starts with `<!-- claude-agent -->`
  on its own line.
