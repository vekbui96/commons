# Commons

A personal home for small apps and utilities, made as they are needed. The
homepage lists every app; some live inside Commons, others are links to sites
elsewhere.

Live: https://vekbui96.github.io/commons/

## Architecture

One repo, two npm workspaces, TypeScript throughout.

```
commons/
├─ web/                     Vite + React front end (GitHub Pages)
│  └─ src/
│     ├─ apps/<id>/         one folder per app
│     │  ├─ manifest.ts     id, name, description, icon, kind, visibility
│     │  └─ App.tsx         internal apps only, lazy-loaded at #/apps/<id>
│     ├─ registry/          discovers apps/*/manifest.ts, validates them
│     ├─ shell/             homepage, app host, routes (hash router)
│     └─ styles/            tokens.css (all colours/type/space) + base.css
├─ server/                  Express + node:sqlite backend (scaffolded, not deployed)
│  ├─ src/index.ts          the one entry point: one process, one port
│  ├─ src/server.ts         core routes + mounts app routers
│  ├─ src/core/             db + migrations, per-app KV, app discovery
│  ├─ src/apps/<id>/        an app's backend: routes.ts exporting a router
│  └─ test/
└─ .github/workflows/       ci.yml, deploy-pages.yml
```

**Front end.** The registry uses `import.meta.glob` to find every
`web/src/apps/*/manifest.ts` at build time, so the homepage needs no edits when
an app is added. A manifest's `kind` is `internal` (a route inside Commons,
code-split and lazy-loaded) or `external` (a link out, opened in a new tab).
`visibility` is `public` or `private`; private apps stay out of the homepage
until the backend has auth. Routing is hash-based (`#/apps/units`) so deep links
work on Pages without a server fallback.

**Back end: one entry point, apps plug in.** The server is a single process on a
single port (`server/src/index.ts`). Apps never get their own server. An app that
needs a backend adds `server/src/apps/<id>/routes.ts`, default-exporting a router
factory; the entry point discovers it on start and mounts it under
`/api/apps/<id>/`. Shared pieces live in the core and are handed to each router:
the SQLite database, a KV store scoped to the app, and later auth. Core routes:
`GET /api/health`. See `server/README.md` for config and the deploy plan.

## Local development

Node 24 or newer (the server uses the built-in `node:sqlite`).

```powershell
npm install
npm run dev          # front end on http://localhost:5180
npm run dev:server   # API on http://127.0.0.1:8790 (proxied at /api in dev)
npm run verify       # format check, typecheck, lint, tests (what CI runs)
npm run build        # production build into web/dist (base /commons/)
```

Use PowerShell, not Git Bash, for builds: MSYS rewrites path-like env values
such as `VITE_BASE=/commons/` and breaks every asset.

## Adding an app

1. Create `web/src/apps/<id>/manifest.ts` with `export default defineApp({...})`.
   The id is kebab-case and must equal the folder name.
2. For an internal app, add `App.tsx` in the same folder with a default-exported
   component. For an external app, set `kind: "external"` and an https `url`.
3. If it needs a backend, add `server/src/apps/<id>/routes.ts`:

   ```ts
   import { Router } from "express";
   import { defineAppRouter } from "../../core/apps";

   export default defineAppRouter(({ kv }) => {
     const router = Router();
     router.get("/count", (_req, res) => res.json({ count: kv.get<number>("count") ?? 0 }));
     return router;
   });
   ```

   It is served at `/api/apps/<id>/count`.

The registry tests check every manifest (valid fields, unique ids, https URLs,
an `App.tsx` for internal apps), so `npm run verify` catches mistakes.

## Deploy

Pushing to `main` runs `deploy-pages.yml`, which verifies, builds and publishes
`web/dist` to Pages. To redeploy by hand:
`gh workflow run deploy-pages.yml --repo vekbui96/commons`.
