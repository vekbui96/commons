# CLAUDE.md

Commons Front End: a personal home for Ve's small apps and utilities. The backend
is a separate repo, **Commons API** (`vekbui96/commons-api`,
`D:\projects\commons-api`).

**One repo, two builds** (`COMMONS_TARGET`, see `build/target.ts`):

- **Public** (default): GitHub Pages, https://vekbui96.github.io/commons/, base
  `/commons/`. Only `visibility: "public"` apps; private apps are cut out of the
  bundle, not just hidden.
- **Private**: every app, base `/`, the API on the same origin under `/api`.
  Served from `D:\services\commons-web\` on server-pc by `tailscale serve` on
  port 8445, **tailnet only, never Funnel**.

This file is a short index plus the rules every app shares. **App-specific
detail never goes here.** It goes in that app's own CLAUDE.md.

## Index

- `README.md`: architecture, style system, adding an app, local dev.
- `docs/api-contract.md`: the contract with the API (identical in both repos).
- `src/apps/<id>/CLAUDE.md`: one per internal app (what it does, files, its rules,
  how to test it). Read the one for the app you are changing.
- `docs/templates/app-CLAUDE.md`: the template for a new app's CLAUDE.md.

## Rules

- Stack matches CardLens: TypeScript, Vite + React, Vitest.
- **Adding an app = a folder + a manifest.** `src/apps/<id>/manifest.ts`
  (+ `App.tsx` and a CLAUDE.md if internal). Never hand-edit a list of apps; the
  registry discovers them.
- **Every internal app has its own short CLAUDE.md** in its folder (15 lines or
  fewer, from the template). External-link apps (manifest only) don't need one.
  A registry test enforces it.
- **The wall between apps.** No source imports between apps. An app imports only
  from its own folder, `src/ui`, `src/api`, `src/styles` and `src/registry/types`
  (for `defineApp`). Nothing outside `src/apps/` imports an app's files; the
  registry finds them with `import.meta.glob`. A finished app is reused only as a
  published runtime embed (a web component at a versioned URL such as
  `embed/v1.js`, loaded live). That embed does not exist yet; the rule stands
  anyway. ESLint enforces it (`commons/app-boundaries`, `eslint/app-boundaries.js`).
- **All API calls go through `src/api/client.ts`**. Private build: same origin
  (`/api/...`). Public build: `VITE_COMMONS_API`, unset (no backend, `hasApi()`
  false) until Ve asks for optional private features there. No `fetch` to the API
  anywhere else. Writes use `sendJson` (CSRF token from `/api/session`).
- **Reachable is not configured.** The API answers only on the tailnet. Wrap API
  features in `<NeedsApi>` (or `useApi()`: `checking | reachable | unreachable`);
  unreachable shows a quiet "Connect to Tailscale to use this", never an error.
- **Contract changes go in both repos.** Edit `docs/api-contract.md` here and in
  `D:\projects\commons-api\docs\api-contract.md` together.
- **This page is public.** No tailnet hostnames (`*.ts.net`), the ops dashboard,
  LAN addresses or secrets anywhere in `src/`. A registry test enforces the host
  rule. `VITE_` values end up in the public bundle.
- **`visibility: "private"` apps exist only in the private build.** Write it as a
  plain literal in the manifest (the build reads it; a test checks). The public
  build swaps the registry glob's placeholder for negative patterns, so no private
  manifest, component or chunk reaches Pages; `node scripts/check-dist.mjs public`
  (CI and the Pages deploy run it) fails if a private id or name is in `dist/`.
  App code is still public on GitHub: data stays on server-pc, never in source.
- The private site shows a "Private" mark (`SiteMark`, in the top bar and on the
  homepage). Keep it.
- **Mobile first; must look good on Windows.** This is a rule, not a
  suggestion. Every UI change is checked at 390px and at 1440px with
  Windows-style 125% scaling (Playwright `deviceScaleFactor: 1.25`), in both
  light and dark (and forced-colors for new controls).
- **One style system.** Colours, fonts, type, space, radii and shadows live only
  in `src/styles/tokens.css` (primitives -> semantic roles -> dark roles) and
  `tokens-fonts.css` (self-hosted OFL fonts). Apps use semantic roles only
  (`--bg`, `--surface`, `--text`, `--accent`, ...), never primitives.
  `src/styles/guard.test.ts` fails on any hex/`rgb(`/`hsl(` colour, font name or
  weight below 400 outside `src/styles/tokens*.css` (exception: a
  `style-guard-allow` comment with a reason). `tokens.test.ts` checks WCAG AA
  contrast for the key pairs in both modes; keep it green when changing colours.
- Plain, light + dark, phone first. No cards nested inside cards. 44px tap
  targets, visible focus, hover only under `@media (hover: hover)`.

## How to style a new app (5 lines)

1. Wrap nothing: `AppHost` already puts your `App.tsx` in `<AppShell>` (top bar, ~680px column).
2. Build from `@/ui`: `Button`, `Input`, `Select`, `Field`, `ListRow`, `Card`, `Toast`/`useToast`.
3. Extra CSS goes in `src/apps/<id>/<id>.css`, layout only, using `var(--space-*)`, `var(--text-*)` and semantic roles.
4. Numbers get `className="num"` (mono, tabular figures). Optional `tint` in the manifest picks the icon tile colour.
5. `npm run check:app -- <id>` while working, then check 390px and 1440px @1.25, light and dark.

## Commands

- **While working on one app:** `npm run check:app -- <id>`. ESLint + Vitest on
  `src/apps/<id>/` plus any `src/shell`, `src/ui`, `src/registry`, `src/api` or
  `src/styles` files you changed; the registry test and style guard always run.
- **Once before every commit:** `npm run verify` (format check, typecheck, lint,
  all tests). CI runs the full set; it is never scoped.
- `npm run format` after scripted or bulk edits.
- **Never build or deploy from Git Bash**: MSYS rewrites `/commons/`-style paths and
  breaks every asset. Use PowerShell or the workflow.

## Deploy

- **Public:** push to `main` (or `gh workflow run deploy-pages.yml --repo vekbui96/commons`).
- **Private:** `npm run deploy:private` from PowerShell on server-pc
  (`scripts/deploy-private.ps1`): builds with `COMMONS_TARGET=private`, checks
  dist, mirrors it into `D:\services\commons-web\` (that folder only). It never
  touches `tailscale serve`; commons-api owns the 8445 handlers (`/` static,
  `/api` -> 127.0.0.1:8790). **Private = tailnet only, never Funnel.**
- **A blank SPA returns 200.** After a deploy, load the page in a browser at phone
  and desktop widths and look at it.
- Every GitHub comment an agent posts as vekbui96 starts with `<!-- claude-agent -->`
  on its own line.
