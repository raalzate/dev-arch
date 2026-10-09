import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ANTHROPIC_DEFAULT_MODEL, GEMINI_DEFAULT_MODEL, resolveLlmProvider } from './provider';

test('gemini by default, model override', () => {
  assert.deepEqual(resolveLlmProvider({}), { provider: 'gemini', model: GEMINI_DEFAULT_MODEL });
  assert.deepEqual(resolveLlmProvider({ LLM_PROVIDER: ' Gemini ', LLM_MODEL: 'gemini-x' }), { provider: 'gemini', model: 'gemini-x' });
});

test('anthropic needs its key and never leaks it', () => {
  assert.deepEqual(resolveLlmProvider({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-ant-1' }), { provider: 'anthropic', model: ANTHROPIC_DEFAULT_MODEL });
  assert.throws(() => resolveLlmProvider({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: '  ' }), /ANTHROPIC_API_KEY/);
});

test('unknown provider', () => {
  assert.throws(() => resolveLlmProvider({ LLM_PROVIDER: 'openai' }), /'openai'.*gemini, anthropic/);
});
