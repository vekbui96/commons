import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findInternalApp, listedApps, registry, type RegisteredApp } from "./registry";
import { duplicateIds, validateManifest } from "./validate";

describe("app registry", () => {
  it("discovers the seeded apps", () => {
    const ids = registry.map((app) => app.manifest.id);
    expect(ids).toEqual(expect.arrayContaining(["cardlens", "portfolio", "units"]));
  });

  it.each(registry.map((app) => [app.folder, app] as const))("apps/%s has a valid manifest", (_, app) => {
    expect(validateManifest(app.manifest, app.folder, app.load !== undefined)).toEqual([]);
  });

  // App-specific detail lives next to the app, never in the root CLAUDE.md.
  it.each(registry.filter((app) => app.manifest.kind === "internal").map((app) => [app.folder] as const))(
    "apps/%s (internal) has its own short CLAUDE.md",
    (folder) => {
      const file = join(process.cwd(), "src", "apps", folder, "CLAUDE.md");
      expect(existsSync(file), `add src/apps/${folder}/CLAUDE.md (docs/templates/app-CLAUDE.md)`).toBe(true);
      const lines = readFileSync(file, "utf8").trimEnd().split("\n").length;
      expect(lines, `src/apps/${folder}/CLAUDE.md is ${lines} lines; keep it to 15`).toBeLessThanOrEqual(15);
    },
  );

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

  // build/target.ts decides what the public build may contain by reading each
  // manifest's source, so visibility must be a plain literal that matches.
  it.each(registry.map((app) => [app.folder, app] as const))(
    "apps/%s declares visibility as a literal (the build switch reads it)",
    (folder, app) => {
      const source = readFileSync(join(process.cwd(), "src", "apps", folder, "manifest.ts"), "utf8");
      expect(source).toMatch(new RegExp(String.raw`\bvisibility\s*:\s*["']${app.manifest.visibility}["']`));
    },
  );

  const secret: RegisteredApp = {
    folder: "secret",
    load: () => Promise.resolve({ default: () => null }),
    manifest: {
      id: "secret",
      name: "Secret",
      description: "Hidden.",
      icon: "S",
      kind: "internal",
      visibility: "private",
    },
  };
  const withSecret = [...registry, secret];

  it("keeps private apps off the public site", () => {
    expect(listedApps(withSecret, "public").map((a) => a.manifest.id)).not.toContain("secret");
    expect(findInternalApp("secret", withSecret, "public")).toBeUndefined();
  });

  it("lists and opens private apps on the private site", () => {
    expect(listedApps(withSecret, "private").map((a) => a.manifest.id)).toContain("secret");
    expect(findInternalApp("secret", withSecret, "private")).toBe(secret);
    expect(listedApps(withSecret, "private")).toHaveLength(withSecret.length);
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
    expect(validateManifest({ ...internal, wide: true }, "demo", true)).toEqual([]);
    expect(validateManifest({ ...internal, wide: "yes" }, "demo", true)).toHaveLength(1);
  });

  it("finds duplicate ids", () => {
    expect(duplicateIds([{ id: "a" }, { id: "b" }, { id: "a" }])).toEqual(["a"]);
  });
});
