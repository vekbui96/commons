# Server map

A live, visual map of server-pc's architecture at `#/apps/server-map`. Internal, **private**, backend: `GET /api/apps/server-map/architecture` (schema v1, written by the ops hub every 15 min; see docs/api-contract.md).

- `map.ts`: schema types, `parseMap` (checks/normalises the body), status symbol+word, staleness, drift count, filters, error sentences. `layout.ts`: dependency-free lane layout (barycenter ordering, column-major wrap, curved edges).
- `App.tsx` (header, toolbar, filters), `Diagram.tsx` (SVG), `DetailPanel.tsx`, `ListView.tsx`, `useArchitecture.ts` (fetch, 60 s refresh + on focus).
- `fixture.ts`: sample map for tests only (fake tailnet name; never imported by App.tsx). `server-map.css`: tokens only, SVG paint via CSS variables.

Rules:

- Status is always colour + symbol + word (`STATUS_META`). Undocumented nodes get a dashed outline. Links: https only (`safeLinks`).
- Over 30 min old shows the stale banner. A failed refresh keeps the last good map.
- No real hostnames or data in source: the map comes only from the API.

Test: `npm run check:app -- server-map`. By hand: 390px and 1440 @1.25, light/dark, against the fixture (intercept the endpoint in Playwright).
