import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import bundled from "./profiles.json";
import {
  fetchPublishedProfiles,
  initialProfiles,
  PROFILES_CACHE_KEY,
  PROFILES_URL,
  readCachedProfiles,
} from "./source";
import { PROFILE_STORAGE_KEY } from "./storage";
import { ProfileProvider, useProfile } from "./useProfile";

const future = { v7_startTransition: true, v7_relativeSplatPath: true } as const;
const available = ["portfolio", "units", "cardlens"];

/** The published file: the bundled shape plus `revision` and a key from the future. */
const published = {
  version: 1,
  revision: 7,
  futureKey: { anything: true },
  guest: { apps: ["portfolio", "units"] },
  profiles: [
    { id: "tammy", name: "Tammy", aliases: [], inheritsGuest: true, apps: ["cardlens"], extra: 1 },
    { id: "ollie", name: "Ollie", aliases: ["Ol"], inheritsGuest: false, apps: ["cardlens"] },
  ],
};

function stubFetch(answer: () => Promise<Response>) {
  const fn = vi.fn(answer);
  vi.stubGlobal("fetch", fn);
  return fn;
}
const ok = (body: unknown) => () => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

function Probe() {
  const state = useProfile();
  return (
    <>
      <output data-testid="label">{state.label}</output>
      <output data-testid="apps">{available.filter((id) => state.isEnabled(id)).join(",")}</output>
    </>
  );
}

function renderSite(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]} future={future}>
      <ProfileProvider available={available} enabled>
        <Probe />
      </ProfileProvider>
    </MemoryRouter>,
  );
}
const apps = () => screen.getByTestId("apps").textContent;
const label = () => screen.getByTestId("label").textContent;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("fetchPublishedProfiles", () => {
  it("fetches the published file cache-busted, ignores unknown keys and caches it", async () => {
    const fn = stubFetch(ok(published));
    const config = await fetchPublishedProfiles({ now: 123 });
    expect(fn).toHaveBeenCalledWith(`${PROFILES_URL}?v=123`, expect.objectContaining({ cache: "no-store" }));
    expect(config).toEqual({
      version: 1,
      guest: { apps: ["portfolio", "units"] },
      profiles: [
        { id: "tammy", name: "Tammy", aliases: [], inheritsGuest: true, apps: ["cardlens"] },
        { id: "ollie", name: "Ollie", aliases: ["Ol"], inheritsGuest: false, apps: ["cardlens"] },
      ],
    });
    expect(readCachedProfiles()).toEqual(config);
  });

  it("resolves undefined on a network error, an HTTP error, bad JSON or invalid data, caching nothing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubFetch(() => Promise.reject(new TypeError("offline")));
    await expect(fetchPublishedProfiles()).resolves.toBeUndefined();
    stubFetch(() => Promise.resolve(new Response("nope", { status: 404 })));
    await expect(fetchPublishedProfiles()).resolves.toBeUndefined();
    stubFetch(() => Promise.resolve(new Response("{not json", { status: 200 })));
    await expect(fetchPublishedProfiles()).resolves.toBeUndefined();
    stubFetch(ok({ version: 2 }));
    await expect(fetchPublishedProfiles()).resolves.toBeUndefined();
    expect(localStorage.getItem(PROFILES_CACHE_KEY)).toBeNull();
  });

  it("gives up after the timeout", async () => {
    stubFetch(() => new Promise<Response>(() => {}));
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_, reject) =>
            init.signal!.addEventListener("abort", () => reject(new Error("aborted"))),
          ),
      ),
    );
    await expect(fetchPublishedProfiles({ timeoutMs: 5 })).resolves.toBeUndefined();
  });
});

describe("initialProfiles", () => {
  it("uses a valid cache, else the bundled file", () => {
    expect(initialProfiles().guest).toEqual(bundled.guest);
    localStorage.setItem(PROFILES_CACHE_KEY, "{broken");
    expect(initialProfiles().guest).toEqual(bundled.guest);
    localStorage.setItem(PROFILES_CACHE_KEY, JSON.stringify(published));
    expect(initialProfiles().guest.apps).toEqual(["portfolio", "units"]);
  });
});

describe("the public site's profiles", () => {
  it("renders from the bundled file first, then switches to the published one", async () => {
    let answer!: (r: Response) => void;
    stubFetch(() => new Promise<Response>((resolve) => (answer = resolve)));
    renderSite();
    expect(apps()).toBe("portfolio");
    await act(async () => answer(new Response(JSON.stringify(published), { status: 200 })));
    expect(apps()).toBe("portfolio,units");
  });

  it("renders from the cache first when there is one (no flash of the bundled tiles)", () => {
    localStorage.setItem(PROFILES_CACHE_KEY, JSON.stringify(published));
    stubFetch(() => new Promise<Response>(() => {}));
    renderSite();
    expect(apps()).toBe("portfolio,units");
  });

  it("keeps the bundled file when the published one fails", async () => {
    const fn = stubFetch(() => Promise.reject(new TypeError("offline")));
    renderSite();
    await waitFor(() => expect(fn).toHaveBeenCalled());
    expect(apps()).toBe("portfolio");
  });

  it("applies a ?profile= that only the published file knows, once it arrives", async () => {
    stubFetch(ok(published));
    renderSite("/?profile=ol");
    await waitFor(() => expect(label()).toBe("Ollie"));
    expect(apps()).toBe("cardlens");
    expect(localStorage.getItem(PROFILE_STORAGE_KEY)).toBe("ollie");
  });

  it("restores a remembered profile that only the published file knows", async () => {
    localStorage.setItem(PROFILE_STORAGE_KEY, "ollie");
    stubFetch(ok(published));
    renderSite();
    expect(label()).toBe("Guest");
    await waitFor(() => expect(label()).toBe("Ollie"));
  });

  it("does not fetch on the private build", () => {
    const fn = stubFetch(ok(published));
    render(
      <MemoryRouter future={future}>
        <ProfileProvider available={available} enabled={false}>
          <Probe />
        </ProfileProvider>
      </MemoryRouter>,
    );
    expect(fn).not.toHaveBeenCalled();
    expect(apps()).toBe("portfolio,units,cardlens");
  });
});
