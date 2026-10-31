---
description: "Task list for 025-reference-assemblies"
---
# Tasks: Ensamblados de referencia (opt-in) y runner Windows manual
- [x] T001 Fixture `Rules/SqlQuery.vb`; pasos Reqnroll (`ReferenceAssemblySteps.cs`); csproj de pruebas referencia el paquete net48 (`ExcludeAssets=all`); enlace de features; runner Cucumber `refassembliesbdd`; rojo [TS-001..TS-004, TS-010..TS-013]
- [x] T002 .NET: `AnalysisSection.ReferenceAssemblies`, `VbProjectLoader.ReferenceAssembliesDirectory`, advertencia, `[info]` [TS-001, TS-002, TS-003, TS-004]
- [x] T003 Java: `AnalysisConfig.referenceAssemblies`, bridge (ruta absoluta), schema + TS, `CONFIGURATION.md` [TS-010, TS-011, TS-013]
- [x] T004 Workflow `windows-fidelity.yml`; docs VB-LEGACY/SCHEMA/CHANGELOG; golden 024 regenerado (nuevo archivo del fixture); EVALUATIONS §13 (referencia con la carpeta) [TS-012, TS-013]
- [ ] T005 `make test-engine` (SDK 8); memoria
