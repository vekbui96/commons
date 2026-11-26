/**
 * The architecture map (schema v1) served at GET /api/apps/server-map/architecture,
 * and the pure helpers the screen uses. See docs/api-contract.md.
 */
import { ApiError } from "@/api/client";

export type NodeStatus = "ok" | "warn" | "bad" | "unknown";
export type NodeKind = "internet" | "site" | "edge" | "service" | "task" | "repo" | "data";

export interface MapLink {
  label: string;
  url: string;
}

export interface MapNode {
  id: string;
  kind: string;
  layer: string;
  name: string;
  description?: string;
  status: NodeStatus;
  statusDetail?: string;
  details: Record<string, string>;
  links: MapLink[];
  documented: boolean;
  group?: string;
}

export interface MapEdge {
  from: string;
  to: string;
  kind: string;
  label?: string;
}

export interface DriftItem {
  nodeId?: string;
  message: string;
}

export interface MapSource {
  name: string;
  ok: boolean;
  error?: string;
}

export interface ArchitectureMap {
  schema: 1;
  generatedAt: string;
  host: string;
  layers: string[];
  nodes: MapNode[];
  edges: MapEdge[];
  drift: DriftItem[];
  sources: MapSource[];
}

/** The layer order when the map does not say. */
export const DEFAULT_LAYERS = ["internet", "edge", "tailnet", "host", "data"];

const STATUSES: readonly NodeStatus[] = ["ok", "warn", "bad", "unknown"];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v : undefined);

/** Thrown (as the server would) when the body is not a schema-1 map. */
function invalid(): never {
  throw new ApiError(502, "map_invalid", "architecture");
}

/**
 * Checks and normalises the endpoint's body. Unknown statuses become "unknown",
 * edges to missing nodes are dropped, and any layer a node uses that the map
 * does not list is added at the end so no node disappears.
 */
export function parseMap(raw: unknown): ArchitectureMap {
  if (!isObject(raw) || raw.schema !== 1 || !Array.isArray(raw.nodes)) invalid();
  const generatedAt = str(raw.generatedAt);
  if (!generatedAt || Number.isNaN(Date.parse(generatedAt))) invalid();

  const seen = new Set<string>();
  const nodes: MapNode[] = [];
  for (const n of raw.nodes) {
    if (!isObject(n)) continue;
    const id = str(n.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const details: Record<string, string> = {};
    if (isObject(n.details)) {
      for (const [key, value] of Object.entries(n.details)) {
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          details[key] = String(value);
        }
      }
    }
    const links = Array.isArray(n.links)
      ? n.links.flatMap((l) => {
          const label = isObject(l) ? str(l.label) : undefined;
          const url = isObject(l) ? str(l.url) : undefined;
          return label && url ? [{ label, url }] : [];
        })
      : [];
    nodes.push({
      id,
      kind: str(n.kind) ?? "service",
      layer: str(n.layer) ?? "host",
      name: str(n.name) ?? id,
      description: str(n.description),
      status: STATUSES.includes(n.status as NodeStatus) ? (n.status as NodeStatus) : "unknown",
      statusDetail: str(n.statusDetail),
      details,
      links,
      documented: n.documented !== false,
      group: str(n.group),
    });
  }

  const edges: MapEdge[] = (Array.isArray(raw.edges) ? raw.edges : []).flatMap((e) => {
    if (!isObject(e)) return [];
    const from = str(e.from);
    const to = str(e.to);
    if (!from || !to || from === to || !seen.has(from) || !seen.has(to)) return [];
    return [{ from, to, kind: str(e.kind) ?? "calls", label: str(e.label) }];
  });

  const listed = Array.isArray(raw.layers) ? raw.layers.filter((l): l is string => !!str(l)) : [];
  const layers = [...new Set(listed.length > 0 ? listed : DEFAULT_LAYERS)];
  for (const node of nodes) if (!layers.includes(node.layer)) layers.push(node.layer);

  const drift: DriftItem[] = (Array.isArray(raw.drift) ? raw.drift : []).flatMap((d) => {
    const message = isObject(d) ? str(d.message) : undefined;
    if (!message || !isObject(d)) return [];
    const nodeId = str(d.nodeId);
    return [{ message, ...(nodeId && seen.has(nodeId) ? { nodeId } : {}) }];
  });

  const sources: MapSource[] = (Array.isArray(raw.sources) ? raw.sources : []).flatMap((s) => {
    const name = isObject(s) ? str(s.name) : undefined;
    if (!name || !isObject(s)) return [];
    return [{ name, ok: s.ok === true, error: str(s.error) }];
  });

  return {
    schema: 1,
    generatedAt,
    host: str(raw.host) ?? "server",
    layers,
    nodes,
    edges,
    drift,
    sources,
  };
}

