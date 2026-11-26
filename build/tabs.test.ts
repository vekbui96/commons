// @vitest-environment node
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TAB_EXCLUDE_PLACEHOLDER, excludePrivateTabs, privateTabIds } from "./target";

function defsDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "commons-tabs-"));
  for (const [name, source] of Object.entries(files)) writeFileSync(join(dir, name), source);
  return dir;
}

const fixture = () =>
  defsDir({
    "open.ts":
      'export default defineTab({ id: "open", filter: { appVisibility: "public" }, visibility: "public" });',
    "secret.ts":
      "export default defineTab({ id: 'secret', filter: { appVisibility: 'private' }, visibility: 'private' });",
    "odd.ts": "export default defineTab({ id: 'odd', visibility: someVariable });",
    "twice.ts": 'export default defineTab({ visibility: "public", nested: { visibility: "private" } });',
    "notes.md": "visibility: private",
    "open.test.ts": 'visibility: "private"',
  });

function run(target: "public" | "private", dir: string, code: string, id = "/x/src/tabs/registry.ts") {
  const plugin = excludePrivateTabs(target, dir);
  const transform = plugin.transform as (this: unknown, code: string, id: string) => unknown;
  return transform.call(
    {
      error: (m: string) => {
        throw new Error(m);
      },
    },
    code,
    id,
  ) as { code: string } | null;
}

describe("private tab exclusion", () => {
  it("treats tab files not plainly public as private (fails closed), ignoring tests and non-ts files", () => {
    expect(privateTabIds(fixture())).toEqual(["odd", "secret", "twice"]);
  });

  it("does not read appVisibility as the tab's visibility", () => {
    expect(privateTabIds(fixture())).not.toContain("open");
  });

  it("swaps the tabs registry placeholder for one negative glob per private tab, public only", () => {
    const dir = fixture();
    const code = `glob(["./defs/*.ts", ${TAB_EXCLUDE_PLACEHOLDER}]);`;
    const out = run("public", dir, code);
    expect(out?.code).not.toContain("__private_tabs_excluded__");
    expect(out?.code).toContain('"!./defs/secret.ts"');
    expect(out?.code).toContain('"!./defs/odd.ts"');
    expect(out?.code).not.toContain('"!./defs/open.ts"');
    expect(run("private", dir, code)).toBeNull();
  });

  it("leaves other files alone and fails loudly if the placeholder goes missing", () => {
    const dir = fixture();
    expect(run("public", dir, "anything", "/x/src/registry/registry.ts")).toBeNull();
    expect(() => run("public", dir, 'glob(["./defs/*.ts"])')).toThrow(/placeholder/);
  });

  it("matches the placeholder in src/tabs/registry.ts", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(join(process.cwd(), "src", "tabs", "registry.ts"), "utf8");
    expect(source).toContain(TAB_EXCLUDE_PLACEHOLDER);
  });

  it("excludes the real Private and Profiles tabs and keeps the Public one", () => {
    const ids = privateTabIds(join(process.cwd(), "src", "tabs", "defs"));
    expect(ids).toContain("private");
    expect(ids).toContain("profiles");
    expect(ids).not.toContain("public");
  });
});
