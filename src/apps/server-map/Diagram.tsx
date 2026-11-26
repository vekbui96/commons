import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { cx } from "@/ui";
import { layerLabel, statusMeta, type MapEdge, type MapNode } from "./map";
import { computeLayout, fitText } from "./layout";

export interface DiagramProps {
  layers: readonly string[];
  nodes: readonly MapNode[];
  edges: readonly MapEdge[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

/** Fallback width before the container is measured (and in jsdom). */
const DEFAULT_WIDTH = 360;

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setWidth(w);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * The map as SVG: one lane per layer, boxes for nodes, curves for edges. The
 * layout is recomputed for the container's width, so it always fits (no
 * sideways scrolling on a phone). Colours come from CSS variables only.
 */
export function Diagram({ layers, nodes, edges, selectedId, onSelect }: DiagramProps) {
  const [ref, width] = useWidth();
  const layout = useMemo(() => computeLayout(layers, nodes, edges, width), [layers, nodes, edges, width]);

  const related = useMemo(() => {
    if (!selectedId) return null;
    const ids = new Set([selectedId]);
    for (const e of edges) {
      if (e.from === selectedId) ids.add(e.to);
      if (e.to === selectedId) ids.add(e.from);
    }
    return ids;
  }, [edges, selectedId]);

  const isHot = (e: MapEdge) => selectedId !== null && (e.from === selectedId || e.to === selectedId);
  // Highlighted edges draw last so they sit on top.
  const ordered = [...layout.edges].sort((a, b) => Number(isHot(a.edge)) - Number(isHot(b.edge)));

  function onKey(event: KeyboardEvent<SVGGElement>, id: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(id === selectedId ? null : id);
    }
  }

  return (
    <div className="sm-diagram" ref={ref} data-testid="sm-diagram">
      <svg
        className={cx("sm-svg", related && "has-selection")}
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="group"
        aria-label="Architecture diagram"
        onClick={(event) => {
          if (event.target === event.currentTarget) onSelect(null);
        }}
      >
        <defs>
          <marker
            id="sm-arrow"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8 z" className="sm-arrow" />
          </marker>
          <marker
            id="sm-arrow-hot"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8 z" className="sm-arrow is-hot" />
          </marker>
        </defs>

        {layout.lanes.map((lane) => (
          <g key={lane.layer} className="sm-lane">
            <rect className="sm-lane__band" x={0} y={lane.y} width={layout.width} height={lane.h} rx={8} />
            <text className="sm-lane__label" x={12} y={lane.y + 20}>
              {layerLabel(lane.layer)}
            </text>
          </g>
        ))}

        <g className="sm-edges">
          {ordered.map(({ edge, path }) => {
            const hot = isHot(edge);
            return (
              <path
                key={`${edge.from}>${edge.to}>${edge.kind}`}
                d={path}
                className={cx("sm-edge", `is-${edge.kind}`, hot && "is-hot", related && !hot && "is-dim")}
                markerEnd={hot ? "url(#sm-arrow-hot)" : "url(#sm-arrow)"}
              />
            );
          })}
        </g>

        {layout.nodes.map(({ node, x, y, w, h }) => {
          const meta = statusMeta(node.status);
          const selected = node.id === selectedId;
          return (
            <g
              key={node.id}
              className={cx(
                "sm-node",
                `is-${node.status}`,
                !node.documented && "is-undocumented",
                selected && "is-selected",
                related && !related.has(node.id) && "is-dim",
              )}
              transform={`translate(${x},${y})`}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              aria-label={`${node.name}, ${node.kind}, ${meta.word}${node.documented ? "" : ", undocumented"}`}
              data-node-id={node.id}
              onClick={() => onSelect(selected ? null : node.id)}
              onKeyDown={(event) => onKey(event, node.id)}
            >
              <title>{node.name}</title>
              <rect className="sm-node__box" width={w} height={h} rx={6} />
              <rect className="sm-node__stripe" width={4} height={h - 12} x={5} y={6} rx={2} />
              <text className="sm-node__name" x={16} y={24}>
                {fitText(node.name, w)}
              </text>
              <text className="sm-node__kind" x={16} y={46}>
                {node.kind}
              </text>
              <text className="sm-node__status" x={w - 10} y={46} textAnchor="end">
                {meta.symbol} {meta.word}
              </text>
            </g>
          );
        })}

        {layout.edges
          .filter(({ edge }) => isHot(edge))
          .map(({ edge, mid }) => (
            <text
              key={`label:${edge.from}>${edge.to}>${edge.kind}`}
              className="sm-edge__label"
              x={Math.min(layout.width - 32, Math.max(32, mid.x))}
              y={mid.y}
              textAnchor="middle"
            >
              {edge.label ?? edge.kind}
            </text>
          ))}
      </svg>
    </div>
  );
}
