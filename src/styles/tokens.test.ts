// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { APP_TINTS } from "@/ui/tints";

const css = readFileSync(fileURLToPath(new URL("./tokens.css", import.meta.url)), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** The body of the first `{...}` block after `marker`, braces balanced. */
function blockAfter(marker: string): string {
  const start = css.indexOf(marker);
  if (start < 0) throw new Error(`marker not found: ${marker}`);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`unbalanced block after ${marker}`);
}

function declarations(body: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) map.set(m[1]!, m[2]!.trim());
  return map;
}

// :root appears twice: primitives first, then the light roles.
const firstRoot = css.indexOf(":root {");
const secondRoot = css.indexOf(":root {", firstRoot + 1);
const primitives = declarations(blockAfter(":root {"));
const light = declarations(css.slice(secondRoot).match(/^:root \{([^}]*)\}/)![1]!);
const dark = declarations(blockAfter(':root[data-theme="dark"]'));
const darkSystem = declarations(blockAfter(':root:not([data-theme="light"])'));

function resolve(roles: Map<string, string>, name: string): string {
  let value = roles.get(name) ?? primitives.get(name);
  for (let hops = 0; value?.startsWith("var("); hops++) {
    if (hops > 5) throw new Error(`var loop at ${name}`);
    const ref = value.slice(4, -1).trim();
    value = roles.get(ref) ?? primitives.get(ref);
  }
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${name} does not resolve to a hex colour`);
  return value;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const TEXT = 4.5; // WCAG AA body text
const UI = 3; // WCAG AA UI components, focus rings, large text

const pairs: [fg: string, bg: string, min: number][] = [
  ...["--bg", "--surface", "--surface-2"].flatMap((bg): [string, string, number][] => [
    ["--text", bg, TEXT],
    ["--text-muted", bg, TEXT],
    ["--accent", bg, TEXT],
    ["--accent-hover", bg, TEXT],
    ["--ok", bg, TEXT],
    ["--warn", bg, TEXT],
    ["--danger", bg, TEXT],
    ["--line-strong", bg, UI],
    ["--focus", bg, UI],
  ]),
  ["--accent", "--accent-soft", TEXT],
  ["--on-accent", "--accent", TEXT],
  ["--on-accent", "--accent-hover", TEXT],
  ["--on-danger", "--danger", TEXT],
  ["--on-danger", "--danger-hover", TEXT],
  ["--ok", "--ok-bg", TEXT],
  ["--warn", "--warn-bg", TEXT],
  ["--danger", "--danger-bg", TEXT],
  ...APP_TINTS.map((t): [string, string, number] => [`--tint-${t}-fg`, `--tint-${t}-bg`, TEXT]),
];

describe("design tokens", () => {
  it("dark mode is defined identically for the toggle and for the system setting", () => {
    expect([...darkSystem.entries()]).toEqual([...dark.entries()]);
  });

  it("dark mode redefines every role and nothing but roles", () => {
    expect([...dark.keys()].sort()).toEqual([...light.keys()].sort());
    for (const name of dark.keys()) expect(primitives.has(name), name).toBe(false);
  });

  it("defines both colours of every app tint in light and dark", () => {
    for (const t of APP_TINTS) {
      for (const roles of [light, dark]) {
        expect(roles.has(`--tint-${t}-bg`)).toBe(true);
        expect(roles.has(`--tint-${t}-fg`)).toBe(true);
      }
    }
  });

  describe.each([
    ["light", light],
    ["dark", dark],
  ] as const)("%s mode contrast (WCAG AA)", (_, roles) => {
    it.each(pairs)("%s on %s >= %s:1", (fg, bg, min) => {
      expect(contrast(resolve(roles, fg), resolve(roles, bg))).toBeGreaterThanOrEqual(min);
    });
  });
});
