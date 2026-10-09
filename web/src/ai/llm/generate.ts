// Text generation through the configured provider (010 FR-040). Gemini (default) goes through Genkit; Anthropic
// through the official SDK (streaming + finalMessage, server-side refusal fallbacks). Loaded on the server only.
import type { LlmSelection } from './provider';

export interface GenerateRequest {
  system: string;
  user: string;
}

async function generateWithGemini(sel: LlmSelection, req: GenerateRequest): Promise<string> {
  const { ai } = await import('../genkit');
  const { googleAI } = await import('@genkit-ai/google-genai');
  const res = await ai.generate({
    model: googleAI.model(sel.model),
    system: req.system,
    prompt: req.user,
    config: { temperature: 0.2 },
  });
  return res.text;
}

async function generateWithAnthropic(sel: LlmSelection, req: GenerateRequest): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic();
  const stream = client.beta.messages.stream({
    model: sel.model,
    max_tokens: 32000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'high' },
    system: req.system,
    messages: [{ role: 'user', content: req.user }],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === 'refusal') throw new Error('The model declined to generate the documentation (refusal).');
  const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  if (!text) throw new Error(`The model returned no text (stop reason: ${message.stop_reason}).`);
  return text;
}

export async function generateText(sel: LlmSelection, req: GenerateRequest): Promise<string> {
  return sel.provider === 'anthropic' ? generateWithAnthropic(sel, req) : generateWithGemini(sel, req);
}
