// Scoped check for one app: `npm run check:app -- <id>`.
//
// Runs Vitest and ESLint on src/apps/<id>/, plus any shared code under
// src/shell, src/ui, src/registry, src/tabs, src/profiles, src/api or src/styles that the working tree
// changed (vs HEAD, untracked included). The registry test and the style guard
// always run, because they check every app's manifest, CLAUDE.md and CSS.
//
// Fast feedback while working. `npm run verify` (what CI runs) still runs once
// before every commit. Plain Node, no shell: works the same in PowerShell and CI.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const id = process.argv[2];
if (!id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || !existsSync(join("src", "apps", id))) {
  console.error("Usage: npm run check:app -- <id>   (a folder under src/apps/)");
  process.exit(2);
}

const SHARED = /^src\/(shell|ui|registry|tabs|profiles|api|styles)\//;

function git(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

const touched = [
  ...new Set([
    ...git(["diff", "--name-only", "HEAD"]),
    ...git(["ls-files", "--others", "--exclude-standard"]),
  ]),
]
  .map((f) => f.replace(/\\/g, "/"))
  .filter((f) => SHARED.test(f) && existsSync(f));

const appDir = `src/apps/${id}`;
const sharedDirs = [...new Set(touched.map((f) => f.split("/").slice(0, 2).join("/")))];
const testTargets = [appDir, "src/registry/registry.test.ts", "src/styles/guard.test.ts", ...sharedDirs];
const lintTargets = [appDir, ...touched.filter((f) => /\.(ts|tsx|js|mjs)$/.test(f))];

function run(label, bin, args) {
  console.log(`\n> ${label}: ${args.join(" ")}`);
  const result = spawnSync(process.execPath, [bin, ...args], { stdio: "inherit" });
  return result.status === 0;
}

console.log(`check:app ${id}`);
if (touched.length) console.log(`shared files touched: ${touched.join(", ")}`);

const lintOk = run("eslint", join("node_modules", "eslint", "bin", "eslint.js"), lintTargets);
const testOk = run("vitest", join("node_modules", "vitest", "vitest.mjs"), [
  "run",
  "--passWithNoTests",
  ...testTargets,
]);

if (!lintOk || !testOk) {
  console.error(
    `\ncheck:app ${id} FAILED (${[!lintOk && "lint", !testOk && "tests"].filter(Boolean).join(", ")})`,
  );
  process.exit(1);
}
console.log(`\ncheck:app ${id} passed. Run \`npm run verify\` once before committing.`);
