import { StrictMode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../AppRoutes";
import { KEY_STORAGE_PREFIX, loaderUrl } from "./config";
import { loadNfc, resetNfcModules, type NfcModule } from "./module";
import { NfcPanelView } from "./NfcPanel";
import { NfcRunnerRouteView } from "./NfcRunnerRoute";
import { NFC_API_BASE, NFC_SESSION_PATH, standaloneUrl } from "./privateConfig";
import { parseTagHash, takeTagKey } from "./tagKey";

const KEY = "demoKEY_demoKEY_demoKEY1";
const GW = "https://gateway.test/public/v1";

function fakeNfc(opts: { throwOnMount?: boolean } = {}) {
  const mounts: { el: Element; opts: Parameters<NfcModule["mount"]>[1] }[] = [];
  let unmounts = 0;
  const themes: [string, boolean | undefined][] = [];
  const mod: NfcModule = {
    mount(el, o) {
      if (opts.throwOnMount) throw new Error("boom");
      const node = document.createElement("nfc-controls");
      node.textContent = "nfc content";
      el.appendChild(node);
      mounts.push({ el, opts: o });
      let done = false;
      return {
        unmount() {
          if (done) return;
          done = true;
          unmounts++;
          node.remove();
        },
        setTheme: (t, fc) => themes.push([t, fc]),
      };
    },
    unmount() {},
  };
  return { mod, mounts, themes, unmounts: () => unmounts };
}

beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
  document.documentElement.removeAttribute("data-theme");
  resetNfcModules();
});
afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
});

