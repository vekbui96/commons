# Homepage tabs

The chips under the homepage top bar. One file per tab: `defs/<id>.ts`, default-exporting `defineTab({...})`.

- `types.ts`: `TabDefinition` = `apps` (lists apps by `filter.appVisibility`) | `link` (`url`: https, `#/...` or same-origin `/path`) | `page` (`app`: an internal app id, rendered in the tab) | `panel` (`load: () => import("...")`: a shell-level view, e.g. the private Profiles editor in `src/profiles/editor/`; the dynamic import keeps it out of the public bundle with the def).
- `registry.ts`: glob discovery, `availableTabs`, `defaultTab` (lowest `order` that is not a link), `resolveTab`, `tabPath`.
- `validate.ts`: rules, checked for every def by `registry.test.ts`. `icons.tsx`: the inline SVGs (`icon` names).

Rules:

- `visibility` is a plain literal and the only `visibility:` in the file (the build reads it; that is why the apps filter key is `appVisibility`). Private tabs are cut from the public bundle (`build/target.ts`, `check-dist`).
- No tailnet hosts in a `url`: the source is public. Routes: `#/` default tab, `#/tab/<id>`.

Test: `npx vitest run src/tabs src/shell build`.
