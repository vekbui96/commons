import { Link } from "react-router-dom";
import { AppShell } from "@/ui";

export function NotFound() {
  return (
    <AppShell title="Not here">
      <p>There is no app at this address.</p>
      <p>
        <Link to="/">Back to Commons</Link>
      </p>
    </AppShell>
  );
}
