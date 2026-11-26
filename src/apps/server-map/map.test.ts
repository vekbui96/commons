import { describe, expect, it } from "vitest";
import { ApiError } from "@/api/client";
import { sampleMap, FIXTURE_GENERATED_AT } from "./fixture";
import {
  STALE_AFTER_MS,
  connectionsOf,
  describeMapError,
  filterMap,
  formatAge,
  isStale,
  parseMap,
  safeLinks,
  statusMeta,
  undocumentedCount,
} from "./map";
import { columnsFor, computeLayout, fitText, laneOrder } from "./layout";

const map = parseMap(sampleMap);
const T0 = Date.parse(FIXTURE_GENERATED_AT);

describe("parseMap", () => {
  it("keeps every node and drops edges to missing nodes", () => {
    expect(map.nodes).toHaveLength(sampleMap.nodes.length);
    expect(map.edges.some((e) => e.to === "nowhere")).toBe(false);
    expect(map.edges).toHaveLength(sampleMap.edges.length - 1);
  });

  it("normalises unknown statuses, missing fields and unlisted layers", () => {
    const parsed = parseMap({
      schema: 1,
      generatedAt: FIXTURE_GENERATED_AT,
      layers: ["host"],
      nodes: [
        { id: "a", name: "A", layer: "host", status: "purple" },
        { id: "b", layer: "attic" },
        { id: "a", name: "duplicate" },
      ],
    });
    expect(parsed.nodes.map((n) => n.id)).toEqual(["a", "b"]);
    expect(parsed.nodes[0]!.status).toBe("unknown");
    expect(parsed.nodes[1]!.name).toBe("b");
    expect(parsed.nodes[1]!.documented).toBe(true);
    expect(parsed.layers).toEqual(["host", "attic"]);
    expect(parsed.edges).toEqual([]);
  });

  it.each([null, {}, { schema: 2, nodes: [] }, { schema: 1, nodes: [], generatedAt: "not a date" }])(
    "treats %j as map_invalid",
    (raw) => {
      expect(() => parseMap(raw)).toThrow(expect.objectContaining({ code: "map_invalid" }));
    },
  );
});

describe("status", () => {
  it("gives every status a symbol and a word (never colour alone)", () => {
    expect(statusMeta("ok")).toEqual({ symbol: "✓", word: "OK" });
    expect(statusMeta("warn")).toEqual({ symbol: "!", word: "Warning" });
    expect(statusMeta("bad")).toEqual({ symbol: "✕", word: "Failing" });
    expect(statusMeta("unknown")).toEqual({ symbol: "?", word: "Unknown" });
    const symbols = new Set(["ok", "warn", "bad", "unknown"].map((s) => statusMeta(s as "ok").symbol));
    expect(symbols.size).toBe(4);
  });
});

describe("freshness", () => {
  it("is stale only past 30 minutes", () => {
    expect(isStale(FIXTURE_GENERATED_AT, T0 + STALE_AFTER_MS)).toBe(false);
    expect(isStale(FIXTURE_GENERATED_AT, T0 + STALE_AFTER_MS + 1)).toBe(true);
    expect(isStale(FIXTURE_GENERATED_AT, T0 - 60_000)).toBe(false);
  });

  it("says how old the map is in plain words", () => {
    expect(formatAge(20_000)).toBe("just now");
    expect(formatAge(60_000)).toBe("1 min ago");
    expect(formatAge(14 * 60_000)).toBe("14 min ago");
    expect(formatAge(3 * 3_600_000)).toBe("3 h ago");
    expect(formatAge(72 * 3_600_000)).toBe("3 days ago");
  });
});

describe("drift", () => {
  it("counts undocumented nodes once plus node-less drift messages", () => {
    // disk-report (documented: false and named by drift) + one message without a node.
    expect(undocumentedCount(map)).toBe(2);
    expect(undocumentedCount({ ...map, drift: [] })).toBe(1);
    expect(
      undocumentedCount({ ...map, drift: [], nodes: map.nodes.map((n) => ({ ...n, documented: true })) }),
    ).toBe(0);
  });
});

