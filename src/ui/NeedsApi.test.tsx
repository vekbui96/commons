import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { resetReachability } from "@/api/client";
import { NeedsApi } from "./NeedsApi";
import { SiteMark } from "./SiteMark";

afterEach(() => {
  resetReachability();
  vi.unstubAllGlobals();
});

describe("NeedsApi", () => {
  it("shows a quiet tailscale hint, not an error, when there is no backend", () => {
    render(<NeedsApi base={null}>secret feature</NeedsApi>);
    expect(screen.getByTestId("needs-api")).toHaveTextContent("Connect to Tailscale to use this.");
    expect(screen.queryByText("secret feature")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the hint when the API does not answer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<NeedsApi base="">secret feature</NeedsApi>);
    expect(screen.getByRole("status")).toHaveTextContent(/Checking/);
    expect(await screen.findByTestId("needs-api")).toBeInTheDocument();
  });

  it("renders the feature once the API answers", async () => {
    const body = { ok: true, service: "commons", db: "ok", schemaVersion: 1, apps: [] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body))));
    render(<NeedsApi base="">secret feature</NeedsApi>);
    expect(await screen.findByText("secret feature")).toBeInTheDocument();
  });
});

describe("SiteMark", () => {
  it("labels only the private site", () => {
    const { rerender } = render(<SiteMark privateSite={false} />);
    expect(screen.queryByText("Private")).not.toBeInTheDocument();
    rerender(<SiteMark privateSite />);
    expect(screen.getByText("Private")).toBeInTheDocument();
  });
});
