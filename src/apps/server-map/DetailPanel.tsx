import { useEffect, useRef } from "react";
import { Button } from "@/ui";
import { connectionsOf, layerLabel, safeLinks, statusMeta, type ArchitectureMap, type MapNode } from "./map";

export interface DetailPanelProps {
  map: ArchitectureMap;
  node: MapNode;
  onSelect: (id: string | null) => void;
}

/** Name, status, details, links and connections of one node. */
export function DetailPanel({ map, node, onSelect }: DetailPanelProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const meta = statusMeta(node.status);
  const links = safeLinks(node.links);
  const connections = connectionsOf(map, node.id);
  const details = Object.entries(node.details);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [node.id]);

  return (
    <aside className="sm-panel" aria-labelledby="sm-panel-title" data-testid="sm-panel">
      <div className="sm-panel__head">
        <h2 className="sm-panel__title" id="sm-panel-title" ref={heading} tabIndex={-1}>
          {node.name}
        </h2>
        <Button
          variant="secondary"
          className="sm-panel__close"
          onClick={() => onSelect(null)}
          aria-label="Close"
        >
          ✕
        </Button>
      </div>

      <p className={`sm-status is-${node.status}`}>
        <span className="sm-status__symbol" aria-hidden="true">
          {meta.symbol}
        </span>
        <span>
          <strong>{meta.word}</strong>
          {node.statusDetail && <span className="sm-status__detail">{node.statusDetail}</span>}
        </span>
      </p>

      {!node.documented && <p className="sm-panel__undoc">Not in the docs yet (CLAUDE.md or the runbook).</p>}
      {node.description && <p className="sm-panel__desc">{node.description}</p>}

      <dl className="sm-facts">
        <dt>Kind</dt>
        <dd>{node.kind}</dd>
        <dt>Layer</dt>
        <dd>{layerLabel(node.layer)}</dd>
        {node.group && (
          <>
            <dt>Project</dt>
            <dd>{node.group}</dd>
          </>
        )}
        {details.map(([key, value]) => (
          <div key={key} className="sm-facts__row">
            <dt>{key}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {links.length > 0 && (
        <ul className="sm-links">
          {links.map((link) => (
            <li key={link.url}>
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                {link.label} <span aria-hidden="true">↗</span>
                <span className="visually-hidden"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {connections.length > 0 && (
        <section className="sm-conns" aria-label="Connected">
          <h3 className="sm-panel__sub">Connected</h3>
          <ul>
            {connections.map(({ edge, node: other, direction }) => (
              <li key={`${direction}:${other.id}:${edge.kind}`}>
                <button type="button" className="sm-conn" onClick={() => onSelect(other.id)}>
                  <span className="sm-conn__how">
                    {direction === "out" ? `${edge.label ?? edge.kind} →` : `← ${edge.label ?? edge.kind}`}
                  </span>
                  <span className="sm-conn__name">{other.name}</span>
                  <span className={`sm-conn__status is-${other.status}`}>
                    {statusMeta(other.status).symbol} {statusMeta(other.status).word}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
