// @ts-check
/**
 * Checks a built dist/ against its target (build/target.ts):
 *
 *   node scripts/check-dist.mjs public    no private app's id or name, and no private
 *                                         tab definition, anywhere in dist/
 *   node scripts/check-dist.mjs private   every private app and tab is in dist/ (the switch works)
 *
 * CI and the Pages deploy run the public check after `npm run build`;
 * scripts/deploy-private.ps1 runs the private one before copying.
 * Needs Node 22.18+ (imports build/target.ts with native type stripping).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { privateAppFolders, privateTabIds, resolveTarget } from "../build/target.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST = join(ROOT, "dist");
const APPS = join(ROOT, "src", "apps");
const TAB_DEFS = join(ROOT, "src", "tabs", "defs");
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
  return { what: `app "${folder}"`, needles: [`apps/${folder}/`, `"${folder}"`, ...(name ? [name] : [])] };
});

// A tab's id and label are ordinary words ("private", "Private") that appear in
// any bundle, so tabs are found by their file: the registry glob key
// ("./defs/<id>.ts") and the sourcemap path both contain "defs/<id>.ts".
const privateTabs = privateTabIds(TAB_DEFS).map((id) => ({
  what: `tab "${id}"`,
  needles: [`defs/${id}.ts`],
}));

// The Ops tab (src/shell/ops/) mounts the ops hub from paths on the private
// origin. Its module and those paths belong to the private build only.
const opsHub = [
  { what: "Ops panel (shell/ops/OpsPanel)", needles: ["shell/ops/OpsPanel"] },
  { what: "ops hub loader path (/ops/embed/)", needles: ["/ops/embed/"] },
  { what: "ops hub API path (/ops/api)", needles: ["/ops/api"] },
  {
    what: "Ops badge poller (shell/ops/background, fetchCount)",
    needles: ["shell/ops/background", "fetchCount"],
  },
];

const items = [...privateApps, ...privateTabs, ...opsHub];
if (items.length === 0) {
  console.log(`check-dist (${target}): no private apps or tabs in src/; nothing to check.`);
  process.exit(0);
}

const problems = [];
for (const item of items) {
  const hits = contents.flatMap(({ file, text }) =>
    item.needles.filter((needle) => text.includes(needle)).map((needle) => `${file} contains ${needle}`),
  );
  if (target === "public" && hits.length > 0) {
    problems.push(`private ${item.what} leaked into the public build:\n  ${hits.join("\n  ")}`);
  }
  if (target === "private" && hits.length === 0) {
    problems.push(`private ${item.what} is missing from the private build`);
  }
}

// Public only: no tailnet host and no hub dashboard port anywhere in dist/.
if (target === "public") {
  for (const [label, pattern] of [
    ["a tailnet host (.ts.net)", /\.ts\.net/],
    ["the ops hub port (:8444)", /:8444\b/],
  ]) {
    const hits = contents.filter(({ text }) => pattern.test(text)).map(({ file }) => file);
    if (hits.length > 0) problems.push(`${label} in the public build:\n  ${hits.join("\n  ")}`);
  }
}

if (problems.length > 0) {
  console.error(`check-dist (${target}) FAILED\n${problems.join("\n")}`);
  process.exit(1);
}
const names = items.map((i) => i.what).join(", ");
console.log(
  target === "public"
    ? `check-dist (public): ${distFiles.length} files, no trace of private ${names}.`
    : `check-dist (private): present: ${names}.`,
);
