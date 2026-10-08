# **App Name**: IA-ArchView

## Core Features:

- File Upload and Processing: Allows users to upload output.json and output_architecture.json files for analysis.
- General Analysis Tab: Displays key metrics, component breakdowns, data analysis, component types, external dependencies, and project summaries.
- Microservice Proposal Visualization: Presents microservice proposals (clusters) with viability assessments, metrics, rationales, and recommended actions. Display an evaluation and next steps in natural language based on data.
- Dependency Graph Generation: Generates an interactive dependency graph of components, color-coded by cluster.
- Interactive Graph Exploration: Enables users to zoom, drag, and inspect nodes (components) within the dependency graph.
- Tooltip Information: Provides detailed information about each component on hover, including ID, layer, LOC, and cluster.
- Automatic Summary: Based on analysis, give suggestions of actions to do with some of the microservices proposals. The AI LLM tool has access to proposal rational, names and current metrics to create it.

## Style Guidelines:

- Primary color: Deep Indigo (#4F46E5) for a professional and analytical feel.
- Background color: Light Gray (#F9FAFB) to provide a clean and neutral backdrop.
- Accent color: Soft Lavender (#A78BFA) for interactive elements and highlights, offering a subtle contrast.
- Body and headline font: 'Inter' sans-serif, to maintain consistency with the existing codebase.
- Use clear and simple icons for file upload, analysis actions, and to represent different types of components and metrics.
- Maintain a clean and well-organized layout with clear sections for file upload, analysis results, and graph visualization.
- Use subtle animations for loading states, tab transitions, and graph interactions to enhance user experience.