'use server';
import { generateMicroserviceActionSuggestions, type MicroserviceActionSuggestionsInput } from '@/ai/flows/generate-microservice-action-suggestions';
import { generateArchitectureDocumentation, type ArchitectureDocumentationInput } from '@/ai/flows/generate-architecture-documentation';

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
    return { documentation: result.documentation, error: null };
  } catch (error) {
    console.error('Error generating documentation:', error);
    const errorMessage = error instanceof Error ? `${error.message}\n\n${error.stack}` : 'An unknown error occurred.';
    return { documentation: null, error: `Failed to generate documentation:\n\n${errorMessage}` };
  }
}
