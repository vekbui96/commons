import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { AppRoutes } from "./shell/AppRoutes";
import "./styles/tokens.css";
import "./styles/base.css";

// Hash routing so deep links (#/apps/units) work on GitHub Pages without a
// server-side fallback.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppRoutes />
    </HashRouter>
  </StrictMode>,
);
