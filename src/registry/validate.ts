import { APP_TINTS, isAppTint } from "@/ui/tints";
import type { AppManifest } from "./types";

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Checks one manifest against the registry rules. Returns a list of problems
 * (empty when valid). `folder` is the directory the manifest was found in.
 */
export function validateManifest(manifest: unknown, folder: string, hasComponent: boolean): string[] {
  const errors: string[] = [];
  const where = `apps/${folder}`;
  if (typeof manifest !== "object" || manifest === null) {
    return [`${where}: manifest.ts must default-export a manifest object`];
  }
  const m = manifest as Partial<AppManifest> & Record<string, unknown>;

  if (typeof m.id !== "string" || !ID_PATTERN.test(m.id)) {
    errors.push(`${where}: id must be kebab-case (got ${JSON.stringify(m.id)})`);
  } else if (m.id !== folder) {
    errors.push(`${where}: id "${m.id}" must match its folder name "${folder}"`);
  }
  if (typeof m.name !== "string" || m.name.trim() === "" || m.name.length > 40) {
    errors.push(`${where}: name must be 1-40 characters`);
  }
  if (
    typeof m.description !== "string" ||
    m.description.trim() === "" ||
    m.description.length > 120 ||
    /\n/.test(m.description)
  ) {
    errors.push(`${where}: description must be a single line of 1-120 characters`);
  }
  if (typeof m.icon !== "string" || m.icon.trim() === "" || [...m.icon].length > 2) {
    errors.push(`${where}: icon must be one or two characters`);
  }
  if (m.tint !== undefined && !isAppTint(m.tint)) {
    errors.push(`${where}: tint must be one of ${APP_TINTS.join(", ")}`);
  }
  if (m.visibility !== "public" && m.visibility !== "private") {
    errors.push(`${where}: visibility must be "public" or "private"`);
  }

  if (m.kind === "external") {
    let url: URL | null = null;
    try {
      url = typeof m.url === "string" ? new URL(m.url) : null;
    } catch {
      url = null;
    }
    if (!url || url.protocol !== "https:") {
      errors.push(`${where}: external apps need an absolute https url`);
    }
    if (hasComponent) {
      errors.push(`${where}: external apps must not have an App.tsx`);
    }
  } else if (m.kind === "internal") {
    if ("wide" in m && typeof m.wide !== "boolean") {
      errors.push(`${where}: wide must be true or false`);
    }
    if ("url" in m) {
      errors.push(`${where}: internal apps must not set url`);
    }
    if (!hasComponent) {
      errors.push(`${where}: internal apps need an App.tsx with a default-exported component`);
    }
  } else {
    errors.push(`${where}: kind must be "internal" or "external"`);
  }
  return errors;
}

/** Ids that appear more than once. */
export function duplicateIds(manifests: readonly { id: string }[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const { id } of manifests) {
    if (seen.has(id)) dupes.add(id);
    seen.add(id);
  }
  return [...dupes];
}
