import { describe, expect, it } from "vitest";
import { findInternalApp, listedApps, registry } from "./registry";
import { duplicateIds, validateManifest } from "./validate";

describe("app registry", () => {
  it("discovers the seeded apps", () => {
    const ids = registry.map((app) => app.manifest.id);
    expect(ids).toEqual(expect.arrayContaining(["cardlens", "portfolio", "units"]));
  });

  it.each(registry.map((app) => [app.folder, app] as const))("apps/%s has a valid manifest", (_, app) => {
    expect(validateManifest(app.manifest, app.folder, app.load !== undefined)).toEqual([]);
  });

  it("has unique ids", () => {
    expect(duplicateIds(registry.map((app) => app.manifest))).toEqual([]);
  });

  it("uses https for every external url", () => {
    for (const { manifest } of registry) {
      if (manifest.kind === "external") expect(new URL(manifest.url).protocol).toBe("https:");
    }
  });

  it("never links to tailnet or private hosts (this page is public)", () => {
    for (const { manifest } of registry) {
      if (manifest.kind !== "external") continue;
      const host = new URL(manifest.url).hostname;
      expect(host).not.toMatch(/\.ts\.net$|^localhost$|^127\.|^10\.|^192\.168\./);
    }
  });

  it("resolves internal apps by id and not external ones", () => {
    expect(findInternalApp("units")).toBeDefined();
    expect(findInternalApp("cardlens")).toBeUndefined();
    expect(findInternalApp("nope")).toBeUndefined();
  });

  it("hides private apps from the homepage", () => {
    const fake = [
      ...registry,
      {
        folder: "secret",
        load: undefined,
        manifest: {
          id: "secret",
          name: "Secret",
          description: "Hidden.",
          icon: "S",
          kind: "external" as const,
          url: "https://example.com/",
          visibility: "private" as const,
        },
      },
    ];
    expect(listedApps(fake).map((a) => a.manifest.id)).not.toContain("secret");
  });
});

describe("validateManifest", () => {
  const good = {
    id: "demo",
    name: "Demo",
    description: "One line.",
    icon: "D",
    kind: "external",
    url: "https://example.com/",
    visibility: "public",
  };

  it("accepts a good manifest", () => {
    expect(validateManifest(good, "demo", false)).toEqual([]);
  });

  it("rejects http urls, id/folder mismatch and bad fields", () => {
    expect(validateManifest({ ...good, url: "http://example.com/" }, "demo", false)).toHaveLength(1);
    expect(validateManifest(good, "other", false)).toHaveLength(1);
    expect(validateManifest({ ...good, id: "Not_Kebab" }, "Not_Kebab", false)).toHaveLength(1);
    expect(validateManifest({ ...good, icon: "abc" }, "demo", false)).toHaveLength(1);
    expect(validateManifest({ ...good, visibility: "team" }, "demo", false)).toHaveLength(1);
    expect(validateManifest({ ...good, description: "two\nlines" }, "demo", false)).toHaveLength(1);
    expect(validateManifest({ ...good, tint: "rust" }, "demo", false)).toHaveLength(1);
    expect(validateManifest({ ...good, tint: "steel" }, "demo", false)).toEqual([]);
  });

  it("requires an App.tsx for internal apps", () => {
    const internal = { ...good, kind: "internal", url: undefined };
    delete (internal as Record<string, unknown>).url;
    expect(validateManifest(internal, "demo", false)).toHaveLength(1);
    expect(validateManifest(internal, "demo", true)).toEqual([]);
  });

  it("finds duplicate ids", () => {
    expect(duplicateIds([{ id: "a" }, { id: "b" }, { id: "a" }])).toEqual(["a"]);
  });
});
