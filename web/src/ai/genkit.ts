import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { config } from 'dotenv';

const modelName = process.env.LLM_MODEL || 'gemini-2.5-flash';

config();

export const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model(modelName),
});