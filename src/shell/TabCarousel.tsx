import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { TabIcon } from "@/tabs/icons";
import { isSelectable, linkTarget, type SelectableTab } from "@/tabs/registry";
import type { TabDefinition } from "@/tabs/types";
import { tabDomId } from "./navState";

export interface TabCarouselProps {
  tabs: readonly TabDefinition[];
  selectedId: string | undefined;
  onSelect: (tab: SelectableTab) => void;
  /** Id of the tabpanel the selected tab controls. */
  panelId: string;
  /** Counts by tab id (e.g. Ops: "Needs you" items). Hidden at 0. */
  badges?: Readonly<Record<string, number>>;
}

/** "3 need you" for screen readers; the chip shows the number. */
export function badgeLabel(count: number): string {
  return `${count} ${count === 1 ? "needs" : "need"} you`;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

interface Overflow {
  overflowing: boolean;
  atStart: boolean;
  atEnd: boolean;
}

/**
 * The row of tab chips under the top bar. The selected chip is a wide pill
 * (icon + label); the others are round, icon only. Scrolls sideways when the
 * chips overflow: swipe, scroll snapping, the mouse wheel (turned sideways)
 * and ‹ › buttons on pointer devices. Keyboard: arrows/Home/End move between
 * chips, Enter or Space selects (WAI-ARIA tabs, manual activation).
 */
export function TabCarousel({ tabs, selectedId, onSelect, panelId, badges = {} }: TabCarouselProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLElement | null)[]>([]);
  const selectedIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === selectedId),
  );
  const [focusIndex, setFocusIndex] = useState(selectedIndex);
  const [overflow, setOverflow] = useState<Overflow>({ overflowing: false, atStart: true, atEnd: true });

  useEffect(() => setFocusIndex(selectedIndex), [selectedIndex]);

  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const max = list.scrollWidth - list.clientWidth;
    const next = { overflowing: max > 1, atStart: list.scrollLeft <= 1, atEnd: list.scrollLeft >= max - 1 };
    setOverflow((prev) =>
      prev.overflowing === next.overflowing && prev.atStart === next.atStart && prev.atEnd === next.atEnd
        ? prev
        : next,
    );
  }, []);

  /** Scrolls the list just enough to show one chip. */
  const reveal = useCallback((index: number) => {
    const list = listRef.current;
    const chip = chipRefs.current[index];
    if (!list || !chip || list.scrollWidth <= list.clientWidth + 1) return;
    const listBox = list.getBoundingClientRect();
    const box = chip.getBoundingClientRect();
    const pad = 8;
    let delta = 0;
    if (box.left < listBox.left + pad) delta = box.left - listBox.left - pad;
    else if (box.right > listBox.right - pad) delta = box.right - listBox.right + pad;
    if (delta !== 0) list.scrollBy({ left: delta, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, []);

  // Chip widths change with the selection: re-measure, and keep the selected chip in view.
  useLayoutEffect(() => {
    measure();
    reveal(selectedIndex);
  }, [measure, reveal, selectedIndex, tabs]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : undefined;
    observer?.observe(list);

    // Windows mice have a vertical wheel only: turn it sideways while the row
    // can still scroll that way, then let the page have it.
    function onWheel(event: WheelEvent) {
      if (!list || list.scrollWidth <= list.clientWidth + 1) return;
      if (event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      const step = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      const max = list.scrollWidth - list.clientWidth;
      if ((step < 0 && list.scrollLeft <= 0) || (step > 0 && list.scrollLeft >= max - 1)) return;
      event.preventDefault();
      list.scrollLeft += step;
    }
    list.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      list.removeEventListener("scroll", measure);
      list.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [measure]);

  function page(direction: -1 | 1) {
    const list = listRef.current;
    if (!list) return;
    list.scrollBy({
      left: direction * Math.max(list.clientWidth * 0.75, 44),
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }

  function moveFocus(index: number) {
    const next = (index + tabs.length) % tabs.length;
    setFocusIndex(next);
    chipRefs.current[next]?.focus();
    reveal(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const keys: Record<string, () => void> = {
      ArrowRight: () => moveFocus(focusIndex + 1),
      ArrowLeft: () => moveFocus(focusIndex - 1),
      Home: () => moveFocus(0),
      End: () => moveFocus(tabs.length - 1),
    };
    const action = keys[event.key];
    if (action) {
      event.preventDefault();
      action();
      return;
    }
    // Links don't activate on Space by default; tabs do.
    if (event.key === " " && event.target instanceof HTMLAnchorElement) {
      event.preventDefault();
      event.target.click();
    }
  }

  return (
    <div
      className="tabs"
      data-overflow={overflow.overflowing || undefined}
      data-at-start={overflow.atStart || undefined}
      data-at-end={overflow.atEnd || undefined}
    >
      <button
        type="button"
        className="tabs__arrow tabs__arrow--prev"
        onClick={() => page(-1)}
        disabled={overflow.atStart}
        tabIndex={-1}
        aria-hidden="true"
        title="Scroll left"
      >
        <Chevron direction="left" />
      </button>
      <div className="tabs__list" role="tablist" aria-label="Sections" ref={listRef} onKeyDown={onKeyDown}>
        {tabs.map((tab, i) => {
          const selected = isSelectable(tab) && tab.id === selectedId;
          const count = badges[tab.id] ?? 0;
          const name = count > 0 ? `${tab.label}, ${badgeLabel(count)}` : tab.label;
          const common = {
            ref: (el: HTMLElement | null) => {
              chipRefs.current[i] = el;
            },
            id: tabDomId(tab.id),
            role: "tab",
            className: `tab-chip${selected ? " is-selected" : ""}`,
            tabIndex: i === focusIndex ? 0 : -1,
            "aria-selected": selected,
            "aria-label": selected && count === 0 ? undefined : name,
            title: selected ? undefined : name,
            onFocus: () => setFocusIndex(i),
          } as const;
          const body = (
            <>
              <TabIcon name={tab.icon} />
              {selected && <span className="tab-chip__label">{tab.label}</span>}
              {count > 0 && (
                <span className="tab-chip__badge num" aria-hidden="true" data-testid={`badge-${tab.id}`}>
                  {count > 99 ? "99+" : count}
                </span>
              )}{" "}
            </>
          );

          if (tab.kind === "link") {
            const { href, newTab } = linkTarget(tab);
            return (
              <a
                key={tab.id}
                {...common}
                href={href}
                {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                aria-label={newTab ? `${tab.label} (opens in a new tab)` : tab.label}
              >
                {body}
              </a>
            );
          }
          return (
            <button
              key={tab.id}
              {...common}
              type="button"
              aria-controls={selected ? panelId : undefined}
              onClick={() => onSelect(tab)}
            >
              {body}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="tabs__arrow tabs__arrow--next"
        onClick={() => page(1)}
        disabled={overflow.atEnd}
        tabIndex={-1}
        aria-hidden="true"
        title="Scroll right"
      >
        <Chevron direction="right" />
      </button>
    </div>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={direction === "left" ? "M14.5 6l-6 6 6 6" : "M9.5 6l6 6-6 6"} />
    </svg>
  );
}
