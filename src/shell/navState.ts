/**
 * Where "← Commons" goes. The homepage opens an app with
 * `state: { from: "/tab/<id>" }`; the app bar returns there. Anything else
 * (a deep link, a reload in a new tab, a hand-made state) goes to `/`, the
 * default tab.
 */
export interface FromTabState {
  from: string;
}

export function fromTab(path: string): FromTabState {
  return { from: path };
}

export function backTarget(state: unknown): string {
  const from = (state as Partial<FromTabState> | null | undefined)?.from;
  if (typeof from === "string" && (from === "/" || /^\/tab\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(from)))
    return from;
  return "/";
}

/** DOM id of a tab chip (the tabpanel is labelled by it). */
export function tabDomId(id: string): string {
  return `home-tab-${id}`;
}
