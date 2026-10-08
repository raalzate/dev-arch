// src/ai/flows/generate-microservice-action-suggestions.ts
'use server';

/**
 * @fileOverview Generates action suggestions for microservice proposals based on their rationale, names, and current metrics.
 *
 * This file exports:
 * - `generateMicroserviceActionSuggestions`: A function to generate action suggestions for microservice proposals.
 * - `MicroserviceActionSuggestionsInput`: The input type for the `generateMicroserviceActionSuggestions` function.
 * - `MicroserviceActionSuggestionsOutput`: The output type for the `generateMicroserviceActionSuggestions` function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MicroserviceActionSuggestionsInputSchema = z.object({
  proposalName: z.string().describe('The name of the microservice proposal.'),
  proposalRationale: z.array(z.string()).describe('The rationale for the microservice proposal.'),
  proposalMetrics: z.object({
    size: z.number().describe('The size of the microservice proposal in components.'),
    cohesion_avg: z.number().describe('The average cohesion of the microservice proposal.'),
    external_coupling: z.number().describe('The external coupling of the microservice proposal.'),
    tables: z.array(z.string()).describe('The tables used by the microservice proposal.'),
    sensitive: z.boolean().describe('Whether the microservice proposal handles sensitive data.'),
  }).describe('The metrics for the microservice proposal.'),
});
export type MicroserviceActionSuggestionsInput = z.infer<typeof MicroserviceActionSuggestionsInputSchema>;

const MicroserviceActionSuggestionsOutputSchema = z.object({
  suggestions: z.string().describe('A summary of suggested next steps for the microservice proposal.')
});
export type MicroserviceActionSuggestionsOutput = z.infer<typeof MicroserviceActionSuggestionsOutputSchema>;


export async function generateMicroserviceActionSuggestions(input: MicroserviceActionSuggestionsInput): Promise<MicroserviceActionSuggestionsOutput> {
  return generateMicroserviceActionSuggestionsFlow(input);
}

const suggestionsPrompt = ai.definePrompt({
  name: 'generateMicroserviceActionSuggestionsPrompt',
  input: {schema: MicroserviceActionSuggestionsInputSchema},
  output: {schema: MicroserviceActionSuggestionsOutputSchema},
  prompt: `Eres un arquitecto de software experto que da consejos sobre cómo proceder con una propuesta de microservicio. Tu respuesta debe ser siempre en español.

Dada la siguiente información sobre una propuesta de microservicio, proporciona un breve resumen de los siguientes pasos sugeridos.

Nombre de la Propuesta: {{{proposalName}}}
Justificación: {{#each proposalRationale}}{{{this}}}\n{{/each}}
Métricas: Tamaño: {{{proposalMetrics.size}}}, Cohesión: {{{proposalMetrics.cohesion_avg}}}, Acoplamiento: {{{proposalMetrics.external_coupling}}}, Datos Sensibles: {{#if proposalMetrics.sensitive}}Sí{{else}}No{{/if}}

Sugerencias: `,
});

const generateMicroserviceActionSuggestionsFlow = ai.defineFlow(
  {
    name: 'generateMicroserviceActionSuggestionsFlow',
    inputSchema: MicroserviceActionSuggestionsInputSchema,
    outputSchema: MicroserviceActionSuggestionsOutputSchema,
  },
  async input => {
    const {output} = await suggestionsPrompt(input);
    return output!;
  }
);