describe("filters and connections", () => {
  it("filters by project and kind and drops edges that lose an end", () => {
    const cardlens = filterMap(map, { group: "cardlens", kind: "" });
    expect(cardlens.nodes.every((n) => n.group === "cardlens")).toBe(true);
    expect(cardlens.edges.every((e) => cardlens.nodes.some((n) => n.id === e.from))).toBe(true);
    expect(filterMap(map, { group: "", kind: "task" }).nodes.map((n) => n.kind)).toEqual([
      "task",
      "task",
      "task",
      "task",
    ]);
  });

  it("lists connections in both directions", () => {
    const conns = connectionsOf(map, "svc:cardlens");
    expect(conns.filter((c) => c.direction === "in").map((c) => c.node.id)).toEqual(["edge:funnel-8443"]);
    expect(conns.filter((c) => c.direction === "out").map((c) => c.node.id)).toEqual([
      "svc:recognition",
      "data:cardlens",
    ]);
  });

  it("shows https links only", () => {
    expect(
      safeLinks([
        { label: "ok", url: "https://example.com" },
        { label: "js", url: "javascript:alert(1)" },
        { label: "http", url: "http://example.com" },
        { label: "junk", url: "not a url" },
      ]).map((l) => l.label),
    ).toEqual(["ok"]);
  });
});

describe("errors", () => {
  it("has a friendly sentence for each error", () => {
    expect(describeMapError(new ApiError(503, "map_not_ready", "x"))).toBe(
      "The hub hasn't written the map yet; it updates every 15 minutes.",
    );
    expect(describeMapError(new ApiError(502, "map_invalid", "x"))).toMatch(/couldn't be read/);
    expect(describeMapError(new ApiError(403, "self_request", "x"))).toMatch(/server-pc itself/);
    expect(describeMapError(new ApiError(403, "not_owner", "x"))).toMatch(/someone other/);
    expect(describeMapError(new ApiError(401, "identity_required", "x"))).toMatch(/No Tailscale identity/);
    expect(describeMapError(new TypeError("Failed to fetch"))).toMatch(/couldn't be loaded/);
  });
});

describe("layout", () => {
  it("maps layers to lanes in order, skipping empty ones", () => {
    const lanes = laneOrder(map.layers, map.nodes, map.edges);
    expect(lanes.map((l) => l.layer)).toEqual(["internet", "edge", "tailnet", "host", "data"]);
    expect(lanes.flatMap((l) => l.nodes)).toHaveLength(map.nodes.length);
    const onlyHost = laneOrder(
      map.layers,
      map.nodes.filter((n) => n.layer === "host"),
      [],
    );
    expect(onlyHost.map((l) => l.layer)).toEqual(["host"]);
  });

  it("orders a lane towards its neighbours", () => {
    // funnel-443 links to the portfolio site and API, funnel-8443 to CardLens:
    // their order in the edge lane follows the order of what they connect to.
    const lanes = laneOrder(map.layers, map.nodes, map.edges);
    const internet = lanes[0]!.nodes.map((n) => n.id);
    const edge = lanes[1]!.nodes.map((n) => n.id);
    const before = (list: string[], a: string, b: string) => list.indexOf(a) < list.indexOf(b);
    expect(before(edge, "edge:funnel-443", "edge:funnel-8443")).toBe(
      before(internet, "site:portfolio", "site:cardlens"),
    );
  });

  it("fits the width: two columns on a phone, more on desktop, no overlap", () => {
    expect(columnsFor(358)).toBe(2);
    expect(columnsFor(1000)).toBeGreaterThanOrEqual(5);
    for (const width of [358, 760, 1100]) {
      const layout = computeLayout(map.layers, map.nodes, map.edges, width);
      expect(layout.nodes).toHaveLength(map.nodes.length);
      expect(layout.edges).toHaveLength(map.edges.length);
      for (const a of layout.nodes) {
        expect(a.x).toBeGreaterThanOrEqual(0);
        expect(a.x + a.w).toBeLessThanOrEqual(width);
        for (const b of layout.nodes) {
          if (a === b) continue;
          const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
          expect(apart, `${a.node.id} overlaps ${b.node.id} at ${width}px`).toBe(true);
        }
      }
      // Lanes go top to bottom in layer order.
      const ys = layout.lanes.map((l) => l.y);
      expect([...ys].sort((p, q) => p - q)).toEqual(ys);
    }
  });

  it("shortens long names to fit a box", () => {
    expect(fitText("cardlens", 160)).toBe("cardlens");
    const cut = fitText("innovation-loop-cardlens-deploy", 160);
    expect(cut.endsWith("…")).toBe(true);
    expect(cut.length).toBeLessThan(20);
  });
});
