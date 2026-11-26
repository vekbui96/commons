import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resetReachability, resetSession } from "@/api/client";
import ProfilesEditor from "./ProfilesEditor";
import type { DraftState, PublishStatus } from "./api";

const health = { ok: true, service: "commons", db: "ok", schemaVersion: 1, apps: ["profiles"] };
const session = { ok: true, login: "owner@example.com", csrfToken: "tok" };
const P = "/api/apps/profiles";

let draft: DraftState;
let status: PublishStatus;
/** Per-test answers for "METHOD /path"; anything else goes to the fake server below. */
let overrides: Record<string, [number, unknown]>;
let requests: { method: string; url: string; body: unknown }[];

function fakeServer(method: string, url: string, body: unknown): [number, unknown] {
  if (url === "/api/health") return [200, health];
  if (url === "/api/session") return [200, session];
  if (method === "GET" && url === `${P}/profiles`) return [200, draft];
  if (method === "GET" && url === `${P}/publish`) return [200, status];
  const profile = /^\/api\/apps\/profiles\/profiles\/([a-z0-9-]+)$/.exec(url)?.[1];
  if (profile && method === "PUT") {
    const input = body as Partial<DraftState["profiles"][number]> & { name: string; apps: string[] };
    const next = { id: profile, aliases: [], inheritsGuest: true, ...input };
    const exists = draft.profiles.some((p) => p.id === profile);
    const profiles = exists
      ? draft.profiles.map((p) => (p.id === profile ? next : p))
      : [...draft.profiles, next];
    draft = { ...draft, profiles, revision: draft.revision + 1, dirty: true };
    return [exists ? 200 : 201, draft];
  }
  if (profile && method === "DELETE") {
    draft = {
      ...draft,
      profiles: draft.profiles.filter((p) => p.id !== profile),
      revision: draft.revision + 1,
      dirty: true,
    };
    return [200, draft];
  }
  if (method === "PUT" && url === `${P}/guest`) {
    draft = { ...draft, guest: body as { apps: string[] }, revision: draft.revision + 1, dirty: true };
    return [200, draft];
  }
  return [404, { error: "not_found" }];
}

beforeEach(() => {
  draft = {
    ok: true,
    revision: 3,
    updatedAt: "2026-11-25T18:00:00.000Z",
    dirty: true,
    guest: { apps: ["portfolio"] },
    profiles: [{ id: "tammy", name: "Tammy", aliases: [], inheritsGuest: true, apps: ["units", "cardlens"] }],
  };
  status = {
    ok: true,
    configured: true,
    repo: "vekbui96/commons-profiles",
    url: "https://vekbui96.github.io/commons-profiles/profiles.json",
    revision: 3,
    dirty: true,
    lastPublished: { revision: 2, publishedAt: "2026-11-24T10:00:00.000Z", commitSha: "a".repeat(40) },
    lastError: null,
  };
  overrides = {};
  requests = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      requests.push({ method, url, body });
      const [code, answer] = overrides[`${method} ${url}`] ?? fakeServer(method, url, body);
      return Promise.resolve(new Response(JSON.stringify(answer), { status: code }));
    }),
  );
});

afterEach(() => {
  resetReachability();
  resetSession();
  vi.unstubAllGlobals();
});

async function open() {
  const user = userEvent.setup();
  render(<ProfilesEditor base="" />);
  await screen.findByTestId("pe-list");
  return user;
}

const sent = (method: string, url: string) => requests.filter((r) => r.method === method && r.url === url);

