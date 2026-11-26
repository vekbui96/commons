# Ops hub micro-frontend contract (v1)

The ops hub dashboard is one build (`dashboard/dist`, repo `vekbui96/ops-hub`) that runs in two places:

- **standalone** at `https://server-pc.tail0e4194.ts.net:8444/` (tailnet only);
- **embedded** in the private Commons (`:8445`) as the Ops tab.

This file is the contract between the two sides: the hub, and the Commons host (`D:\projects\commons`). Keep an
identical copy in both repos. Change it only by agreement, and bump the loader name (`v1.js` -> `v2.js`) for a
breaking change. Plan: `D:\projects\plans\2026-11-25-ops-hub-mfe-revamp.md`.

## URLs

| Site | Path | Served by | What |
| --- | --- | --- | --- |
| :8444 | `/` | `tailscale serve` -> `D:\hub\dashboard\dist` | standalone page (`index.html` mounts `<ops-hub api-base="api">`) |
| :8444 | `/api` | `tailscale serve` -> `http://127.0.0.1:8446` | action server (`action-server/server.mjs`) |
| :8445 | `/ops/` | `tailscale serve` -> `D:\hub\dashboard\dist` | the same build (phase 3) |
| :8445 | `/ops/embed/v1.js` | (same handler) | the **stable loader**: re-exports the hashed bundle `assets/ops-hub-<hash>.js` |
| :8445 | `/ops/api` | `tailscale serve` -> `http://127.0.0.1:8446` | action server, once Ve lists 8445 in `registry\actions.json` |

- Both sites are **tailnet only**, never Funnel.
- The build uses `base: './'`, so every path inside it is relative. The same `dist` works at `/`, `/ops/` and the phase-2
  preview `/next/`.
- `tailscale serve` can't set cache headers. So the host imports the loader with a minute cache-buster
  (`/ops/embed/v1.js?t=<minute>`), and the bundle's name changes with its content.
- Same origin only: no CORS headers, no cross-site requests. Commons source must not contain a `*.ts.net` host. It builds
  the URL from `location.origin`.

## Module API (`embed/v1.js`)

```ts
const m = await import(/* @vite-ignore */ new URL('/ops/embed/v1.js?t=' + minute, location.origin).href);
const handle = m.mount(el, { apiBase: '/ops/api', embedded: true, theme, forcedColors, onError });
handle.setTheme('dark', false);   // or m.setTheme(...) for every mounted element
handle.unmount();                  // or m.unmount(el); idempotent
```

| Export | Signature | Notes |
| --- | --- | --- |
| `mount` | `(el: Element, opts?: MountOptions) => MountHandle` | Creates `<ops-hub>` inside `el` and replaces an earlier mount there. Defines the element first if needed. |
| `unmount` | `(el?: Element) => void` | Removes the element mounted in `el`, or every mounted one when `el` is omitted. Safe to call twice. |
| `setTheme` | `(theme: 'light' \| 'dark' \| 'system', forcedColors?: boolean) => void` | A theme hint for every mounted element. |
| `define` | `() => void` | Defines `<ops-hub>` once. Safe to call any number of times, and with two copies of the bundle on one page. |
| `OpsHubElement` | class | The custom element, for type checks. |
| `TAG` | `'ops-hub'` | |
| `fetchCount` | `(opts?: CountOptions) => Promise<Count>` | Headless Needs-you count for a badge while the element is **not** mounted. No DOM, no timers, no session or token. One `GET data` (no fallback to `data.json`), run through the element's own model, so it gives exactly the `{ needsYou, stale }` the element would emit in `ops-hub:count`. Rejects on a network error, a non-200 answer, bad JSON or an abort; keep the last badge then. |

```ts
interface MountOptions {
  apiBase?: string;        // default 'api', resolved against document.baseURI; Commons passes '/ops/api'
  embedded?: boolean;      // Commons passes true
  theme?: 'light' | 'dark' | 'system';
  forcedColors?: boolean;
  onError?: (err: unknown) => void;   // errors inside the element's own handlers never reach a React error boundary
}
interface MountHandle {
  element: OpsHubElement;
  unmount(): void;
  setTheme(theme: 'light' | 'dark' | 'system', forcedColors?: boolean): void;
}
interface CountOptions {
  apiBase?: string;        // default 'api', resolved against document.baseURI; Commons passes '/ops/api'
  signal?: AbortSignal;    // cancels the request (the promise rejects)
}
interface Count {
  needsYou: number;        // the same number as ops-hub:count: Needs you items only, never proposals
  stale: boolean;
}
```

Badge without mounting (`fetchCount`):

```ts
const { needsYou, stale } = await m.fetchCount({ apiBase: '/ops/api' });
```

- Poll **at most every 5 minutes**, and **only while `document.visibilityState === 'visible'`**: stop on `hidden`,
  fetch once on `visible` if the last fetch is older than 5 minutes. The read endpoints share one 120-per-minute limit.
