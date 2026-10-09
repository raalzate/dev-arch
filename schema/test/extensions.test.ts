// node:test suite of the generated extension module (010-modernization-ux, option B: separate registry for the
// inference configuration and the 008 MCP responses). Run: npm --prefix schema test
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BANNER, EXTENSIONS_DIR, ENTRIES, EXTENSION_ENTRIES } from "../gen/lib.mjs";
import { generateExtensions } from "../gen/generate.mjs";
import * as ext from "../extensions/index.ts";
import { validatorsByKind } from "../generated/validators.ts";

test("extension registry declares exactly the extension kinds and leaves the original registry unchanged", () => {
  assert.deepEqual(Object.keys(ext.extensionValidatorsByKind), EXTENSION_ENTRIES.map((e) => e.kind));
  assert.deepEqual(Object.keys(validatorsByKind), ENTRIES.map((e) => e.kind));
  for (const { fn } of EXTENSION_ENTRIES) assert.equal(typeof (ext as Record<string, unknown>)[fn], "function", fn);
});

test("extension validators accept and reject documents", () => {
  assert.deepEqual(ext.parseInferenceConfig({ viability: { thresholds: { high: 0.9 } } }), { viability: { thresholds: { high: 0.9 } } });
  assert.equal(ext.extensionValidatorsByKind["inference-config"].safeParse({ nope: 1 }).success, false);
  assert.equal(ext.extensionValidatorsByKind["mcp/score_proposal"].safeParse({ name: "x" }).success, false);
});

test("extension module regenerates byte-identically and carries the generated banner", async () => {
  const out = mkdtempSync(join(tmpdir(), "si-schema-ext-"));
  for (const name of await generateExtensions(out)) {
    const committed = readFileSync(join(EXTENSIONS_DIR, name), "utf8");
    assert.equal(readFileSync(join(out, name), "utf8"), committed, `extensions/${name} is out of date`);
  }
  for (const name of readdirSync(EXTENSIONS_DIR)) assert.ok(readFileSync(join(EXTENSIONS_DIR, name), "utf8").startsWith(BANNER), name);
});