describe("profiles editor", () => {
  it("lists Guest and the profiles with their app counts, and shows unpublished changes", async () => {
    await open();
    const list = screen.getByTestId("pe-list");
    expect(within(list).getByText("Guest")).toBeInTheDocument();
    expect(within(list).getByText(/Anyone without a profile · 1 app$/)).toBeInTheDocument();
    expect(within(list).getByText("Tammy")).toBeInTheDocument();
    expect(within(list).getByText(/· 3 apps/)).toBeInTheDocument();
    expect(screen.getByTestId("pe-dirty")).toHaveTextContent("Unpublished changes");
    expect(screen.getByText(/a minute or two after publishing/)).toBeInTheDocument();
    // Guest can be edited but never deleted.
    expect(within(list).getByRole("button", { name: "Edit Guest" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Delete/ })).toBeNull();
  });

  it("adds a profile: id from the name, apps limited to public ones, effective list, then saved", async () => {
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Add profile" }));
    const form = screen.getByTestId("pe-form");
    await user.type(within(form).getByLabelText("Name"), "Mary Ann");
    expect(within(form).getByLabelText("Link name")).toHaveValue("mary-ann");
    await user.type(within(form).getByLabelText("Other names"), "Mae, M");
    // Only public apps are offered.
    const boxes = within(form)
      .getAllByRole("checkbox", { name: /./ })
      .filter((b) => b.getAttribute("role") !== "switch");
    const offered = boxes.map((b) => b.closest("label")!.querySelector(".pe-check__name")!.textContent);
    expect(offered).toEqual(["CardLens", "Portfolio", "Units"]);
    expect(within(screen.getByTestId("pe-effective")).getByText("Portfolio")).toBeInTheDocument();
    await user.click(within(form).getByRole("checkbox", { name: /Units/ }));
    await user.click(within(form).getByRole("switch", { name: /Includes guest apps/ }));
    const effective = within(screen.getByTestId("pe-effective"));
    expect(effective.getByText("Units")).toBeInTheDocument();
    expect(effective.queryByText("Portfolio")).toBeNull();

    await user.click(within(form).getByRole("button", { name: "Save" }));
    expect(await within(await screen.findByTestId("pe-list")).findByText("Mary Ann")).toBeInTheDocument();
    expect(screen.getByText("Saved Mary Ann")).toBeInTheDocument();
    expect(sent("PUT", `${P}/profiles/mary-ann`)[0]!.body).toEqual({
      name: "Mary Ann",
      aliases: ["Mae", "M"],
      inheritsGuest: false,
      apps: ["units"],
    });
  });

  it("edits a profile in place", async () => {
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Edit Tammy" }));
    const form = screen.getByTestId("pe-form");
    expect(within(form).queryByLabelText("Link name")).toBeNull();
    expect(within(form).getByRole("checkbox", { name: /CardLens/ })).toBeChecked();
    await user.click(within(form).getByRole("checkbox", { name: /CardLens/ }));
    await user.click(within(form).getByRole("button", { name: "Save" }));
    await screen.findByTestId("pe-list");
    expect(sent("PUT", `${P}/profiles/tammy`)[0]!.body).toMatchObject({ name: "Tammy", apps: ["units"] });
    expect(screen.getByText(/· 2 apps/)).toBeInTheDocument();
  });

  it("deletes a profile only after a confirmation", async () => {
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Edit Tammy" }));
    await user.click(screen.getByRole("button", { name: "Delete…" }));
    expect(sent("DELETE", `${P}/profiles/tammy`)).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Keep" }));
    expect(screen.queryByRole("button", { name: "Delete Tammy" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Delete…" }));
    await user.click(screen.getByRole("button", { name: "Delete Tammy" }));
    await screen.findByTestId("pe-list");
    expect(sent("DELETE", `${P}/profiles/tammy`)).toHaveLength(1);
    expect(within(screen.getByTestId("pe-list")).queryByText("Tammy")).toBeNull();
  });

  it("shows the API's problems inline and keeps the form", async () => {
    overrides[`PUT ${P}/profiles/tammy`] = [
      400,
      {
        ok: false,
        error: "invalid_profiles",
        problems: ['"tam" already picks profile "tamsin"', "name is too long"],
      },
    ];
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Edit Tammy" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    const problems = await screen.findByTestId("pe-problems");
    expect(problems).toHaveTextContent('"tam" already picks profile "tamsin"');
    expect(problems).toHaveTextContent("name is too long");
    expect(screen.getByTestId("pe-form")).toBeInTheDocument();
  });

  it("edits the guest apps", async () => {
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Edit Guest" }));
    const form = screen.getByTestId("pe-guest-form");
    await user.click(within(form).getByRole("checkbox", { name: /Units/ }));
    await user.click(within(form).getByRole("button", { name: "Save" }));
    await screen.findByTestId("pe-list");
    expect(sent("PUT", `${P}/guest`)[0]!.body).toEqual({ apps: ["portfolio", "units"] });
  });

  it("publishes the current revision and shows the time", async () => {
    overrides[`POST ${P}/publish`] = [
      200,
      {
        ...status,
        dirty: false,
        unchanged: false,
        lastPublished: { revision: 3, publishedAt: new Date().toISOString(), commitSha: "b".repeat(40) },
      },
    ];
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByTestId("pe-publish-note")).toHaveTextContent(
      /^Published at .+\. The public site/,
    );
    expect(sent("POST", `${P}/publish`)[0]!.body).toEqual({ revision: 3 });
    expect(screen.queryByTestId("pe-dirty")).toBeNull();
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
  });

  it("asks for a reload on a revision mismatch, and reloads", async () => {
    overrides[`POST ${P}/publish`] = [409, { ok: false, error: "revision_mismatch", revision: 4 }];
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByTestId("pe-publish-note")).toHaveTextContent(/changed since this page loaded/);
    const before = sent("GET", `${P}/profiles`).length;
    await user.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() => expect(sent("GET", `${P}/profiles`).length).toBe(before + 1));
  });

  it("shows the reason when publishing fails", async () => {
    overrides[`POST ${P}/publish`] = [
      502,
      { ok: false, error: "publish_failed", reason: "github_forbidden", status: 403 },
    ];
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByTestId("pe-publish-note")).toHaveTextContent(
      "Publishing failed: The token can't write to the repo, or GitHub is rate limiting. (HTTP 403)",
    );
  });

  it("offers the download instead of Publish when publishing isn't set up", async () => {
    status = { ...status, configured: false, lastPublished: null };
    await open();
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
    expect(screen.getByTestId("pe-not-configured")).toHaveTextContent("Publishing isn't set up yet");
    const link = screen.getByRole("link", { name: "Download profiles.json" });
    expect(link).toHaveAttribute("href", `${P}/export`);
    expect(link).toHaveAttribute("download", "profiles.json");
  });

  it("copies a profile's public link", async () => {
    const user = await open();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await user.click(screen.getByRole("button", { name: "Copy Tammy's link" }));
    expect(writeText).toHaveBeenCalledWith("https://vekbui96.github.io/commons/?profile=tammy");
    expect(await screen.findByText("Copied Tammy's link")).toBeInTheDocument();
  });

  it("previews the tiles a visitor would see", async () => {
    const user = await open();
    const tiles = () =>
      within(screen.getByTestId("pe-viewas"))
        .getAllByRole("listitem")
        .map((li) => li.textContent);
    expect(tiles()).toHaveLength(1);
    expect(tiles()[0]).toContain("Portfolio");
    await user.selectOptions(screen.getByLabelText("Visitor"), "tammy");
    const names = tiles().join(" ");
    expect(names).toContain("Portfolio");
    expect(names).toContain("Units");
    expect(names).toContain("CardLens");
  });

  it("explains a refused load and can try again", async () => {
    overrides[`GET ${P}/profiles`] = [403, { error: "self_request" }];
    const user = userEvent.setup();
    render(<ProfilesEditor base="" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/server-pc itself/);
    delete overrides[`GET ${P}/profiles`];
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByTestId("pe-list")).toBeInTheDocument();
  });

  it("asks for Tailscale when the API can't be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("offline"))),
    );
    render(<ProfilesEditor base="" />);
    expect(await screen.findByTestId("needs-api")).toHaveTextContent("Connect to Tailscale");
  });
});
