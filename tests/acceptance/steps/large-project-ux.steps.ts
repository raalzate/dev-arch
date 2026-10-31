// 027-large-project-ux: lexical search index, pagination and hover threshold (pure web helpers, in-memory fixture).
import { Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import type { DevArchWorld } from '../support/world.ts';
import { buildSearchIndex, countByKind, search, type SearchEntry, type SearchResult } from '../../../web/src/lib/modernization/search.ts';
import { hoverDimmingEnabled, paginate } from '../../../web/src/lib/modernization/paging.ts';
import { view } from '../../../web/src/lib/modernization/search.test.ts';

Given('the analysis view of the fixture {string}', function (this: DevArchWorld, name: string) {
  assert.equal(name, 'search-sample');
  this.data.index = buildSearchIndex(view);
});

When('the lexical search runs for {string}', function (this: DevArchWorld, query: string) {
  this.data.query = query;
  this.data.results = search(this.data.index as SearchEntry[], query);
});

When('the lexical search runs for {string} with limit {int}', function (this: DevArchWorld, query: string, limit: number) {
  this.data.query = query;
  this.data.results = search(this.data.index as SearchEntry[], query, limit);
});

Then('the results include a {string} titled {string}', function (this: DevArchWorld, kind: string, title: string) {
  const results = this.data.results as SearchResult[];
  assert.ok(results.some((r) => r.kind === kind && r.title === title), JSON.stringify(results.map((r) => [r.kind, r.title])));
});

Then('the result kinds with their counts are {string}', function (this: DevArchWorld, expected: string) {
  const counts = countByKind(this.data.index as SearchEntry[], this.data.query as string);
  const actual = Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ');
  assert.equal(actual, expected);
});

Then('there are no results', function (this: DevArchWorld) {
  assert.deepEqual(this.data.results, []);
});

Then('there are {int} results', function (this: DevArchWorld, n: number) {
  assert.equal((this.data.results as SearchResult[]).length, n);
});

Then('the result titles in order are {string}', function (this: DevArchWorld, csv: string) {
  assert.deepEqual((this.data.results as SearchResult[]).map((r) => r.title), csv.split(',').map((s) => s.trim()));
});

Then('the first result is a {string} targeting step {string} and component {string}', function (this: DevArchWorld, kind: string, step: string, component: string) {
  const first = (this.data.results as SearchResult[])[0];
  assert.ok(first, 'no results');
  assert.equal(first.kind, kind);
  assert.equal(first.target.step, step);
  assert.equal(first.target.componentId ?? '', component);
});

When('{int} rows are paginated with page size {int} showing {int} pages', function (this: DevArchWorld, rows: number, size: number, pages: number) {
  this.data.page = paginate(Array.from({ length: rows }, (_, i) => i), pages, size);
});

Then('{int} rows are shown and {int} remain', function (this: DevArchWorld, shown: number, remaining: number) {
  const p = this.data.page as { shown: unknown[]; remaining: number };
  assert.equal(p.shown.length, shown);
  assert.equal(p.remaining, remaining);
});

Then('hover dimming for {int} components is {word}', function (this: DevArchWorld, n: number, enabled: string) {
  assert.equal(hoverDimmingEnabled(n), enabled === 'true');
});
