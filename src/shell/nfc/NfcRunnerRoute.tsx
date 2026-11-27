import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/ui";
import { NFC_FALLBACK, NFC_GATEWAY, NFC_PUBLIC_TIMEOUT_MS } from "./config";
import { loadPublicNfcEarly } from "./publicModule";
import { takeTagKey } from "./tagKey";
import { useNfcMount } from "./useNfcMount";
import "./nfc.css";

/**
 * `#/t/<id>?k=<key>` on the public Commons: a public NFC tag. Full screen (no
 * tab carousel), a thin "← Commons" row, and the <nfc-controls> runner from
 * the nfc-controls Pages site on this same origin. The runner talks only to
 * the public gateway (VITE_NFC_GATEWAY). Nothing runs until the Run tap.
 *
 * Wording here is for anyone who taps a tag: never Tailscale, never "private".
 */

export interface NfcRunnerRouteViewProps {
  tagId: string;
  load?: () => Promise<unknown>;
  gateway?: string;
  fallback?: string;
  timeoutMs?: number;
}

export function NfcRunnerRouteView({
  tagId,
  load = loadPublicNfcEarly,
  gateway = NFC_GATEWAY,
  fallback = NFC_FALLBACK,
  timeoutMs = NFC_PUBLIC_TIMEOUT_MS,
}: NfcRunnerRouteViewProps) {
  const tagKey = useMemo(() => takeTagKey(tagId), [tagId]);
  const { hostRef, status, retry } = useNfcMount({
    load,
    timeoutMs,
    mountKey: `${tagId}\n${tagKey ?? ""}`,
    options: {
      mode: "runner",
      source: "public",
      tagId,
      ...(tagKey ? { tagKey } : {}),
      apiBase: gateway,
      ...(fallback ? { fallbackUrl: fallback } : {}),
    },
  });

  // The element reports the tag's name; it never writes the title itself when embedded.
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const previous = document.title;
    const onTitle = (event: Event) => {
      const title = (event as CustomEvent<{ title?: unknown }>).detail?.title;
      if (typeof title === "string" && title) document.title = `${title} · Commons`;
    };
    el.addEventListener("nfc-controls:title", onTitle);
    return () => {
      el.removeEventListener("nfc-controls:title", onTitle);
      document.title = previous;
    };
  }, [hostRef]);

  return (
    <div className="nfc-route">
      <header className="nfc-route__top">
        <Link to="/" className="ui-topbar__back">
          <span aria-hidden="true">←</span> Commons
        </Link>
      </header>
      <main className="nfc-route__main">
        {status === "loading" && <RunnerSkeleton />}
        {status === "unreachable" && (
          <NfcRouteNotice
            title="This tag can't be reached right now."
            text="Try again in a little while."
            onRetry={retry}
          />
        )}
        {status === "crashed" && <NfcRouteNotice title="Something went wrong." text="" onRetry={retry} />}
        <div ref={hostRef} className="nfc-route__host" hidden={status !== "mounted"} data-testid="nfc-host" />
      </main>
    </div>
  );
}

/** The runner's shape (tag line + big button), so nothing jumps when it mounts. */
export function RunnerSkeleton() {
  return (
    <div className="nfc-skeleton" role="status">
      <span className="visually-hidden">Loading the tag…</span>
      <div aria-hidden="true" className="nfc-skeleton__body">
        <div className="nfc-skeleton__line nfc-skeleton__line--eyebrow" />
        <div className="nfc-skeleton__line nfc-skeleton__line--name" />
        <div className="nfc-skeleton__line nfc-skeleton__line--short" />
      </div>
      <div aria-hidden="true" className="nfc-skeleton__button" />
    </div>
  );
}

function NfcRouteNotice({ title, text, onRetry }: { title: string; text: string; onRetry: () => void }) {
  return (
    <div className="nfc-notice nfc-notice--full">
      <div className="nfc-notice__body">
        <h1 className="nfc-notice__title">{title}</h1>
        {text && <p className="nfc-notice__text">{text}</p>}
      </div>
      <Button variant="secondary" className="nfc-notice__retry" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export default function NfcRunnerRoute() {
  const { tagId = "" } = useParams();
  return <NfcRunnerRouteView key={tagId} tagId={tagId} />;
}
