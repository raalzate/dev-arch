import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildDocumentationPrompt, selectPromptTemplate } from './index';
import { technologyProfile } from '../../lib/modernization/technology';
import { fixture } from '../../lib/modernization/test-fixtures';

test('template per technology', () => {
  const t = (f: 'java-standar' | 'dotnet-ecommerce' | 'vb-synthetic') => selectPromptTemplate(technologyProfile(fixture(f).graph));
  assert.deepEqual([t('java-standar'), t('dotnet-ecommerce'), t('vb-synthetic')], ['java-spring-jee', 'aspnet-core', 'vb-desktop']);
});

test('prompt mentions the technology vocabulary and the data', () => {
  const v = fixture('vb-synthetic');
  const p = buildDocumentationPrompt(v, technologyProfile(v.graph));
  assert.equal(p.template, 'vb-desktop');
  assert.match(p.system, /Visual Basic/);
  assert.match(p.user, /LegacyShop/);
  assert.ok(!p.user.includes('"code_issues"'), 'raw documents are not dumped');
  const j = fixture('java-standar');
  assert.match(buildDocumentationPrompt(j, technologyProfile(j.graph)).system, /Spring/);
});
