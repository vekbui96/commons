# Units

Quick conversions (length, weight, temperature) at `#/apps/units`. Internal, public, no backend.

- `manifest.ts`: registry entry. `App.tsx`: picker, value input, swap button, result with Copy (toast).
- `convert.ts`: the `conversions` table (forward/backward pairs) and `formatNumber` (max 4 decimals, `—` when not a number).
- `units.css`: layout only, tokens only.

Rules:

- Add a conversion by adding a row to `conversions`. Use exact factors (1 mi = 1.609344 km); round only in `formatNumber`.
- Keep `data-testid="units-result"`: `src/shell/Home.test.tsx` checks 1 km = 0.6214 mi through it.
- The swap button lines up with the input via `units__swap`'s top margin; recheck at 390px if `Field` changes.

Test: `npm run check:app -- units` (runs `convert.test.ts`). Touching `App.tsx`? Also `npx vitest run src/shell`.
