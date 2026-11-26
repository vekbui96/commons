import type { RegisteredApp } from "@/registry/registry";

/**
 * Name/description text match for apps. The homepage's filter box is gone for
 * now (the top bar has the "Commons" pill instead); this stays for the future
 * search, which will also own the "/" shortcut.
 */
export function matchesQuery(app: RegisteredApp, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const { name, description } = app.manifest;
  return name.toLowerCase().includes(q) || description.toLowerCase().includes(q);
}
