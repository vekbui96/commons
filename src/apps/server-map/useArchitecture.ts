import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE, appApiUrl, getJson } from "@/api/client";
import { parseMap, type ArchitectureMap } from "./map";

/** How often the map is fetched again while the page is open. */
export const REFRESH_MS = 60_000;
/** Focus and visibility changes do not refetch more often than this. */
const MIN_GAP_MS = 5_000;

export interface ArchitectureState {
  map: ArchitectureMap | null;
  /** The last fetch's error (kept alongside an older map if there is one). */
  error: unknown;
  loading: boolean;
  refresh: () => void;
}

/**
 * GET /api/apps/server-map/architecture, again every 60 s and whenever the tab
 * comes back into view. A failed refresh keeps the last good map.
 */
export function useArchitecture(base: string | null = API_BASE): ArchitectureState {
  const [map, setMap] = useState<ArchitectureMap | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const last = useRef(0);
  const live = useRef(true);

  const refresh = useCallback(() => {
    last.current = Date.now();
    setLoading(true);
    getJson<unknown>(appApiUrl("server-map", "architecture", base))
      .then(parseMap)
      .then(
        (value) => {
          if (!live.current) return;
          setMap(value);
          setError(null);
        },
        (err: unknown) => live.current && setError(err),
      )
      .finally(() => live.current && setLoading(false));
  }, [base]);

  useEffect(() => {
    live.current = true;
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState !== "hidden") refresh();
    }, REFRESH_MS);
    const onFocus = () => {
      if (document.visibilityState === "visible" && Date.now() - last.current > MIN_GAP_MS) refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      live.current = false;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  return { map, error, loading, refresh };
}

/** The current time, ticking every `ms` so "N min ago" stays right. */
export function useNow(ms = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}
