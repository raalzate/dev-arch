import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allIssues, groupIssues } from './findings';
import { fixture } from './test-fixtures';

test('group by severity in severity order with totals', () => {
  const v = fixture('dotnet-ecommerce');
  const all = allIssues(v.graph);
  const g = groupIssues(all, 'severity', null);
  assert.equal(g.reduce((n, x) => n + x.count, 0), all.length);
  const order = ['CRITICAL', 'ERROR', 'WARNING', 'INFO'];
  const keys = g.map((x) => x.key);
  assert.deepEqual(keys, order.filter((k) => keys.includes(k)));
});

test('group by pattern with a minimum severity, largest group first', () => {
  const v = fixture('dotnet-ecommerce');
  const g = groupIssues(allIssues(v.graph), 'pattern', 'WARNING');
  for (const grp of g) for (const i of grp.issues) assert.notEqual(i.severity, 'INFO');
  for (let k = 1; k < g.length; k++) assert.ok(g[k - 1].count > g[k].count || (g[k - 1].count === g[k].count && g[k - 1].key < g[k].key));
  assert.ok(allIssues(v.graph).every((i) => typeof i.componentId === 'string'));
});
