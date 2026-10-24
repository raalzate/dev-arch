// Deep link to an analysis (013-agent-mcp-bridge, research D6): /?analysis=<id>.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkedAnalysisId, withoutAnalysisParam } from './analysis-link.ts';

const ID = '0b5c6f3e-1d2a-4c3b-9e8f-7a6b5c4d3e2f';

test('the analysis id is read from the query and only when it is a valid id', () => {
  assert.equal(linkedAnalysisId(`?analysis=${ID}`), ID);
  assert.equal(linkedAnalysisId(`?x=1&analysis=${ID.toUpperCase()}`), ID);
  assert.equal(linkedAnalysisId('?analysis=../../etc'), null);
  assert.equal(linkedAnalysisId(''), null);
});

test('the parameter is removed keeping the rest of the URL', () => {
  assert.equal(withoutAnalysisParam(`http://h:9002/?analysis=${ID}`), 'http://h:9002/');
  assert.equal(withoutAnalysisParam(`http://h:9002/?a=1&analysis=${ID}#s`), 'http://h:9002/?a=1#s');
});