describe("tag links", () => {
  it("parses #/t/<id>?k=<key>", () => {
    expect(parseTagHash(`#/t/demo00000001?k=${KEY}`)).toEqual({ id: "demo00000001", key: KEY });
    expect(parseTagHash("#/t/demo00000001")).toEqual({ id: "demo00000001", key: null });
    expect(parseTagHash("#/tab/nfc")).toBeNull();
    expect(parseTagHash("#/t/BAD_ID?k=x")).toBeNull();
  });

  it("takes the key out of the address bar into sessionStorage, and finds it again on reload", () => {
    window.history.replaceState(null, "", `/commons/#/t/demo00000001?k=${KEY}&x=1`);
    expect(takeTagKey("demo00000001")).toBe(KEY);
    expect(window.location.hash).toBe("#/t/demo00000001");
    expect(window.location.href).not.toContain(KEY);
    expect(sessionStorage.getItem(KEY_STORAGE_PREFIX + "demo00000001")).toBe(KEY);
    expect(takeTagKey("demo00000001")).toBe(KEY); // a reload in the same tab
    expect(takeTagKey("demo00000002")).toBeNull();
  });

  it("loader URLs come from the origin with a minute cache-buster", () => {
    expect(loaderUrl("/nfc-controls/embed/v1.js", 120_000, "https://example.test")).toBe(
      "https://example.test/nfc-controls/embed/v1.js?t=2",
    );
    expect(standaloneUrl("https://example.test")).toBe("https://example.test/nfc/");
  });

  it("shares one import per loader path, and forgets a failed one", async () => {
    const importer = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue({ ok: 1 });
    await expect(loadNfc("/x.js", importer, () => "u")).rejects.toThrow();
    await Promise.resolve();
    await expect(loadNfc("/x.js", importer, () => "u")).resolves.toEqual({ ok: 1 });
    await loadNfc("/x.js", importer, () => "u");
    expect(importer).toHaveBeenCalledTimes(2);
  });

  it("the public build has no #/t/ route without a gateway", () => {
    render(
      <MemoryRouter initialEntries={["/t/demo00000001"]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Not here" })).toBeTruthy();
  });
});

function renderRoute(props: Partial<Parameters<typeof NfcRunnerRouteView>[0]> = {}) {
  return render(
    <StrictMode>
      <MemoryRouter>
        <Routes>
          <Route
            path="*"
            element={
              <NfcRunnerRouteView tagId="demo00000001" gateway={GW} fallback="" timeoutMs={200} {...props} />
            }
          />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );
}

describe("public runner route", () => {
  it("mounts the runner with the gateway and the key (as a mount option), embedded", async () => {
    window.history.replaceState(null, "", `/commons/#/t/demo00000001?k=${KEY}`);
    const nfc = fakeNfc();
    renderRoute({ load: () => Promise.resolve(nfc.mod), fallback: "https://backup.test/tags.json" });
    await screen.findByText("nfc content");
    const last = nfc.mounts.at(-1)!.opts;
    expect(last).toMatchObject({
      mode: "runner",
      source: "public",
      tagId: "demo00000001",
      tagKey: KEY,
      apiBase: GW,
      fallbackUrl: "https://backup.test/tags.json",
      embedded: true,
    });
    expect(window.location.href).not.toContain(KEY);
    expect(document.body.innerHTML).not.toContain(KEY);
    expect(screen.getByRole("link", { name: /Commons/ }).getAttribute("href")).toBe("/");
  });

  it("shows the runner skeleton while loading", () => {
    renderRoute({ load: () => new Promise(() => {}) });
    expect(screen.getByRole("status").textContent).toMatch(/Loading the tag/);
  });

  it("unreachable: neutral words (no Tailscale), and Try again retries", async () => {
    const nfc = fakeNfc();
    let fail = true;
    const load = vi.fn(() => (fail ? Promise.reject(new Error("down")) : Promise.resolve(nfc.mod)));
    renderRoute({ load });
    await screen.findByRole("heading", { name: "This tag can't be reached right now." });
    expect(document.body.textContent).not.toMatch(/Tailscale|private/i);
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("nfc content");
  });

  it("crash: unmounts and shows Something went wrong", async () => {
    const nfc = fakeNfc();
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderRoute({ load: () => Promise.resolve(nfc.mod) });
    await screen.findByText("nfc content");
    act(() => nfc.mounts.at(-1)!.opts.onError(new Error("render")));
    await screen.findByRole("heading", { name: "Something went wrong." });
    expect(screen.queryByText("nfc content")).toBeNull();
  });

  it("sets the page title from the element's title event and restores it", async () => {
    const nfc = fakeNfc();
    document.title = "Commons";
    const view = renderRoute({ load: () => Promise.resolve(nfc.mod) });
    await screen.findByText("nfc content");
    act(() => {
      screen
        .getByTestId("nfc-host")
        .dispatchEvent(
          new CustomEvent("nfc-controls:title", { detail: { title: "Kitchen menu" }, bubbles: true }),
        );
    });
    expect(document.title).toBe("Kitchen menu · Commons");
    view.unmount();
    expect(document.title).toBe("Commons");
  });

  it("passes theme changes through", async () => {
    const nfc = fakeNfc();
    renderRoute({ load: () => Promise.resolve(nfc.mod) });
    await screen.findByText("nfc content");
    document.documentElement.setAttribute("data-theme", "dark");
    await waitFor(() => expect(nfc.themes.at(-1)?.[0]).toBe("dark"));
  });
});

describe("private NFC controls tab", () => {
  const ready = () => Promise.resolve(true);

  it("mounts the editor against the private API", async () => {
    const nfc = fakeNfc();
    render(<NfcPanelView load={() => Promise.resolve(nfc.mod)} check={ready} tagId="demo00000001" />);
    await screen.findByText("nfc content");
    expect(nfc.mounts.at(-1)!.opts).toMatchObject({
      mode: "editor",
      source: "private",
      tagId: "demo00000001",
      apiBase: NFC_API_BASE,
      sessionUrl: NFC_SESSION_PATH,
      embedded: true,
    });
  });

  it("unreachable when the API doesn't answer; offers the standalone page", async () => {
    const nfc = fakeNfc();
    render(<NfcPanelView load={() => Promise.resolve(nfc.mod)} check={() => Promise.resolve(false)} />);
    await screen.findByText("NFC controls isn't answering.");
    expect(screen.getByRole("link", { name: "Open NFC controls on its own" }).getAttribute("href")).toMatch(
      /\/nfc\/$/,
    );
    expect(nfc.mounts).toHaveLength(0);
  });

  it("times out to unreachable", async () => {
    render(<NfcPanelView load={() => new Promise(() => {})} check={ready} timeoutMs={30} />);
    await screen.findByText("NFC controls isn't answering.");
  });

  it("a throwing mount is a crash", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const nfc = fakeNfc({ throwOnMount: true });
    render(<NfcPanelView load={() => Promise.resolve(nfc.mod)} check={ready} />);
    await screen.findByText("Something went wrong in this tab.");
  });

  it("unmounts on leave", async () => {
    const nfc = fakeNfc();
    const view = render(<NfcPanelView load={() => Promise.resolve(nfc.mod)} check={ready} />);
    await screen.findByText("nfc content");
    view.unmount();
    expect(nfc.unmounts()).toBe(1);
  });
});
