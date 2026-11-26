import { afterEach, describe, expect, it, vi } from "vitest";
import { registry } from "@/registry/registry";
import bundled from "./profiles.json";
import { enabledAppIds, filterApps, findProfile, normaliseName } from "./resolve";
import { loadProfiles } from "./source";
import { clearProfileId, PROFILE_STORAGE_KEY, readProfileId, saveProfileId } from "./storage";
import type { ProfilesConfig } from "./types";
import { parseProfiles, ProfilesError, unknownAppIds } from "./validate";

const config: ProfilesConfig = {
  version: 1,
  guest: { apps: ["portfolio"] },
  profiles: [
    { id: "tammy", name: "Tammy", aliases: ["Tam"], inheritsGuest: true, apps: ["units", "cardlens"] },
    { id: "zoe", name: "Zoë", aliases: [], inheritsGuest: false, apps: ["units", "gone"] },
  ],
};

function problemsOf(raw: unknown): string[] {
  try {
    parseProfiles(raw);
    return [];
  } catch (error) {
    if (error instanceof ProfilesError) return error.problems;
    throw error;
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("the bundled profiles.json", () => {
  it("is valid", () => {
    expect(() => parseProfiles(bundled)).not.toThrow();
  });

  // Tests see every app, private ones too: a profile may only name public apps that exist.
  it("names only public apps that exist", () => {
    const publicIds = registry
      .filter((app) => app.manifest.visibility === "public")
      .map((app) => app.manifest.id);
    expect(unknownAppIds(parseProfiles(bundled), publicIds)).toEqual([]);
  });

  it("gives guests Portfolio and Tammy Portfolio, Units and CardLens", () => {
    const parsed = loadProfiles();
    const ids = registry.map((app) => app.manifest.id);
    expect([...enabledAppIds(parsed, undefined, ids)]).toEqual(["portfolio"]);
    expect([...enabledAppIds(parsed, findProfile(parsed, "tammy"), ids)].sort()).toEqual([
      "cardlens",
      "portfolio",
      "units",
    ]);
  });
});

describe("parseProfiles", () => {
  it("returns the config typed", () => {
    expect(parseProfiles(config)).toEqual(config);
  });

  it("rejects a wrong shape, listing every problem", () => {
    expect(problemsOf(null)).toEqual(["the profiles data must be an object"]);
    const problems = problemsOf({
      version: 2,
      guest: { apps: ["Bad Id", "units", "units"] },
      profiles: [{ id: "Not Kebab", name: "", aliases: "x", inheritsGuest: "yes", apps: [1] }, 7],
    });
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/version/),
        expect.stringMatching(/guest\.apps has a bad app id/),
        expect.stringMatching(/guest\.apps lists "units" twice/),
        expect.stringMatching(/profiles\[0\]\.id/),
        expect.stringMatching(/profiles\[0\]\.name/),
        expect.stringMatching(/profiles\[0\]\.aliases/),
        expect.stringMatching(/profiles\[0\]\.inheritsGuest/),
        expect.stringMatching(/profiles\[0\]\.apps has a bad app id/),
        expect.stringMatching(/profiles\[1\] must be an object/),
      ]),
    );
  });

  it("rejects names that would pick two profiles, or the guest view", () => {
    const profile = (id: string, name: string, aliases: string[] = []) => ({
      id,
      name,
      aliases,
      inheritsGuest: true,
      apps: [],
    });
    expect(
      problemsOf({ version: 1, guest: { apps: [] }, profiles: [profile("a", "Ann"), profile("b", "ÁNN")] }),
    ).toEqual([expect.stringMatching(/"ann" already picks profile "a"/)]);
    expect(
      problemsOf({ version: 1, guest: { apps: [] }, profiles: [profile("a", "Ann", ["Guest"])] }),
    ).toEqual([expect.stringMatching(/"guest" already picks the guest view/)]);
  });

  it("falls back to nothing extra when loadProfiles gets broken data", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(loadProfiles({ version: 9 })).toEqual({ version: 1, guest: { apps: [] }, profiles: [] });
    expect(error).toHaveBeenCalled();
  });
});

describe("resolve", () => {
  it("normalises case, spaces and accents", () => {
    expect(normaliseName("  ZOË  ")).toBe("zoe");
    expect(normaliseName("Mary   Ann")).toBe("mary ann");
  });

  it("finds a profile by id, name or alias, ignoring case and accents", () => {
    expect(findProfile(config, "tammy")?.id).toBe("tammy");
    expect(findProfile(config, "TAMMY ")?.id).toBe("tammy");
    expect(findProfile(config, "tam")?.id).toBe("tammy");
    expect(findProfile(config, "Tâmmy")?.id).toBe("tammy");
    expect(findProfile(config, "zoe")?.id).toBe("zoe");
    expect(findProfile(config, "nobody")).toBeUndefined();
    expect(findProfile(config, "   ")).toBeUndefined();
    expect(findProfile(config, null)).toBeUndefined();
  });

  it("enables guest apps plus the profile's own, limited to this build", () => {
    const build = ["portfolio", "units", "cardlens"];
    expect([...enabledAppIds(config, undefined, build)]).toEqual(["portfolio"]);
    expect([...enabledAppIds(config, config.profiles[0], build)]).toEqual(build);
    // No inheritsGuest: own apps only; "gone" is not in the build.
    expect([...enabledAppIds(config, config.profiles[1], build)]).toEqual(["units"]);
    // An app listed but not in this build (e.g. cut out) is never enabled.
    expect([...enabledAppIds(config, config.profiles[0], ["units"])]).toEqual(["units"]);
  });

  it("filters apps in order", () => {
    const apps = ["a", "b", "c"].map((id) => ({ manifest: { id } }));
    expect(filterApps(apps, new Set(["c", "a"])).map((app) => app.manifest.id)).toEqual(["a", "c"]);
  });
});

describe("storage", () => {
  it("remembers and forgets the profile id under commons.profile", () => {
    expect(readProfileId()).toBeUndefined();
    saveProfileId("tammy");
    expect(localStorage.getItem(PROFILE_STORAGE_KEY)).toBe("tammy");
    expect(readProfileId()).toBe("tammy");
    clearProfileId();
    expect(readProfileId()).toBeUndefined();
  });

  it("survives blocked storage", () => {
    const blocked = () => {
      throw new Error("blocked");
    };
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(blocked);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(blocked);
    expect(readProfileId()).toBeUndefined();
    expect(() => saveProfileId("tammy")).not.toThrow();
    expect(() => clearProfileId()).not.toThrow();
  });
});
