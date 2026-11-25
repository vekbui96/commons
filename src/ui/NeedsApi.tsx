import type { ReactNode } from "react";
import { API_BASE } from "@/api/client";
import { useApi } from "@/api/useApi";

export interface NeedsApiProps {
  /** Rendered once the Commons API answers. */
  children: ReactNode;
  /** Override the API base (tests). */
  base?: string | null;
}

/**
 * Wraps a feature that needs the Commons API. While checking it shows a quiet
 * line; when the API cannot be reached (off the tailnet, or no backend) it says
 * so plainly. It never shows an error: being off Tailscale is normal.
 */
export function NeedsApi({ children, base = API_BASE }: NeedsApiProps) {
  const status = useApi(base);
  if (status === "reachable") return <>{children}</>;
  if (status === "checking") {
    return (
      <p className="ui-needs-api" role="status">
        Checking the connection…
      </p>
    );
  }
  return (
    <p className="ui-needs-api" role="status" data-testid="needs-api">
      Connect to Tailscale to use this.
    </p>
  );
}
