import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { AppRoutes } from "./shell/AppRoutes";
import { ProfileProvider } from "./profiles/useProfile";
import { isPrivateSite } from "./site";
import "./styles/tokens-fonts.css";
import "./styles/tokens.css";
import "./styles/base.css";

// The private (tailnet-only) build says so in the tab title too.
if (isPrivateSite()) document.title = "Commons (private)";

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
