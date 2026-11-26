# Visitor profiles

Which public apps a visitor sees on the **public** build. A guest sees `guest.apps`; a named visitor (picked from the avatar, or `?profile=<name>`) sees their profile's apps. The private build ignores profiles.

**Rule: profiles are tailoring, never access control.** Every public app is still in the public bundle and on GitHub; a name is not a password. Never use a profile to hide something that must stay private: that is `visibility: "private"`.

- Data: the **published** file `https://vekbui96.github.io/commons-profiles/profiles.json` (written by the editor below via the API), fetched at runtime with `?v=<now>`, checked by `parseProfiles` (unknown keys such as `revision` ignored) and cached in `commons.profiles`. First render uses that cache, else the bundled `profiles.json` (the fallback); a failed fetch keeps what is shown. An app is hidden from guests until listed (allowlist).
- `validate.ts` (`parseProfiles`), `resolve.ts` (`normaliseName`, `findProfile`, `enabledAppIds`, `filterApps`), `storage.ts` (`commons.profile`), `source.ts` (`loadProfiles`, `initialProfiles`, `fetchPublishedProfiles`), `useProfile.ts` (provider + hook; holds the profile id, so a profile only the published file knows still applies once it arrives).
- `editor/`: the private **Profiles tab** (`src/tabs/defs/profiles.ts`, kind `panel`): list, add/edit/delete, guest apps, view-as, copy link, publish or Download (`/api/apps/profiles/`, contract `### profiles`). Calls go through `editor/api.ts` -> `src/api/client.ts`. Offers public apps only.
- Shell-level, not an app: apps never import it (the app-boundaries lint rule already forbids it). The registry stays pure; `Home`, `AppHost` and `SiteAvatar` apply the profile.
- `?profile=` is read from the real query and the hash route's; a match is applied, remembered and stripped; `guest` resets; unknown values are ignored.

Test: `npx vitest run src/profiles src/shell`. Owner flows can only be tested in Vitest: the API refuses requests from server-pc itself (`self_request`). `profiles.test.ts` fails if `profiles.json` names a private or missing app.
