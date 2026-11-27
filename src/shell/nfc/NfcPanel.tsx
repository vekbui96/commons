import { useSearchParams } from "react-router-dom";
import { checkReachable } from "@/api/client";
import { Button } from "@/ui";
import { loadNfc } from "./module";
import {
  NFC_API_BASE,
  NFC_PRIVATE_LOADER_PATH,
  NFC_SESSION_PATH,
  NFC_TIMEOUT_MS,
  standaloneUrl,
} from "./privateConfig";
import { useNfcMount } from "./useNfcMount";
import "./nfc.css";

/**
 * The "NFC controls" tab (private build only): the <nfc-controls> editor,
 * loaded live from the nfc-controls private build on this origin
 * (`/nfc/embed/v1.js`, served from D:\services\nfc-web). It edits tags through
 * the commons-api app `/api/apps/nfc-controls/`; those requests are the
 * element's own (outside the src/api/client.ts rule, like the Ops tab). The
 * host's reachability check does use client.ts. `#/tab/nfc?tag=<id>` opens one tag.
 */

const loadPrivateNfc = () => loadNfc(NFC_PRIVATE_LOADER_PATH);
const apiReachable = () => checkReachable();

export interface NfcPanelViewProps {
  load?: () => Promise<unknown>;
  check?: (signal: AbortSignal) => Promise<boolean>;
  timeoutMs?: number;
  tagId?: string | null;
}

export function NfcPanelView({
  load = loadPrivateNfc,
  check = apiReachable,
  timeoutMs = NFC_TIMEOUT_MS,
  tagId = null,
}: NfcPanelViewProps) {
  const { hostRef, status, retry } = useNfcMount({
    load,
    check,
    timeoutMs,
    mountKey: tagId ?? "",
    options: {
      mode: "editor",
      source: "private",
      ...(tagId ? { tagId } : {}),
      apiBase: NFC_API_BASE,
      sessionUrl: NFC_SESSION_PATH,
    },
  });

  return (
    <div className="nfc-panel">
      {status === "loading" && <PanelSkeleton />}
      {status === "unreachable" && <PanelNotice message="NFC controls isn't answering." onRetry={retry} />}
      {status === "crashed" && <PanelNotice message="Something went wrong in this tab." onRetry={retry} />}
      <div ref={hostRef} className="nfc-panel__host" hidden={status !== "mounted"} data-testid="nfc-host" />
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="nfc-panel-skeleton" role="status">
      <span className="visually-hidden">Loading NFC controls…</span>
      <div className="nfc-skeleton__line nfc-skeleton__line--name" aria-hidden="true" />
      <div className="nfc-panel-skeleton__row" aria-hidden="true" />
      <div className="nfc-panel-skeleton__row" aria-hidden="true" />
      <div className="nfc-panel-skeleton__row" aria-hidden="true" />
    </div>
  );
}

function PanelNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="nfc-notice">
      <p className="nfc-notice__text">{message}</p>
      <div className="nfc-notice__actions">
        <Button variant="secondary" onClick={onRetry}>
          Retry
        </Button>
        <a className="nfc-notice__link" href={standaloneUrl()}>
          Open NFC controls on its own
        </a>
      </div>
    </div>
  );
}

export default function NfcPanel() {
  const [params] = useSearchParams();
  const tag = params.get("tag");
  return <NfcPanelView tagId={tag && /^[a-z0-9-]{1,32}$/.test(tag) ? tag : null} />;
}
