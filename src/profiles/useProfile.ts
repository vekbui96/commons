import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { listedApps } from "@/registry/registry";
import { isPrivateSite } from "@/site";
import { enabledAppIds, filterApps, findProfile, normaliseName } from "./resolve";
import { fetchPublishedProfiles, initialProfiles, loadProfiles } from "./source";
import { clearProfileId, readProfileId, saveProfileId } from "./storage";
import type { Profile, ProfilesConfig } from "./types";

export const PROFILE_PARAM = "profile";
export const GUEST_LABEL = "Guest";

export interface ProfileState {
  /** False on the private build: profiles don't apply and every app is enabled. */
  active: boolean;
  /** The chosen profile, or undefined for a guest. */
  profile: Profile | undefined;
  /** What the avatar says: the profile's name, or "Guest". */
  label: string;
  isEnabled(appId: string): boolean;
  filterApps<T extends { manifest: { id: string } }>(apps: readonly T[]): T[];
  /** Picks the profile matching a typed name; undefined (and no change) if none does. */
  choose(name: string): Profile | undefined;
  switchToGuest(): void;
}

function makeState(
  active: boolean,
  profile: Profile | undefined,
  enabled: ReadonlySet<string>,
  choose: ProfileState["choose"],
  switchToGuest: () => void,
): ProfileState {
  return {
    active,
    profile: active ? profile : undefined,
    label: active && profile ? profile.name : GUEST_LABEL,
    isEnabled: (id) => !active || enabled.has(id),
    filterApps: (apps) => (active ? filterApps(apps, enabled) : [...apps]),
    choose,
    switchToGuest,
  };
}

function availableIds(): string[] {
  return listedApps().map((app) => app.manifest.id);
}

// Without a provider: the plain guest view (read-only).
const guestConfig = loadProfiles();
const ProfileContext = createContext<ProfileState>(
  makeState(
    !isPrivateSite(),
    undefined,
    enabledAppIds(guestConfig, undefined, availableIds()),
    () => undefined,
    () => {},
  ),
);

/** What a `?profile=` value asks for: a profile, the guest view, or nothing (unknown). */
type ParamWish = { kind: "profile"; profile: Profile } | { kind: "guest" } | undefined;

function wishFrom(config: ProfilesConfig, search: string): ParamWish {
  const value = new URLSearchParams(search).get(PROFILE_PARAM);
  if (value === null) return undefined;
  if (normaliseName(value) === "guest") return { kind: "guest" };
  const profile = findProfile(config, value);
  return profile ? { kind: "profile", profile } : undefined;
}

function withoutParam(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(PROFILE_PARAM);
  const rest = params.toString();
  return rest ? `?${rest}` : "";
}

export interface ProfileProviderProps {
  children?: ReactNode;
  /** Fixed data (tests). Default: the cached or bundled file first, then the published one. */
  config?: ProfilesConfig;
  /** Whether profiles apply. Default: on the public build only. */
  enabled?: boolean;
  /** App ids in this build. Default: listedApps(). */
  available?: readonly string[];
}

/**
 * Holds the visitor's profile (public build only). Reads `?profile=` from the
 * real query string and from the hash route's, then the remembered choice.
 * A known name or "guest" is applied, remembered and removed from the URL; an
 * unknown value is ignored (and tried again once the published file arrives).
 * Must sit inside the router.
 *
 * Data: it renders at once from the last published file cached on this device
 * (else the bundled profiles.json), then fetches the published file and
 * switches to it; a failed fetch keeps what is shown.
 */
export function ProfileProvider({
  children,
  config: configProp,
  enabled = !isPrivateSite(),
  available: availableProp,
}: ProfileProviderProps) {
  const [loaded, setLoaded] = useState<ProfilesConfig>(() =>
    configProp ? configProp : enabled ? initialProfiles() : loadProfiles(),
  );
  const config = configProp ?? loaded;
  const available = useMemo(() => availableProp ?? availableIds(), [availableProp]);
  const location = useLocation();
  const navigate = useNavigate();

  // The published file (public build, no fixed config).
  useEffect(() => {
    if (configProp || !enabled) return;
    let live = true;
    void fetchPublishedProfiles().then((next) => {
      if (live && next) setLoaded(next);
    });
    return () => {
      live = false;
    };
  }, [configProp, enabled]);

  // The chosen profile's id; the profile itself comes from the current data.
  const [profileId, setProfileId] = useState<string | undefined>(() => {
    if (!enabled) return undefined;
    // The hash route's query wins over the real one, as in the effect below.
    const wish = wishFrom(config, location.search) ?? wishFrom(config, window.location.search);
    if (wish) return wish.kind === "profile" ? wish.profile.id : undefined;
    return readProfileId();
  });
  const profile = profileId ? config.profiles.find((p) => p.id === profileId) : undefined;

  const apply = useCallback((next: Profile | undefined) => {
    setProfileId(next?.id);
    if (next) saveProfileId(next.id);
    else clearProfileId();
  }, []);

  // ?profile= in either place: apply it, remember it, take it out of the URL.
  useEffect(() => {
    if (!enabled) return;
    const outer = wishFrom(config, window.location.search);
    if (outer) {
      apply(outer.kind === "profile" ? outer.profile : undefined);
      const { pathname, search, hash } = window.location;
      window.history.replaceState(window.history.state, "", `${pathname}${withoutParam(search)}${hash}`);
    }
    const inner = wishFrom(config, location.search);
    if (inner) {
      apply(inner.kind === "profile" ? inner.profile : undefined);
      navigate(
        { pathname: location.pathname, search: withoutParam(location.search), hash: location.hash },
        { replace: true, state: location.state },
      );
    }
  }, [enabled, config, apply, navigate, location.pathname, location.search, location.hash, location.state]);

  const choose = useCallback(
    (name: string) => {
      const match = findProfile(config, name);
      if (match) apply(match);
      return match;
    },
    [config, apply],
  );
  const switchToGuest = useCallback(() => apply(undefined), [apply]);

  const value = useMemo(
    () => makeState(enabled, profile, enabledAppIds(config, profile, available), choose, switchToGuest),
    [enabled, profile, config, available, choose, switchToGuest],
  );
  return createElement(ProfileContext.Provider, { value }, children);
}

/** The visitor's profile and the apps it enables. */
export function useProfile(): ProfileState {
  return useContext(ProfileContext);
}
