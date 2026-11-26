import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProfileProvider } from "@/profiles/useProfile";
import { PROFILE_STORAGE_KEY } from "@/profiles/storage";
import { defineTab } from "@/tabs/types";
import { availableTabs } from "@/tabs/registry";
import { Home } from "./Home";

const future = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

function renderHome(tabs = availableTabs()) {
  return render(
    <MemoryRouter initialEntries={["/"]} future={future}>
      <ProfileProvider>
        <Routes>
          <Route path="/" element={<Home tabs={tabs} />} />
          <Route path="/tab/:tabId" element={<Home tabs={tabs} />} />
        </Routes>
      </ProfileProvider>
    </MemoryRouter>,
  );
}

const appNames = () =>
  within(screen.getByRole("tabpanel"))
    .queryAllByRole("listitem")
    .map((item) => item.querySelector(".ui-list-row__title, strong")?.textContent ?? item.textContent);
const dialog = () => screen.getByRole("dialog");

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("profile dialog", () => {
  it("opens from the Guest avatar, focuses the name box, and has no autocomplete", async () => {
    renderHome();
    const avatar = screen.getByRole("button", { name: "Guest" });
    expect(avatar).toHaveAttribute("aria-haspopup", "dialog");
    await userEvent.click(avatar);

    expect(dialog()).toHaveAccessibleName("Who’s visiting?");
    const input = within(dialog()).getByRole("textbox", { name: "First name" });
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("autocomplete", "off");
    expect(dialog().querySelector("form")).toHaveAttribute("autocomplete", "off");
  });

  it("switches to Tammy by name: the avatar and the app list follow", async () => {
    renderHome();
    expect(appNames()).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Guest" }));
    await userEvent.type(within(dialog()).getByRole("textbox"), "tammy{Enter}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const avatar = screen.getByRole("button", { name: "Tammy" });
    expect(avatar).toHaveFocus();
    expect(appNames()).toHaveLength(3);
    expect(localStorage.getItem(PROFILE_STORAGE_KEY)).toBe("tammy");
  });

  it("shows a quiet note for an unknown name and stays a guest", async () => {
    renderHome();
    await userEvent.click(screen.getByRole("button", { name: "Guest" }));
    const input = within(dialog()).getByRole("textbox");
    await userEvent.type(input, "Bob");
    await userEvent.click(within(dialog()).getByRole("button", { name: "Continue" }));

    const note = within(dialog()).getByRole("status");
    expect(note).toHaveTextContent("No view for “Bob” yet. You’re browsing as a guest.");
    expect(input).toHaveAccessibleDescription(/No view for/);
    expect(screen.getByRole("button", { name: "Guest" })).toBeInTheDocument();
    expect(appNames()).toHaveLength(1);

    // Typing again clears the note.
    await userEvent.type(input, "x");
    expect(note).toBeEmptyDOMElement();
  });

  it("shows 'Browsing as' for an active profile, and switching to guest works", async () => {
    localStorage.setItem(PROFILE_STORAGE_KEY, "tammy");
    renderHome();
    expect(appNames()).toHaveLength(3);
    await userEvent.click(screen.getByRole("button", { name: "Tammy" }));

    expect(dialog()).toHaveAccessibleName("Browsing as Tammy");
    const toGuest = within(dialog()).getByRole("button", { name: "Switch to guest" });
    expect(toGuest).toHaveFocus();
    await userEvent.click(toGuest);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guest" })).toHaveFocus();
    expect(appNames()).toHaveLength(1);
    expect(localStorage.getItem(PROFILE_STORAGE_KEY)).toBeNull();
  });

  it("closes on Escape and on Cancel without changing anything, returning focus", async () => {
    renderHome();
    const avatar = screen.getByRole("button", { name: "Guest" });
    await userEvent.click(avatar);
    await userEvent.type(within(dialog()).getByRole("textbox"), "tammy");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(avatar).toHaveFocus();
    expect(screen.getByRole("button", { name: "Guest" })).toBeInTheDocument();

    await userEvent.click(avatar);
    await userEvent.click(within(dialog()).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(avatar).toHaveFocus();
  });

  it("hides a page tab whose app is not in the profile", async () => {
    const page = defineTab({
      id: "units-page",
      label: "Convert",
      icon: "page",
      kind: "page",
      app: "units",
      order: 40,
      visibility: "public",
    });
    renderHome([...availableTabs(), page]);
    expect(screen.queryByRole("tab", { name: "Convert" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Guest" }));
    await userEvent.type(within(dialog()).getByRole("textbox"), "Tammy{Enter}");
    expect(screen.getByRole("tab", { name: "Convert" })).toBeInTheDocument();
  });
});
