import { test } from 'node:test';
import assert from 'node:assert/strict';
import { back, navigate, open } from './drawer-history.ts';

test('navigate pushes, back pops, no-op at the root and on the same id', () => {
  let s = open('A');
  s = navigate(s, 'B');
  s = navigate(s, 'C');
  assert.deepEqual(s, { current: 'C', history: ['A', 'B'] });
  s = back(s);
  assert.deepEqual(s, { current: 'B', history: ['A'] });
  assert.deepEqual(back(back(s)), { current: 'A', history: [] });
  const a = open('A');
  assert.equal(navigate(a, 'A'), a);
});

test('history is capped at 20', () => {
  let s = open('X0');
  for (let i = 1; i <= 25; i++) s = navigate(s, `X${i}`);
  assert.equal(s.history.length, 20);
  assert.equal(s.history[0], 'X5');
});
