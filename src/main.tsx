import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { AppRoutes } from "./shell/AppRoutes";
import { ProfileProvider } from "./profiles/useProfile";
import { isPrivateSite } from "./site";
import { startTabBackgrounds } from "./shell/tabBackgrounds";
import "./styles/tokens-fonts.css";
import "./styles/tokens.css";
import "./styles/base.css";

// The private (tailnet-only) build says so in the tab title too.
if (isPrivateSite()) document.title = "Commons (private)";

// Background work of the tabs on this site (private build: the Ops badge).
// Outside React, so StrictMode never starts it twice.
startTabBackgrounds();

// Public NFC tag links (#/t/<id>?k=<key>): strip the key from the address bar
// and start loading the runner before React boots. Build-time literals: the
// import is gone from builds without a gateway and from the private build.
if (import.meta.env.COMMONS_TARGET === "public" && import.meta.env.VITE_NFC_GATEWAY) {
  void import("./shell/nfc/early").then((m) => m.startNfcEarly());
}

// Hash routing so deep links (#/apps/units) work on GitHub Pages without a
// server-side fallback.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {/* Visitor profiles: public build only; the private build ignores them. */}
      <ProfileProvider>
        <AppRoutes />
      </ProfileProvider>
    </HashRouter>
  </StrictMode>,
);
