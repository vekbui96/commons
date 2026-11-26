import { afterEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { PROFILE_STORAGE_KEY } from "./storage";
import type { ProfilesConfig } from "./types";
import { ProfileProvider, useProfile, type ProfileState } from "./useProfile";

const future = { v7_startTransition: true, v7_relativeSplatPath: true } as const;
const config: ProfilesConfig = {
  version: 1,
  guest: { apps: ["portfolio"] },
  profiles: [
    { id: "tammy", name: "Tammy", aliases: ["Tam"], inheritsGuest: true, apps: ["units", "cardlens"] },
  ],
};
const available = ["portfolio", "units", "cardlens", "other"];

let state: ProfileState;

function Probe() {
  state = useProfile();
  const location = useLocation();
  return (
    <>
      <output data-testid="label">{state.label}</output>
      <output data-testid="route">{location.pathname + location.search}</output>
    </>
  );
}

function renderAt(path = "/", { enabled = true }: { enabled?: boolean } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]} future={future}>
      <ProfileProvider config={config} available={available} enabled={enabled}>
        <Probe />
      </ProfileProvider>
    </MemoryRouter>,
  );
}

const label = () => screen.getByTestId("label").textContent;
const route = () => screen.getByTestId("route").textContent;
const stored = () => localStorage.getItem(PROFILE_STORAGE_KEY);

afterEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("useProfile", () => {
  it("starts as a guest with the guest apps", () => {
    renderAt();
    expect(label()).toBe("Guest");
    expect(state.profile).toBeUndefined();
    expect(state.isEnabled("portfolio")).toBe(true);
    expect(state.isEnabled("units")).toBe(false);
  });

  it("restores the remembered profile", () => {
    localStorage.setItem(PROFILE_STORAGE_KEY, "tammy");
    renderAt();
    expect(label()).toBe("Tammy");
    expect(state.isEnabled("units")).toBe(true);
    expect(state.isEnabled("other")).toBe(false);
  });

  it("ignores a remembered id that no longer exists", () => {
    localStorage.setItem(PROFILE_STORAGE_KEY, "someone-gone");
    renderAt();
    expect(label()).toBe("Guest");
  });

  it("chooses by name, remembers it, and switches back to guest", () => {
    renderAt();
    act(() => {
      expect(state.choose("nobody")).toBeUndefined();
    });
    expect(label()).toBe("Guest");
    expect(stored()).toBeNull();
    act(() => {
      expect(state.choose(" TAM ")?.id).toBe("tammy");
    });
    expect(label()).toBe("Tammy");
    expect(stored()).toBe("tammy");
    act(() => state.switchToGuest());
    expect(label()).toBe("Guest");
    expect(stored()).toBeNull();
  });

  it("reads ?profile= from the hash route, applies it and strips it (keeping other params)", () => {
    renderAt("/apps/units?x=1&profile=tammy");
    expect(label()).toBe("Tammy");
    expect(stored()).toBe("tammy");
    expect(route()).toBe("/apps/units?x=1");
  });

  it("reads ?profile= from the real query string and strips it with replaceState", () => {
    window.history.replaceState(null, "", "/commons/?profile=Tammy#/tab/public");
    renderAt();
    expect(label()).toBe("Tammy");
    expect(stored()).toBe("tammy");
    expect(window.location.search).toBe("");
    expect(window.location.pathname).toBe("/commons/");
    expect(window.location.hash).toBe("#/tab/public");
  });

  it("resets to guest on ?profile=guest", () => {
    localStorage.setItem(PROFILE_STORAGE_KEY, "tammy");
    renderAt("/?profile=guest");
    expect(label()).toBe("Guest");
    expect(stored()).toBeNull();
    expect(route()).toBe("/");
  });

  it("resets to guest on ?profile=guest in the real query string", () => {
    localStorage.setItem(PROFILE_STORAGE_KEY, "tammy");
    window.history.replaceState(null, "", "/?profile=GUEST");
    renderAt();
    expect(label()).toBe("Guest");
    expect(stored()).toBeNull();
    expect(window.location.search).toBe("");
  });

  it("ignores an unknown ?profile= and keeps the current state", () => {
    localStorage.setItem(PROFILE_STORAGE_KEY, "tammy");
    renderAt("/?profile=bob");
    expect(label()).toBe("Tammy");
    expect(stored()).toBe("tammy");
  });

  it("does nothing on the private build: every app is enabled, ?profile= is left alone", () => {
    renderAt("/?profile=tammy", { enabled: false });
    expect(state.active).toBe(false);
    expect(label()).toBe("Guest");
    expect(state.isEnabled("other")).toBe(true);
    expect(stored()).toBeNull();
    expect(route()).toBe("/?profile=tammy");
  });
});
