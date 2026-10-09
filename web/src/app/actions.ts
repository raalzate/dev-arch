'use server';
import { generateArchitectureDocumentation, type ArchitectureDocumentationInput } from '@/ai/flows/generate-architecture-documentation';
import { LlmConfigError } from '@/ai/llm/provider';
import { generateMicroserviceActionSuggestions, type MicroserviceActionSuggestionsInput } from '@/ai/flows/generate-microservice-action-suggestions';

export async function getAISuggestions(input: MicroserviceActionSuggestionsInput) {
  try {
    const result = await generateMicroserviceActionSuggestions(input);
    return { suggestions: result.suggestions, error: null };
  } catch (error) {
    console.error('Error generating AI suggestions:', error);
    return { suggestions: null, error: 'Failed to generate AI suggestions. Please check the server logs.' };
  }
}

export async function getArchitectureDocumentation(input: ArchitectureDocumentationInput) {
  try {
    const result = await generateArchitectureDocumentation(input);
    return { documentation: result.documentation, template: result.template, provider: result.provider, error: null };
  } catch (error) {
    console.error('Error generating documentation:', error);
    const message = error instanceof LlmConfigError ? error.message : error instanceof Error ? error.message : 'Unknown error';
    return { documentation: null, template: null, provider: null, error: `No se pudo generar la documentación: ${message}` };
  }
}
