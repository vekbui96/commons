import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resetReachability } from "@/api/client";
import ServerMapApp from "./App";
import { FIXTURE_GENERATED_AT, sampleMap } from "./fixture";

vi.mock("@/api/client", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  API_BASE: "",
}));

const health = { ok: true, service: "commons", db: "ok", schemaVersion: 1, apps: ["server-map"] };
const URL_MAP = "/api/apps/server-map/architecture";

function respond(map: Record<string, [number, unknown]>) {
  const fn = vi.fn().mockImplementation((url: string) => {
    const [status, body] = map[url] ?? [404, { error: "not_found" }];
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  resetReachability();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function freshMap(minutesOld = 4) {
  const generatedAt = new Date(Date.now() - minutesOld * 60_000).toISOString();
  return { ...sampleMap, generatedAt };
}

describe("server map", () => {
  it("draws the diagram with status words, the drift badge and the failed source", async () => {
    respond({ "/api/health": [200, health], [URL_MAP]: [200, freshMap()] });
    render(<ServerMapApp />);
    const diagram = await screen.findByTestId("sm-diagram");
    expect(within(diagram).getByRole("button", { name: "commons-api, service, OK" })).toBeInTheDocument();
    expect(
      within(diagram).getByRole("button", { name: /innovation-loop-watch, task, Failing/ }),
    ).toBeInTheDocument();
    expect(
      within(diagram).getByRole("button", { name: "disk-report, task, Unknown, undocumented" }),
    ).toHaveClass("is-undocumented");
    expect(screen.getByText("4 min ago")).toBeInTheDocument();
    expect(screen.queryByTestId("sm-stale")).toBeNull();
    expect(screen.getByTestId("sm-drift-badge")).toHaveTextContent("2 undocumented");
    expect(screen.getByTestId("sm-sources")).toHaveTextContent("tailscale (timed out)");
  });

  it("opens a node's details, highlights its edges and jumps to a neighbour", async () => {
    respond({ "/api/health": [200, health], [URL_MAP]: [200, freshMap()] });
    const user = userEvent.setup();
    const { container } = render(<ServerMapApp />);
    await user.click(await screen.findByRole("button", { name: "cardlens, service, OK" }));
    const panel = screen.getByTestId("sm-panel");
    expect(within(panel).getByRole("heading", { name: "cardlens" })).toBeInTheDocument();
    expect(within(panel).getByText("8787 (loopback)")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: /Repo/ })).toHaveAttribute(
      "href",
      "https://github.com/vekbui96/cardlens",
    );
    expect(container.querySelectorAll(".sm-edge.is-hot")).toHaveLength(3);

    await user.click(within(panel).getByRole("button", { name: /recognition/ }));
    expect(
      within(screen.getByTestId("sm-panel")).getByRole("heading", { name: "recognition" }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("sm-panel")).toBeNull();
  });

  it("drops non-https links from the panel", async () => {
    respond({ "/api/health": [200, health], [URL_MAP]: [200, freshMap()] });
    const user = userEvent.setup();
    render(<ServerMapApp />);
    await user.click(await screen.findByRole("button", { name: "Hub state, data, OK" }));
    expect(within(screen.getByTestId("sm-panel")).queryByRole("link")).toBeNull();
  });

  it("lists drift items and the same nodes as a list", async () => {
    respond({ "/api/health": [200, health], [URL_MAP]: [200, freshMap()] });
    const user = userEvent.setup();
    render(<ServerMapApp />);
    await user.click(await screen.findByTestId("sm-drift-badge"));
    expect(screen.getByText("Scheduled task disk-report is not in CLAUDE.md.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "List" }));
    const list = screen.getByTestId("sm-list");
    expect(within(list).getByRole("heading", { name: /Host/ })).toBeInTheDocument();
    expect(within(list).getAllByRole("button")).toHaveLength(sampleMap.nodes.length);
  });

  it("warns when the map is over 30 minutes old", async () => {
    respond({ "/api/health": [200, health], [URL_MAP]: [200, freshMap(45)] });
    render(<ServerMapApp />);
    expect(await screen.findByTestId("sm-stale")).toHaveTextContent("45 min old");
  });

  it("explains a map the hub has not written yet", async () => {
    respond({ "/api/health": [200, health], [URL_MAP]: [503, { error: "map_not_ready" }] });
    render(<ServerMapApp />);
    expect(await screen.findByTestId("sm-error")).toHaveTextContent(
      "The hub hasn't written the map yet; it updates every 15 minutes.",
    );
  });

  it("explains an invalid map and identity errors", async () => {
    respond({ "/api/health": [200, health], [URL_MAP]: [502, { error: "map_invalid" }] });
    const first = render(<ServerMapApp />);
    expect(await screen.findByTestId("sm-error")).toHaveTextContent(/couldn't be read/);
    first.unmount();
    resetReachability();

    respond({ "/api/health": [200, health], [URL_MAP]: [403, { error: "self_request" }] });
    render(<ServerMapApp />);
    expect(await screen.findByTestId("sm-error")).toHaveTextContent(/server-pc itself/);
  });

  it("treats a body of the wrong shape as invalid", async () => {
    respond({ "/api/health": [200, health], [URL_MAP]: [200, { schema: 2 }] });
    render(<ServerMapApp />);
    expect(await screen.findByTestId("sm-error")).toHaveTextContent(/couldn't be read/);
  });

  it("is quiet off the tailnet", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<ServerMapApp />);
    expect(await screen.findByText("Connect to Tailscale to use this.")).toBeInTheDocument();
  });

  it("refetches every minute", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetch = respond({ "/api/health": [200, health], [URL_MAP]: [200, freshMap()] });
    render(<ServerMapApp />);
    await screen.findByTestId("sm-diagram");
    const calls = () => fetch.mock.calls.filter(([url]) => url === URL_MAP).length;
    expect(calls()).toBe(1);
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(calls()).toBe(2);
  });

  it("keeps the fixture timestamp parseable", () => {
    expect(Number.isNaN(Date.parse(FIXTURE_GENERATED_AT))).toBe(false);
  });
});
