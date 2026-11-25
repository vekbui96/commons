// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Style drift guard. Colours and font names live only in src/styles/tokens*.css;
 * everything else uses the semantic roles (var(--accent), var(--font-display) ...).
 *
 * Fails on, outside src/styles/tokens*.css:
 *   - hex colours, and rgb()/rgba()/hsl()/hsla() colour functions
 *   - font-family / fontFamily / font: values other than var(--font-*) or inherit
 *   - font weights below 400
 *
 * Exception: put the comment `style-guard-allow` (with a reason) on the same
 * line or the line directly above. Keep those rare.
 */

const ROOT = process.cwd();
const ALLOW = "style-guard-allow";

const rules: { name: string; pattern: RegExp }[] = [
  { name: "hex colour", pattern: /#[0-9a-fA-F]{3,8}\b/ },
  { name: "colour function", pattern: /\b(?:rgba?|hsla?)\(/ },
  {
    name: "font-family outside tokens",
    pattern: /font-family\s*:\s*(?!\s*(?:var\(--font-[\w-]+\)|inherit)\s*[;}"'\n])/,
  },
  { name: "fontFamily outside tokens", pattern: /fontFamily\s*:/ },
  { name: "font shorthand with a family", pattern: /(?:^|[\s{;])font\s*:\s*(?!\s*inherit\s*[;}"'\n])/ },
  { name: "font weight below 400", pattern: /(?:font-weight|fontWeight)\s*:\s*["']?[1-3]00\b/ },
];

function sourceFiles(): string[] {
  const files = (readdirSync(join(ROOT, "src"), { recursive: true }) as string[])
    .map((f) => join("src", f))
    .filter((f) => /\.(css|ts|tsx)$/.test(f))
    .filter((f) => !/^src[\\/]styles[\\/]tokens[^\\/]*\.css$/.test(f))
    // This file holds deliberate fixtures.
    .filter((f) => !f.endsWith("guard.test.ts"));
  return [...files, "index.html"];
}

function violations(): string[] {
  const found: string[] = [];
  for (const file of sourceFiles()) {
    const lines = readFileSync(join(ROOT, file), "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      if (line.includes(ALLOW) || (i > 0 && lines[i - 1]!.includes(ALLOW))) return;
      for (const { name, pattern } of rules) {
        if (pattern.test(line)) {
          found.push(
            `${relative(ROOT, join(ROOT, file)).split(sep).join("/")}:${i + 1} ${name}: ${line.trim()}`,
          );
        }
      }
    });
  }
  return found;
}

describe("style guard", () => {
  it("keeps colour literals and font names inside src/styles/tokens*.css", () => {
    expect(violations()).toEqual([]);
  });

  it("catches the things it is meant to catch", () => {
    const hit = (s: string) => rules.some(({ pattern }) => pattern.test(s));
    expect(hit("color: #1f4fbf;")).toBe(true);
    expect(hit("background: rgb(0 0 0 / 0.5);")).toBe(true);
    expect(hit("color: hsl(220 70% 40%);")).toBe(true);
    expect(hit('font-family: "Comic Sans MS", sans-serif;')).toBe(true);
    expect(hit("style={{ fontFamily: 'Arial' }}")).toBe(true);
    expect(hit("font: 16px Arial;")).toBe(true);
    expect(hit("font-weight: 300;")).toBe(true);

    expect(hit("font-family: var(--font-display);")).toBe(false);
    expect(hit("font: inherit;")).toBe(false);
    expect(hit("color: var(--accent);")).toBe(false);
    expect(hit('<a href="#/apps/units">')).toBe(false);
    expect(hit("font-weight: var(--weight-semibold);")).toBe(false);
  });
});
