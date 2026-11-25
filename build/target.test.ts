// @vitest-environment node
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EXCLUDE_PLACEHOLDER,
  excludePrivateApps,
  privateAppFolders,
  resolveTarget,
  visibilityFromSource,
} from "./target";

function appsDir(manifests: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "commons-apps-"));
  for (const [folder, source] of Object.entries(manifests)) {
    mkdirSync(join(dir, folder));
    writeFileSync(join(dir, folder, "manifest.ts"), source);
  }
  return dir;
}

const fixture = () =>
  appsDir({
    open: 'export default defineApp({ id: "open", visibility: "public" });',
    secret: "export default defineApp({ id: 'secret', visibility: 'private' });",
    odd: "export default defineApp({ id: 'odd', visibility: someVariable });",
  });

describe("build target", () => {
  it("defaults to public and rejects anything unknown", () => {
    expect(resolveTarget(undefined)).toBe("public");
    expect(resolveTarget("")).toBe("public");
    expect(resolveTarget("Private")).toBe("private");
    expect(() => resolveTarget("staging")).toThrow(/COMMONS_TARGET/);
  });

  it("reads visibility from manifest source", () => {
    expect(visibilityFromSource('visibility: "public",')).toBe("public");
    expect(visibilityFromSource("visibility:'private'")).toBe("private");
    expect(visibilityFromSource("visibility: v")).toBeUndefined();
  });

  it("treats anything not plainly public as private (fails closed)", () => {
    expect(privateAppFolders(fixture())).toEqual(["odd", "secret"]);
  });

  it("swaps the registry placeholder for one negative glob per private app, public only", () => {
    const dir = fixture();
    const code = `glob(["../apps/*/manifest.ts", ${EXCLUDE_PLACEHOLDER}]); glob(["../apps/*/App.tsx", ${EXCLUDE_PLACEHOLDER}]);`;
    const id = "/x/src/registry/registry.ts";
    const run = (target: "public" | "private") => {
      const plugin = excludePrivateApps(target, dir);
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
    };
    const out = run("public");
    expect(out?.code).not.toContain("__private_apps_excluded__");
    expect(out?.code.match(/"!\.\.\/apps\/secret\/\*\*"/g)).toHaveLength(2);
    expect(out?.code.match(/"!\.\.\/apps\/odd\/\*\*"/g)).toHaveLength(2);
    expect(run("private")).toBeNull();
  });
});
