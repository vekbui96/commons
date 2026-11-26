import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/ui";

export interface NotFoundProps {
  /** Replaces "There is no app at this address." (e.g. an app outside the visitor's profile). */
  hint?: ReactNode;
}

export function NotFound({ hint }: NotFoundProps) {
  return (
    <AppShell title="Not here">
      <p>{hint ?? "There is no app at this address."}</p>
      <p>
        <Link to="/">Back to Commons</Link>
      </p>
    </AppShell>
  );
}
