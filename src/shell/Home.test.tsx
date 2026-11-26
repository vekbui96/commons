import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AppRoutes } from "./AppRoutes";
import { AppHost } from "./AppHost";
import { Home } from "./Home";
import { listedApps, type RegisteredApp } from "@/registry/registry";
import { availableTabs, tabRegistry } from "@/tabs/registry";
import { defineTab, type TabDefinition } from "@/tabs/types";

const future = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

function Where() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="where">{location.pathname}</output>
      <button type="button" onClick={() => navigate(-1)}>
        Browser back
      </button>
    </>
  );
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]} future={future}>
      <AppRoutes />
      <Where />
    </MemoryRouter>,
  );
}

/** A private-site homepage with given tabs and apps, plus the app route. */
function renderSite(path: string, tabs: TabDefinition[], apps: RegisteredApp[] = listedApps()) {
  return render(
    <MemoryRouter initialEntries={[path]} future={future}>
      <Routes>
        <Route path="/" element={<Home tabs={tabs} apps={apps} />} />
        <Route path="/tab/:tabId" element={<Home tabs={tabs} apps={apps} />} />
        <Route path="/apps/:id" element={<AppHost />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
}

const secret: RegisteredApp = {
  folder: "secret",
  load: () => Promise.resolve({ default: () => null }),
  manifest: {
    id: "secret",
    name: "Secret thing",
    description: "Hidden.",
    icon: "S",
    kind: "internal",
    visibility: "private",
  },
};
const privateTabs = availableTabs(tabRegistry, "private");
// A non-default tab that lists Units, to check "← Commons" returns to it.
const tools = defineTab({
  id: "tools",
  label: "Tools",
  icon: "grid",
  kind: "apps",
  filter: { appVisibility: "public" },
  order: 30,
  visibility: "private",
});

const where = () => screen.getByTestId("where").textContent;
const selectedTab = () => screen.getByRole("tab", { selected: true });

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("homepage", () => {
  it("names Commons in the h1 pill and shows the Guest avatar on the public site", () => {
    renderAt("/");
    expect(screen.getByRole("heading", { level: 1, name: "Commons" })).toBeInTheDocument();
    expect(screen.getByText("Guest")).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("selects the Public tab by default and lists every public app", () => {
    renderAt("/");
    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(selectedTab()).toHaveAccessibleName("Public");
    const panel = screen.getByRole("tabpanel", { name: "Public" });
    const list = within(panel).getByRole("list", { name: /Public/ });
    expect(within(list).getAllByRole("listitem")).toHaveLength(listedApps().length);
  });

  it("links external apps out in a new tab", () => {
    renderAt("/");
    const cardlens = screen.getByRole("link", { name: /CardLens/ });
    expect(cardlens).toHaveAttribute("href", "https://vekbui96.github.io/cardlens/");
    expect(cardlens).toHaveAttribute("target", "_blank");
    expect(cardlens).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(screen.getByRole("link", { name: /Portfolio/ })).toHaveAttribute(
      "href",
      "https://vekbui96.github.io/solid-website/",
    );
  });

  it("opens an internal app on its own route", async () => {
    renderAt("/");
    await userEvent.click(screen.getByRole("link", { name: /Units/ }));
    expect(await screen.findByRole("heading", { level: 1, name: "Units" })).toBeInTheDocument();
    // The lazy App.tsx has loaded and converts: 1 km = 0.6214 mi.
    expect(await screen.findByTestId("units-result")).toHaveTextContent("0.6214");
  });

  it("falls back to the default tab for unknown ids, and fixes the URL", () => {
    renderAt("/tab/nope");
    expect(selectedTab()).toHaveAccessibleName("Public");
    expect(where()).toBe("/");
  });

  it("has no Private tab on the public site, even by URL", () => {
    renderAt("/tab/private");
    expect(screen.queryByRole("tab", { name: "Private" })).not.toBeInTheDocument();
    expect(selectedTab()).toHaveAccessibleName("Public");
    expect(where()).toBe("/");
  });

  it("shows a not-found page for unknown apps", () => {
    renderAt("/apps/does-not-exist");
    expect(screen.getByRole("heading", { name: "Not here" })).toBeInTheDocument();
  });
});

describe("homepage tabs (private site)", () => {
  it("switches tabs through the URL, scrolls to the top, and back works", async () => {
    renderSite("/", privateTabs, [...listedApps(), secret]);
    expect(selectedTab()).toHaveAccessibleName("Public");
    expect(screen.queryByRole("link", { name: /Secret thing/ })).not.toBeInTheDocument();

    const scrollTo = vi.mocked(window.scrollTo);
    scrollTo.mockClear();
    await userEvent.click(screen.getByRole("tab", { name: "Private" }));
    expect(where()).toBe("/tab/private");
    expect(selectedTab()).toHaveAccessibleName("Private");
    expect(screen.getByRole("link", { name: /Secret thing/ })).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledWith(0, 0);

    await userEvent.click(screen.getByRole("button", { name: "Browser back" }));
    expect(where()).toBe("/");
    expect(selectedTab()).toHaveAccessibleName("Public");
  });

  it("opens /tab/<id> directly", () => {
    renderSite("/tab/private", privateTabs, [...listedApps(), secret]);
    expect(selectedTab()).toHaveAccessibleName("Private");
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Private");
  });

  it("returns to the tab the app was opened from (← Commons and Esc)", async () => {
    renderSite("/tab/tools", [...privateTabs, tools]);
    expect(selectedTab()).toHaveAccessibleName("Tools");

    await userEvent.click(screen.getByRole("link", { name: /Units/ }));
    expect(await screen.findByRole("heading", { level: 1, name: "Units" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: /Commons/ }));
    expect(where()).toBe("/tab/tools");
    expect(selectedTab()).toHaveAccessibleName("Tools");

    await userEvent.click(screen.getByRole("link", { name: /Units/ }));
    await screen.findByRole("heading", { level: 1, name: "Units" });
    await userEvent.keyboard("{Escape}");
    expect(where()).toBe("/tab/tools");
  });

  it("sends a deep-linked app back to the default tab", async () => {
    renderSite("/apps/units", privateTabs);
    await screen.findByRole("heading", { level: 1, name: "Units" });
    await userEvent.click(screen.getByRole("link", { name: /Commons/ }));
    expect(where()).toBe("/");
  });

  it("renders a page tab's app inside the tab", async () => {
    const page = defineTab({
      id: "units-page",
      label: "Convert",
      icon: "page",
      kind: "page",
      app: "units",
      order: 40,
      visibility: "public",
    });
    renderSite("/tab/units-page", [...privateTabs, page]);
    expect(selectedTab()).toHaveAccessibleName("Convert");
    expect(await screen.findByTestId("units-result")).toHaveTextContent("0.6214");
    // No app bar inside a tab.
    expect(screen.getAllByRole("link", { name: "Commons" })).toHaveLength(1);
  });
});
