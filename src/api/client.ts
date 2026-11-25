/**
 * The only place the front end talks to the Commons API
 * (vekbui96/commons-api). The contract is docs/api-contract.md, kept identical
 * in both repos.
 *
 * The base URL comes from VITE_COMMONS_API at build time. Unset means there is
 * no backend: hasApi() is false and backend features must stay hidden.
 */

/** GET /api/health response. */
export interface HealthResponse {
  ok: boolean;
  service: "commons";
  db: "ok" | "error";
  schemaVersion: number | null;
  apps: string[];
}

export class ApiUnavailableError extends Error {
  constructor() {
    super("Commons API is not configured (VITE_COMMONS_API is unset)");
    this.name = "ApiUnavailableError";
  }
}

/** Normalises a configured base URL: trimmed, no trailing slash, null when empty. */
export function normaliseBase(raw: string | undefined): string | null {
  const value = raw?.trim().replace(/\/+$/, "");
  return value ? value : null;
}

export const API_BASE: string | null = normaliseBase(import.meta.env.VITE_COMMONS_API);

export function hasApi(base: string | null = API_BASE): boolean {
  return base !== null;
}

function requireBase(base: string | null): string {
  if (base === null) throw new ApiUnavailableError();
  return base;
}

/** URL of a core endpoint, e.g. apiUrl("/api/health"). */
export function apiUrl(path: string, base: string | null = API_BASE): string {
  return `${requireBase(base)}${path.startsWith("/") ? path : `/${path}`}`;
}

/** URL under an app's prefix: /api/apps/<id>/<path>. */
export function appApiUrl(id: string, path = "", base: string | null = API_BASE): string {
  const rest = path.replace(/^\/+/, "");
  return apiUrl(`/api/apps/${encodeURIComponent(id)}/${rest}`, base);
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { Accept: "application/json", ...init?.headers } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return (await res.json()) as T;
}

export function getHealth(base: string | null = API_BASE): Promise<HealthResponse> {
  return getJson<HealthResponse>(apiUrl("/api/health", base));
}
