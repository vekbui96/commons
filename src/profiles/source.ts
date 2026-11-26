import bundled from "./profiles.json";
import { parseProfiles, ProfilesError } from "./validate";
import type { ProfilesConfig } from "./types";

/** Used if the data is broken: nobody sees any app (a test keeps the bundled file valid). */
const EMPTY: ProfilesConfig = { version: 1, guest: { apps: [] }, profiles: [] };

/**
 * Where the profiles come from. Today: profiles.json, bundled at build time.
 * The seam for later: this can become a runtime fetch (a separate Pages repo
 * or the API) returning the same shape, checked by parseProfiles.
 */
export function loadProfiles(raw: unknown = bundled): ProfilesConfig {
  try {
    return parseProfiles(raw);
  } catch (error) {
    if (!(error instanceof ProfilesError)) throw error;
    console.error(error.message);
    return EMPTY;
  }
}
