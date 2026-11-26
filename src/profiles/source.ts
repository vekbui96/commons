import bundled from "./profiles.json";
import { parseProfiles, ProfilesError } from "./validate";
import type { ProfilesConfig } from "./types";

/** Used if the data is broken: nobody sees any app (a test keeps the bundled file valid). */
const EMPTY: ProfilesConfig = { version: 1, guest: { apps: [] }, profiles: [] };

/**
 * The published file. The private editor (Profiles tab) publishes it through
 * the Commons API to the public data repo vekbui96/commons-profiles; Pages
 * serves it here. Same shape as the bundled file plus a top-level `revision`,
 * which parseProfiles ignores (readers must ignore unknown keys).
 */
export const PROFILES_URL = "https://vekbui96.github.io/commons-profiles/profiles.json";

/** The last good published file, kept on this device so a return visit renders right away. */
export const PROFILES_CACHE_KEY = "commons.profiles";

/** How long the published file may take before the page keeps what it has. */
export const REMOTE_TIMEOUT_MS = 5000;

/** Checks profiles data; broken data (logged) means nobody sees any extra app. */
export function loadProfiles(raw: unknown = bundled): ProfilesConfig {
  try {
    return parseProfiles(raw);
  } catch (error) {
    if (!(error instanceof ProfilesError)) throw error;
    console.error(error.message);
    return EMPTY;
  }
}

/** The cached published file, if there is a valid one. */
export function readCachedProfiles(): ProfilesConfig | undefined {
  try {
    const text = localStorage.getItem(PROFILES_CACHE_KEY);
    return text ? parseProfiles(JSON.parse(text)) : undefined;
  } catch {
    return undefined;
  }
}

function writeCachedProfiles(config: ProfilesConfig): void {
  try {
    localStorage.setItem(PROFILES_CACHE_KEY, JSON.stringify(config));
  } catch {
    // Storage unavailable: the next visit starts from the bundled file again.
  }
}

/** What to render first, before the published file answers: the cache, else the bundled file. */
export function initialProfiles(): ProfilesConfig {
  return readCachedProfiles() ?? loadProfiles();
}

/**
 * Fetches the published file (cache-busted, never from the HTTP cache), checks
 * it with parseProfiles and caches it. Resolves undefined on any failure
 * (network, timeout, HTTP error, bad JSON, invalid data): the caller keeps what
 * it shows (the cache, else the bundled file).
 */
export async function fetchPublishedProfiles({
  url = PROFILES_URL,
  timeoutMs = REMOTE_TIMEOUT_MS,
  now = Date.now(),
}: { url?: string; timeoutMs?: number; now?: number } = {}): Promise<ProfilesConfig | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${url}?v=${now}`, { cache: "no-store", signal: controller.signal });
    if (!res.ok) return undefined;
    const config = parseProfiles(await res.json());
    writeCachedProfiles(config);
    return config;
  } catch (error) {
    if (error instanceof ProfilesError) console.error(`Published ${error.message}`);
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}
