import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, resetSession, TOKEN_HEADER } from "@/api/client";
import {
  deleteProfile,
  describeReason,
  exportUrl,
  getDraft,
  getPublishStatus,
  problemsOf,
  profileLink,
  publish,
  saveGuest,
  saveProfile,
  slugify,
} from "./api";

const session = { ok: true, login: "owner@example.com", csrfToken: "tok" };
const draft = { ok: true, revision: 3, updatedAt: "x", dirty: true, guest: { apps: [] }, profiles: [] };

function stubFetch(answer: (url: string, init?: RequestInit) => [number, unknown]) {
  const fn = vi.fn((url: string, init?: RequestInit) => {
    const [status, body] = url === "/api/session" ? [200, session] : answer(url, init);
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

function callTo(fn: ReturnType<typeof stubFetch>, path: string) {
  const call = fn.mock.calls.find(([url]) => url === path);
  expect(call, `a request to ${path}`).toBeDefined();
  return call![1] as RequestInit & { headers: Record<string, string> };
}

afterEach(() => {
  resetSession();
  vi.unstubAllGlobals();
});

describe("profiles API calls", () => {
  it("reads the draft and the publish status without caching", async () => {
    const fn = stubFetch((url) => [200, url.endsWith("/publish") ? { configured: false } : draft]);
    await expect(getDraft("")).resolves.toEqual(draft);
    await expect(getPublishStatus("")).resolves.toEqual({ configured: false });
    expect(callTo(fn, "/api/apps/profiles/profiles").cache).toBe("no-store");
    expect(callTo(fn, "/api/apps/profiles/publish").cache).toBe("no-store");
  });

  it("saves a profile with PUT, the CSRF token and a JSON body", async () => {
    const fn = stubFetch(() => [201, draft]);
    const input = { name: "Zoë", aliases: ["Z"], inheritsGuest: false, apps: ["units"] };
    await saveProfile("zoe", input, "");
    const init = callTo(fn, "/api/apps/profiles/profiles/zoe");
    expect(init.method).toBe("PUT");
    expect(init.headers[TOKEN_HEADER]).toBe("tok");
    expect(JSON.parse(init.body as string)).toEqual(input);
  });

  it("deletes a profile, saves the guest apps and publishes a revision", async () => {
    const fn = stubFetch(() => [200, draft]);
    await deleteProfile("tammy", "");
    await saveGuest(["portfolio"], "");
    await publish(3, "");
    expect(callTo(fn, "/api/apps/profiles/profiles/tammy").method).toBe("DELETE");
    expect(JSON.parse(callTo(fn, "/api/apps/profiles/guest").body as string)).toEqual({
      apps: ["portfolio"],
    });
    const post = callTo(fn, "/api/apps/profiles/publish");
    expect(post.method).toBe("POST");
    expect(JSON.parse(post.body as string)).toEqual({ revision: 3 });
  });

  it("keeps the error body: problems, reason and revision", async () => {
    stubFetch(() => [400, { ok: false, error: "invalid_profile", problems: ["name is too long"] }]);
    const error = await saveProfile("x", { name: "", aliases: [], inheritsGuest: true, apps: [] }, "").catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("invalid_profile");
    expect(problemsOf(error)).toEqual(["name is too long"]);
    expect(problemsOf(new Error("x"))).toEqual([]);

    stubFetch(() => [409, { ok: false, error: "revision_mismatch", revision: 5 }]);
    const mismatch = (await publish(3, "").catch((e: unknown) => e)) as ApiError;
    expect(mismatch.body.revision).toBe(5);
  });
});

describe("helpers", () => {
  it("builds the export URL and the public profile link", () => {
    expect(exportUrl("")).toBe("/api/apps/profiles/export");
    expect(profileLink("mary-ann")).toBe("https://vekbui96.github.io/commons/?profile=mary-ann");
  });

  it("suggests a kebab-case id from a name", () => {
    expect(slugify("  Mary Ann ")).toBe("mary-ann");
    expect(slugify("Zoë!")).toBe("zoe");
    expect(slugify("***")).toBe("");
  });

  it("puts GitHub failure reasons in plain words", () => {
    expect(describeReason("github_unauthorized", 401)).toBe("GitHub rejected the token. (HTTP 401)");
    expect(describeReason("something_new")).toMatch(/GitHub refused/);
  });
});
