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

// NFC controls (src/shell/nfc/, docs/nfc-controls-contract.md). The editor tab
// and its private paths belong to the private build only.
const nfcPrivate = [
  { what: "NFC editor panel (shell/nfc/NfcPanel)", needles: ["shell/nfc/NfcPanel"] },
  { what: "NFC private loader path (/nfc/embed/)", needles: ["/nfc/embed/"] },
  { what: "NFC private API path (/api/apps/nfc-controls)", needles: ["/api/apps/nfc-controls"] },
];

const items = [...privateApps, ...privateTabs, ...opsHub, ...nfcPrivate];
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

// Public NFC tags: the runner route exists in the public build only when it was
// built with VITE_NFC_GATEWAY (read here from the same env). That gateway's exact
// origin is the ONE tailnet-named host allowed in the public bundle; no wildcard.
const gateway = (process.env.VITE_NFC_GATEWAY ?? "").trim();
let gatewayOrigin = "";
if (gateway) {
  try {
    const url = new URL(gateway);
    if (url.protocol !== "https:") throw new Error("not https");
    gatewayOrigin = url.origin;
  } catch {
    problems.push(`VITE_NFC_GATEWAY is not an https URL: ${JSON.stringify(gateway)}`);
  }
}
const runnerHits = contents
  .filter(({ text }) => text.includes("shell/nfc/NfcRunnerRoute"))
  .map(({ file }) => file);
const publicLoaderHits = contents
  .filter(({ text }) => text.includes("/nfc-controls/embed/v1.js"))
  .map(({ file }) => file);
if (target === "public" && gateway) {
  if (runnerHits.length === 0) problems.push("VITE_NFC_GATEWAY is set but the #/t/ runner route is missing");
  if (publicLoaderHits.length === 0)
    problems.push("VITE_NFC_GATEWAY is set but the public NFC loader path is missing");
} else if (runnerHits.length + publicLoaderHits.length > 0) {
  problems.push(
    `the public NFC runner is in a build without a gateway (or in the private build):\n  ${[...runnerHits, ...publicLoaderHits].join("\n  ")}`,
  );
}

// Public only: no tailnet host (except that exact gateway origin), no hub
// dashboard port and no private Commons port anywhere in dist/.
if (target === "public") {
  for (const [label, pattern] of [
    ["a tailnet host (.ts.net)", /\.ts\.net/],
    ["the ops hub port (:8444)", /:8444\b/],
    ["the private Commons port (:8445)", /:8445\b/],
  ]) {
    const hits = contents
      .filter(({ text }) => pattern.test(gatewayOrigin ? text.split(gatewayOrigin).join("") : text))
      .map(({ file }) => file);
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
