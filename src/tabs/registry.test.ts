import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { registry, type RegisteredApp } from "@/registry/registry";
import {
  appsForTab,
  availableTabs,
  defaultTab,
  linkTarget,
  resolveTab,
  tabPath,
  tabRegistry,
  type RegisteredTab,
} from "./registry";
import { defineTab, type AppsTab, type TabDefinition } from "./types";
import { isAllowedTabUrl, validateTab } from "./validate";

const link = defineTab({
  id: "hub",
  label: "Hub",
  icon: "link",
  kind: "link",
  url: "https://example.com/",
  order: 5,
  visibility: "public",
});
const inSite = defineTab({ ...link, id: "units-link", url: "#/apps/units", order: 30 });
const page = defineTab({
  id: "units-page",
  label: "Units",
  icon: "page",
  kind: "page",
  app: "units",
  order: 40,
  visibility: "public",
});
const reg = (tabs: TabDefinition[]): RegisteredTab[] => tabs.map((tab) => ({ file: tab.id, tab }));
const all = (extra: TabDefinition[] = []) => [...tabRegistry, ...reg(extra)];
const appsTab = (id: string) => tabRegistry.find((t) => t.tab.id === id)!.tab as AppsTab;

const secretApp: RegisteredApp = {
  folder: "secret",
  load: () => Promise.resolve({ default: () => null }),
  manifest: {
    id: "secret",
    name: "S",
    description: "S.",
    icon: "S",
    kind: "internal",
    visibility: "private",
  },
};

