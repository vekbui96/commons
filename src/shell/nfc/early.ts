import { NFC_GATEWAY } from "./config";
import { isNfcModule } from "./module";
import { loadPublicNfcEarly } from "./publicModule";
import { parseTagHash, takeTagKey } from "./tagKey";

/**
 * Called by main.tsx before React renders, on the public build with a
 * gateway only: when the page opened on a tag link, take the key out of the
 * address bar and start the loader, the route chunk and the tag read in
 * parallel with React's boot (a cold load from a tag tap on cellular).
 */
export function startNfcEarly(win: Window = window): void {
  const route = parseTagHash(win.location.hash);
  if (!route || !NFC_GATEWAY) return;
  const key = takeTagKey(route.id, win);
  void import("./NfcRunnerRoute");
  void loadPublicNfcEarly().then(
    (mod) => {
      if (key && isNfcModule(mod)) mod.preload?.({ tagId: route.id, tagKey: key, apiBase: NFC_GATEWAY });
    },
    () => {
      // the route shows "can't be reached" and offers Try again
    },
  );
}
