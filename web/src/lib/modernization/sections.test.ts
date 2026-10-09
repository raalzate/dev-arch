import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SECTIONS, STEPS, resolveSections, sectionApplies } from './sections';
import { technologyProfile } from './technology';
import { fixture } from './test-fixtures';

const FIXTURES = ['java-standar', 'dotnet-ecommerce', 'vb-synthetic'] as const;

test('section ids are unique and every step exists', () => {
  assert.equal(new Set(SECTIONS.map((s) => s.id)).size, SECTIONS.length);
  for (const s of SECTIONS) assert.ok(STEPS.some((x) => x.id === s.step), s.id);
  assert.deepEqual(STEPS.map((s) => s.id), ['summary', 'map', 'proposals', 'findings', 'plan']);
});

test('technology-specific prefixes match their applicability', () => {
  for (const s of SECTIONS) {
    if (s.id.startsWith('java-')) assert.deepEqual(s.appliesTo, ['java']);
    if (s.id.startsWith('csharp-')) assert.deepEqual(s.appliesTo, ['csharp']);
    if (s.id.startsWith('vb-')) assert.deepEqual(s.appliesTo, ['vb']);
    if (s.id.startsWith('dotnet-')) assert.deepEqual(s.appliesTo, ['dotnet']);
  }
});

for (const f of FIXTURES) {
  test(`visible sections are non-empty and empty applicable ones are named (${f})`, () => {
    const v = fixture(f);
    const p = technologyProfile(v.graph);
    for (const step of STEPS) {
      const r = resolveSections(step.id, p, v);
      for (const x of r.visible) assert.ok(x.items.length > 0, x.def.id);
      for (const def of SECTIONS.filter((d) => d.step === step.id)) {
        const applies = sectionApplies(def, p);
        const n = applies ? def.items(v, p).length : 0;
        assert.equal(r.visible.some((x) => x.def.id === def.id), applies && n > 0, def.id);
        assert.equal(r.empty.some((x) => x.id === def.id), applies && n === 0, def.id);
      }
    }
  });
}

test('.NET fixtures never resolve Java sections; Java never resolves .NET sections', () => {
  for (const f of FIXTURES) {
    const v = fixture(f);
    const p = technologyProfile(v.graph);
    const ids = STEPS.flatMap((s) => {
      const r = resolveSections(s.id, p, v);
      return [...r.visible.map((x) => x.def.id), ...r.empty.map((x) => x.id)];
    });
    if (f === 'java-standar') assert.ok(!ids.some((i) => /^(csharp|vb|dotnet)-/.test(i)), ids.join());
    else assert.ok(!ids.some((i) => i.startsWith('java-')), ids.join());
  }
});

test('VB synthetic shows desktop, legacy risks, app.config and data access sections', () => {
  const v = fixture('vb-synthetic');
  const r = resolveSections('findings', technologyProfile(v.graph), v);
  const ids = r.visible.map((x) => x.def.id);
  for (const id of ['vb-desktop-ui', 'vb-legacy-risks', 'dotnet-app-config', 'data-access', 'vb-modules']) assert.ok(ids.includes(id), id);
});

test('C# fixture shows the DI section', () => {
  const v = fixture('dotnet-ecommerce');
  const r = resolveSections('findings', technologyProfile(v.graph), v);
  assert.ok(r.visible.some((x) => x.def.id === 'csharp-di'));
});

test('warnings section follows the analysis warnings', () => {
  const v = fixture('java-standar');
  const p = technologyProfile(v.graph);
  assert.ok(resolveSections('summary', p, v).empty.some((e) => e.id === 'summary-warnings'));
  v.warnings = ['x'];
  assert.ok(resolveSections('summary', p, v).visible.some((e) => e.def.id === 'summary-warnings'));
});
