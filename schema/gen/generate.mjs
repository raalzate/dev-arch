#!/usr/bin/env node
// Generates schema/generated/{types,validators,index}.ts from the contract (FR-017, FR-018) and, since
// 010-modernization-ux (option B), the separate extension module schema/extensions/{types,validators,index}.ts.
// Usage: node gen/generate.mjs [--out <dir>] [--extensions-out <dir>]
//   no option: both modules in place; --out only: the original module only (005 behaviour);
//   --extensions-out: the extension module (into that directory).
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "json-schema-to-typescript";
import { jsonSchemaToZod } from "json-schema-to-zod";
import { format } from "prettier";
import {
  BANNER,
  ENTRIES,
  EXTENSION_ENTRIES,
  EXTENSIONS_DIR,
  PACKAGE_DIR,
  VERSION,
  dereferenceAll,
  flattenAllOf,
  isPureReference,
  readSchema,
} from "./lib.mjs";

/**
 * Loads every entry. Pure-reference roots (MCP responses that are a `$ref` to a document or definition)
 * become aliases of the referenced type instead of duplicated declarations.
 */
async function loadRoots(entries = ENTRIES, aliasTargets = entries) {
  const resolved = await dereferenceAll(entries.map((e) => e.file));
  return entries.map((entry) => {
    const raw = readSchema(entry.file);
    const schema = resolved.get(entry.file);
    if (isPureReference(raw)) {
      const target = aliasTargets.find((e) => raw.$ref.endsWith("/" + e.file) || raw.$ref === "../" + e.file);
      const aliasOf = target ? target.type : raw.$ref.split("/").pop();
      return { ...entry, aliasOf, description: raw.description, schema };
    }
    return { ...entry, schema: flattenAllOf(schema) };
  });
}

