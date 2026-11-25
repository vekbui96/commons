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
5. `npm run verify` (guard + contrast tests), then check 390px and 1440px @1.25, light and dark.

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
