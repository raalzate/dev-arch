# Data Model: 026
- `Job.extractionConfig: object | null` (estado del web, `.archview/jobs/<id>/job.json`).
- `AnalysisStatus.extractionConfig: object | null` (API del web).
- UI `ExtractionOptions { extended: boolean (false); maxDepth: 0-5 (0); referenceAssemblies: string ('') }` → `{ analysis: { extended: 'on', referenceAssemblies }, detection: { maxDepth } }` solo con valores no por defecto.
