# Visitor profiles

Which public apps a visitor sees on the **public** build. A guest sees `guest.apps`; a named visitor (picked from the avatar, or `?profile=<name>`) sees their profile's apps. The private build ignores profiles.

**Rule: profiles are tailoring, never access control.** Every public app is still in the public bundle and on GitHub; a name is not a password. Never use a profile to hide something that must stay private: that is `visibility: "private"`.

- `profiles.json`: the data (shape in `types.ts`, kept exactly as a future API will return it). Plain first names. An app is hidden from guests until listed here (allowlist).
- `validate.ts` (`parseProfiles`), `resolve.ts` (`normaliseName`, `findProfile`, `enabledAppIds`, `filterApps`), `storage.ts` (`commons.profile`), `source.ts` (`loadProfiles`: the seam for a later runtime fetch), `useProfile.ts` (provider + hook).
- Shell-level, not an app: apps never import it (the app-boundaries lint rule already forbids it). The registry stays pure; `Home`, `AppHost` and `SiteAvatar` apply the profile.
- `?profile=` is read from the real query and the hash route's; a match is applied, remembered and stripped; `guest` resets; unknown values are ignored.

Test: `npx vitest run src/profiles src/shell`. `profiles.test.ts` fails if `profiles.json` names a private or missing app.
