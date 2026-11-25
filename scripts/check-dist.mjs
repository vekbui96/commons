// @ts-check
/**
 * Checks a built dist/ against its target (build/target.ts):
 *
 *   node scripts/check-dist.mjs public    no private app's id or name anywhere in dist/
 *   node scripts/check-dist.mjs private   every private app is in dist/ (the switch works)
 *
 * CI and the Pages deploy run the public check after `npm run build`;
 * scripts/deploy-private.ps1 runs the private one before copying.
 * Needs Node 22.18+ (imports build/target.ts with native type stripping).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { privateAppFolders, resolveTarget } from "../build/target.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST = join(ROOT, "dist");
const APPS = join(ROOT, "src", "apps");
const target = resolveTarget(process.argv[2]);

/** @param {string} dir @returns {string[]} */
function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const distFiles = files(DIST).filter((f) => /\.(html|js|css|map|json|txt|svg)$/.test(f));
const contents = distFiles.map((f) => ({ file: relative(ROOT, f), text: readFileSync(f, "utf8") }));

const privateApps = privateAppFolders(APPS).map((folder) => {
  const source = readFileSync(join(APPS, folder, "manifest.ts"), "utf8");
  const name = /\bname\s*:\s*"([^"]+)"/.exec(source)?.[1];
  return { folder, needles: [`apps/${folder}/`, `"${folder}"`, ...(name ? [name] : [])] };
});

if (privateApps.length === 0) {
  console.log(`check-dist (${target}): no private apps in src/apps; nothing to check.`);
  process.exit(0);
}

const problems = [];
for (const app of privateApps) {
  const hits = contents.flatMap(({ file, text }) =>
    app.needles.filter((needle) => text.includes(needle)).map((needle) => `${file} contains ${needle}`),
  );
  if (target === "public" && hits.length > 0) {
    problems.push(`private app "${app.folder}" leaked into the public build:\n  ${hits.join("\n  ")}`);
  }
  if (target === "private" && hits.length === 0) {
    problems.push(`private app "${app.folder}" is missing from the private build`);
  }
}

if (problems.length > 0) {
  console.error(`check-dist (${target}) FAILED\n${problems.join("\n")}`);
  process.exit(1);
}
const ids = privateApps.map((a) => a.folder).join(", ");
console.log(
  target === "public"
    ? `check-dist (public): ${distFiles.length} files, no trace of private apps (${ids}).`
    : `check-dist (private): private apps present (${ids}).`,
);
