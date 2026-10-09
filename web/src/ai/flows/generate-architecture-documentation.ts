'use server';
// Architecture documentation (010 FR-039, FR-040): technology-specific template + configured LLM provider.
import type { ConsolidatedArchitecture, DependencyGraph } from '@static-inference/schema';
import { buildDocumentationPrompt } from '@/ai/prompts';
import { generateText } from '@/ai/llm/generate';
import { resolveLlmProvider } from '@/ai/llm/provider';
import { technologyProfile } from '@/lib/modernization/technology';

export interface ArchitectureDocumentationInput {
  graph: DependencyGraph;
  architecture: ConsolidatedArchitecture;
  warnings: string[];
}

export async function generateArchitectureDocumentation(input: ArchitectureDocumentationInput): Promise<{ documentation: string; template: string; provider: string }> {
  const selection = resolveLlmProvider(process.env);
  const view = { graph: input.graph, architecture: input.architecture, warnings: input.warnings };
  const prompt = buildDocumentationPrompt(view, technologyProfile(input.graph));
  const documentation = await generateText(selection, { system: prompt.system, user: prompt.user });
  return { documentation, template: prompt.template, provider: selection.provider };
}
