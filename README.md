# Commons Front End

A personal home for small apps and utilities, made as they are needed. The
homepage lists every app; some live inside Commons, others are links to sites
elsewhere.

Live: https://vekbui96.github.io/commons/

Commons is two repos, like the portfolio:

| Repo                                                                 | What                                                                                       |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [`vekbui96/commons`](https://github.com/vekbui96/commons) (this one) | **Commons Front End**: Vite + React on GitHub Pages                                        |
| [`vekbui96/commons-api`](https://github.com/vekbui96/commons-api)    | **Commons API**: one Express + `node:sqlite` server that apps plug into (not deployed yet) |

Their contract (base URL, CORS, health shape, `/api/apps/<id>/`) is in
[`docs/api-contract.md`](docs/api-contract.md), kept identical in both repos.

## Architecture

```
commons/
├─ src/
│  ├─ apps/<id>/         one folder per app
│  │  ├─ manifest.ts     id, name, description, icon, kind, visibility
│  │  └─ App.tsx         internal apps only, lazy-loaded at #/apps/<id>
│  ├─ registry/          discovers apps/*/manifest.ts, validates them
│  ├─ shell/             homepage, app host, routes (hash router)
│  ├─ api/client.ts      the only module that calls the Commons API
│  └─ styles/            tokens.css (all colours/type/space) + base.css
├─ docs/api-contract.md
└─ .github/workflows/    ci.yml, deploy-pages.yml
```

- The registry uses `import.meta.glob` to find every `src/apps/*/manifest.ts`
  at build time, so the homepage needs no edits when an app is added.
- `kind` is `internal` (a route inside Commons, code-split and lazy-loaded) or
  `external` (a link out, opened in a new tab).
- `visibility` is `public` or `private`; private apps stay off the homepage
  until the API has auth.
- Routing is hash-based (`#/apps/units`) so deep links work on Pages without a
  server fallback.
- API calls go through `src/api/client.ts`, with the base URL from
  `VITE_COMMONS_API`. It is unset for now, which means no backend features.

## Local development

```powershell
npm install
npm run dev       # http://localhost:5180 (proxies /api to a local Commons API on 8790)
npm run verify    # format check, typecheck, lint, tests (what CI runs)
npm run build     # production build into dist/ (base /commons/)
npm run preview   # serve dist/ at http://localhost:4173/commons/
```

Use PowerShell, not Git Bash, for builds: MSYS rewrites path-like env values
such as `VITE_BASE=/commons/` and breaks every asset.

## Adding an app

1. Create `src/apps/<id>/manifest.ts` with `export default defineApp({...})`.
   The id is kebab-case and must equal the folder name.
2. For an internal app, add `App.tsx` in the same folder with a default-exported
   component. For an external app, set `kind: "external"` and an https `url`.
3. If it needs a backend, add `src/apps/<id>/routes.ts` in `commons-api` with
   the same id; call it here with `appApiUrl("<id>", "...")` from the client.

The registry tests check every manifest (valid fields, unique ids, https URLs,
an `App.tsx` for internal apps), so `npm run verify` catches mistakes.

## Deploy

Pushing to `main` runs `deploy-pages.yml`, which verifies, builds and publishes
`dist/` to Pages. To redeploy by hand:
`gh workflow run deploy-pages.yml --repo vekbui96/commons`.
