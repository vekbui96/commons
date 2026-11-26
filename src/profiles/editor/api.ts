/**
 * The profiles editor's calls to the Commons API (`/api/apps/profiles/`, the
 * `profiles` section of docs/api-contract.md). Every request goes through
 * src/api/client.ts; this file only names the endpoints and reads the errors.
 */
import { API_BASE, ApiError, appApiUrl, getJson, sendJson } from "@/api/client";
import type { Profile } from "../types";

const APP = "profiles";

/** GET /profiles, and the answer to every successful edit. */
export interface DraftState {
  ok: true;
  revision: number;
  updatedAt: string;
  /** The draft differs from what was last published. */
  dirty: boolean;
  guest: { apps: string[] };
  profiles: Profile[];
}

/** PUT /profiles/:id body. */
export interface ProfileInput {
  name: string;
  aliases: string[];
  inheritsGuest: boolean;
  apps: string[];
}

/** GET /publish (POST /publish adds `unchanged`). */
export interface PublishStatus {
  ok: true;
  /** The server has a GitHub token. False: POST /publish answers 503; offer the export instead. */
  configured: boolean;
  repo: string | null;
  url: string | null;
  revision: number;
  dirty: boolean;
  lastPublished: { revision: number; publishedAt: string; commitSha: string | null } | null;
  lastAttemptAt?: string | null;
  lastError: { error: string; status?: number; at: string } | null;
  unchanged?: boolean;
}

export function getDraft(base: string | null = API_BASE): Promise<DraftState> {
  return getJson<DraftState>(appApiUrl(APP, "profiles", base));
}

export function saveProfile(id: string, input: ProfileInput, base: string | null = API_BASE) {
  return sendJson<DraftState>(appApiUrl(APP, `profiles/${encodeURIComponent(id)}`, base), "PUT", input, base);
}

export function deleteProfile(id: string, base: string | null = API_BASE) {
  return sendJson<DraftState>(
    appApiUrl(APP, `profiles/${encodeURIComponent(id)}`, base),
    "DELETE",
    undefined,
    base,
  );
}

export function saveGuest(apps: string[], base: string | null = API_BASE) {
  return sendJson<DraftState>(appApiUrl(APP, "guest", base), "PUT", { apps }, base);
}

export function getPublishStatus(base: string | null = API_BASE): Promise<PublishStatus> {
  return getJson<PublishStatus>(appApiUrl(APP, "publish", base));
}

/** Publishes only if `revision` is still the draft's (what the editor shows). */
export function publish(revision: number, base: string | null = API_BASE) {
  return sendJson<PublishStatus>(appApiUrl(APP, "publish", base), "POST", { revision }, base);
}

/** GET /export: the exact file a publish would write, as a download. */
export function exportUrl(base: string | null = API_BASE): string {
  return appApiUrl(APP, "export", base);
}

/** The public site's link that picks a profile. */
export const PUBLIC_SITE = "https://vekbui96.github.io/commons/";

export function profileLink(id: string): string {
  return `${PUBLIC_SITE}?profile=${encodeURIComponent(id)}`;
}

/** "Mary Ann" -> "mary-ann": a suggested id for a new profile. */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/, "");
}

/** The API's `problems[]` for a rejected edit (empty when the error is not that). */
export function problemsOf(error: unknown): string[] {
  if (!(error instanceof ApiError)) return [];
  const { problems } = error.body;
  return Array.isArray(problems) ? problems.filter((p): p is string => typeof p === "string") : [];
}

const GITHUB_REASONS: Record<string, string> = {
  github_unauthorized: "GitHub rejected the token.",
  github_forbidden: "The token can't write to the repo, or GitHub is rate limiting.",
  github_not_found: "GitHub can't find the repo or branch with this token.",
  github_conflict: "GitHub reported a conflict twice in a row.",
  github_unreachable: "GitHub didn't answer in time.",
  github_error: "GitHub returned an error.",
};

/** Plain words for a GitHub failure reason (`publish_failed.reason`, `lastError.error`). */
export function describeReason(reason: unknown, status?: unknown): string {
  const text = (typeof reason === "string" && GITHUB_REASONS[reason]) || "GitHub refused the change.";
  return typeof status === "number" ? `${text} (HTTP ${status})` : text;
}

/** Plain words for an error loading or saving (not the field problems). */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "self_request":
        return "The API doesn't take requests from server-pc itself. Open this from your phone or laptop.";
      case "not_owner":
        return "You're signed in to Tailscale as someone other than the owner.";
      case "identity_required":
        return "No Tailscale identity came with the request.";
      case "identity_not_ready":
        return "The API is still starting. Try again in a moment.";
      case "profile_not_found":
        return "That profile is already gone. Reload to see the latest.";
      case "guest_reserved":
        return "“guest” is reserved for the guest view.";
    }
    return `The API answered ${error.status}${error.code ? ` (${error.code})` : ""}.`;
  }
  return "Couldn't reach the API.";
}
