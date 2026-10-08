# Implementation Plan: Cierre de VB.NET legacy

**Branch**: `009-vb-legacy-completion` | **Date**: 2026-10-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/009-vb-legacy-completion/spec.md`

## Summary

El analizador .NET (Roslyn) gana un conjunto de **pasadas VB** que se ejecutan solo sobre compilaciones Visual Basic, en paralelo a las pasadas C# existentes, que no se tocan (principio I): extracción de tablas ADO.NET (SQL literal plegado desde concatenaciones + DataSets tipados `.xsd`), métricas (CBO/LCOM/complejidad sobre `VisualBasicSyntax`), configuración y secretos (`AppConfigParser` para `app.config`/`web.config` + referencias `ConfigurationManager`/`My.Settings`), code issues VB (`On Error Resume Next`, `Option Strict Off`, `GoTo`, enlace tardío vía `IDynamic*Operation`, más los patrones generales portados), capas de escritorio (formularios, reportes, acceso a datos, módulos, servicios web) y endpoints ASMX/WCF. La carga VB por proyecto con fallback Adhoc pasa a declarar `meta.source = "roslyn-fallback"` y a producir una **advertencia de usuario** que el analizador .NET imprime en `stderr` como `[warning] <texto>`; el puente Java (`DotNetBridgeAnalyzer`) las recoge y las expone por el canal de 007 (`_meta["static-inference/warnings"]` y `[warning]` en el CLI). Contrato JSON 1.0.0 sin cambios. Corpus sintético redistribuible (`Fixtures/VbLegacy/SyntheticDesktop` y `SyntheticWebServices`) en las pruebas .NET; el corpus real sigue en la categoría opcional `Corpus`. Escenarios BDD: Reqnroll (xUnit) para los escenarios .NET y Cucumber-JVM (`@engine`) para el canal de advertencias del motor.

## Technical Context

**Language/Version**: C# / .NET 8 (analizador `engine/src/main/dotnet/DotNetAnalyzer`, Roslyn 4.9.2); Java 17 (motor, solo `DotNetBridgeAnalyzer`)
**Primary Dependencies**: existentes (Microsoft.CodeAnalysis.VisualBasic.Workspaces 4.9.2, `System.Xml` de la BCL para `.config`/`.xsd`, Jackson, MCP Java SDK); **nueva solo en pruebas**: `Reqnroll.xUnit` 2.0.3 en `DotNetAnalyzer.Tests` (runner BDD exigido por la regla *phase-discipline*; compatible con xUnit 2.7.0 existente; research D9). 0 dependencias nuevas en `dotnet-analyzer` y en el fat JAR
**Storage**: N/A (lectura de archivos del proyecto analizado)
**Testing**: xUnit + FluentAssertions + Reqnroll (.NET), JUnit 5 + Cucumber-JVM (motor)
**Target Platform**: macOS/Linux (CI `ubuntu-latest`, fidelidad reducida) y Windows (fidelidad completa)
**Project Type**: motor de análisis (CLI/MCP) dentro del producto `apps/dev-arch`
**Performance Goals**: el análisis del corpus sintético no añade más de 2 s respecto de 004; las pasadas VB son lineales en nodos de sintaxis
**Constraints**: salidas C#/Java byte-idénticas (FR-080); contrato 1.0.0 (FR-081); determinismo (FR-082); Checkstyle ≤ 4763 (ratchet), SpotBugs 0, `dotnet format --verify-no-changes`; `.feature`/hashes/aserciones de 001–008 intactos; Constitución sin enmiendas
**Scale/Scope**: 8 historias, 42 FR, 9 SC; ~12 clases .NET nuevas en `Analysis/Vb/`, 2 archivos .NET tocados (`ProjectAnalyzer`, `Program`), 1 clase Java tocada, 2 proyectos VB sintéticos de fixture, 1 documento nuevo (`docs/VB-LEGACY.md`)

## Constitution Check

*GATE: evaluado antes de research y re-evaluado tras el diseño.*

```
CONSTITUTION GATE ACTIVE — CONSTITUTION.md v1.0.0 (6 principios + Quality Standards + Workflow + Governance)
```

| Principio / regla | Evaluación | Estado |
|-------------------|------------|--------|
| I. CLI operativo; JSON = contrato público; misma salida CLI/MCP | Las pasadas VB se despachan por `compilation.Language == VisualBasic`; las clases C# existentes (`TableExtractor`, `MetricsCalculator`, `SecretsDetector`, `RoslynCodeAnalyzer`, `EndpointExtractor`, `LayerClassifier`) no se modifican. Prueba de oro byte a byte de las fixtures C# + `BaselineParityTest` (dotnet-ecommerce) + diff antes/después de los 3 demos .NET. Valores nuevos solo en conjuntos abiertos del contrato (`pattern`) y enumeraciones existentes (`layer`, `type`, `severity`). Las advertencias viajan por el canal de 007, fuera de los documentos | PASS |
| II. Lógica en el núcleo; adaptadores delgados | Toda la detección vive en `DotNetAnalyzer.Analysis.Vb`; `Program.cs` solo imprime `UserWarnings`; el puente Java solo traduce líneas `[warning]` a `getWarnings()`; MCP/CLI ya exponen `getWarnings()` (007) | PASS |
| III. TDD; no modificar aserciones | testify antes de tasks; cada tarea de producción va precedida de su prueba roja (Reqnroll/xUnit/JUnit); la prueba de oro C# se crea antes de tocar `ProjectAnalyzer` | PASS |
| IV. Determinismo | Orden ordinal de archivos, tablas en orden de aparición + orden final de `ProjectAnalyzer`; issues ordenados con el mismo comparador que C#; advertencias ordenadas y sin rutas absolutas; prueba de dos ejecuciones byte a byte | PASS |
| V. Degradación con errores claros | Cada pasada VB atrapa errores por componente/archivo con `[WARN]` de diagnóstico; `.config`/`.xsd` mal formados → `[WARN]` y se continúa; fidelidad reducida → advertencia de usuario | PASS |
| VI. Huella mínima | 0 dependencias de runtime nuevas (XML de la BCL); `Reqnroll.xUnit` solo en el proyecto de pruebas (como Cucumber-JVM en 005/007) | PASS (justificado) |
| Quality: pruebas unitarias de métodos públicos del núcleo | Cada clase pública nueva tiene pruebas unitarias | PASS |
| Quality: integración sobre proyectos representativos | Corpus sintético de 2 proyectos VB + demos C# | PASS |
| Quality: análisis estático resuelto | Checkstyle sin subir el umbral; SpotBugs 0; `dotnet format` limpio | PASS |
| Workflow: breaking schema ⇒ bump | Sin cambio de contrato | PASS |
| Governance | Sin enmiendas | PASS |

**Post-design re-check**: PASS (ver Complexity Tracking).

## Architecture

```text
 CLI (java -jar engine.jar) ─┐                         ┌─ MCP analyze_project (_meta warnings)
                             ▼                         ▼
                 AnalysisService (core, 007) ── getWarnings() ──┐
                             │                                   │
                 DotNetBridgeAnalyzer ── stdout JSON ──► DependencyGraph
                             │  stderr "[warning] …" ──► warnings (NEW)
                             ▼
             dotnet-analyzer (Program.cs → ProjectAnalyzer)
                             │
      ┌──────────────────────┴───────────────────────────┐
      │ C# compilation: passes 1–11 (unchanged)          │
      │ VB compilation: passes 1–11 (unchanged, no-op    │
      │   for C#-only walkers) + VB passes:              │
      │   4b VbEndpointExtractor   (ASMX/WCF)            │
      │   5b VbTableExtractor      (SQL literal + .xsd)  │
      │   7b VbMetricsCalculator   (CBO/LCOM/CC)         │
      │   8b VbLayerClassifier     (desktop layers)      │
      │  10b VbSecretsDetector     (AppConfigParser)     │
      │  11b VbCodeAnalyzer        (VB issues)           │
      └──────────────────────────────────────────────────┘
      VbProjectContext: project dir → app.config/web.config, *.xsd
```

## Design

1. **Despacho por lenguaje** (`ProjectAnalyzer`): tras cada pasada existente, si `compilation.Language == LanguageNames.VisualBasic`, se ejecuta la pasada VB equivalente. Las pasadas existentes siguen ejecutándose igual sobre todas las compilaciones (las C#-only no encuentran nodos en VB). Ninguna rama nueva se ejecuta para compilaciones C#. Research D1.
2. **Índice de tipos VB** (`VbTypeIndex`): mapea cada `TypeBlockSyntax` (Class/Module/Structure/Interface) a su id de componente con el mismo cálculo de nombre totalmente calificado que `TypeAnalyzer`; cada nodo se atribuye al bloque de tipo **más interno** (research D2).
3. **Contexto de proyecto** (`VbProjectContext`): directorio del proyecto = ancestro común de los árboles de sintaxis, subiendo como máximo 3 niveles hasta el primer directorio con `*.vbproj`; localiza `app.config`/`web.config` (no recursivo, orden ordinal) y `*.xsd` (recursivo, excluye `bin/` y `obj/`). Research D3.
4. **Tablas** (`VbStringFolder` + `SqlTableParser` + `TypedDataSetParser` + `VbTableExtractor`): pliega concatenaciones `&`/`+` de literales (partes no literales → marcador `\u0001`), reconoce SQL con la gramática estricta de data-model §SQL, normaliza nombres; DataSets tipados por nombre de adaptador (`<X>TableAdapter`) y de tabla tipada (`<X>DataTable`) → `DbObjectName` del adaptador, o tablas del `CommandText`, o el nombre del adaptador. Research D4, D5.
5. **Métricas** (`VbMetricsCalculator`): definiciones de data-model §Métricas; excluye tipos `TypeKind.Error` (FR-021). Issues de complejidad iguales a C# (sin `Location`, como C#).
6. **Configuración** (`AppConfigParser` + `VbSecretsDetector`): data-model §Configuración. Nunca se emite un valor; los mensajes nombran la referencia y el archivo.
7. **Code issues** (`VbCodeAnalyzer`): walker por bloque de tipo; enlace tardío por `SemanticModel.GetOperation` (`DynamicMemberReference`, `DynamicInvocation`, `DynamicIndexerAccess`, `DynamicObjectCreation`) + invocaciones `CreateObject`/`GetObject`; un issue por línea. Ordenación final con el mismo comparador que `RoslynCodeAnalyzer`. Marca `sensitive_data` si hay `HARDCODED_SECRET_IN_CODE`. Research D6.
8. **Capas** (`VbLayerClassifier`): se ejecuta después del clasificador general y solo sobrescribe según FR-040; interfaces intactas. Research D7.
9. **Endpoints** (`VbEndpointExtractor`): sintáctico (funciona sin resolver `System.Web.Services`/`System.ServiceModel`), con símbolos de la compilación para enlazar contrato↔implementación. data-model §Endpoints. Research D8.
10. **Fidelidad reducida**: en la rama `.vbproj` de `ProjectAnalyzer`, una compilación MSBuild vacía **o sin biblioteca base resuelta** (`GetSpecialType(System_Object).TypeKind == Error`) pasa a la carga Adhoc (FR-065, research D13); `VbProjectLoader.LoadAdhoc` excluye `bin/` y `obj/`. `ProjectAnalyzer` registra los proyectos VB cargados por Adhoc (fallback por proyecto y fallback global con fuentes VB); `meta.source = roslyn-fallback`; expone `UserWarnings` (ordenadas, sin duplicados); `Program.cs` las imprime tras el JSON como `[warning] <texto>`. `DotNetBridgeAnalyzer` añade a `getWarnings()` cada línea de `stderr` que empieza por `[warning] ` (contrato en [contracts/dotnet-warnings-channel.md](./contracts/dotnet-warnings-channel.md)). Research D10.
11. **BDD**: Reqnroll enlaza los `.feature` .NET de `specs/009-vb-legacy-completion/tests/features/` desde `DotNetAnalyzer.Tests` (code-behind movido a `obj/`; patrón `specs/**/*.feature.cs` en `.gitignore`); el `.feature` del canal de advertencias (`@engine`) corre en Cucumber-JVM con un runner nuevo. Research D9.

## Project Structure

### Documentation (this feature)

```text
specs/009-vb-legacy-completion/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── vb-analysis-output.md
│   └── dotnet-warnings-channel.md
├── checklists/requirements.md
└── tests/features/*.feature
```

### Source Code (product root `apps/dev-arch`)

```text
engine/src/main/dotnet/DotNetAnalyzer/
  Program.cs                                  # prints [warning] lines (UserWarnings)
  Analysis/ProjectAnalyzer.cs                 # VB dispatch, roslyn-fallback for VB, UserWarnings
  Analysis/Vb/VbTypeIndex.cs                  # TypeBlock ↔ component id
  Analysis/Vb/VbProjectContext.cs             # project dir, config + xsd discovery
  Analysis/Vb/VbStringFolder.cs               # literal concatenation folding
  Analysis/Vb/SqlTableParser.cs               # SQL literal → table names
  Analysis/Vb/TypedDataSetParser.cs           # .xsd → adapters/tables
  Analysis/Vb/AppConfigParser.cs              # app.config / web.config
  Analysis/Vb/VbTableExtractor.cs
  Analysis/Vb/VbMetricsCalculator.cs
  Analysis/Vb/VbSecretsDetector.cs
  Analysis/Vb/VbCodeAnalyzer.cs
  Analysis/Vb/VbLayerClassifier.cs
  Analysis/Vb/VbEndpointExtractor.cs
  Analysis/Vb/VbProjectLoader.cs              # (existing) LoadAdhoc skips bin/ and obj/
engine/src/test/dotnet/DotNetAnalyzer.Tests/
  DotNetAnalyzer.Tests.csproj                 # + Reqnroll.xUnit, linked .feature files, fixtures copy
  Analysis/Vb/*Tests.cs                       # unit tests per class
  Analysis/Vb/VbCorpusSmokeTests.cs           # doc comment fixed (opt-in corpus)
  Compatibility/CSharpGoldenOutputTests.cs    # byte-identical C# fixture outputs
  Fixtures/Golden/*.json                      # captured before the change
  Fixtures/VbLegacy/SyntheticDesktop/**       # synthetic WinForms desktop project
  Fixtures/VbLegacy/SyntheticWebServices/**   # synthetic ASMX + WCF project
  Bdd/*Steps.cs                               # Reqnroll step definitions
engine/src/main/java/com/extractor/analyzer/DotNetBridgeAnalyzer.java   # [warning] stderr lines
engine/src/test/java/com/extractor/analyzer/DotNetBridgeWarningsTest.java
engine/src/test/java/com/extractor/vblegacybdd/{RunVbLegacyCompletionFeaturesTest,VbWarningsSteps}.java
docs/VB-LEGACY.md                             # limitations, full fidelity, rules
CHANGELOG.md                                  # [Unreleased] entry
.gitignore                                    # specs/**/*.feature.cs
```

**Structure Decision**: las clases VB viven en `Analysis/Vb/` (namespace `DotNetAnalyzer.Analysis.Vb`) junto a `VbProjectLoader`, separadas de las clases C#, para que el principio I sea verificable por diff (ningún archivo C# de análisis cambia salvo `ProjectAnalyzer`).

## Complexity Tracking

| Riesgo / desviación | Por qué | Mitigación |
|---------------------|---------|------------|
| `Reqnroll.xUnit` (dependencia de pruebas) | La regla *phase-discipline* exige runner BDD para los `.feature`; precedente Cucumber-JVM en 005/007 | Solo `DotNetAnalyzer.Tests`; versión 2.0.3 compatible con xUnit 2.7.0 (sin subir xUnit) |
| Heurística SQL sobre literales | Sin flujo de datos no se puede seguir `sql` hasta el comando | Gramática estricta (data-model §SQL), casos negativos en la matriz; limitaciones documentadas |
| Capa `Web` para formularios/reportes | El catálogo cerrado no tiene "Presentación"/"Reportes" | Default pendiente de confirmar; las capas no afectan a la inferencia |
| `ProjectAnalyzer` (archivo compartido C#/VB) | Punto único de despacho | Prueba de oro C# antes del cambio; ramas nuevas solo para VB |

## Requirement Coverage

| Requisitos | Diseño | Tareas |
|------------|--------|--------|
| FR-001, FR-002, FR-003, FR-004 | Design 4 (data-model §SQL, §DataSet; research D4, D5) | T008, T009 |
| FR-010, FR-011, FR-012, FR-013, FR-014, FR-015 | Design 7 (data-model §Code issues; research D6) | T010 |
| FR-020, FR-021, FR-022, FR-023 | Design 5 (data-model §Métricas) | T011 |
| FR-030, FR-031, FR-032, FR-033, FR-034, FR-035 | Design 6 (data-model §Configuración) | T012, T013, T010 (secreto en código) |
| FR-040, FR-041, FR-042 | Design 8 (data-model §Capas; research D7) | T014 |
| FR-050, FR-051, FR-052, FR-053 | Design 9 (data-model §Endpoints; research D8) | T015 |
| FR-060, FR-061, FR-062, FR-063, FR-064, FR-065 | Design 10 (contracts/dotnet-warnings-channel.md; research D10, D13) | T007, T016, T017 |
| FR-070, FR-071 | research D11 | T002, T018 |
| FR-080, FR-081, FR-082, FR-083 | Design 1 (research D1, D12); contracts/vb-analysis-output.md | T003, T018, T019, T020 |
| SC-001, SC-002, SC-003, SC-005, SC-007, SC-008 | corpus sintético + escenarios Reqnroll | T004, T009–T015, T018 |
| SC-004, SC-009 | pruebas de oro C#, suites existentes, clon limpio | T003, T019, T020 |
| SC-006 | escenarios `@engine` | T005, T016 |
