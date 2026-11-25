import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "./AppRoutes";
import { listedApps } from "@/registry/registry";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe("homepage", () => {
  it("lists every public app from the registry", () => {
    renderAt("/");
    expect(screen.getByRole("heading", { level: 1, name: "Commons" })).toBeInTheDocument();
    const list = screen.getByRole("list", { name: /apps/i });
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

  it("shows a not-found page for unknown apps", () => {
    renderAt("/apps/does-not-exist");
    expect(screen.getByRole("heading", { name: "Not here" })).toBeInTheDocument();
  });
});
