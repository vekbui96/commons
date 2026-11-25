import { ApiError } from "@/api/client";

/** A plain sentence for why /api/session did not name you. Never alarming. */
export function describeSessionError(err: unknown): string {
  const code = err instanceof ApiError ? err.code : undefined;
  switch (code) {
    case "self_request":
      return "Opened from server-pc itself. Open it from another device on the tailnet to see your identity.";
    case "identity_not_ready":
      return "The API is still reading the tailnet owner. Try again in a moment.";
    case "not_owner":
      return "Signed in to Tailscale as someone other than the owner.";
    case "identity_required":
    case "not_via_tailscale":
    case "wrong_host":
      return "No Tailscale identity came with this request. Open the private Commons through its tailnet address.";
    default:
      return "Your identity could not be read right now.";
  }
}
