import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { defineTab, type TabDefinition } from "@/tabs/types";
import type { SelectableTab } from "@/tabs/registry";
import { TabCarousel } from "./TabCarousel";
import { SiteAvatar } from "./SiteAvatar";

// Many chips, to force overflow (a test page only; never shipped).
const many: TabDefinition[] = Array.from({ length: 12 }, (_, i) =>
  defineTab({
    id: `t${i}`,
    label: `Tab ${i}`,
    icon: i % 2 ? "grid" : "globe",
    kind: "apps",
    filter: { appVisibility: "public" },
    order: i,
    visibility: "public",
  }),
);
const withLink: TabDefinition[] = [
  ...many.slice(0, 2),
  defineTab({
    id: "out",
    label: "Out",
    icon: "link",
    kind: "link",
    url: "https://example.com/",
    order: 99,
    visibility: "public",
  }),
];

function Harness({ tabs, onSelect }: { tabs: TabDefinition[]; onSelect?: (t: SelectableTab) => void }) {
  const [selected, setSelected] = useState(tabs[0]!.id);
  return (
    <TabCarousel
      tabs={tabs}
      selectedId={selected}
      panelId="panel"
      onSelect={(tab) => {
        setSelected(tab.id);
        onSelect?.(tab);
      }}
    />
  );
}

/** jsdom has no layout: give the list fake scroll metrics. */
function fakeOverflow(list: HTMLElement, { scrollWidth = 900, clientWidth = 300 } = {}) {
  Object.defineProperty(list, "scrollWidth", { configurable: true, value: scrollWidth });
  Object.defineProperty(list, "clientWidth", { configurable: true, value: clientWidth });
  list.scrollBy = vi.fn() as unknown as typeof list.scrollBy;
  act(() => {
    window.dispatchEvent(new Event("resize"));
  });
}

afterEach(() => vi.restoreAllMocks());

describe("tab carousel", () => {
  it("shows the selected chip with its label, the others as icon-only with a name and tooltip", () => {
    render(<Harness tabs={many} />);
    const selected = screen.getByRole("tab", { selected: true });
    expect(selected).toHaveTextContent("Tab 0");
    expect(selected).toHaveAttribute("aria-controls", "panel");
    const other = screen.getByRole("tab", { name: "Tab 1" });
    expect(other).toHaveTextContent("");
    expect(other).toHaveAttribute("title", "Tab 1");
    expect(screen.getByRole("tablist")).toHaveAccessibleName("Sections");
  });

  it("uses a roving tabindex: arrows/Home/End move focus, Enter or Space selects", async () => {
    const onSelect = vi.fn();
    render(<Harness tabs={many} onSelect={onSelect} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.filter((t) => t.tabIndex === 0)).toHaveLength(1);

    await userEvent.tab();
    expect(tabs[0]).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(tabs[1]).toHaveFocus();
    expect(onSelect).not.toHaveBeenCalled();
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: "t1" }));

    await userEvent.keyboard("{End}");
    expect(tabs.at(-1)).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(tabs[0]).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(tabs.at(-1)).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: "t11" }));
    await userEvent.keyboard("{Home}");
    expect(tabs[0]).toHaveFocus();
  });

  it("renders link tabs as links that open in a new tab and never become selected", () => {
    render(<Harness tabs={withLink} />);
    const out = screen.getByRole("tab", { name: /Out/ });
    expect(out.tagName).toBe("A");
    expect(out).toHaveAttribute("href", "https://example.com/");
    expect(out).toHaveAttribute("target", "_blank");
    expect(out).toHaveAttribute("aria-selected", "false");
  });

  it("shows ‹ › only while the row overflows, disabled at each end", () => {
    const { container } = render(<Harness tabs={many} />);
    const root = container.querySelector(".tabs")!;
    const list = screen.getByRole("tablist");
    expect(root).not.toHaveAttribute("data-overflow");

    fakeOverflow(list);
    expect(root).toHaveAttribute("data-overflow", "true");
    const [prev, next] = container.querySelectorAll<HTMLButtonElement>(".tabs__arrow");
    expect(prev).toBeDisabled();
    expect(next).toBeEnabled();

    fireEvent.click(next!);
    expect(list.scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: 225 }));

    list.scrollLeft = 600;
    fireEvent.scroll(list);
    expect(prev).toBeEnabled();
    expect(next).toBeDisabled();
  });

  it("turns a vertical mouse wheel into sideways scrolling, then lets the page have it", () => {
    render(<Harness tabs={many} />);
    const list = screen.getByRole("tablist");
    fakeOverflow(list);

    const down = new WheelEvent("wheel", { deltaY: 100, cancelable: true, bubbles: true });
    list.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    expect(list.scrollLeft).toBe(100);

    list.scrollLeft = 600; // at the end
    const more = new WheelEvent("wheel", { deltaY: 100, cancelable: true, bubbles: true });
    list.dispatchEvent(more);
    expect(more.defaultPrevented).toBe(false);
  });

  it("leaves the wheel alone when nothing overflows", () => {
    render(<Harness tabs={many.slice(0, 2)} />);
    const event = new WheelEvent("wheel", { deltaY: 100, cancelable: true, bubbles: true });
    screen.getByRole("tablist").dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe("tab badges", () => {
  const two = many.slice(0, 2);
  const show = (badges: Record<string, number>, selectedId = "t0") =>
    render(
      <TabCarousel tabs={two} selectedId={selectedId} onSelect={() => {}} panelId="p" badges={badges} />,
    );

  it("shows a count on a chip and names it for screen readers", () => {
    show({ t1: 3 });
    expect(screen.getByTestId("badge-t1")).toHaveTextContent("3");
    expect(screen.getByRole("tab", { name: "Tab 1, 3 need you" })).toBeInTheDocument();
  });

  it("names the count on the selected chip too, singular for one", () => {
    show({ t0: 1 });
    expect(screen.getByRole("tab", { selected: true })).toHaveAccessibleName("Tab 0, 1 needs you");
  });

  it("is hidden at 0 and capped at 99+", () => {
    show({ t0: 0, t1: 120 });
    expect(screen.queryByTestId("badge-t0")).not.toBeInTheDocument();
    expect(screen.getByTestId("badge-t1")).toHaveTextContent("99+");
  });
});

describe("site avatar", () => {
  it("says Private on the private build and Guest on the public one", () => {
    const { rerender } = render(<SiteAvatar privateSite />);
    expect(screen.getByText("Private")).toBeInTheDocument();
    rerender(<SiteAvatar privateSite={false} />);
    expect(screen.getByText("Guest")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("becomes a button once it has a tap action", async () => {
    const onActivate = vi.fn();
    render(<SiteAvatar privateSite onActivate={onActivate} />);
    await userEvent.click(screen.getByRole("button", { name: "Private" }));
    expect(onActivate).toHaveBeenCalledOnce();
  });
});
