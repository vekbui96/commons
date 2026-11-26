import { StrictMode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetTabBadges, useTabBadges } from "../tabBadges";
import { OPS_API_BASE, OPS_TAB_ID, healthUrl, loaderUrl, standaloneUrl } from "./config";
import { OpsPanelView, currentTheme, isOpsHubModule, type OpsHubModule } from "./OpsPanel";

/** A fake hub module: records every mount, unmount and theme call. */
function fakeHub(opts: { throwOnMount?: boolean } = {}) {
  const calls = { mounts: [] as { el: Element; opts: Parameters<OpsHubModule["mount"]>[1] }[], unmounts: 0 };
  const themes: [string, boolean | undefined][] = [];
  const mod: OpsHubModule = {
    mount(el, o) {
      if (opts.throwOnMount) throw new Error("boom");
      const node = document.createElement("ops-hub");
      node.textContent = "hub content";
      el.appendChild(node);
      calls.mounts.push({ el, opts: o });
      let done = false;
      return {
        unmount() {
          if (done) return;
          done = true;
          calls.unmounts++;
          node.remove();
        },
        setTheme: (t, fc) => themes.push([t, fc]),
      };
    },
    unmount() {},
  };
  return { mod, calls, themes };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const healthy = () => Promise.resolve(true);

function Badge() {
  const badges = useTabBadges();
  return <output data-testid="badge">{badges[OPS_TAB_ID] ?? 0}</output>;
}

beforeEach(() => {
  resetTabBadges();
  document.documentElement.removeAttribute("data-theme");
});
afterEach(() => {
  vi.useRealTimers();
  document.documentElement.removeAttribute("data-theme");
});

describe("ops config", () => {
  it("builds every URL from the origin, with a minute cache-buster and no literal host", () => {
    expect(loaderUrl(120_000 + 59_999, "https://example.test")).toBe(
      "https://example.test/ops/embed/v1.js?t=2",
    );
    expect(healthUrl("https://example.test")).toBe("https://example.test/ops/api/healthz");
    expect(standaloneUrl("https://example.test")).toBe("https://example.test/ops/");
    expect(standaloneUrl()).toBe(`${window.location.origin}/ops/`);
  });

  it("recognises the module shape", () => {
    expect(isOpsHubModule(fakeHub().mod)).toBe(true);
    expect(isOpsHubModule({ mount() {} })).toBe(false);
    expect(isOpsHubModule(null)).toBe(false);
  });
});

describe("OpsPanel", () => {
  it("shows a loading skeleton, then mounts the hub with the contract's options", async () => {
    const hub = fakeHub();
    const gate = deferred<unknown>();
    render(<OpsPanelView load={() => gate.promise} checkHealth={healthy} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading Ops…");

    await act(async () => gate.resolve(hub.mod));
    expect(await screen.findByText("hub content")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(hub.calls.mounts).toHaveLength(1);
    const { el, opts } = hub.calls.mounts[0]!;
    expect(el).toBe(screen.getByTestId("ops-host"));
    expect(opts).toMatchObject({
      apiBase: OPS_API_BASE,
      embedded: true,
      theme: "system",
      forcedColors: false,
    });
    expect(typeof opts.onError).toBe("function");
  });

  it("unmounts exactly once when the tab is left", async () => {
    const hub = fakeHub();
    const { unmount } = render(<OpsPanelView load={() => Promise.resolve(hub.mod)} checkHealth={healthy} />);
    await screen.findByText("hub content");
    unmount();
    expect(hub.calls.unmounts).toBe(1);
  });

  it("stays balanced under StrictMode", async () => {
    const hub = fakeHub();
    const { unmount } = render(
      <StrictMode>
        <OpsPanelView load={() => Promise.resolve(hub.mod)} checkHealth={healthy} />
      </StrictMode>,
    );
    await screen.findByText("hub content");
    expect(screen.getAllByText("hub content")).toHaveLength(1);
    expect(hub.calls.mounts.length - hub.calls.unmounts).toBe(1);
    unmount();
    expect(hub.calls.mounts.length).toBe(hub.calls.unmounts);
  });

  it("never mounts after a tab switch mid-load", async () => {
    const hub = fakeHub();
    const gate = deferred<unknown>();
    const { unmount } = render(<OpsPanelView load={() => gate.promise} checkHealth={healthy} />);
    unmount();
    await act(async () => gate.resolve(hub.mod));
    expect(hub.calls.mounts).toHaveLength(0);
  });

  it("passes theme changes through setTheme", async () => {
    const hub = fakeHub();
    render(<OpsPanelView load={() => Promise.resolve(hub.mod)} checkHealth={healthy} />);
    await screen.findByText("hub content");
    document.documentElement.setAttribute("data-theme", "dark");
    await waitFor(() => expect(hub.themes.at(-1)).toEqual(["dark", false]));
    document.documentElement.removeAttribute("data-theme");
    await waitFor(() => expect(hub.themes.at(-1)).toEqual(["system", false]));
  });

  it("mounts with the current theme", async () => {
    document.documentElement.setAttribute("data-theme", "light");
    expect(currentTheme()).toBe("light");
    const hub = fakeHub();
    render(<OpsPanelView load={() => Promise.resolve(hub.mod)} checkHealth={healthy} />);
    await screen.findByText("hub content");
    expect(hub.calls.mounts[0]!.opts.theme).toBe("light");
  });

  it("shows the crash state when mount throws, and Retry tries again", async () => {
    const bad = fakeHub({ throwOnMount: true });
    const good = fakeHub();
    const load = vi.fn().mockResolvedValueOnce(bad.mod).mockResolvedValue(good.mod);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<OpsPanelView load={load} checkHealth={healthy} />);
    expect(await screen.findByText("Something went wrong in this tab.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("hub content")).toBeInTheDocument();
    spy.mockRestore();
  });

  it("shows the crash state when the hub reports an error through onError", async () => {
    const hub = fakeHub();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<OpsPanelView load={() => Promise.resolve(hub.mod)} checkHealth={healthy} />);
    await screen.findByText("hub content");
    act(() => hub.calls.mounts[0]!.opts.onError(new Error("handler threw")));
    expect(await screen.findByText("Something went wrong in this tab.")).toBeInTheDocument();
    expect(hub.calls.unmounts).toBe(1);
    spy.mockRestore();
  });

  it("is quietly unreachable when the import fails, with Retry and the standalone link", async () => {
    const hub = fakeHub();
    const load = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValue(hub.mod);
    render(<OpsPanelView load={load} checkHealth={healthy} />);
    expect(await screen.findByText("The ops hub isn't answering.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Open the standalone dashboard" });
    expect(link).toHaveAttribute("href", `${window.location.origin}/ops/`);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("hub content")).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("is unreachable when the health check fails", async () => {
    const hub = fakeHub();
    render(<OpsPanelView load={() => Promise.resolve(hub.mod)} checkHealth={() => Promise.resolve(false)} />);
    expect(await screen.findByText("The ops hub isn't answering.")).toBeInTheDocument();
    expect(hub.calls.mounts).toHaveLength(0);
  });

  it("is unreachable when the module has the wrong shape", async () => {
    render(<OpsPanelView load={() => Promise.resolve({ nope: true })} checkHealth={healthy} />);
    expect(await screen.findByText("The ops hub isn't answering.")).toBeInTheDocument();
  });

  it("gives up after the timeout", async () => {
    const never = new Promise<unknown>(() => {});
    render(<OpsPanelView load={() => never} checkHealth={healthy} timeoutMs={30} />);
    expect(await screen.findByText("The ops hub isn't answering.")).toBeInTheDocument();
  });

  it("reports the Needs you count as the tab badge", async () => {
    const hub = fakeHub();
    render(
      <>
        <OpsPanelView load={() => Promise.resolve(hub.mod)} checkHealth={healthy} />
        <Badge />
      </>,
    );
    await screen.findByText("hub content");
    const node = screen.getByText("hub content");
    act(() => {
      node.dispatchEvent(
        new CustomEvent("ops-hub:count", {
          detail: { needsYou: 3, stale: false },
          bubbles: true,
          composed: true,
        }),
      );
    });
    expect(screen.getByTestId("badge")).toHaveTextContent("3");
    act(() => {
      node.dispatchEvent(
        new CustomEvent("ops-hub:count", { detail: { needsYou: 0, stale: true }, bubbles: true }),
      );
    });
    expect(screen.getByTestId("badge")).toHaveTextContent("0");
  });
});
