// LLM provider selection (010 FR-040; research D10). Pure: reads only the environment passed in, never prints secrets.
export type LlmProviderName = 'gemini' | 'anthropic';
export const LLM_PROVIDERS: readonly LlmProviderName[] = ['gemini', 'anthropic'];
export const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash';
/** Default Claude model per the current claude-api guidance (overridable with LLM_MODEL). */
export const ANTHROPIC_DEFAULT_MODEL = 'claude-opus-5-5';

export interface LlmSelection {
  provider: LlmProviderName;
  model: string;
}

export class LlmConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmConfigError';
  }
}

export function resolveLlmProvider(env: NodeJS.ProcessEnv): LlmSelection {
  const raw = (env.LLM_PROVIDER ?? '').trim().toLowerCase();
  const provider = (raw || 'gemini') as LlmProviderName;
  if (!LLM_PROVIDERS.includes(provider)) {
    throw new LlmConfigError(`LLM_PROVIDER '${env.LLM_PROVIDER?.trim()}' is not supported. Allowed: ${LLM_PROVIDERS.join(', ')}`);
  }
  const model = env.LLM_MODEL?.trim();
  if (provider === 'anthropic') {
    if (!env.ANTHROPIC_API_KEY?.trim()) {
      throw new LlmConfigError('LLM_PROVIDER is anthropic but ANTHROPIC_API_KEY is not set');
    }
    return { provider, model: model || ANTHROPIC_DEFAULT_MODEL };
  }
  return { provider, model: model || GEMINI_DEFAULT_MODEL };
}
