// @ts-check
/**
 * The wall between apps. Each folder under src/apps/ is sealed:
 *
 *   - A file in src/apps/<a>/ may import only from its own folder, src/ui,
 *     src/api, src/styles and the manifest contract src/registry/types.
 *     Never from another app, src/shell or the rest of src/registry.
 *   - Nothing outside src/apps/ may import an app's files. The registry finds
 *     apps with import.meta.glob (not an import statement), which stays allowed.
 *
 * A finished app is reused only as a published runtime embed (a web component
 * at a versioned URL such as embed/v1.js, loaded live), never by importing its
 * source. See CLAUDE.md.
 *
 * Resolves "@/..." (the src alias) and relative specifiers; package imports are
 * ignored.
 */
import path from "node:path";

const SRC = path.resolve(import.meta.dirname, "..", "src");
const APPS = path.join(SRC, "apps");
const APP_ALLOWED = ["ui", "api", "styles"].map((dir) => path.join(SRC, dir));
const MANIFEST_CONTRACT = path.join(SRC, "registry", "types");

/** "src/apps/<id>/..." -> "<id>", otherwise undefined. */
function appOf(file) {
  const rel = path.relative(APPS, file);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) return undefined;
  const [id, ...rest] = rel.split(path.sep);
  return rest.length > 0 ? id : undefined;
}

function isInside(file, dir) {
  const rel = path.relative(dir, file);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function resolveSpecifier(spec, fromFile) {
  if (spec.startsWith("@/")) return path.join(SRC, spec.slice(2));
  if (spec.startsWith("./") || spec.startsWith("../") || spec === "." || spec === "..") {
    return path.resolve(path.dirname(fromFile), spec);
  }
  return undefined;
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: { description: "No source imports between apps, or into apps from outside src/apps/." },
    messages: {
      crossApp:
        "apps/{{from}} may not import from apps/{{to}}. No source imports between apps; reuse a finished app only as a published runtime embed.",
      appOutside:
        "apps/{{from}} may import only its own folder, src/ui, src/api, src/styles and src/registry/types (got {{spec}}).",
      intoApp:
        "Code outside src/apps/ may not import app internals (apps/{{to}}). The registry discovers apps with import.meta.glob.",
    },
    schema: [],
  },
  create(context) {
    const file = path.resolve(context.filename);
    if (!isInside(file, SRC)) return {};
    const fromApp = appOf(file);

    function check(node, spec) {
      if (typeof spec !== "string") return;
      const target = resolveSpecifier(spec, file);
      if (!target) return;
      const toApp = appOf(target);

      if (fromApp === undefined) {
        if (toApp !== undefined) context.report({ node, messageId: "intoApp", data: { to: toApp } });
        return;
      }
      if (toApp === fromApp) return;
      if (toApp !== undefined) {
        context.report({ node, messageId: "crossApp", data: { from: fromApp, to: toApp } });
        return;
      }
      const allowed =
        APP_ALLOWED.some((dir) => isInside(target, dir)) ||
        target === MANIFEST_CONTRACT ||
        target === `${MANIFEST_CONTRACT}.ts`;
      if (!allowed) context.report({ node, messageId: "appOutside", data: { from: fromApp, spec } });
    }

    const fromSource = (node) => check(node.source, node.source?.value);
    return {
      ImportDeclaration: fromSource,
      ExportNamedDeclaration: (node) => node.source && fromSource(node),
      ExportAllDeclaration: fromSource,
      ImportExpression: (node) =>
        node.source.type === "Literal" ? check(node.source, node.source.value) : undefined,
    };
  },
};

export default { rules: { "app-boundaries": rule } };