describe("tab registry", () => {
  it("discovers the Public, Private, Ops and Profiles tabs", () => {
    expect(tabRegistry.map((t) => t.tab.id).sort()).toEqual(["ops", "private", "profiles", "public"]);
  });

  it.each(tabRegistry.map((t) => [t.file, t] as const))("tabs/defs/%s.ts is valid", (file, { tab }) => {
    expect(validateTab(tab, file, registry)).toEqual([]);
  });

  it("has unique ids", () => {
    const ids = tabRegistry.map((t) => t.tab.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // build/target.ts reads each file's source to decide what the public build
  // may contain: exactly one visibility literal, matching the definition.
  it.each(tabRegistry.map((t) => [t.file, t] as const))(
    "tabs/defs/%s.ts declares its visibility once, as a literal",
    (file, { tab }) => {
      const source = readFileSync(join(process.cwd(), "src", "tabs", "defs", `${file}.ts`), "utf8");
      const found = [...source.matchAll(/\bvisibility\s*:\s*["'](public|private)["']/g)].map((m) => m[1]);
      expect(found).toEqual([tab.visibility]);
    },
  );

  it("shows only the Public tab on the public site, all on the private site, Public first", () => {
    expect(availableTabs(tabRegistry, "public").map((t) => t.id)).toEqual(["public"]);
    expect(availableTabs(tabRegistry, "private").map((t) => t.id)).toEqual([
      "public",
      "private",
      "ops",
      "profiles",
    ]);
  });

  it("sorts by order, then label", () => {
    const tabs = availableTabs(all([page, link, inSite]), "private");
    expect(tabs.map((t) => t.id)).toEqual([
      "hub",
      "public",
      "private",
      "ops",
      "units-link",
      "profiles",
      "units-page",
    ]);
  });

  it("defaults to the first selectable tab, skipping links", () => {
    expect(defaultTab(availableTabs(all([link]), "private"))?.id).toBe("public");
    expect(defaultTab([])).toBeUndefined();
  });

  it("resolves ids, falling back to the default for unknown, unavailable and link tabs", () => {
    const pub = availableTabs(all([link, page]), "public");
    expect(resolveTab("units-page", pub)?.id).toBe("units-page");
    expect(resolveTab(undefined, pub)?.id).toBe("public");
    expect(resolveTab("nope", pub)?.id).toBe("public");
    expect(resolveTab("private", pub)?.id).toBe("public");
    expect(resolveTab("hub", pub)?.id).toBe("public");
    expect(resolveTab("private", availableTabs(tabRegistry, "private"))?.id).toBe("private");
  });

  it("gives the default tab the path / and others /tab/<id>", () => {
    const tabs = availableTabs(tabRegistry, "private");
    expect(tabPath("public", tabs)).toBe("/");
    expect(tabPath("private", tabs)).toBe("/tab/private");
  });

  it("lists apps by visibility", () => {
    const apps = [...registry.filter((a) => a.manifest.visibility === "public"), secretApp];
    expect(appsForTab(appsTab("private"), apps).map((a) => a.manifest.id)).toEqual(["secret"]);
    expect(appsForTab(appsTab("public"), apps)).toHaveLength(apps.length - 1);
  });
});

describe("link tabs", () => {
  it("open https in a new tab and in-site routes in this one", () => {
    expect(linkTarget(link)).toEqual({ href: "https://example.com/", newTab: true });
    expect(linkTarget(inSite)).toEqual({ href: "#/apps/units", newTab: false });
    expect(linkTarget({ ...link, url: "/ops/" })).toEqual({ href: "/ops/", newTab: false });
  });

  it("accept https, #/ routes and same-origin paths, never tailnet, LAN or http", () => {
    expect(isAllowedTabUrl("https://example.com/")).toBe(true);
    expect(isAllowedTabUrl("#/apps/units")).toBe(true);
    expect(isAllowedTabUrl("/ops/")).toBe(true);
    expect(isAllowedTabUrl("//evil.example/")).toBe(false);
    expect(isAllowedTabUrl("http://example.com/")).toBe(false);
    expect(isAllowedTabUrl("https://box.tail0000.ts.net/")).toBe(false);
    expect(isAllowedTabUrl("https://192.168.1.2/")).toBe(false);
    expect(isAllowedTabUrl("javascript:alert(1)")).toBe(false);
  });

  it("are validated", () => {
    expect(validateTab(link, "hub", registry)).toEqual([]);
    expect(validateTab({ ...link, url: "http://example.com/" }, "hub", registry)).toHaveLength(1);
  });
});

describe("page tabs", () => {
  const apps = [...registry, secretApp];

  it("must name an internal app the tab may show", () => {
    expect(validateTab(page, "units-page", apps)).toEqual([]);
    expect(validateTab({ ...page, app: "cardlens" }, "units-page", apps)).toHaveLength(1);
    expect(validateTab({ ...page, app: "nope" }, "units-page", apps)).toHaveLength(1);
    expect(validateTab({ ...page, app: "secret" }, "units-page", apps)).toHaveLength(1);
    expect(validateTab({ ...page, app: "secret", visibility: "private" }, "units-page", apps)).toEqual([]);
  });

  it("are selectable", () => {
    expect(resolveTab("units-page", [page])?.id).toBe("units-page");
  });
});

describe("panel tabs", () => {
  const panel = defineTab({
    id: "view",
    label: "View",
    icon: "people",
    kind: "panel",
    load: () => Promise.resolve({ default: () => null }),
    order: 50,
    visibility: "private",
  });

  it("need a loader and are selectable", () => {
    expect(validateTab(panel, "view", registry)).toEqual([]);
    expect(validateTab({ ...panel, load: "x" }, "view", registry)).toHaveLength(1);
    expect(resolveTab("view", [panel])?.id).toBe("view");
  });
});

describe("validateTab", () => {
  const good = appsTab("public");

  it("rejects bad fields", () => {
    expect(validateTab(good, "other", registry)).toHaveLength(1);
    expect(validateTab({ ...good, id: "Bad_Id" }, "Bad_Id", registry)).toHaveLength(1);
    expect(validateTab({ ...good, label: "" }, "public", registry)).toHaveLength(1);
    expect(validateTab({ ...good, icon: "rocket" }, "public", registry)).toHaveLength(1);
    expect(validateTab({ ...good, visibility: "team" }, "public", registry)).toHaveLength(1);
    expect(validateTab({ ...good, order: Number.NaN }, "public", registry)).toHaveLength(1);
    expect(validateTab({ ...good, kind: "feed" }, "public", registry)).toHaveLength(1);
    expect(validateTab(null, "public", registry)).toHaveLength(1);
  });

  it("keeps private apps out of public tabs", () => {
    expect(validateTab({ ...good, filter: { appVisibility: "private" } }, "public", registry)).toHaveLength(
      1,
    );
  });
});
