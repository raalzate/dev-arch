// 028-details-drawer: linear navigation history of the drawer (pure helper).
import { Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import type { DevArchWorld } from '../support/world.ts';
import { back, navigate, open, type DrawerState } from '../../../web/src/lib/modernization/drawer-history.ts';

const state = (w: DevArchWorld) => w.data.drawer as DrawerState;

Given('an empty drawer history at {string}', function (this: DevArchWorld, id: string) {
  this.data.drawer = open(id);
});

When('the drawer navigates to {string}', function (this: DevArchWorld, id: string) {
  this.data.drawer = navigate(state(this), id);
});

When('the drawer navigates through {int} distinct components', function (this: DevArchWorld, n: number) {
  for (let i = 1; i <= n; i++) this.data.drawer = navigate(state(this), `Comp${i}`);
});

When('the drawer goes back', function (this: DevArchWorld) {
  this.data.drawer = back(state(this));
});

Then('the drawer shows {string} with history {string}', function (this: DevArchWorld, current: string, history: string) {
  assert.equal(state(this).current, current);
  assert.deepEqual(state(this).history, history ? history.split(',').map((s) => s.trim()) : []);
});

Then('the history length is {int}', function (this: DevArchWorld, n: number) {
  assert.equal(state(this).history.length, n);
});
