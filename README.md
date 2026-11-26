# Commons Front End

A personal home for small apps and utilities, made as they are needed. The
homepage has a sticky header (the "Commons" pill, an avatar badge, and a row
of tab chips) over the selected tab's apps; some apps live inside Commons,
others are links to sites elsewhere.

Live: https://vekbui96.github.io/commons/

## Two builds, one repo

| Build                | Where                                                                     | Apps                                              | API                                                     |
| -------------------- | ------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------- |
| **Public** (default) | GitHub Pages, `/commons/`                                                 | `visibility: "public"` only; private ones cut out | `VITE_COMMONS_API` (unset for now: no backend features) |
| **Private**          | server-pc, `D:\services\commons-web\` served by `tailscale serve` on 8445 | all                                               | same origin, `/api/...`                                 |

`COMMONS_TARGET=public|private` picks the build (`build/target.ts`). The private
site is **tailnet only, never Funnel**; Ve opens it on a device with Tailscale on.
App code stays public on GitHub either way; data stays on server-pc.

How private apps stay off Pages: `src/registry/registry.ts` discovers apps with
`import.meta.glob`, and each glob carries a placeholder negative pattern. For the
public target, a small Vite plugin (`excludePrivateApps` in `build/target.ts`)
reads each `src/apps/*/manifest.ts`, and swaps the placeholder for
`!../apps/<id>/**` for every app that is not plainly `visibility: "public"`
(unknown counts as private). Vite never loads those files, so no manifest,
component or chunk of theirs is emitted. `node scripts/check-dist.mjs public`
then searches `dist/` for each private app's id, folder path and name, and fails
on any hit; CI and the Pages deploy run it. (`... private` checks the reverse.)
Tests always see every app, so every manifest is still validated.

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
│  │  ├─ App.tsx         internal apps only, lazy-loaded at #/apps/<id>
│  │  └─ CLAUDE.md       internal apps only: the app's own short agent notes
│  ├─ registry/          discovers apps/*/manifest.ts, validates them
│  ├─ tabs/              homepage tabs: defs/<id>.ts, registry, validation, icons
│  ├─ shell/             homepage, app host, routes (hash router)
│  ├─ api/client.ts      the only module that calls the Commons API
│  ├─ ui/                shared component kit (AppShell, Button, Input, ...)
│  └─ styles/            tokens.css, tokens-fonts.css, fonts/, base.css
├─ src/site.ts           which build this is (public / private), from COMMONS_TARGET
├─ build/target.ts       the build switch and the private-app exclusion plugin
├─ scripts/check-dist.mjs, scripts/deploy-private.ps1
├─ docs/api-contract.md, docs/templates/app-CLAUDE.md
├─ eslint/app-boundaries.js   the wall between apps (lint rule)
├─ scripts/check-app.mjs      npm run check:app -- <id>
└─ .github/workflows/    ci.yml, deploy-pages.yml
```

- The registry uses `import.meta.glob` to find every `src/apps/*/manifest.ts`
  at build time, so the homepage needs no edits when an app is added.
- `kind` is `internal` (a route inside Commons, code-split and lazy-loaded) or
  `external` (a link out, opened in a new tab).
- `visibility` is `public` or `private`; private apps exist only in the private
  build (see above). Write it as a plain literal: the build reads it.
- Routing is hash-based so deep links work on Pages without a server fallback:
  `#/` (default tab), `#/tab/<id>`, `#/apps/<id>`. "← Commons" in an app
  returns to the tab it was opened from (router state; `/` otherwise).
- API calls go through `src/api/client.ts`: same origin on the private build,
  `VITE_COMMONS_API` on the public one (unset for now). `checkReachable()` /
  `useApi()` ask `/api/health` with a short timeout (cached), and `<NeedsApi>`
  shows a quiet "Connect to Tailscale to use this" when the API cannot be
  reached. Writes go through `sendJson`, which sends the CSRF token from
  `/api/session` in `X-Commons-Token`.

## Rule: mobile first, and it must look good on Windows

Not a suggestion. Every UI change is checked at **390px** and at **1440px with
Windows-style 125% scaling** (`deviceScaleFactor: 1.25`), in **light and dark**.

## Style system

One global system controls every app's look:

- `src/styles/tokens.css`: **primitives** (palette, font stacks, type scale in
  rem, spacing, radii, shadows) -> **semantic roles** (`--bg`, `--surface`,
  `--surface-2`, `--text`, `--text-muted`, `--line`, `--line-strong`,
  `--accent`, `--accent-hover`, `--on-accent`, `--focus`, `--ok`, `--warn`,
  `--danger` and their `-bg` variants) -> **dark mode**, which redefines roles only.
  Theme follows `prefers-color-scheme`; the homepage toggle (light / dark /
  system) is stored in `localStorage`.
- Palette: warm paper with cobalt blue (`#1f4fbf` light, `#7ea3ff` dark) as the
  one accent. App icon tiles may use one of five fixed tints
  (`cobalt`, `indigo`, `steel`, `slate`, `stone`) via the manifest's `tint`.
- `src/styles/tokens-fonts.css`: self-hosted fonts, all SIL OFL 1.1 (licences in
  `src/styles/fonts/`): **Newsreader** (headings), **Source Sans 3** (UI),
  **JetBrains Mono** (numbers, tabular figures), with metric-matched Segoe UI /
  Helvetica Neue fallbacks to keep layout shift small.
- `src/ui/`: the kit. `AppShell`, `Button` (primary / secondary / danger),
  `Input`, `Select`, `Field`, `ListRow`, `Card`, `Toast` + `useToast`,
  `ThemeToggle`, `AppMark`. 44px tap targets, focus rings, mouse-only hover,
  forced-colors and reduced-motion support.
- Guards: `src/styles/guard.test.ts` fails on any hex / `rgb(` / `hsl(` colour,
  font name or weight below 400 outside `src/styles/tokens*.css` (exception: a
  `style-guard-allow` comment with a reason). `src/styles/tokens.test.ts` checks
  WCAG AA contrast (4.5:1 text, 3:1 UI) for the key pairs in both modes.
- Keys: Esc leaves an app (back to its tab); in the tab row, arrows / Home /
  End move between chips and Enter or Space selects. `/` is kept free for a
  future search.

### How to style a new app

1. `AppHost` already wraps your `App.tsx` in `<AppShell>` (top bar, ~680px column).
2. Build from `@/ui`: `Button`, `Input`, `Select`, `Field`, `ListRow`, `Card`, `Toast`.
3. Extra CSS in `src/apps/<id>/<id>.css`: layout only, with `var(--space-*)`, `var(--text-*)` and semantic roles.
4. Numbers get `className="num"`; an optional manifest `tint` colours the icon tile.
5. `npm run verify`, then look at 390px and 1440px @1.25, light and dark.

## Local development

```powershell
npm install
npm run dev       # http://localhost:5180 (proxies /api to a local Commons API on 8790)
npm run check:app -- <id>  # one app's lint + tests while working
npm run verify    # format check, typecheck, lint, tests (what CI runs)
npm run build     # public production build into dist/ (base /commons/)
npm run preview   # serve dist/ at http://localhost:4173/commons/
npm run check:dist -- public   # no private app in dist/

$env:COMMONS_TARGET = "private"; npm run build   # private build (base /), then:
Remove-Item Env:COMMONS_TARGET
npm run deploy:private   # build private + publish to D:\services\commons-web\ (server-pc only)
```

`COMMONS_TARGET=private npm run dev` shows the private site locally (all apps,
the "Private" mark), with `/api` proxied to a local Commons API on 8790.

Use PowerShell, not Git Bash, for builds: MSYS rewrites path-like env values
such as `VITE_BASE=/commons/` and breaks every asset.

## Adding an app

1. Create `src/apps/<id>/manifest.ts` with `export default defineApp({...})`.
   The id is kebab-case and must equal the folder name.
2. For an internal app, add `App.tsx` in the same folder with a default-exported
   component, and a short `CLAUDE.md` (15 lines or fewer) copied from
   [`docs/templates/app-CLAUDE.md`](docs/templates/app-CLAUDE.md): what the app
   does, its files, its own rules, how to test it. Add `wide: true` for a ~1100px column (diagrams, tables). For an external app, set
   `kind: "external"` and an https `url`; it needs no CLAUDE.md.
3. If it needs a backend, add `src/apps/<id>/routes.ts` in `commons-api` with
   the same id; call it here with `appApiUrl("<id>", "...")` from the client.

The registry tests check every manifest (valid fields, unique ids, https URLs,
an `App.tsx` and a CLAUDE.md for internal apps), so `npm run verify` catches
mistakes.

### Per-app CLAUDE.md

App-specific detail lives in `src/apps/<id>/CLAUDE.md`, never in the root
`CLAUDE.md`, which stays a short index plus the shared rules. This keeps an
agent's context small: it reads the root and the one app it is working on.

### The wall between apps

No source imports between apps. A file in `src/apps/<a>/` may import only from
its own folder, `src/ui`, `src/api`, `src/styles` and `src/registry/types` (for
`defineApp`); nothing outside `src/apps/` may import an app's files (the
registry's `import.meta.glob` discovery is not an import and stays allowed).
ESLint enforces this with a local rule, `commons/app-boundaries`
(`eslint/app-boundaries.js`).

A finished app is reused only as a published runtime embed: a web component at
a versioned URL such as `embed/v1.js`, loaded live. No embed exists yet; the rule
is recorded so nobody imports another app's source in the meantime.

## Homepage tabs

The chips under the top bar come from a registry like the apps: one file per
tab, `src/tabs/defs/<id>.ts`, default-exporting `defineTab({...})`:

| Field        | Meaning                                                                |
| ------------ | ---------------------------------------------------------------------- |
| `id`         | kebab-case, equal to the file name; the URL is `#/tab/<id>`            |
| `label`      | shown on the selected chip; tooltip and accessible name otherwise      |
| `icon`       | an inline SVG from `src/tabs/icons.tsx` (`globe`, `grid`, `lock`, ...) |
| `visibility` | `public` or `private` (a plain literal, the file's only `visibility:`) |
| `order`      | carousel position; the lowest non-link tab is the default (`#/`)       |
| `kind`       | `apps` (`filter.appVisibility`), `link` (`url`) or `page` (`app` id)   |

- `apps` lists the apps matching its filter. `link` opens its URL like an
  external app (https in a new tab; `#/...` or a same-origin `/path` in this
  one) and is never "selected". `page` renders one internal app in the tab,
  without the app bar.
- Today: **Public** (public apps, the only tab on Pages, the default) and
  **Private** (private apps, private build only).
- Private tabs are cut out of the public bundle the same way as private apps
  (`excludePrivateTabs` in `build/target.ts`), and `check-dist` looks for their
  files (`defs/<id>.ts`) in `dist/`.

Example: adding an Ops hub tab is one entry, `src/tabs/defs/ops.ts` (not added):

```ts
export default defineTab({
  id: "ops",
  label: "Ops hub",
  icon: "link",
  kind: "link",
  url: "/ops/", // a same-origin path; never a *.ts.net host: the source is public
  order: 30,
  visibility: "private",
});
```

## Checks

```powershell
npm run check:app -- units   # one app: eslint + vitest on src/apps/units, plus touched shared code
npm run verify               # everything (what CI runs); once before every commit
```

`check:app` lints and tests `src/apps/<id>/`, plus any files under `src/shell`,
`src/ui`, `src/registry`, `src/api` or `src/styles` changed in the working tree
(vs `HEAD`, untracked included). The registry test and the style guard always
run since they check every app. It is plain Node, so it behaves the same in
PowerShell and CI. CI always runs the full `verify`.

## Deploy

**Public (Pages):** pushing to `main` runs `deploy-pages.yml`, which verifies,
builds the public target, checks `dist/` has no private app, and publishes it.
To redeploy by hand: `gh workflow run deploy-pages.yml --repo vekbui96/commons`.

**Private (server-pc):** from PowerShell on server-pc, `npm run deploy:private`
(`scripts/deploy-private.ps1`). It builds with `COMMONS_TARGET=private`, checks
`dist/` holds the private apps and loads assets from `/`, then mirrors `dist/`
into `D:\services\commons-web\`, replacing that folder's contents only. Never
from Git Bash. It does not touch `tailscale serve`: the Commons API side owns the
8445 handlers (`/` static from that folder, `/api` to `127.0.0.1:8790`).
**The private site is tailnet only. Never put it behind Funnel.**
