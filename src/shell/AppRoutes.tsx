import { Route, Routes } from "react-router-dom";
import { Home } from "./Home";
import { AppHost } from "./AppHost";
import { NotFound } from "./NotFound";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/apps/:id" element={<AppHost />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