- While the Ops tab is mounted, stop polling and use `ops-hub:count` instead (the element polls every 60 s).
- `/proposals` is not fetched: it holds only the bodies shown on row expand and does not change the count.

## The `<ops-hub>` element

Open shadow DOM. The host's CSS custom properties inherit through the shadow boundary, so the host's tokens, its
`data-theme` switch, `prefers-color-scheme` and its `@font-face` fonts apply live.

| Attribute | Meaning |
| --- | --- |
| `api-base` | Where the action server is. Default `api`, resolved against the document, always with a trailing `/`. |
| `embedded` | Inside a host. No `document.title` writes, no `location.hash` reads or writes, no history writes, no theme toggle, no PWA bits, and no fallback to `data.json` next to the page. No outer horizontal margin, padding or max-width either: the content lines up with the host's column edges (the host owns width and gutters). |
| `data-theme` | Set by `setTheme`: `light` or `dark`; removed for `system`. |
| `data-forced-colors` | Set by `setTheme(…, true)`. |

Lifecycle:
- `connectedCallback` starts the data poll (60 s, **only while the page is visible**), the session retry (60 s) and the
  countdown tick (30 s).
- `disconnectedCallback` clears every timer and listener and aborts in-flight requests.
- Changing `api-base` or `embedded` while connected restarts the element.

## Events

Both bubble and are `composed` (they cross the shadow boundary).

| Event | `detail` | When |
| --- | --- | --- |
| `ops-hub:count` | `{ needsYou: number, stale: boolean }` | After the first load, then whenever either value changes. `needsYou` counts **Needs you items only**, never proposals (Ve's decision 7). The tab badge is hidden at 0, with no push and no sound. |
| `ops-hub:error` | `{ error: unknown }` | A render or handler threw. The same error goes to `onError`. |

## What the element calls

All requests go to `<api-base>/…`, same origin, `cache: 'no-store'`.

| Request | Body / answer | Notes |
| --- | --- | --- |
| `GET healthz` | `{ ok, ready, dryRun }` | **Unauthenticated**, never audited. `ready` = the server knows the owner login and this node's name; `dryRun` = actions are validated and logged but not sent to GitHub. Commons' Ops panel uses it for its status line. |
| `GET session` | `{ ok, token, dryRun }` | No token means no buttons: rows link to GitHub instead. Refused from server-pc itself. |
| `GET data` | `data.json` | Read-only. Allowed from server-pc too. |
| `GET proposals` | `{ bodies: { "<repo>#<n>": markdown } }` | Fetched on the first row expand. Rendered escape-first. |
| `POST approve` / `hold` / `reject` / `unapprove` | `{ repo, number, note?, via?: 'row' \| 'batch', batch? }` with `X-Hub-Token` and `Content-Type: application/json` | **One request acts on one issue.** A 403 `bad token` reloads the session once and retries once. |

Action rules (hub `CLAUDE.md`, "Dashboard"; enforced by `dashboard/test/safety.test.ts`):
- No approve-all. Nothing is automatic or timed.
- **"Approve these N"** on the Ready shortlist reads the rows on screen and runs only after the in-page "Yes, approve N".
  It sends one POST per item, one after the other, with `via: 'batch'` and a batch id. If the shortlist changes before
  the Yes, nothing is approved.
- **Undo** removes `approved` within 5 minutes of the page adding it (from the row, the toast, or "Undo these N").
- **Reject** sits behind the row's More menu. Its confirm step is a one-tap reason picker. Until the server takes a
  `reason` field (feedback F2), the reason goes in `note` as exactly `Reason: not-valuable`, `Reason: wrong-direction` or
  `Reason: later`. There is no free-text box: today the note is posted publicly on GitHub.
- Links are `https` only. A Preview link is rendered only for `https://server-pc.tail0e4194.ts.net` on ports 8460-8464.

## Token roles (drift guard)

The hub's CSS uses **only** these Commons roles. Commons' `tokens.test.ts` asserts that each exists in light and dark,
and the hub's `dashboard/test/styles.test.ts` asserts that nothing else is used.

- **Colours:** `--bg`, `--surface`, `--surface-2`, `--text`, `--text-muted`, `--line`, `--line-strong`, `--accent`,
  `--accent-soft`, `--ok`, `--ok-bg`, `--warn`, `--warn-bg`, `--danger`, `--danger-bg`, `--focus`. Info maps to accent.
- **Scales:**
  - `--space-1` … `--space-24`
  - `--text-sm`, `--text-base`, `--text-md`, `--text-lg`, `--text-xl`, `--text-2xl`, `--text-display`
  - `--radius-sm`, `--radius`, `--radius-lg`, `--radius-full`
  - `--tap` (44px)
  - `--font-sans`, `--font-display`, `--font-mono`

Standalone, the page loads a vendored copy (`dashboard/vendor/commons/`, from `npm run sync-tokens`, with `SOURCE.json`
holding the commit and sha256 of each file).

Commons rules that apply inside the element:
- no nested cards;
- 44px targets;
- visible focus;
- hover only under `@media (hover: hover)`;
- tabular numbers for counts.
