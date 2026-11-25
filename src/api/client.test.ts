import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE, ApiUnavailableError, apiUrl, appApiUrl, getHealth, hasApi, normaliseBase } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("has no backend while VITE_COMMONS_API is unset", () => {
    expect(API_BASE).toBeNull();
    expect(hasApi()).toBe(false);
    expect(() => apiUrl("/api/health")).toThrow(ApiUnavailableError);
  });

  it("normalises the configured base", () => {
    expect(normaliseBase(undefined)).toBeNull();
    expect(normaliseBase("  ")).toBeNull();
    expect(normaliseBase("https://api.example/")).toBe("https://api.example");
  });

  it("builds core and per-app URLs per the contract", () => {
    const base = "https://api.example";
    expect(apiUrl("/api/health", base)).toBe("https://api.example/api/health");
    expect(appApiUrl("units", "/history", base)).toBe("https://api.example/api/apps/units/history");
    expect(appApiUrl("units", "", base)).toBe("https://api.example/api/apps/units/");
  });

  it("fetches health from the configured base", async () => {
    const body = { ok: true, service: "commons", db: "ok", schemaVersion: 1, apps: [] };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getHealth("https://api.example")).resolves.toEqual(body);
    expect(fetchMock.mock.calls[0]![0]).toBe("https://api.example/api/health");
  });
});
