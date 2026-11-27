import { defineTab } from "../types";

// NFC controls: the <nfc-controls> editor, mounted live from the nfc-controls
// private build on this origin (src/shell/nfc/, docs/nfc-controls-contract.md).
// `#/tab/nfc?tag=<id>` opens one tag.
export default defineTab({
  id: "nfc",
  label: "NFC controls",
  icon: "nfc",
  kind: "panel",
  load: () => import("@/shell/nfc/NfcPanel"),
  order: 35,
  visibility: "private",
});
