import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppShell, Button, Field, Input, ThemeToggle } from "@/ui";
import { THEME_STORAGE_KEY, readTheme } from "./theme";
import { Home } from "@/shell/Home";

const future = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("Field", () => {
  it("links label, hint and error to the control", () => {
    render(
      <Field label="Amount" hint="In kilometres" error="Enter a number">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Amount");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("In kilometres Enter a number");
  });
});

describe("Button", () => {
  it("defaults to type=button and the primary variant", () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("ui-button--primary");
  });
});

describe("ThemeToggle", () => {
  it("sets data-theme and remembers the choice; system clears both", async () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "System" })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(readTheme()).toBe("dark");

    await userEvent.click(screen.getByRole("button", { name: "System" }));
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });
});

describe("keyboard", () => {
  it("Esc in an app goes back to the homepage", async () => {
    render(
      <MemoryRouter initialEntries={["/apps/demo"]} future={future}>
        <Routes>
          <Route path="/" element={<h1>Home page</h1>} />
          <Route
            path="/apps/demo"
            element={
              <AppShell title="Demo">
                <p>Body</p>
              </AppShell>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Demo" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(await screen.findByRole("heading", { name: "Home page" })).toBeInTheDocument();
  });

  it("/ focuses the homepage filter, which narrows the list", async () => {
    render(
      <MemoryRouter future={future}>
        <Home />
      </MemoryRouter>,
    );
    fireEvent.keyDown(document.body, { key: "/" });
    const filter = screen.getByLabelText("Filter apps");
    expect(filter).toHaveFocus();
    await userEvent.type(filter, "units");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    await userEvent.clear(filter);
    await userEvent.type(filter, "zzz");
    expect(screen.getByText(/No apps match/)).toBeInTheDocument();
  });
});
