import { useCallback, useEffect, useRef, useState } from "react";
import {
  currentTheme,
  forcedColorsQuery,
  isNfcModule,
  type NfcMountHandle,
  type NfcMountOptions,
} from "./module";

/**
 * Loads <nfc-controls>, mounts it into `hostRef`, passes the theme through,
 * and turns a failed load or a crash into a status (the views show notices).
 * The same shape as the Ops tab's host code, kept separate so a change here
 * can never break Ops (and so the public runner never pulls in Ops code).
 */

export type NfcStatus = "loading" | "mounted" | "unreachable" | "crashed";

export interface UseNfcMountOptions {
  /** Imports the loader module. */
  load: () => Promise<unknown>;
  /** An extra readiness check run alongside the load (the private API). Default: ready. */
  check?: (signal: AbortSignal) => Promise<boolean>;
  timeoutMs: number;
  /** The mount options, minus what the hook fills in (theme, forcedColors, onError, embedded). */
  options: Omit<NfcMountOptions, "theme" | "forcedColors" | "onError" | "embedded">;
  /** Changing this remounts (e.g. a different tag). */
  mountKey: string;
}

export function useNfcMount({ load, check, timeoutMs, options, mountKey }: UseNfcMountOptions) {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<NfcMountHandle | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [status, setStatus] = useState<NfcStatus>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let handle: NfcMountHandle | null = null;
    const abort = new AbortController();
    setStatus("loading");

    void (async () => {
      let mod: unknown;
      let ready = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        [mod, ready] = await Promise.race([
          Promise.all([load(), check ? check(abort.signal) : Promise.resolve(true)]),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error("timed out")), timeoutMs);
          }),
        ]);
      } catch {
        ready = false;
      } finally {
        clearTimeout(timer);
      }
      if (cancelled) return;
      const el = hostRef.current;
      if (!ready || !isNfcModule(mod) || !el) {
        setStatus("unreachable");
        return;
      }
      const crash = (err: unknown) => {
        if (cancelled) return;
        // The error only: never the mount options (they may hold a tag key).
        console.error("nfc-controls:", err instanceof Error ? err.message : "error");
        handle?.unmount();
        handle = null;
        handleRef.current = null;
        setStatus("crashed");
      };
      try {
        handle = mod.mount(el, {
          ...optionsRef.current,
          embedded: true,
          theme: currentTheme(),
          forcedColors: forcedColorsQuery()?.matches ?? false,
          onError: crash,
        });
        handleRef.current = handle;
        setStatus("mounted");
      } catch (err) {
        crash(err);
      }
    })();

    return () => {
      cancelled = true;
      abort.abort();
      handle?.unmount();
      handle = null;
      handleRef.current = null;
    };
  }, [attempt, load, check, timeoutMs, mountKey]);

  // Theme passthrough: custom properties inherit; setTheme covers the rest.
  useEffect(() => {
    if (status !== "mounted") return;
    const root = document.documentElement;
    const query = forcedColorsQuery();
    const push = () => handleRef.current?.setTheme(currentTheme(root), query?.matches ?? false);
    const observer = new MutationObserver(push);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    query?.addEventListener?.("change", push);
    return () => {
      observer.disconnect();
      query?.removeEventListener?.("change", push);
    };
  }, [status]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { hostRef, status, retry };
}
