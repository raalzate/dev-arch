// Steps shared by several 006 features.
import { Given, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import path from 'node:path';
import { layout, PRODUCT_REL } from '../support/layout.ts';
import { cleanClone } from '../support/git.ts';
import type { DevArchWorld } from '../support/world.ts';

/** Clean clone (objects only); steps that need files call checkoutClone(). */
Given('a clean clone of the repository on the feature branch', function (this: DevArchWorld) {
  const { dir, commit } = cleanClone(layout.monorepoRoot, false);
  this.monorepo = dir;
  this.product = path.join(dir, PRODUCT_REL);
  this.commit = commit;
  this.data.checkedOut = false;
  this.cleanup.push(path.dirname(dir));
});

Then('it exits with code {int}', function (this: DevArchWorld, code: number) {
  assert.ok(this.result, 'no command was executed');
  assert.equal(this.result.code, code, this.result.output.slice(-4000));
});

Then('it exits with a non-zero code', function (this: DevArchWorld) {
  assert.ok(this.result, 'no command was executed');
  assert.notEqual(this.result.code, 0, this.result.output.slice(-4000));
});
