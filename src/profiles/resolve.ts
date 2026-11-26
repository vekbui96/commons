import type { Profile, ProfilesConfig } from "./types";

/** "  Tâmmy " -> "tammy": trimmed, single-spaced, lower case, accents dropped. */
export function normaliseName(input: string): string {
  return input.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim().replace(/\s+/g, " ");
}

/** The profile whose id, name or an alias matches (case- and accent-insensitive). */
export function findProfile(config: ProfilesConfig, input: string | null | undefined): Profile | undefined {
  if (!input) return undefined;
  const key = normaliseName(input);
  if (key === "") return undefined;
  return config.profiles.find((profile) =>
    [profile.id, profile.name, ...profile.aliases].some((candidate) => normaliseName(candidate) === key),
  );
}

/**
 * The app ids a visitor sees: the guest apps (for a guest, or a profile that
 * inherits them) plus the profile's own, limited to the apps in this build.
 */
export function enabledAppIds(
  config: ProfilesConfig,
  profile: Profile | undefined,
  available: Iterable<string>,
): Set<string> {
  const wanted = new Set<string>();
  if (!profile || profile.inheritsGuest) config.guest.apps.forEach((id) => wanted.add(id));
  profile?.apps.forEach((id) => wanted.add(id));
  return new Set([...available].filter((id) => wanted.has(id)));
}

/** Keeps the apps whose id is enabled, in their original order. */
export function filterApps<T extends { manifest: { id: string } }>(
  apps: readonly T[],
  enabled: ReadonlySet<string>,
): T[] {
  return apps.filter((app) => enabled.has(app.manifest.id));
}
