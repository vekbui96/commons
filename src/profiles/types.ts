/**
 * Visitor profiles: which public apps a named visitor sees on the public
 * Commons. Tailoring only, never access control (see CLAUDE.md here).
 *
 * The shape is fixed: a future API will return exactly this.
 */
export interface ProfilesConfig {
  version: 1;
  /** What a visitor with no profile sees. An allowlist: unlisted apps stay hidden. */
  guest: { apps: string[] };
  profiles: Profile[];
}

export interface Profile {
  /** Kebab-case, unique. Also accepted by `?profile=` and the name box. */
  id: string;
  /** A plain first name, shown on the avatar. */
  name: string;
  /** Other names that pick this profile (nicknames). */
  aliases: string[];
  /** Also see the guest apps. */
  inheritsGuest: boolean;
  /** App ids this profile adds. */
  apps: string[];
}