/** Collects every titled object definition reachable from the roots, in deterministic (title) order. */
function collectDefinitions(roots) {
  const byTitle = new Map();
  const visit = (node, isRoot) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach((n) => visit(n, false));
    if (node.title && !isRoot && !byTitle.has(node.title)) byTitle.set(node.title, node);
    for (const [key, value] of Object.entries(node)) {
      if (key !== "enum" && key !== "const" && key !== "required") visit(value, false);
    }
  };
  roots.forEach((r) => visit(r.schema, true));
  return new Map([...byTitle.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

async function generateTypes(allRoots) {
  const roots = allRoots.filter((r) => !r.aliasOf);
  // One synthetic root so shared definitions are declared once (deduplicated by title).
  const bundle = {
    title: "StaticInferenceContract",
    description: `Every document and MCP response of contract ${VERSION}.`,
    type: "object",
    additionalProperties: false,
    properties: Object.fromEntries(roots.map((r) => [r.type, r.schema])),
    required: roots.map((r) => r.type),
  };
  const ts = await compile(bundle, "StaticInferenceContract", {
    bannerComment: "",
    additionalProperties: false,
    declareExternallyReferenced: true,
    unreachableDefinitions: false,
    ignoreMinAndMaxItems: true,
    strictIndexSignatures: false,
    format: true,
    style: { singleQuote: false, semi: true, printWidth: 120, trailingComma: "all" },
  });
  const aliases = allRoots
    .filter((r) => r.aliasOf)
    .map((r) => `/**\n * ${r.description}\n */\nexport type ${r.type} = ${r.aliasOf};`)
    .join("\n\n");
  return BANNER + "\n" + ts.trimEnd() + "\n\n" + aliases + "\n";
}

/** Variable name of the zod schema of a titled definition. */
const schemaVar = (title) => `${title.charAt(0).toLowerCase()}${title.slice(1)}Schema`;

function generateValidators(roots, definitions) {
  const titleOf = new Map([...definitions.entries()].map(([title, node]) => [node, title]));
  const toZod = (node, ownTitle) => {
    const code = jsonSchemaToZod(node, {
      zodVersion: 3,
      parserOverride: (schema, refs) => {
        if (typeof schema.tsType === "string") return `B.${schemaVar(schema.tsType)}`;
        const title = titleOf.get(schema);
        if (title && title !== ownTitle && refs.path.length > 0) {
          return `z.lazy(() => ${schemaVar(title)})`;
        }
        return undefined;
      },
    });
    return { code };
  };

  const lines = [BANNER, 'import { z } from "zod";', ""];
  for (const [title, node] of definitions) {
    const { code } = toZod(node, title);
    lines.push(`/** Validator of the \`${title}\` definition. */`);
    lines.push(`export const ${schemaVar(title)}: z.ZodTypeAny = ${code};`, "");
  }
  for (const root of roots) {
    lines.push(`/** Validator of \`${root.type}\` (kind \`${root.kind}\`, ${root.file}). */`);
    if (root.aliasOf) {
      lines.push(`export const ${schemaVar(root.type)}: z.ZodTypeAny = ${schemaVar(root.aliasOf)};`, "");
    } else {
      const { code } = toZod(root.schema, root.type);
      lines.push(`export const ${schemaVar(root.type)}: z.ZodTypeAny = ${code};`, "");
    }
  }
  lines.push("/** Validators by contract kind (as accepted by `npm run check -- --kind`). */");
  lines.push("export const validatorsByKind: Record<string, z.ZodTypeAny> = {");
  for (const root of roots) lines.push(`  ${JSON.stringify(root.kind)}: ${schemaVar(root.type)},`);
  lines.push("};", "");
  for (const root of roots) {
    lines.push(`/** Parses (and validates) a \`${root.type}\`; throws a ZodError naming the failing path. */`);
    lines.push(`export const ${root.fn} = (doc: unknown): T.${root.type} => ${schemaVar(root.type)}.parse(doc) as T.${root.type};`);
  }
  lines.push(`/** Parses (and validates) a single \`Component\`. */`);
  lines.push(`export const parseComponent = (doc: unknown): T.Component => componentSchema.parse(doc) as T.Component;`);
  lines.splice(lines.indexOf('import { z } from "zod";') + 1, 0, 'import type * as T from "./types.ts";');
  return lines.join("\n").trimEnd() + "\n";
}

function generateIndex() {
  return (
    BANNER +
    "\n" +
    'export * from "./types.ts";\n' +
    'export * from "./validators.ts";\n' +
    `export const CONTRACT_VERSION = ${JSON.stringify(VERSION)} as const;\n`
  );
}

// --- extension module (010-modernization-ux, option B) ---------------------------------------------------

/**
 * Replaces every titled definition already generated in the original module by a reference to it
 * (`tsType`), so the extension module imports shared declarations instead of re-declaring them.
 */
function referToBase(node, baseTitles, memo = new Map(), isRoot = true) {
  if (!node || typeof node !== "object") return node;
  if (memo.has(node)) return memo.get(node);
  if (!isRoot && !Array.isArray(node) && node.title && baseTitles.has(node.title)) {
    const ref = { tsType: node.title };
    memo.set(node, ref);
    return ref;
  }
  const out = Array.isArray(node) ? [] : {};
  memo.set(node, out);
  for (const [k, v] of Object.entries(node)) {
    out[k] = k === "enum" || k === "const" || k === "required" ? v : referToBase(v, baseTitles, memo, false);
  }
  return out;
}

/** Base type names referenced by the extension roots (tsType references and aliases), sorted. */
function baseReferences(roots, baseTypes) {
  const names = new Set();
  const seen = new Set();
  const visit = (node) => {
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    if (typeof node.tsType === "string") names.add(node.tsType);
    Object.values(node).forEach(visit);
  };
  for (const r of roots) {
    if (r.aliasOf) {
      if (baseTypes.has(r.aliasOf)) names.add(r.aliasOf);
    } else visit(r.schema);
  }
  return [...names].sort();
}

async function generateExtensionTypes(allRoots, baseNames) {
  const roots = allRoots.filter((r) => !r.aliasOf);
  const bundle = {
    title: "StaticInferenceContractExtensions",
    description: `Extension documents and MCP responses of contract ${VERSION} (separate registry, 010-modernization-ux).`,
    type: "object",
    additionalProperties: false,
    properties: Object.fromEntries(roots.map((r) => [r.type, r.schema])),
    required: roots.map((r) => r.type),
  };
  const ts = await compile(bundle, "StaticInferenceContractExtensions", {
    bannerComment: "",
    additionalProperties: false,
    declareExternallyReferenced: true,
    unreachableDefinitions: false,
    ignoreMinAndMaxItems: true,
    strictIndexSignatures: false,
    format: true,
    style: { singleQuote: false, semi: true, printWidth: 120, trailingComma: "all" },
  });
  const aliases = allRoots
    .filter((r) => r.aliasOf)
    .map((r) => `/**\n * ${r.description}\n */\nexport type ${r.type} = ${r.aliasOf};`)
    .join("\n\n");
  const imports = baseNames.length ? `import type { ${baseNames.join(", ")} } from "../generated/types.ts";\n\n` : "";
  return BANNER + "\n" + imports + ts.trimEnd() + "\n\n" + aliases + "\n";
}

function generateExtensionValidators(roots, definitions) {
  const titleOf = new Map([...definitions.entries()].map(([title, node]) => [node, title]));
  const toZod = (node, ownTitle) =>
    jsonSchemaToZod(node, {
      zodVersion: 3,
      parserOverride: (schema, refs) => {
        if (typeof schema.tsType === "string") return `B.${schemaVar(schema.tsType)}`;
        const title = titleOf.get(schema);
        if (title && title !== ownTitle && refs.path.length > 0) return `z.lazy(() => ${schemaVar(title)})`;
        return undefined;
      },
    });
  const lines = [
    BANNER,
    'import { z } from "zod";',
    'import * as B from "../generated/validators.ts";',
    'import type * as T from "./types.ts";',
    "",
  ];
  for (const [title, node] of definitions) {
    lines.push(`/** Validator of the \`${title}\` definition. */`);
    lines.push(`export const ${schemaVar(title)}: z.ZodTypeAny = ${toZod(node, title)};`, "");
  }
  for (const root of roots) {
    lines.push(`/** Validator of \`${root.type}\` (kind \`${root.kind}\`, ${root.file}). */`);
    if (root.aliasOf) {
      const local = roots.some((r) => r.type === root.aliasOf) ? "" : "B.";
      lines.push(`export const ${schemaVar(root.type)}: z.ZodTypeAny = ${local}${schemaVar(root.aliasOf)};`, "");
    } else {
      lines.push(`export const ${schemaVar(root.type)}: z.ZodTypeAny = ${toZod(root.schema, root.type)};`, "");
    }
  }
  lines.push("/** Validators of the extension kinds (separate from the original `validatorsByKind` registry). */");
  lines.push("export const extensionValidatorsByKind: Record<string, z.ZodTypeAny> = {");
  for (const root of roots) lines.push(`  ${JSON.stringify(root.kind)}: ${schemaVar(root.type)},`);
  lines.push("};", "");
  for (const root of roots) {
    lines.push(`/** Parses (and validates) a \`${root.type}\`; throws a ZodError naming the failing path. */`);
    lines.push(`export const ${root.fn} = (doc: unknown): T.${root.type} => ${schemaVar(root.type)}.parse(doc) as T.${root.type};`);
  }
  return lines.join("\n").trimEnd() + "\n";
}

/** Generates the extension module (EXTENSION_ENTRIES) into outDir; returns the written file names. */
export async function generateExtensions(outDir) {
  const baseRoots = await loadRoots();
  const baseDefinitions = collectDefinitions(baseRoots);
  const baseTypes = new Set([...baseDefinitions.keys(), ...ENTRIES.map((e) => e.type)]);
  // One dereference pass over both entry lists (as the shared definitions are resolved for the original module).
  const extKinds = new Set(EXTENSION_ENTRIES.map((e) => e.kind));
  const loaded = (await loadRoots([...ENTRIES, ...EXTENSION_ENTRIES])).filter((r) => extKinds.has(r.kind));
  const memo = new Map();
  const roots = loaded.map((r) => ({ ...r, schema: r.aliasOf ? r.schema : referToBase(r.schema, baseTypes, memo) }));
  const definitions = collectDefinitions(roots.filter((r) => !r.aliasOf));
  const files = {
    "types.ts": await generateExtensionTypes(roots, baseReferences(roots, baseTypes)),
    "validators.ts": await format(generateExtensionValidators(roots, definitions), {
      parser: "typescript",
      printWidth: 120,
      trailingComma: "all",
    }),
    "index.ts": generateIndex(),
  };
  mkdirSync(outDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) writeFileSync(join(outDir, name), content, "utf8");
  return Object.keys(files);
}

export async function generate(outDir) {
  const roots = await loadRoots();
  const definitions = collectDefinitions(roots);
  const files = {
    "types.ts": await generateTypes(roots),
    "validators.ts": await format(generateValidators(roots, definitions), {
      parser: "typescript",
      printWidth: 120,
      trailingComma: "all",
    }),
    "index.ts": generateIndex(),
  };
  mkdirSync(outDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) writeFileSync(join(outDir, name), content, "utf8");
  return Object.keys(files);
}

// fileURLToPath, not URL.pathname: the latter percent-encodes spaces and the CLI silently did nothing (006).
const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const arg = (name) => (process.argv.indexOf(name) > 0 ? resolve(process.argv[process.argv.indexOf(name) + 1]) : null);
  const out = arg("--out");
  const extOut = arg("--extensions-out");
  if (out || !extOut) {
    const outDir = out ?? join(PACKAGE_DIR, "generated");
    const written = await generate(outDir);
    console.log(`[schema] generated ${written.join(", ")} in ${outDir}`);
  }
  if (extOut || !out) {
    const extDir = extOut ?? EXTENSIONS_DIR;
    const written = await generateExtensions(extDir);
    console.log(`[schema] generated ${written.join(", ")} in ${extDir}`);
  }
}
