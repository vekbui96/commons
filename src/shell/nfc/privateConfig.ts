/**
 * NFC controls, private side: the editor tab on the private Commons (:8445).
 * Imported only by NfcPanel (a private tab), so none of this reaches the
 * public bundle (check-dist fails if it does). Paths only, resolved against
 * location.origin: no host is ever written here.
 */

/** The tab's id (src/tabs/defs/nfc.ts). `#/tab/nfc?tag=<id>` opens one tag. */
export const NFC_TAB_ID = "nfc";

/** The editor build's standalone page (`tailscale serve` /nfc -> D:\services\nfc-web). */
export const NFC_PAGE_PATH = "/nfc/";

/** The private build's stable loader. */
export const NFC_PRIVATE_LOADER_PATH = "/nfc/embed/v1.js";

/** The commons-api app the editor talks to, and the session it takes the CSRF token from. */
export const NFC_API_BASE = "/api/apps/nfc-controls/";
export const NFC_SESSION_PATH = "/api/session";

/** Loading the loader and the API check together must finish within this. */
export const NFC_TIMEOUT_MS = 4000;

export function standaloneUrl(base: string = window.location.origin): string {
  return new URL(NFC_PAGE_PATH, base).href;
}
