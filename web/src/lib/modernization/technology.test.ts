import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appliesTo, technologyProfile } from './technology';
import { layerLabel } from './layers';
import { fixture } from './test-fixtures';

test('technology profile per fixture', () => {
  assert.deepEqual(
    (['java-standar', 'dotnet-ecommerce', 'vb-synthetic'] as const).map((f) => {
      const p = technologyProfile(fixture(f).graph);
      return [p.technology, p.label, p.accent, p.reducedFidelity];
    }),
    [
      ['java', 'Java', 'java', false],
      ['csharp', '.NET · C#', 'dotnet', true],
      ['vb', 'VB.NET', 'vb', true],
    ],
  );
});

test('mixed and unknown .NET languages', () => {
  const g = fixture('dotnet-ecommerce').graph;
  g.components[0].files = ['A.VB'];
  assert.equal(technologyProfile(g).technology, 'dotnet-mixed');
  assert.equal(technologyProfile(g).label, '.NET · C# + VB');
  assert.deepEqual(technologyProfile(g).languages, ['csharp', 'vb']);
  for (const c of g.components) c.files = ['x.txt'];
  assert.equal(technologyProfile(g).technology, 'dotnet');
  assert.equal(technologyProfile(g).label, '.NET');
});

test('section applicability', () => {
  const java = technologyProfile(fixture('java-standar').graph);
  const mixed = technologyProfile({ ...fixture('dotnet-ecommerce').graph, components: [{ ...fixture('dotnet-ecommerce').graph.components[0], files: ['a.cs', 'b.vb'] }] });
  assert.equal(appliesTo(java, 'all'), true);
  assert.equal(appliesTo(java, ['java']), true);
  assert.equal(appliesTo(java, ['dotnet', 'csharp', 'vb']), false);
  assert.equal(appliesTo(mixed, ['csharp']), true);
  assert.equal(appliesTo(mixed, ['vb']), true);
  assert.equal(appliesTo(mixed, ['dotnet']), true);
  assert.equal(appliesTo(mixed, ['java']), false);
});

test('layer labels by technology', () => {
  const vb = technologyProfile(fixture('vb-synthetic').graph);
  const cs = technologyProfile(fixture('dotnet-ecommerce').graph);
  const java = technologyProfile(fixture('java-standar').graph);
  assert.equal(layerLabel('Web', vb), 'Presentación (formularios y reportes)');
  assert.equal(layerLabel('Compartida', vb), 'Módulos compartidos');
  assert.equal(layerLabel('Datos', vb), 'Acceso a datos (ADO.NET)');
  assert.equal(layerLabel('Web', cs), 'Presentación web');
  assert.equal(layerLabel('Controlador', java), 'Controlador');
  assert.equal(layerLabel('Desconocida', java), 'Desconocida');
});
