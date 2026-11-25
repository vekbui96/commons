import { useEffect, useState } from "react";
import { API_BASE, checkReachable } from "./client";

/** Whether the Commons API answers right now, from this browser. */
export type ApiStatus = "checking" | "reachable" | "unreachable";

/**
 * Reachability of the Commons API for a component. No configured backend is
 * "unreachable" straight away. The check is shared and cached (checkReachable),
 * so many components can call this without extra requests.
 */
export function useApi(base: string | null = API_BASE): ApiStatus {
  const [status, setStatus] = useState<ApiStatus>(base === null ? "unreachable" : "checking");

  useEffect(() => {
    if (base === null) {
      setStatus("unreachable");
      return;
    }
    let live = true;
    setStatus("checking");
    void checkReachable(base).then((ok) => {
      if (live) setStatus(ok ? "reachable" : "unreachable");
    });
    return () => {
      live = false;
    };
  }, [base]);

  return status;
}
