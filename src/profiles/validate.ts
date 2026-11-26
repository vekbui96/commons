import { normaliseName } from "./resolve";
import type { Profile, ProfilesConfig } from "./types";

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Thrown by parseProfiles; `problems` lists every rule the data breaks. */
export class ProfilesError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`Invalid profiles: ${problems.join("; ")}`);
    this.name = "ProfilesError";
    this.problems = problems;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function appList(value: unknown, where: string, problems: string[]): string[] {
  if (!Array.isArray(value)) {
    problems.push(`${where} must be an array of app ids`);
    return [];
  }
  const ids: string[] = [];
  for (const id of value) {
    if (typeof id !== "string" || !KEBAB.test(id))
      problems.push(`${where} has a bad app id: ${JSON.stringify(id)}`);
    else if (ids.includes(id)) problems.push(`${where} lists "${id}" twice`);
    else ids.push(id);
  }
  return ids;
}

/**
 * Checks untrusted data (today the bundled profiles.json, later an API
 * response) and returns it typed. Throws ProfilesError listing every problem.
 * App ids are checked for shape only: enabledAppIds limits them to this
 * build's apps, and a test checks the bundled file names only public apps.
 */
export function parseProfiles(raw: unknown): ProfilesConfig {
  if (!isRecord(raw)) throw new ProfilesError(["the profiles data must be an object"]);
  const problems: string[] = [];
  if (raw.version !== 1) problems.push(`version must be 1 (got ${JSON.stringify(raw.version)})`);

  let guestApps: string[] = [];
  if (!isRecord(raw.guest)) problems.push("guest must be an object with apps");
  else guestApps = appList(raw.guest.apps, "guest.apps", problems);

  const profiles: Profile[] = [];
  if (!Array.isArray(raw.profiles)) problems.push("profiles must be an array");
  else {
    // Every id, name and alias picks one profile, so none may collide, or be "guest".
    const taken = new Map<string, string>([["guest", "the guest view"]]);
    raw.profiles.forEach((entry: unknown, i) => {
      const where = `profiles[${i}]`;
      if (!isRecord(entry)) {
        problems.push(`${where} must be an object`);
        return;
      }
      const { id, name, aliases, inheritsGuest, apps } = entry;
      const idOk = typeof id === "string" && KEBAB.test(id);
      const nameOk = typeof name === "string" && name.trim() !== "";
      const aliasesOk =
        Array.isArray(aliases) && aliases.every((a) => typeof a === "string" && a.trim() !== "");
      if (!idOk) problems.push(`${where}.id must be kebab-case`);
      if (!nameOk) problems.push(`${where}.name must be a non-empty string`);
      if (!aliasesOk) problems.push(`${where}.aliases must be an array of non-empty strings`);
      if (typeof inheritsGuest !== "boolean") problems.push(`${where}.inheritsGuest must be true or false`);
      const appIds = appList(apps, `${where}.apps`, problems);
      if (!idOk || !nameOk || !aliasesOk || typeof inheritsGuest !== "boolean") return;

      for (const key of new Set([id, name, ...aliases].map(normaliseName))) {
        const owner = taken.get(key);
        if (owner) problems.push(`${where}: "${key}" already picks ${owner}`);
        else taken.set(key, `profile "${id}"`);
      }
      profiles.push({ id, name: name.trim(), aliases: [...aliases], inheritsGuest, apps: appIds });
    });
  }

  if (problems.length > 0) throw new ProfilesError(problems);
  return { version: 1, guest: { apps: guestApps }, profiles };
}

/** App ids the config names that are not in `known` (checks the bundled file). */
export function unknownAppIds(config: ProfilesConfig, known: Iterable<string>): string[] {
  const knownSet = new Set(known);
  const all = [...config.guest.apps, ...config.profiles.flatMap((p) => p.apps)];
  return [...new Set(all)].filter((id) => !knownSet.has(id));
}
