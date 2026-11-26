/**
 * A small lane layout for the map: one horizontal lane per layer, top to
 * bottom, nodes as boxes wrapped into columns to fit the width, edges as
 * curves. Pure and dependency-free (no layout library in the bundle).
 *
 * Within a lane, nodes start sorted by group, kind and name, then a few
 * barycenter sweeps move each node towards the average position of the nodes
 * it connects to in other lanes, which keeps most lines short and uncrossed.
 */
import type { MapEdge, MapNode } from "./map";

export const BOX_H = 60;
const MIN_BOX_W = 150;
const MAX_BOX_W = 240;
const GAP_X = 12;
const GAP_Y = 14;
const PAD = 8;
const LANE_HEADER = 30;
const LANE_PAD = 14;
const LANE_GAP = 26;
const SWEEPS = 4;

export interface PlacedNode {
  node: MapNode;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlacedLane {
  layer: string;
  y: number;
  h: number;
}

export interface PlacedEdge {
  edge: MapEdge;
  path: string;
  /** Where a label sits when the edge is highlighted. */
  mid: { x: number; y: number };
}

export interface Layout {
  width: number;
  height: number;
  lanes: PlacedLane[];
  nodes: PlacedNode[];
  edges: PlacedEdge[];
}

/** How many box columns fit in a width (at least 2, so a phone shows pairs). */
export function columnsFor(width: number): number {
  return Math.max(2, Math.floor((width - 2 * PAD + GAP_X) / (MIN_BOX_W + GAP_X)));
}

const KIND_ORDER = ["internet", "site", "edge", "service", "task", "repo", "data"];

function initialOrder(a: MapNode, b: MapNode): number {
  const ga = a.group ?? "~";
  const gb = b.group ?? "~";
  if (ga !== gb) return ga.localeCompare(gb);
  const ka = KIND_ORDER.indexOf(a.kind);
  const kb = KIND_ORDER.indexOf(b.kind);
  if (ka !== kb) return (ka < 0 ? 99 : ka) - (kb < 0 ? 99 : kb);
  return a.name.localeCompare(b.name);
}

/**
 * Lanes in layer order holding the given nodes (empty lanes are dropped),
 * each ordered to reduce crossings. Exported for tests: this is the mapping
 * from map data to layout input.
 */
export function laneOrder(layers: readonly string[], nodes: readonly MapNode[], edges: readonly MapEdge[]) {
  const lanes = layers
    .map((layer) => ({ layer, nodes: nodes.filter((n) => n.layer === layer).sort(initialOrder) }))
    .filter((lane) => lane.nodes.length > 0);

  const laneOf = new Map<string, number>();
  lanes.forEach((lane, i) => lane.nodes.forEach((n) => laneOf.set(n.id, i)));
  const neighbours = new Map<string, string[]>();
  for (const e of edges) {
    if (!laneOf.has(e.from) || !laneOf.has(e.to) || laneOf.get(e.from) === laneOf.get(e.to)) continue;
    neighbours.set(e.from, [...(neighbours.get(e.from) ?? []), e.to]);
    neighbours.set(e.to, [...(neighbours.get(e.to) ?? []), e.from]);
  }

  const position = new Map<string, number>();
  const measure = () =>
    lanes.forEach((lane) => lane.nodes.forEach((n, i) => position.set(n.id, (i + 0.5) / lane.nodes.length)));
  measure();

  for (let sweep = 0; sweep < SWEEPS; sweep += 1) {
    const order = lanes.map((_, i) => i);
    if (sweep % 2 === 1) order.reverse();
    for (const i of order) {
      const lane = lanes[i]!;
      const keyed = lane.nodes.map((n, index) => {
        const near = neighbours.get(n.id) ?? [];
        const bary =
          near.length > 0
            ? near.reduce((sum, id) => sum + (position.get(id) ?? 0.5), 0) / near.length
            : position.get(n.id)!;
        return { n, bary, index };
      });
      keyed.sort((a, b) => a.bary - b.bary || a.index - b.index);
      lane.nodes = keyed.map((k) => k.n);
      lane.nodes.forEach((n, index) => position.set(n.id, (index + 0.5) / lane.nodes.length));
    }
  }
  return lanes;
}

/** A polyline with rounded corners, as an SVG path. */
function rounded(points: readonly [number, number][], r = 6): string {
  let d = `M${points[0]![0]},${points[0]![1]}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const [px, py] = points[i - 1]!;
    const [x, y] = points[i]!;
    const [nx, ny] = points[i + 1]!;
    const inLen = Math.hypot(x - px, y - py);
    const outLen = Math.hypot(nx - x, ny - y);
    const k = Math.min(r, inLen / 2, outLen / 2);
    const ax = x - ((x - px) / (inLen || 1)) * k;
    const ay = y - ((y - py) / (inLen || 1)) * k;
    const bx = x + ((nx - x) / (outLen || 1)) * k;
    const by = y + ((ny - y) / (outLen || 1)) * k;
    d += ` L${ax},${ay} Q${x},${y} ${bx},${by}`;
  }
  const [lx, ly] = points[points.length - 1]!;
  return `${d} L${lx},${ly}`;
}

function edgePath(
  a: PlacedNode,
  b: PlacedNode,
  all: readonly PlacedNode[],
  gutters: readonly number[],
): { path: string; mid: { x: number; y: number } } {
  const ax = a.x + a.w / 2;
  const bx = b.x + b.w / 2;
  if (Math.abs(a.y - b.y) < 1) {
    // Same row: side to side, arcing above the row when boxes sit between them.
    const [left, right] = a.x < b.x ? [a, b] : [b, a];
    const x1 = left.x + left.w;
    const x2 = right.x;
    const y = a.y + a.h / 2;
    const adjacent = x2 - x1 <= GAP_X + 1;
    const [sx, tx] = a === left ? [x1, x2] : [x2, x1];
    if (adjacent) return { path: `M${sx},${y} L${tx},${y}`, mid: { x: (x1 + x2) / 2, y: y - 8 } };
    const lift = a.y - 26;
    return {
      path: `M${ax},${a.y} C${ax},${lift} ${bx},${lift} ${bx},${b.y}`,
      mid: { x: (ax + bx) / 2, y: lift + 4 },
    };
  }
  const down = b.y > a.y;
  const y1 = down ? a.y + a.h : a.y;
  const y2 = down ? b.y : b.y + b.h;
  const top = Math.min(y1, y2);
  const bottom = Math.max(y1, y2);
  const lo = Math.min(ax, bx);
  const hi = Math.max(ax, bx);
  const blocked = all.some(
    (n) => n !== a && n !== b && n.y >= top && n.y + n.h <= bottom && n.x < hi + 1 && n.x + n.w > lo - 1,
  );
  if (!blocked || gutters.length === 0) {
    const bend = (y2 - y1) / 2;
    return {
      path: `M${ax},${y1} C${ax},${y1 + bend} ${bx},${y2 - bend} ${bx},${y2}`,
      mid: { x: (ax + bx) / 2, y: (y1 + y2) / 2 },
    };
  }
  // Boxes in between: run down the column gutter nearest the middle, turning
  // in the row gaps just past the source and just before the target.
  const middle = (ax + bx) / 2;
  const gx = gutters.reduce((best, g) => (Math.abs(g - middle) < Math.abs(best - middle) ? g : best));
  const step = down ? GAP_Y / 2 : -GAP_Y / 2;
  const ya = y1 + step;
  const yb = y2 - step;
  return {
    path: rounded([
      [ax, y1],
      [ax, ya],
      [gx, ya],
      [gx, yb],
      [bx, yb],
      [bx, y2],
    ]),
    mid: { x: Math.max(28, gx), y: (ya + yb) / 2 },
  };
}

/** Places lanes, boxes and edges for a container `width` px wide. */
export function computeLayout(
  layers: readonly string[],
  nodes: readonly MapNode[],
  edges: readonly MapEdge[],
  width: number,
): Layout {
  const w = Math.max(300, Math.floor(width));
  const inner = w - 2 * PAD;
  const lanes = laneOrder(layers, nodes, edges);
  // Only as many columns as the widest lane uses, so a wide screen gets
  // bigger boxes instead of empty columns.
  const fit = columnsFor(w);
  const cols = Math.max(
    1,
    ...lanes.map((lane) => Math.ceil(lane.nodes.length / Math.ceil(lane.nodes.length / fit))),
  );
  const boxW = Math.min(MAX_BOX_W, (inner - (cols - 1) * GAP_X) / cols);
  // One column grid for every lane, so the gutters between columns line up
  // from top to bottom and long edges can run down them.
  const gridLeft = PAD + (inner - (cols * boxW + (cols - 1) * GAP_X)) / 2;
  const colX = (c: number) => gridLeft + c * (boxW + GAP_X);
  const gutters = Array.from({ length: cols + 1 }, (_, c) =>
    Math.round(
      c === 0 ? gridLeft - PAD / 2 : c === cols ? colX(cols) - GAP_X + PAD / 2 : colX(c) - GAP_X / 2,
    ),
  );

  const placedLanes: PlacedLane[] = [];
  const placed = new Map<string, PlacedNode>();
  let y = 0;

  for (const lane of lanes) {
    const n = lane.nodes.length;
    const rows = Math.ceil(n / cols);
    const used = Math.ceil(n / rows);
    const offset = Math.floor((cols - used) / 2);
    const top = y + LANE_HEADER;
    // Column-major fill keeps the left-to-right order of the sweeps.
    lane.nodes.forEach((node, i) => {
      const col = Math.floor(i / rows);
      const row = i % rows;
      placed.set(node.id, {
        node,
        x: Math.round(colX(offset + col)),
        y: Math.round(top + row * (BOX_H + GAP_Y)),
        w: Math.round(boxW),
        h: BOX_H,
      });
    });
    const h = LANE_HEADER + rows * BOX_H + (rows - 1) * GAP_Y + LANE_PAD;
    placedLanes.push({ layer: lane.layer, y, h });
    y += h + LANE_GAP;
  }

  const boxes = [...placed.values()];
  const placedEdges: PlacedEdge[] = edges.flatMap((edge) => {
    const a = placed.get(edge.from);
    const b = placed.get(edge.to);
    return a && b ? [{ edge, ...edgePath(a, b, boxes, gutters) }] : [];
  });

  return {
    width: w,
    height: Math.max(0, y - LANE_GAP),
    lanes: placedLanes,
    nodes: boxes,
    edges: placedEdges,
  };
}

/** Cuts a name to fit a box (the full name is in the title and detail panel). */
export function fitText(text: string, boxWidth: number, charPx = 8.2): string {
  const max = Math.max(4, Math.floor((boxWidth - 26) / charPx));
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}
