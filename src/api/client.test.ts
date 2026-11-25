import { afterEach, describe, expect, it, vi } from "vitest";
import {
  API_BASE,
  ApiUnavailableError,
  HEALTH_TIMEOUT_MS,
  REACHABILITY_TTL_MS,
  apiUrl,
  appApiUrl,
  checkReachable,
  getHealth,
  hasApi,
  normaliseBase,
  resetReachability,
  resetSession,
  resolveApiBase,
  getSession,
  sendJson,
  TOKEN_HEADER,
} from "./client";

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

describe("api base per build target", () => {
  it("uses the same origin on the private build and nothing on the public one", () => {
    expect(resolveApiBase("private", undefined)).toBe("");
    expect(resolveApiBase("public", undefined)).toBeNull();
    expect(resolveApiBase("public", "https://api.example/")).toBe("https://api.example");
    expect(apiUrl("/api/health", resolveApiBase("private", undefined))).toBe("/api/health");
    expect(hasApi("")).toBe(true);
  });
});

describe("reachability", () => {
  afterEach(() => {
    resetReachability();
    vi.useRealTimers();
  });

  const healthy = () =>
    new Response(JSON.stringify({ ok: true, service: "commons", db: "ok", schemaVersion: 1, apps: [] }));

  it("is false without a base and never fetches", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(checkReachable(null)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("caches one health check per base", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(healthy()));
    vi.stubGlobal("fetch", fetchMock);
    const [a, b] = await Promise.all([checkReachable("", 1000), checkReachable("", 2000)]);
    expect([a, b]).toEqual([true, true]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await checkReachable("", 1000 + REACHABILITY_TTL_MS + 1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("counts network errors and 503 as unreachable, without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(checkReachable("https://a.example")).resolves.toBe(false);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 503 })));
    await expect(checkReachable("https://b.example")).resolves.toBe(false);
  });

  it("gives up after the timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(
          (_url: string, init: RequestInit) =>
            new Promise((_, reject) =>
              init.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))),
            ),
        ),
    );
    const result = checkReachable("https://slow.example");
    await vi.advanceTimersByTimeAsync(HEALTH_TIMEOUT_MS + 1);
    await expect(result).resolves.toBe(false);
  });
});

describe("session and writes", () => {
  afterEach(() => resetSession());

  it("sends the session's token on writes and retries once with a fresh one", async () => {
    let token = "t1";
    const fetchMock = vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
      if (url === "/api/session") {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, login: "me@example.com", csrfToken: token })),
        );
      }
      const sent = (init.headers as Record<string, string>)[TOKEN_HEADER];
      if (sent !== "t2") {
        return Promise.resolve(
          new Response(JSON.stringify({ error: "csrf_token_invalid" }), { status: 403 }),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ saved: true })));
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(getSession("")).resolves.toMatchObject({ login: "me@example.com" });
    token = "t2"; // the API restarted
    await expect(sendJson("/api/apps/x/thing", "PUT", { a: 1 }, "")).resolves.toEqual({ saved: true });
    const last = fetchMock.mock.calls.at(-1)!;
    expect(last[1].method).toBe("PUT");
    expect(last[1].body).toBe('{"a":1}');
  });

  it("surfaces the API's error code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "not_owner" }), { status: 403 })),
    );
    await expect(getSession("")).rejects.toMatchObject({ name: "ApiError", status: 403, code: "not_owner" });
  });
});