/* ---------- Status: a colour, a symbol and a word, never colour alone ---------- */

export interface StatusMeta {
  symbol: string;
  word: string;
}

export const STATUS_META: Record<NodeStatus, StatusMeta> = {
  ok: { symbol: "✓", word: "OK" },
  warn: { symbol: "!", word: "Warning" },
  bad: { symbol: "✕", word: "Failing" },
  unknown: { symbol: "?", word: "Unknown" },
};

export function statusMeta(status: NodeStatus): StatusMeta {
  return STATUS_META[status] ?? STATUS_META.unknown;
}

/** Counts per status, for the summary line. */
export function statusCounts(nodes: readonly MapNode[]): Record<NodeStatus, number> {
  const counts: Record<NodeStatus, number> = { ok: 0, warn: 0, bad: 0, unknown: 0 };
  for (const n of nodes) counts[n.status] += 1;
  return counts;
}

/* ---------- Freshness ---------- */

/** Older than this, the map shows a stale warning (the hub writes it every 15 min). */
export const STALE_AFTER_MS = 30 * 60_000;

export function mapAgeMs(generatedAt: string, now: number): number {
  return Math.max(0, now - Date.parse(generatedAt));
}

export function isStale(generatedAt: string, now: number): boolean {
  return mapAgeMs(generatedAt, now) > STALE_AFTER_MS;
}

/** "just now", "1 min ago", "14 min ago", "2 h ago", "3 days ago". */
export function formatAge(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hours = Math.floor(min / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

/* ---------- Drift, filters, connections ---------- */

/** Every node not in the docs, plus drift messages that name no node. */
export function undocumentedCount(map: ArchitectureMap): number {
  const ids = new Set(map.nodes.filter((n) => !n.documented).map((n) => n.id));
  for (const d of map.drift) if (d.nodeId) ids.add(d.nodeId);
  return ids.size + map.drift.filter((d) => !d.nodeId).length;
}

export interface MapFilter {
  group: string;
  kind: string;
}

export const ALL = "";

export function filterMap(map: ArchitectureMap, filter: MapFilter): { nodes: MapNode[]; edges: MapEdge[] } {
  const nodes = map.nodes.filter(
    (n) =>
      (filter.group === ALL || n.group === filter.group) && (filter.kind === ALL || n.kind === filter.kind),
  );
  const ids = new Set(nodes.map((n) => n.id));
  return { nodes, edges: map.edges.filter((e) => ids.has(e.from) && ids.has(e.to)) };
}

export function groupsOf(map: ArchitectureMap): string[] {
  return [...new Set(map.nodes.flatMap((n) => (n.group ? [n.group] : [])))].sort();
}

export function kindsOf(map: ArchitectureMap): string[] {
  return [...new Set(map.nodes.map((n) => n.kind))].sort();
}

export interface Connection {
  edge: MapEdge;
  node: MapNode;
  direction: "out" | "in";
}

export function connectionsOf(map: ArchitectureMap, id: string): Connection[] {
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  return map.edges.flatMap((edge): Connection[] => {
    if (edge.from === id) {
      const node = byId.get(edge.to);
      return node ? [{ edge, node, direction: "out" }] : [];
    }
    if (edge.to === id) {
      const node = byId.get(edge.from);
      return node ? [{ edge, node, direction: "in" }] : [];
    }
    return [];
  });
}

/** Only https links are shown (anything else in the data is dropped). */
export function safeLinks(links: readonly MapLink[]): MapLink[] {
  return links.filter((l) => {
    try {
      return new URL(l.url).protocol === "https:";
    } catch {
      return false;
    }
  });
}

export function layerLabel(layer: string): string {
  return layer.charAt(0).toUpperCase() + layer.slice(1);
}

/* ---------- Errors ---------- */

/** A plain sentence for why the map could not be shown. Never alarming. */
export function describeMapError(err: unknown): string {
  const code = err instanceof ApiError ? err.code : undefined;
  switch (code) {
    case "map_not_ready":
      return "The hub hasn't written the map yet; it updates every 15 minutes.";
    case "map_invalid":
      return "The map the hub wrote couldn't be read. The next update (every 15 minutes) should fix it.";
    case "self_request":
      return "Opened from server-pc itself. Open the private Commons from your phone or laptop to see the map.";
    case "identity_not_ready":
      return "The API is still reading the tailnet owner. Try again in a moment.";
    case "not_owner":
      return "Signed in to Tailscale as someone other than the owner.";
    case "identity_required":
    case "not_via_tailscale":
    case "wrong_host":
      return "No Tailscale identity came with this request. Open the private Commons through its tailnet address.";
    default:
      return "The map couldn't be loaded right now.";
  }
}
