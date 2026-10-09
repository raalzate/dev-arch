// Fast acceptance steps of 010-modernization-ux (no browser): technology profile, sections, map model, findings,
// plan/Markdown/JSON export, comparison, AI provider/template selection and generated contract types. They
// exercise the pure modules of web/src/lib/modernization and web/src/ai with the contract fixtures.
import { Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { ConsolidatedArchitecture, DependencyGraph, EntrypointsDocument } from '@static-inference/schema';
import { layout } from '../support/layout.ts';
import type { DevArchWorld } from '../support/world.ts';
import { technologyProfile, type TechnologyProfile } from '../../../web/src/lib/modernization/technology.ts';
import { layerLabel } from '../../../web/src/lib/modernization/layers.ts';
import { SECTIONS, STEPS, resolveSections, sectionApplies, type AnalysisView } from '../../../web/src/lib/modernization/sections.ts';
import {
  SEVERITIES, SEVERITY_STYLES, TECH_ACCENTS, SURFACES, contrastRatio,
} from '../../../web/src/lib/modernization/severity.ts';
import {
  NO_PROPOSAL, edgeKey, groupComponents, highlightedComponents, legend, strokeWidth, visibleEdges,
} from '../../../web/src/lib/modernization/graph-model.ts';
import { allIssues, groupIssues } from '../../../web/src/lib/modernization/findings.ts';
import { buildPlan, VIABILITY_ORDER } from '../../../web/src/lib/modernization/plan.ts';
import { planToMarkdown, exportPlanJson } from '../../../web/src/lib/modernization/markdown.ts';
import { compareAnalyses, isComparable } from '../../../web/src/lib/modernization/compare.ts';
import { toInferenceConfig, type PanelParameter } from '../../../web/src/lib/modernization/inference.ts';
import { selectPromptTemplate } from '../../../web/src/ai/prompts/index.ts';
import { resolveLlmProvider } from '../../../web/src/ai/llm/provider.ts';
import { panelParameters } from '../../../web/src/server/inference/inference-service.ts';

type Edge = DependencyGraph['edges'][number];

const FIXTURE_DIRS: Record<string, string> = {
  'java-standar': path.join(layout.schemaDir, 'fixtures', 'valid', 'java-standar'),
  'dotnet-ecommerce': path.join(layout.schemaDir, 'fixtures', 'valid', 'dotnet-ecommerce'),
  'vb-synthetic': path.join(layout.productRoot, 'tests', 'acceptance', 'fixtures', 'vb-synthetic'),
};

function loadFixture(name: string): AnalysisView {
  const dir = FIXTURE_DIRS[name];
  assert.ok(dir, `unknown fixture ${name}`);
  const read = <T>(f: string) => JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as T;
  return {
    graph: read<DependencyGraph>('output.json'),
    architecture: read<ConsolidatedArchitecture>('output_architecture.json'),
    contracts: read<EntrypointsDocument>('output_entrypoints.json'),
    warnings: [],
  };
}

const view = (w: DevArchWorld) => {
  const v = w.data.view as AnalysisView | undefined;
  assert.ok(v, 'no analysis fixture loaded');
  return v;
};
const profileOf = (w: DevArchWorld): TechnologyProfile => technologyProfile(view(w).graph);

// --- fixtures -------------------------------------------------------------------------------------------

Given('the analysis output fixture {string}', function (this: DevArchWorld, name: string) {
  this.data.view = loadFixture(name);
  this.data.fixture = name;
});

Given(
  'the analysis output fixture {string} with one component file renamed from {string} to {string}',
  function (this: DevArchWorld, name: string, from: string, to: string) {
    const v = loadFixture(name);
    const c = v.graph.components.find((x) => x.files.some((f) => f.endsWith(from)));
    assert.ok(c, `no component with a ${from} file`);
    c.files = c.files.map((f) => (f.endsWith(from) ? f.slice(0, -from.length) + to : f));
    this.data.view = v;
  },
);

Given('the analysis output fixture {string} with the analysis warning {string}', function (this: DevArchWorld, name: string, w: string) {
  const v = loadFixture(name);
  v.warnings = [w];
  this.data.view = v;
});

// --- technology profile ---------------------------------------------------------------------------------

When('its technology profile is computed', function (this: DevArchWorld) {
  this.data.profile = profileOf(this);
});

Then('the technology is {string} with the label {string}', function (this: DevArchWorld, tech: string, label: string) {
  const p = this.data.profile as TechnologyProfile;
  assert.equal(p.technology, tech);
  assert.equal(p.label, label);
});

Then('the profile is marked as reduced fidelity', function (this: DevArchWorld) {
  assert.equal((this.data.profile as TechnologyProfile).reducedFidelity, true);
});

// --- sections -------------------------------------------------------------------------------------------

interface Resolved {
  step: string;
  visible: { id: string; count: number }[];
  empty: { id: string; title: string }[];
}

When('the sections of every step are resolved', function (this: DevArchWorld) {
  const p = profileOf(this);
  this.data.resolved = STEPS.map((s) => {
    const r = resolveSections(s.id, p, view(this));
    return { step: s.id, visible: r.visible.map((v) => ({ id: v.def.id, count: v.items.length })), empty: r.empty };
  }) satisfies Resolved[];
});

function resolvedIds(w: DevArchWorld): string[] {
  const all = w.data.resolved as Resolved[];
  return all.flatMap((r) => [...r.visible.map((v) => v.id), ...r.empty.map((e) => e.id)]);
}

Then('no visible section and no {string} entry has an identifier starting with {string}', function (this: DevArchWorld, _l: string, prefix: string) {
  const bad = resolvedIds(this).filter((id) => id.startsWith(prefix));
  assert.deepEqual(bad, []);
});

Then(
  'no visible section and no {string} entry has an identifier starting with {string}, {string} or {string}',
  function (this: DevArchWorld, _l: string, a: string, b: string, c: string) {
    const bad = resolvedIds(this).filter((id) => [a, b, c].some((p) => id.startsWith(p)));
    assert.deepEqual(bad, []);
  },
);

Then('every visible section has at least one item', function (this: DevArchWorld) {
  for (const r of this.data.resolved as Resolved[]) {
    for (const v of r.visible) assert.ok(v.count >= 1, `${r.step}/${v.id} is visible with ${v.count} items`);
  }
});

Then(
  'every applicable section without items is absent from the visible sections and named in the {string} entries of its step',
  function (this: DevArchWorld, _l: string) {
    const p = profileOf(this);
    const resolved = this.data.resolved as Resolved[];
    for (const def of SECTIONS) {
      if (!sectionApplies(def, p)) continue;
      const items = def.items(view(this), p);
      if (items.length > 0) continue;
      const r = resolved.find((x) => x.step === def.step);
      assert.ok(r, `no step ${def.step}`);
      assert.ok(!r.visible.some((v) => v.id === def.id), `${def.id} is visible while empty`);
      const e = r.empty.find((x) => x.id === def.id);
      assert.ok(e, `${def.id} is not named in the "Sin hallazgos" entries of ${def.step}`);
      assert.equal(e.title, def.title);
    }
  },
);

Then(
  'the visible sections include {string}, {string}, {string} and {string}',
  function (this: DevArchWorld, a: string, b: string, c: string, d: string) {
    const visible = (this.data.resolved as Resolved[]).flatMap((r) => r.visible.map((v) => v.id));
    for (const id of [a, b, c, d]) assert.ok(visible.includes(id), `${id} not visible: ${visible.join(', ')}`);
  },
);

Then('the layer {string} is labeled {string}', function (this: DevArchWorld, layer: string, label: string) {
  assert.equal(layerLabel(layer, profileOf(this)), label);
});

// --- visual vocabulary ----------------------------------------------------------------------------------

Given('the visual vocabulary of the interface', function () {
  assert.ok(SEVERITY_STYLES && TECH_ACCENTS);
});

Then(
  'each severity {string}, {string}, {string} and {string} has a distinct Spanish label and a distinct color',
  function (this: DevArchWorld, ...sev: string[]) {
    const list = sev.slice(0, 4);
    assert.deepEqual([...SEVERITIES].sort(), [...list].sort());
    const labels = new Set(list.map((s) => SEVERITY_STYLES[s as keyof typeof SEVERITY_STYLES].label));
    const light = new Set(list.map((s) => SEVERITY_STYLES[s as keyof typeof SEVERITY_STYLES].light.toLowerCase()));
    const dark = new Set(list.map((s) => SEVERITY_STYLES[s as keyof typeof SEVERITY_STYLES].dark.toLowerCase()));
    assert.equal(labels.size, 4);
    assert.equal(light.size, 4);
    assert.equal(dark.size, 4);
    for (const s of list) assert.notEqual(SEVERITY_STYLES[s as keyof typeof SEVERITY_STYLES].label, s, 'label is not translated');
  },
);

Then('each technology accent {string}, {string} and {string} has a distinct color', function (this: DevArchWorld, ...acc: string[]) {
  const list = acc.slice(0, 3) as (keyof typeof TECH_ACCENTS)[];
  assert.equal(new Set(list.map((a) => TECH_ACCENTS[a].light.toLowerCase())).size, 3);
  assert.equal(new Set(list.map((a) => TECH_ACCENTS[a].dark.toLowerCase())).size, 3);
});

Then('every severity and accent color reaches a contrast ratio of at least {float} against the light and the dark surface', function (min: number) {
  const colors = [...Object.values(SEVERITY_STYLES), ...Object.values(TECH_ACCENTS)];
  for (const c of colors) {
    assert.ok(contrastRatio(c.light, SURFACES.light) >= min, `${c.light} on ${SURFACES.light}: ${contrastRatio(c.light, SURFACES.light)}`);
    assert.ok(contrastRatio(c.dark, SURFACES.dark) >= min, `${c.dark} on ${SURFACES.dark}: ${contrastRatio(c.dark, SURFACES.dark)}`);
  }
});

// --- system map model -----------------------------------------------------------------------------------

function parseEdges(spec: [string, string, number][]): Edge[] {
  return spec.map(([fromTo, type, weight]) => {
    const [from, to] = fromTo.split('->');
    return { from, to, type, weight };
  });
}

Given(
  'the dependencies {string} of type {string} and weight {int} and {string} of type {string} and weight {int}',
  function (this: DevArchWorld, e1: string, t1: string, w1: number, e2: string, t2: string, w2: number) {
    this.data.edges = parseEdges([[e1, t1, w1], [e2, t2, w2]]);
  },
);

When('the map legend is computed', function (this: DevArchWorld) {
  this.data.legend = legend(this.data.edges as Edge[]);
});

Then(
  'the legend lists {string} with {int} dependency and {string} with {int} dependencies',
  function (this: DevArchWorld, a: string, na: number, b: string, nb: number) {
    assert.deepEqual(this.data.legend, [{ type: a, count: na }, { type: b, count: nb }]);
  },
);

When('the type {string} is disabled on the map', function (this: DevArchWorld, t: string) {
  this.data.visible = visibleEdges(this.data.edges as Edge[], new Set([t]));
});

Then('the visible dependencies are {string}', function (this: DevArchWorld, list: string) {
  assert.deepEqual((this.data.visible as Edge[]).map((e) => `${e.from}->${e.to}`), list.split(',').map((s) => s.trim()));
});

When('the map stroke widths are computed', function (this: DevArchWorld) {
  const edges = this.data.edges as Edge[];
  const max = Math.max(...edges.map((e) => e.weight));
  this.data.widths = Object.fromEntries(edges.map((e) => [edgeKey(e), strokeWidth(e.weight, max)]));
});

Then('the stroke of {string} is wider than the stroke of {string}', function (this: DevArchWorld, a: string, b: string) {
  const w = this.data.widths as Record<string, number>;
  const key = (s: string) => {
    const [from, to] = s.split('->');
    return edgeKey({ from, to });
  };
  assert.ok(w[key(a)] > w[key(b)], JSON.stringify(w));
});

When('the map groups components by proposal', function (this: DevArchWorld) {
  const v = view(this);
  this.data.groups = groupComponents(v.graph.components, 'proposal', v.architecture.proposals, profileOf(this));
});

When('the map groups components by layer', function (this: DevArchWorld) {
  const v = view(this);
  this.data.groups = groupComponents(v.graph.components, 'layer', v.architecture.proposals, profileOf(this));
});

Then(
  'every component listed in a proposal belongs to the group named after that proposal and every other component to the group {string}',
  function (this: DevArchWorld, none: string) {
    assert.equal(none, NO_PROPOSAL);
    const v = view(this);
    const groups = this.data.groups as Map<string, string>;
    for (const c of v.graph.components) {
      const p = v.architecture.proposals.find((x) => x.components.includes(c.id));
      assert.equal(groups.get(c.id), p ? p.name : none, c.id);
    }
  },
);

Then('every component belongs to the group named with the technology label of its layer', function (this: DevArchWorld) {
  const groups = this.data.groups as Map<string, string>;
  for (const c of view(this).graph.components) assert.equal(groups.get(c.id), layerLabel(c.layer, profileOf(this)), c.id);
});

When('the minimum severity {string} is chosen on the map', function (this: DevArchWorld, sev: string) {
  this.data.highlighted = highlightedComponents(view(this).graph.components, sev as (typeof SEVERITIES)[number]);
});

Then(
  'exactly the components having at least one code issue of severity {string} or {string} are highlighted',
  function (this: DevArchWorld, a: string, b: string) {
    const expected = view(this).graph.components
      .filter((c) => c.code_issues.some((i) => i.severity === a || i.severity === b))
      .map((c) => c.id)
      .sort();
    assert.ok(expected.length > 0, 'the fixture has no such component');
    assert.deepEqual([...(this.data.highlighted as Set<string>)].sort(), expected);
  },
);

// --- findings -------------------------------------------------------------------------------------------

When('the findings tabs are resolved', function (this: DevArchWorld) {
  this.data.findings = resolveSections('findings', profileOf(this), view(this));
});

Then(
  'the tabs offered are exactly those of {string}, {string}, {string} and {string} with at least one item',
  function (this: DevArchWorld, ...tabs: string[]) {
    const ids = tabs.slice(0, 4);
    const p = profileOf(this);
    const r = this.data.findings as ReturnType<typeof resolveSections>;
    const offered = r.visible.map((v) => v.def.id).filter((id) => ids.includes(id));
    const expected = ids.filter((id) => SECTIONS.find((s) => s.id === id)!.items(view(this), p).length > 0);
    assert.deepEqual(offered, expected);
  },
);

Then('the other tabs are named in the {string} entries of the findings step', function (this: DevArchWorld, _l: string) {
  const r = this.data.findings as ReturnType<typeof resolveSections>;
  const offered = new Set(r.visible.map((v) => v.def.id));
  for (const id of ['tab-issues', 'tab-secrets', 'tab-contracts', 'tab-entrypoints']) {
    if (!offered.has(id)) assert.ok(r.empty.some((e) => e.id === id), `${id} is neither offered nor named`);
  }
});

When('the code issues are grouped by severity', function (this: DevArchWorld) {
  this.data.issueGroups = groupIssues(allIssues(view(this).graph), 'severity', null);
});

Then('the group totals add up to the number of code issues of the analysis', function (this: DevArchWorld) {
  const total = view(this).graph.components.reduce((n, c) => n + c.code_issues.length, 0);
  const groups = this.data.issueGroups as { count: number; issues: unknown[] }[];
  assert.ok(total > 0);
  assert.equal(groups.reduce((n, g) => n + g.count, 0), total);
  for (const g of groups) assert.equal(g.count, g.issues.length);
});

When('the code issues are grouped by pattern and filtered to severity {string} or higher', function (this: DevArchWorld, sev: string) {
  this.data.issueGroups = groupIssues(allIssues(view(this).graph), 'pattern', sev as (typeof SEVERITIES)[number]);
});

Then(
  'every listed issue has severity {string}, {string} or {string} and the group totals add up to the number of such issues',
  function (this: DevArchWorld, a: string, b: string, c: string) {
    const ok = new Set([a, b, c]);
    const groups = this.data.issueGroups as { count: number; issues: { severity: string }[] }[];
    const listed = groups.flatMap((g) => g.issues);
    for (const i of listed) assert.ok(ok.has(i.severity), i.severity);
    const expected = view(this).graph.components.flatMap((x) => x.code_issues).filter((i) => ok.has(i.severity)).length;
    assert.ok(expected > 0);
    assert.equal(groups.reduce((n, g) => n + g.count, 0), expected);
  },
);

// --- plan and exports -----------------------------------------------------------------------------------

function plan(w: DevArchWorld) {
  const v = view(w);
  return buildPlan(v, profileOf(w), {
    project: (w.data.fixture as string) ?? 'project',
    analysisId: '00000000-0000-4000-8000-000000000000',
    finishedAt: '2026-10-09T00:00:00.000Z',
    parameters: (w.data.parameters as Parameters<typeof buildPlan>[2]['parameters']) ?? null,
  });
}

When('the modernization plan is built', function (this: DevArchWorld) {
  this.data.plan = plan(this);
});

Then(
  'the plan proposals are ordered by viability {string}, {string}, {string}, then by ascending external coupling, then by name',
  function (this: DevArchWorld, a: string, b: string, c: string) {
    assert.deepEqual([...VIABILITY_ORDER], [a, b, c]);
    const items = (this.data.plan as ReturnType<typeof buildPlan>).stages.flatMap((s) => s.proposals);
    assert.equal(items.length, view(this).architecture.proposals.length);
    for (let i = 1; i < items.length; i++) {
      const p = items[i - 1];
      const q = items[i];
      const vp = VIABILITY_ORDER.indexOf(p.viability);
      const vq = VIABILITY_ORDER.indexOf(q.viability);
      assert.ok(vp < vq || (vp === vq && (p.coupling < q.coupling || (p.coupling === q.coupling && p.name <= q.name))), `${p.name} before ${q.name}`);
    }
  },
);

Then('each stage contains only proposals of one viability and no stage is empty', function (this: DevArchWorld) {
  for (const s of (this.data.plan as ReturnType<typeof buildPlan>).stages) {
    assert.ok(s.proposals.length > 0);
    assert.equal(new Set(s.proposals.map((p) => p.viability)).size, 1);
    assert.equal(s.proposals[0].viability, s.viability);
  }
});

When('the plan is exported to Markdown twice', function (this: DevArchWorld) {
  this.data.md = [planToMarkdown(plan(this)), planToMarkdown(plan(this))];
});

Then('both documents are byte-identical', function (this: DevArchWorld) {
  const [a, b] = this.data.md as string[];
  assert.equal(a, b);
});

Then(
  'the document contains the technology label {string}, an executive summary, every proposal name in plan order, the code issues per severity and the analysis warning',
  function (this: DevArchWorld, label: string) {
    const md = (this.data.md as string[])[0];
    const p = plan(this);
    assert.ok(md.includes(label));
    assert.match(md, /^## Resumen ejecutivo$/m);
    let last = -1;
    for (const item of p.stages.flatMap((s) => s.proposals)) {
      const at = md.indexOf(item.name, last + 1);
      assert.ok(at > last, `${item.name} missing or out of order`);
      last = at;
    }
    for (const sev of SEVERITIES) {
      const n = p.severityCounts[sev];
      if (n > 0) assert.ok(md.includes(`${SEVERITY_STYLES[sev].label}: ${n}`), `${sev} count missing`);
    }
    for (const w of view(this).warnings) assert.ok(md.includes(w), 'warning missing');
  },
);

Given('the inference configuration {} with minimum viability {string}', function (this: DevArchWorld, json: string, min: string) {
  this.data.parameters = { config: JSON.parse(json), minViability: min };
});

When('the plan is exported to JSON', function (this: DevArchWorld) {
  const p = this.data.parameters as { config: unknown; minViability: string };
  this.data.json = JSON.parse(exportPlanJson(view(this).architecture, p));
});

Then('the export contains the architecture document and that configuration and minimum viability', function (this: DevArchWorld) {
  const j = this.data.json as Record<string, unknown>;
  assert.deepEqual(j.architecture, view(this).architecture);
  assert.deepEqual(j.inference, this.data.parameters);
});

// --- comparison -----------------------------------------------------------------------------------------

Given('the analysis output fixtures {string} and {string}', function (this: DevArchWorld, a: string, b: string) {
  this.data.pair = [loadFixture(a), loadFixture(b)];
});

When('the two analyses are compared', function (this: DevArchWorld) {
  const [a, b] = this.data.pair as AnalysisView[];
  this.data.cmp = compareAnalyses(a, b);
});

Then(
  'the comparison shows for each analysis its components, lines of code, dependencies, proposals per viability and code issues per severity',
  function (this: DevArchWorld) {
    const [a, b] = this.data.pair as AnalysisView[];
    const cmp = this.data.cmp as ReturnType<typeof compareAnalyses>;
    for (const [v, t] of [[a, cmp.a], [b, cmp.b]] as const) {
      assert.equal(t.components, v.graph.components.length);
      assert.equal(t.loc, v.graph.components.reduce((n, c) => n + c.loc, 0));
      assert.equal(t.edges, v.graph.edges.length);
      for (const via of VIABILITY_ORDER) assert.equal(t.proposals[via], v.architecture.proposals.filter((p) => p.viability === via).length);
      for (const s of SEVERITIES) assert.equal(t.issues[s], v.graph.components.flatMap((c) => c.code_issues).filter((i) => i.severity === s).length);
    }
  },
);

Then('each difference equals the second total minus the first', function (this: DevArchWorld) {
  const { a, b, delta } = this.data.cmp as ReturnType<typeof compareAnalyses>;
  assert.equal(delta.components, b.components - a.components);
  assert.equal(delta.loc, b.loc - a.loc);
  assert.equal(delta.edges, b.edges - a.edges);
  for (const v of VIABILITY_ORDER) assert.equal(delta.proposals[v], b.proposals[v] - a.proposals[v]);
  for (const s of SEVERITIES) assert.equal(delta.issues[s], b.issues[s] - a.issues[s]);
});

Then('the components present only in each analysis are listed in alphabetical order', function (this: DevArchWorld) {
  const [a, b] = this.data.pair as AnalysisView[];
  const cmp = this.data.cmp as ReturnType<typeof compareAnalyses>;
  const ia = new Set(a.graph.components.map((c) => c.id));
  const ib = new Set(b.graph.components.map((c) => c.id));
  assert.deepEqual(cmp.onlyInA, [...ia].filter((x) => !ib.has(x)).sort());
  assert.deepEqual(cmp.onlyInB, [...ib].filter((x) => !ia.has(x)).sort());
  assert.ok(cmp.onlyInA.length > 0 && cmp.onlyInB.length > 0);
});

Given(
  'history entries with the states {string}, {string}, {string} and {string}',
  function (this: DevArchWorld, ...states: string[]) {
    this.data.entries = states.slice(0, 4).map((status) => ({ status }));
  },
);

Then('only the {string} entry can be selected for comparison', function (this: DevArchWorld, st: string) {
  for (const e of this.data.entries as { status: string }[]) assert.equal(isComparable(e), e.status === st, e.status);
});

// --- AI -------------------------------------------------------------------------------------------------

When('the AI documentation prompt is prepared', function (this: DevArchWorld) {
  this.data.template = selectPromptTemplate(profileOf(this));
});

Then('the template {string} is used', function (this: DevArchWorld, t: string) {
  assert.equal(this.data.template, t);
});

Given('the server environment has no LLM_PROVIDER', function (this: DevArchWorld) {
  this.data.llmEnv = {};
});

Given('the server environment has LLM_PROVIDER {string} and an ANTHROPIC_API_KEY', function (this: DevArchWorld, p: string) {
  this.data.llmEnv = { LLM_PROVIDER: p, ANTHROPIC_API_KEY: 'sk-ant-test-0123456789' };
});

Given('the server environment has LLM_PROVIDER {string} and no ANTHROPIC_API_KEY', function (this: DevArchWorld, p: string) {
  this.data.llmEnv = { LLM_PROVIDER: p };
});

Given('the server environment has LLM_PROVIDER {string}', function (this: DevArchWorld, p: string) {
  this.data.llmEnv = { LLM_PROVIDER: p };
});

When('the LLM provider is resolved', function (this: DevArchWorld) {
  this.data.llm = null;
  this.data.llmError = null;
  try {
    this.data.llm = resolveLlmProvider(this.data.llmEnv as NodeJS.ProcessEnv);
  } catch (e) {
    this.data.llmError = e instanceof Error ? e.message : String(e);
  }
});

Then('the provider is {string}', function (this: DevArchWorld, p: string) {
  assert.equal(this.data.llmError, null);
  const r = this.data.llm as { provider: string; model: string };
  assert.equal(r.provider, p);
  assert.ok(r.model.length > 0);
});

Then('the resolution fails with a message naming {string} and containing no key value', function (this: DevArchWorld, name: string) {
  const m = this.data.llmError as string | null;
  assert.ok(m, 'the resolution did not fail');
  assert.ok(m.includes(name));
  assert.ok(!/sk-ant-/.test(m));
});

Then('the resolution fails with a message naming {string}, {string} and {string}', function (this: DevArchWorld, a: string, b: string, c: string) {
  const m = this.data.llmError as string | null;
  assert.ok(m, 'the resolution did not fail');
  for (const x of [a, b, c]) assert.ok(m.includes(x), `${x} not named: ${m}`);
});

// --- inference parameters (pure) ------------------------------------------------------------------------

Given('the panel parameters with their defaults and ranges', function (this: DevArchWorld) {
  const defaults = JSON.parse(readFileSync(path.join(layout.productRoot, 'tests', 'acceptance', 'fixtures', 'inference-defaults.json'), 'utf8'));
  const schema = JSON.parse(readFileSync(path.join(layout.schemaDir, '1.0.0', 'inference-config.schema.json'), 'utf8'));
  this.data.params = panelParameters(defaults, schema);
});

When('the user sets {string} to {float} and leaves the others at their defaults', function (this: DevArchWorld, p: string, v: number) {
  const params = this.data.params as PanelParameter[];
  const values = Object.fromEntries(params.map((x) => [x.path, x.path === p ? v : x.default]));
  this.data.sent = toInferenceConfig(values, params);
});

Then('the configuration sent is {}', function (this: DevArchWorld, json: string) {
  assert.deepEqual(this.data.sent, JSON.parse(json));
});

// --- generated types ------------------------------------------------------------------------------------

Given('the generated contract package', function (this: DevArchWorld) {
  this.data.generated = path.join(layout.schemaDir, 'generated');
});

Then('it declares the types {string}, {string} and {string}', function (this: DevArchWorld, ...names: string[]) {
  const types = readFileSync(path.join(this.data.generated as string, 'types.ts'), 'utf8');
  for (const n of names.slice(0, 3)) assert.match(types, new RegExp(`export (interface|type) ${n}\\b`), n);
});

Then('it registers runtime validators for the kinds {string}, {string} and {string}', async function (this: DevArchWorld, ...kinds: string[]) {
  const g = (await import('@static-inference/schema')) as unknown as { validatorsByKind: Record<string, unknown> };
  for (const k of kinds.slice(0, 3)) assert.ok(g.validatorsByKind[k], `no validator for ${k}`);
});

const CONTRACT_TYPE = new RegExp(
  '^\\s*(?:export\\s+)?(?:declare\\s+)?(?:interface|type|class)\\s+(DependencyGraph|ConsolidatedArchitecture|EntrypointsDocument|Component' +
    '|Edge|GraphMeta|ApiContracts|ApiEndpoint|ApiSchema|Proposal|ProposalMetrics|ProjectMetadata|LegacyEntrypoint|SupportLibrary' +
    '|CodeIssue|InferenceConfig|ScoreProposalResponse|ReinferArchitectureResponse|PackageDependencyDetails|ComponentsData|ArchitectureData)\\b',
  'm',
);

Given('the web source tree', function (this: DevArchWorld) {
  this.data.webSrc = path.join(layout.webDir, 'src');
});

When('every type declaration named after a contract type is located', function (this: DevArchWorld) {
  const found: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const f = path.join(d, n);
      if (statSync(f).isDirectory()) walk(f);
      else if (/\.(ts|tsx)$/.test(n) && CONTRACT_TYPE.test(readFileSync(f, 'utf8'))) found.push(path.relative(layout.webDir, f));
    }
  };
  walk(this.data.webSrc as string);
  this.data.declarations = found;
});

Then('none resides in the web source tree', function (this: DevArchWorld) {
  assert.deepEqual(this.data.declarations, []);
});
