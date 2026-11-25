import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ApiError, resetReachability, resetSession } from "@/api/client";
import PrivateCheckApp from "./App";
import { describeSessionError } from "./session";

vi.mock("@/api/client", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  API_BASE: "",
}));

afterEach(() => {
  resetReachability();
  resetSession();
  vi.unstubAllGlobals();
});

function respond(map: Record<string, [number, unknown]>) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      const [status, body] = map[url] ?? [404, { error: "not_found" }];
      return Promise.resolve(new Response(JSON.stringify(body), { status }));
    }),
  );
}

const health = { ok: true, service: "commons", db: "ok", schemaVersion: 2, apps: [] };

describe("private check", () => {
  it("shows health and the tailnet login", async () => {
    respond({
      "/api/health": [200, health],
      "/api/session": [200, { ok: true, login: "ve@example.com", csrfToken: "x" }],
    });
    render(<PrivateCheckApp />);
    expect(await screen.findByText("ve@example.com")).toBeInTheDocument();
    expect(screen.getByTestId("private-check-login")).toHaveTextContent("ve@example.com");
    expect(screen.getByText("Answering")).toBeInTheDocument();
  });

  it("explains a request from server-pc itself instead of erroring", async () => {
    respond({ "/api/health": [200, health], "/api/session": [403, { error: "self_request" }] });
    render(<PrivateCheckApp />);
    expect(await screen.findByText(/Opened from server-pc itself/)).toBeInTheDocument();
  });

  it("is quiet off the tailnet", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<PrivateCheckApp />);
    expect(await screen.findByText("Connect to Tailscale to use this.")).toBeInTheDocument();
  });

  it("has a sentence for every session error", () => {
    expect(describeSessionError(new ApiError(403, "not_owner", "/api/session"))).toMatch(/someone other/);
    expect(describeSessionError(new Error("x"))).toMatch(/could not be read/);
  });
});
