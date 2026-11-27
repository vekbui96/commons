import { NFC_PUBLIC_LOADER_PATH } from "./config";
import { loadNfc } from "./module";

/** The public runner's loader (shared by the early start and the route). */
export const loadPublicNfcEarly = () => loadNfc(NFC_PUBLIC_LOADER_PATH);
