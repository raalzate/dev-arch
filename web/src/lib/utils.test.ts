// cn(): conditional class names merged with Tailwind conflict resolution.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cn } from './utils.ts';

test('joins truthy class names and drops falsy ones', () => {
  assert.equal(cn('a', false, null, undefined, 0, '', 'b'), 'a b');
});

test('accepts objects and nested arrays of conditions', () => {
  assert.equal(cn({ active: true, hidden: false }, ['x', ['y', { z: true }]]), 'active x y z');
});

test('the last conflicting Tailwind utility wins', () => {
  assert.equal(cn('p-2 text-sm', 'p-4'), 'text-sm p-4');
  assert.equal(cn('bg-red-500', { 'bg-blue-500': true }), 'bg-blue-500');
  assert.equal(cn('px-2 py-1', 'p-3'), 'p-3');
});

test('non-conflicting utilities are all kept', () => {
  assert.equal(cn('px-2', 'py-1', 'text-red-500'), 'px-2 py-1 text-red-500');
});
