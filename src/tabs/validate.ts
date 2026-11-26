import type { RegisteredApp } from "@/registry/registry";
import { TAB_ICONS } from "./icons";
import type { TabDefinition } from "./types";

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PRIVATE_HOST = /\.ts\.net$|^localhost$|^127\.|^10\.|^192\.168\./;

/** Whether a link tab's url is allowed: https (not a tailnet/LAN host), `#/...` or a same-origin `/path`. */
export function isAllowedTabUrl(url: string): boolean {
  if (url.startsWith("#/")) return true;
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !PRIVATE_HOST.test(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Checks one tab definition. `file` is its file name (without .ts); `apps` is
 * every app in the registry (tests see all of them). Returns problems, empty
 * when valid.
 */
export function validateTab(tab: unknown, file: string, apps: readonly RegisteredApp[]): string[] {
  const where = `tabs/defs/${file}.ts`;
  if (typeof tab !== "object" || tab === null) return [`${where}: must default-export a tab definition`];
  const t = tab as Partial<TabDefinition> & Record<string, unknown>;
  const errors: string[] = [];

  if (typeof t.id !== "string" || !ID_PATTERN.test(t.id)) {
    errors.push(`${where}: id must be kebab-case (got ${JSON.stringify(t.id)})`);
  } else if (t.id !== file) {
    errors.push(`${where}: id "${t.id}" must match its file name "${file}"`);
  }
  if (typeof t.label !== "string" || t.label.trim() === "" || t.label.length > 24) {
    errors.push(`${where}: label must be 1-24 characters`);
  }
  if (typeof t.icon !== "string" || !(TAB_ICONS as string[]).includes(t.icon)) {
    errors.push(`${where}: icon must be one of ${TAB_ICONS.join(", ")}`);
  }
  if (t.visibility !== "public" && t.visibility !== "private") {
    errors.push(`${where}: visibility must be "public" or "private"`);
  }
  if (typeof t.order !== "number" || !Number.isFinite(t.order)) {
    errors.push(`${where}: order must be a number`);
  }

  if (t.kind === "apps") {
    const shows = (t.filter as { appVisibility?: unknown } | undefined)?.appVisibility;
    if (shows !== "public" && shows !== "private") {
      errors.push(`${where}: filter.appVisibility must be "public" or "private"`);
    } else if (shows === "private" && t.visibility === "public") {
      errors.push(`${where}: a public tab cannot list private apps`);
    }
  } else if (t.kind === "link") {
    if (typeof t.url !== "string" || !isAllowedTabUrl(t.url)) {
      errors.push(
        `${where}: url must be https (not a tailnet or LAN host), "#/..." or a same-origin "/path"`,
      );
    }
  } else if (t.kind === "page") {
    const app = apps.find((a) => a.manifest.id === t.app);
    if (!app || app.manifest.kind !== "internal" || !app.load) {
      errors.push(`${where}: app must be the id of an internal app (got ${JSON.stringify(t.app)})`);
    } else if (app.manifest.visibility === "private" && t.visibility === "public") {
      errors.push(`${where}: a public tab cannot show the private app "${app.manifest.id}"`);
    }
  } else {
    errors.push(`${where}: kind must be "apps", "link" or "page"`);
  }
  return errors;
}
