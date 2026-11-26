import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/api/client";
import { Button, Field, NeedsApi, Select, cx } from "@/ui";
import {
  ALL,
  describeMapError,
  filterMap,
  formatAge,
  groupsOf,
  isStale,
  kindsOf,
  mapAgeMs,
  statusCounts,
  statusMeta,
  undocumentedCount,
  type ArchitectureMap,
  type MapFilter,
  type NodeStatus,
} from "./map";
import { Diagram } from "./Diagram";
import { DetailPanel } from "./DetailPanel";
import { ListView } from "./ListView";
import { useArchitecture, useNow } from "./useArchitecture";
import "./server-map.css";

type View = "diagram" | "list";

function Freshness({ map, failed }: { map: ArchitectureMap; failed: boolean }) {
  const now = useNow();
  const age = mapAgeMs(map.generatedAt, now);
  const stale = isStale(map.generatedAt, now);
  const counts = statusCounts(map.nodes);
  const shown: NodeStatus[] = ["bad", "warn", "unknown"];
  return (
    <>
      <p className="sm-meta">
        <span>
          <span className="num">{map.host}</span> · Updated{" "}
          <time dateTime={map.generatedAt} title={new Date(map.generatedAt).toLocaleString()}>
            {formatAge(age)}
          </time>
        </span>
        <span className="sm-meta__counts">
          {(["ok", ...shown] as NodeStatus[]).map((s) =>
            counts[s] > 0 || s === "ok" ? (
              <span key={s} className={`sm-count is-${s}`}>
                <span aria-hidden="true">{statusMeta(s).symbol}</span>{" "}
                <span className="num">{counts[s]}</span> {statusMeta(s).word}
              </span>
            ) : null,
          )}
        </span>
      </p>
      {stale && (
        <p className="sm-banner is-warn" role="status" data-testid="sm-stale">
          <span aria-hidden="true">!</span> This map is {formatAge(age).replace(" ago", "")} old. The hub
          writes it every 15 minutes, so its collector may have stopped.
        </p>
      )}
      {failed && !stale && <p className="sm-note">The last refresh failed; showing the previous map.</p>}
    </>
  );
}

function Drift({ map, onSelect }: { map: ArchitectureMap; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const count = undocumentedCount(map);
  if (count === 0) return <span className="sm-documented">All documented</span>;
  return (
    <div className="sm-drift">
      <button
        type="button"
        className="sm-drift__badge"
        aria-expanded={open}
        aria-controls="sm-drift-list"
        onClick={() => setOpen((o) => !o)}
        data-testid="sm-drift-badge"
      >
        <span aria-hidden="true">!</span> <span className="num">{count}</span> undocumented
      </button>
      {open && (
        <ul className="sm-drift__list" id="sm-drift-list">
          {map.drift.map((d, i) => (
            <li key={`${d.nodeId ?? "none"}:${i}`}>
              {d.nodeId ? (
                <button type="button" className="sm-drift__item" onClick={() => onSelect(d.nodeId!)}>
                  {d.message}
                </button>
              ) : (
                <span className="sm-drift__item is-plain">{d.message}</span>
              )}
            </li>
          ))}
          {map.drift.length === 0 &&
            map.nodes
              .filter((n) => !n.documented)
              .map((n) => (
                <li key={n.id}>
                  <button type="button" className="sm-drift__item" onClick={() => onSelect(n.id)}>
                    {n.name} is not in the docs.
                  </button>
                </li>
              ))}
        </ul>
      )}
    </div>
  );
}

export function MapView({ map, failed }: { map: ArchitectureMap; failed: boolean }) {
  const [view, setView] = useState<View>("diagram");
  const [filter, setFilter] = useState<MapFilter>({ group: ALL, kind: ALL });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visible = useMemo(() => filterMap(map, filter), [map, filter]);
  const groups = useMemo(() => groupsOf(map), [map]);
  const kinds = useMemo(() => kindsOf(map), [map]);
  const selected = map.nodes.find((n) => n.id === selectedId) ?? null;
  const failedSources = map.sources.filter((s) => !s.ok);

  // Esc closes the panel first (the shell's Esc, back to Commons, comes next).
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setSelectedId(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [selectedId]);

  const select = (id: string | null) => {
    if (id && !visible.nodes.some((n) => n.id === id)) setFilter({ group: ALL, kind: ALL });
    setSelectedId(id);
  };

  return (
    <div className="sm">
      <Freshness map={map} failed={failed} />

      <div className="sm-toolbar">
        <div className="sm-toggle" role="group" aria-label="View">
          {(["diagram", "list"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              className={cx("sm-toggle__btn", view === v && "is-on")}
              aria-pressed={view === v}
              onClick={() => setView(v)}
            >
              {v === "diagram" ? "Diagram" : "List"}
            </button>
          ))}
        </div>
        <Drift map={map} onSelect={select} />
      </div>

      <div className="sm-filters">
        {groups.length > 0 && (
          <Field label="Project">
            <Select
              value={filter.group}
              onChange={(e) => setFilter((f) => ({ ...f, group: e.target.value }))}
            >
              <option value={ALL}>All projects</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Kind">
          <Select value={filter.kind} onChange={(e) => setFilter((f) => ({ ...f, kind: e.target.value }))}>
            <option value={ALL}>All kinds</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className={cx("sm-body", selected && "has-panel")}>
        <div className="sm-main">
          {visible.nodes.length === 0 ? (
            <p className="sm-note">Nothing matches these filters.</p>
          ) : view === "diagram" ? (
            <Diagram
              layers={map.layers}
              nodes={visible.nodes}
              edges={visible.edges}
              selectedId={selectedId}
              onSelect={select}
            />
          ) : (
            <ListView layers={map.layers} nodes={visible.nodes} selectedId={selectedId} onSelect={select} />
          )}
          {view === "diagram" && (
            <p className="sm-legend">
              Tap a box for its details. A dashed outline means it is not in the docs yet.
            </p>
          )}
        </div>
        {selected && <DetailPanel map={map} node={selected} onSelect={select} />}
      </div>

      {failedSources.length > 0 && (
        <p className="sm-note" data-testid="sm-sources">
          Couldn't read{" "}
          {failedSources.map((s, i) => (
            <span key={s.name}>
              {i > 0 && ", "}
              {s.name}
              {s.error ? ` (${s.error})` : ""}
            </span>
          ))}
          ; those parts may be out of date.
        </p>
      )}
    </div>
  );
}

function Loader() {
  const { map, error, loading, refresh } = useArchitecture();
  if (map) return <MapView map={map} failed={error !== null} />;
  if (error !== null) {
    return (
      <div className="sm-empty" role="status" data-testid="sm-error">
        <p>{describeMapError(error)}</p>
        <Button variant="secondary" onClick={refresh} disabled={loading}>
          Try again
        </Button>
      </div>
    );
  }
  return (
    <p className="loading" role="status">
      Loading the map…
    </p>
  );
}

export default function ServerMapApp() {
  return (
    <NeedsApi base={API_BASE}>
      <Loader />
    </NeedsApi>
  );
}
