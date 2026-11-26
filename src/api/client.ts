/**
 * The only place the front end talks to the Commons API
 * (vekbui96/commons-api). The contract is docs/api-contract.md, kept identical
 * in both repos.
 *
 * Base URL:
 *   - Private build (tailnet-only, COMMONS_TARGET=private): the same origin, so
 *     calls go to /api/... on the host that served the page.
 *   - Public build (GitHub Pages): VITE_COMMONS_API at build time. Unset (today)
 *     means there is no backend: hasApi() is false and backend features stay hidden.
 *
 * Reachability: having a base is not the same as reaching it (the private API
 * answers only on the tailnet). Use checkReachable() / useApi() and show a quiet
 * "connect to Tailscale" state when it is unreachable, never an error.
 */
import { SITE_TARGET, type SiteTarget } from "@/site";

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

/**
 * The API base for a build. The private build defaults to "" (same origin, so
 * URLs are /api/...); the public build has a backend only when one is configured.
 */
export function resolveApiBase(target: SiteTarget, configured: string | undefined): string | null {
  const base = normaliseBase(configured);
  if (base !== null) return base;
  return target === "private" ? "" : null;
}

export const API_BASE: string | null = resolveApiBase(SITE_TARGET, import.meta.env.VITE_COMMONS_API);

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

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    url: string,
    /** The parsed JSON error body, when there was one (e.g. `problems`, `reason`, `revision`). */
    readonly body: Record<string, unknown> = {},
  ) {
    super(`${status}${code ? ` ${code}` : ""} for ${url}`);
    this.name = "ApiError";
  }
}

async function errorBody(res: Response): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await res.json();
    return typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await errorBody(res);
    throw new ApiError(res.status, typeof body.error === "string" ? body.error : undefined, url, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** How long a health check may take before the API counts as unreachable. */
export const HEALTH_TIMEOUT_MS = 3000;

export interface HealthOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

/** GET /api/health, aborted after a short timeout. */
export async function getHealth(
  base: string | null = API_BASE,
  { timeoutMs = HEALTH_TIMEOUT_MS, signal }: HealthOptions = {},
): Promise<HealthResponse> {
  const url = apiUrl("/api/health", base);
  // Hand-rolled rather than AbortSignal.any/timeout so older phone browsers work.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    return await requestJson<HealthResponse>(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/** Reachability results are reused for this long. */
export const REACHABILITY_TTL_MS = 30_000;

const reachability = new Map<string, { at: number; result: Promise<boolean> }>();

/**
 * Whether the API answers /api/health (any answer from it with `ok: true`).
 * Cached per base for REACHABILITY_TTL_MS so many components can ask at once.
 * Never throws: a timeout, network error, CORS failure or 503 is `false`.
 */
export function checkReachable(base: string | null = API_BASE, now: number = Date.now()): Promise<boolean> {
  if (base === null) return Promise.resolve(false);
  const hit = reachability.get(base);
  if (hit && now - hit.at < REACHABILITY_TTL_MS) return hit.result;
  const result = getHealth(base).then(
    (health) => health.ok === true,
    () => false,
  );
  reachability.set(base, { at: now, result });
  return result;
}

/** Forget cached reachability (tests, or a "try again" button). */
export function resetReachability(): void {
  reachability.clear();
}

/** GET /api/session: who you are on the tailnet, plus the CSRF token for writes. */
export interface SessionResponse {
  ok: true;
  /** Your Tailscale login, from `tailscale serve`. */
  login: string;
  /** Per-boot token; send it as TOKEN_HEADER on every write. */
  csrfToken: string;
}

/** The header writes carry the CSRF token in (docs/api-contract.md). */
export const TOKEN_HEADER = "X-Commons-Token";

let sessionCache: Promise<SessionResponse> | null = null;

/** GET /api/session, cached for the page's life (the token lasts until the API restarts). */
export function getSession(base: string | null = API_BASE, { fresh = false } = {}): Promise<SessionResponse> {
  if (fresh || sessionCache === null) {
    const request = requestJson<SessionResponse>(apiUrl("/api/session", base), { cache: "no-store" });
    // A failed session is not cached, so the next call asks again.
    request.catch(() => {
      if (sessionCache === request) sessionCache = null;
    });
    sessionCache = request;
  }
  return sessionCache;
}

/** Forget the cached session (tests). */
export function resetSession(): void {
  sessionCache = null;
}

/** GET JSON from the API (an app endpoint built with appApiUrl, for example). */
export function getJson<T>(url: string): Promise<T> {
  return requestJson<T>(url, { cache: "no-store" });
}

/**
 * A write (POST/PUT/PATCH/DELETE) with the CSRF token from /api/session. If the
 * API restarted (new token), it fetches a fresh session and retries once.
 */
export async function sendJson<T>(
  url: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
  base: string | null = API_BASE,
): Promise<T> {
  const send = async (fresh: boolean) => {
    const { csrfToken } = await getSession(base, { fresh });
    return requestJson<T>(url, {
      method,
      headers: {
        [TOKEN_HEADER]: csrfToken,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };
  try {
    return await send(false);
  } catch (err) {
    if (err instanceof ApiError && err.code === "csrf_token_invalid") return send(true);
    throw err;
  }
}
