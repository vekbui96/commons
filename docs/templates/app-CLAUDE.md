# <App name>

<One line: what it does> at `#/apps/<id>`. Internal, public|private, backend: none | `/api/apps/<id>/`.

- `manifest.ts`: registry entry. `App.tsx`: <what the screen holds>.
- `<logic>.ts`: <pure logic, tested>.
- `<id>.css`: layout only, tokens only.

Rules:

- <A rule only this app has, e.g. units, data shape, storage key, API calls via `appApiUrl("<id>", ...)`>.
- <Anything a test or another file depends on, e.g. a test id>.

Test: `npm run check:app -- <id>`. <Anything else to look at by hand.>
