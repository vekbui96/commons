import { layerLabel, statusMeta, type MapNode } from "./map";

export interface ListViewProps {
  layers: readonly string[];
  nodes: readonly MapNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** The same nodes as a readable list, grouped by layer (handy on a phone). */
export function ListView({ layers, nodes, selectedId, onSelect }: ListViewProps) {
  return (
    <div className="sm-list" data-testid="sm-list">
      {layers.map((layer) => {
        const inLayer = nodes.filter((n) => n.layer === layer);
        if (inLayer.length === 0) return null;
        return (
          <section key={layer} className="sm-list__layer" aria-labelledby={`sm-layer-${layer}`}>
            <h2 className="sm-list__heading" id={`sm-layer-${layer}`}>
              {layerLabel(layer)} <span className="num">{inLayer.length}</span>
            </h2>
            <ul className="ui-list">
              {inLayer.map((node) => {
                const meta = statusMeta(node.status);
                return (
                  <li key={node.id} className="ui-listrow">
                    <button
                      type="button"
                      className={`sm-list__row${node.documented ? "" : " is-undocumented"}`}
                      aria-pressed={node.id === selectedId}
                      onClick={() => onSelect(node.id)}
                    >
                      <span className="sm-list__text">
                        <span className="sm-list__name">{node.name}</span>
                        <span className="sm-list__meta">
                          {node.kind}
                          {node.group ? ` · ${node.group}` : ""}
                          {node.documented ? "" : " · undocumented"}
                        </span>
                      </span>
                      <span className={`sm-list__status is-${node.status}`}>
                        <span aria-hidden="true">{meta.symbol}</span> {meta.word}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
