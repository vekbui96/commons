import { describe, expect, it } from "vitest";
import { registry } from "@/registry/registry";
import { backTarget, fromTab } from "./navState";
import { matchesQuery } from "./appFilter";

describe("back target", () => {
  it("returns to the tab the app was opened from", () => {
    expect(backTarget(fromTab("/tab/private"))).toBe("/tab/private");
    expect(backTarget(fromTab("/"))).toBe("/");
  });

  it("falls back to the default tab for anything else", () => {
    expect(backTarget(undefined)).toBe("/");
    expect(backTarget(null)).toBe("/");
    expect(backTarget({ from: "https://example.com/" })).toBe("/");
    expect(backTarget({ from: "/apps/units" })).toBe("/");
    expect(backTarget({ from: 7 })).toBe("/");
  });
});

describe("app filter (kept for the future search)", () => {
  const units = registry.find((a) => a.manifest.id === "units")!;

  it("matches name and description, case-insensitively", () => {
    expect(matchesQuery(units, "")).toBe(true);
    expect(matchesQuery(units, "UNI")).toBe(true);
    expect(matchesQuery(units, "temperature")).toBe(true);
    expect(matchesQuery(units, "zzz")).toBe(false);
  });
});
