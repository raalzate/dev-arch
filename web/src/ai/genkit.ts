import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { config } from 'dotenv';
import { GEMINI_DEFAULT_MODEL } from './llm/provider';

config();

const modelName = (process.env.LLM_PROVIDER ?? 'gemini').trim().toLowerCase() === 'gemini' && process.env.LLM_MODEL ? process.env.LLM_MODEL : GEMINI_DEFAULT_MODEL;

export const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model(modelName),
});
