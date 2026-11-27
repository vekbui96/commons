import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { Home } from "./Home";
import { AppHost } from "./AppHost";
import { NotFound } from "./NotFound";

// Public NFC tags (#/t/<id>?k=<key>): public build only, and only when the
// build has a gateway (VITE_NFC_GATEWAY). Both are build-time literals, so
// otherwise the route and its chunk are not in the bundle at all.
const NfcRunnerRoute =
  import.meta.env.COMMONS_TARGET === "public" && import.meta.env.VITE_NFC_GATEWAY
    ? lazy(() => import("./nfc/NfcRunnerRoute"))
    : null;

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/tab/:tabId" element={<Home />} />
      <Route path="/apps/:id" element={<AppHost />} />
      {NfcRunnerRoute && (
        <Route
          path="/t/:tagId"
          element={
            <Suspense fallback={null}>
              <NfcRunnerRoute />
            </Suspense>
          }
        />
      )}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
