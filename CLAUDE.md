# CLAUDE.md

Commons: a personal home for Ve's small apps and utilities. Front end on GitHub
Pages (https://vekbui96.github.io/commons/); backend scaffolded, not deployed.
Architecture and the add-an-app steps are in `README.md`.

## Rules

- Stack matches CardLens: TypeScript, Vite + React (`web/`), Express run with
  `tsx` (`server/`), storage in built-in `node:sqlite`. **No better-sqlite3** or
  other native modules: native builds on server-pc are a pain.
- **Adding an app = a folder + a manifest.** `web/src/apps/<id>/manifest.ts`
  (+ `App.tsx` if internal). Never hand-edit a list of apps; the registry
  discovers them.
- **Backend: one entry point, apps plug in.** `server/src/index.ts` is the only
  process and port. An app's backend is `server/src/apps/<id>/routes.ts`
  exporting a router factory, auto-mounted under `/api/apps/<id>/`. Shared
  things (health, db, per-app KV, later auth) stay in `server/src/core/`.
  Never start a second server or port for an app.
- **This page is public.** No tailnet hostnames (`*.ts.net`), the ops dashboard,
  LAN addresses or secrets anywhere in `web/`. A registry test enforces the host rule.
- `private` apps stay hidden until auth exists. Don't expose write endpoints before then.
- Styling goes through `web/src/styles/tokens.css` variables; keep it plain,
  light + dark, phone first. No cards nested inside cards.
- Migrations in `server/src/core/db.ts` are append-only.

## Commands

- `npm run verify` before every commit (format check, typecheck, lint, tests; CI runs the same).
- `npm run format` after scripted or bulk edits.
- **Never build or deploy from Git Bash**: MSYS rewrites `/commons/`-style paths and
  breaks every asset. Use PowerShell or the workflow.

## Deploy

- Front end: push to `main` (or `gh workflow run deploy-pages.yml --repo vekbui96/commons`).
- **A blank SPA returns 200.** After a deploy, load the page in a browser at phone
  and desktop widths and look at it.
- Backend: not deployed. The plan is in `server/README.md` (NSSM + Funnel on 443 or
  10000; 8443 is CardLens's). Don't install a service without being asked.
- Every GitHub comment an agent posts as vekbui96 starts with `<!-- claude-agent -->`
  on its own line.
