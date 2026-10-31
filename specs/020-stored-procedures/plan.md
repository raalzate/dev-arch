# Implementation Plan: Acceso a datos por stored procedures en .NET legacy

**Branch**: `020-stored-procedures` | **Date**: 2026-10-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/020-stored-procedures/spec.md` (feature 015 del `PLAN-VB-PLATAFORMA-LEGACY.md`)

## Summary

El analizador .NET gana una pasada **5c de procedimientos almacenados** que reconoce, de forma sintáctica y sin resolver las bibliotecas de acceso a datos, las invocaciones por nombre literal de Enterprise Library (`GetStoredProcCommand`, `Execute*(db, "X")`), ADO.NET (`CommandType.StoredProcedure` + `CommandText`) y Dapper (`commandType: StoredProcedure`), en VB y en C#, y las emite en `tables_used` como `sp:<nombre canónico>`. Un **catálogo opcional** (carpeta de scripts `CREATE PROCEDURE` o CSV `procedimiento,tabla,operación`) traduce cada `sp:` a sus tablas con resolución transitiva de `EXEC` y dos modos (complementar, por defecto; sustituir). La pasada se activa por configuración `dataAccess.procedures` con valor por defecto `auto` (activa solo en compilaciones VB), de modo que **ninguna salida C#/Java existente cambia**. La configuración viaja del motor Java (`InferenceConfig.dataAccess`, misma carga/validación que 008) al analizador .NET por una opción nueva `--config=<archivo>` que el puente añade **solo cuando la sección no es la de por defecto** (la línea de comandos actual no cambia). En la inferencia Java, los recursos `sp:` entran en el agrupamiento por datos compartidos, en `tables_shared` y en la cohesión de datos con un peso `dataAccess.procedureWeight` (1.0 = igual que una tabla; 0 = ignorar). Heurística de entidad por nombre (`dataAccess.entityHeuristic`, apagada) solo para el nombrado de propuestas. Contrato JSON 1.0.0 sin cambios en los documentos; `inference-config.schema.json` gana la sección `dataAccess` (aditiva) y se regeneran los tipos TS. Corpus sintético ampliado con un catálogo en ambas formas y golden file; criterios sobre la referencia externa en pruebas `Corpus` opt-in.

## Technical Context

**Language/Version**: C# / .NET 8 (analizador, Roslyn 4.9.2 C# y VB); Java 17 (motor: configuración, puente, inferencia)
**Primary Dependencies**: existentes (Roslyn Workspaces 4.9.2, `System.Text.Json`, Jackson, MCP Java SDK, Reqnroll.xUnit 2.0.3 y Cucumber-JVM en pruebas). **0 dependencias nuevas** (el CSV se lee con un lector propio de dos columnas obligatorias; los scripts SQL con la gramática de `SqlTableParser` ampliada con `CREATE/ALTER PROCEDURE` y `EXEC`)
**Storage**: N/A (lectura de los archivos del proyecto y del catálogo entregado)
**Testing**: xUnit + FluentAssertions + Reqnroll (.NET); JUnit 5 + Cucumber-JVM (motor); golden files; pruebas `Corpus` opt-in sobre la referencia externa
**Target Platform**: macOS/Linux (fidelidad reducida, CI) y Windows (fidelidad completa); las reglas son sintácticas y no dependen de la fidelidad
**Project Type**: motor de análisis (CLI/MCP) del producto dev-arch
**Performance Goals**: pasada lineal en nodos de sintaxis; ≤ +10 % sobre el análisis .NET de la referencia (~40 s) sin catálogo (SC-008); catálogo indexado una vez por análisis
**Constraints**: salidas `test-for-demo/*` y líneas base byte-idénticas sin configuración (FR-023, FR-031); contrato 1.0.0; determinismo (FR-050); Checkstyle ratchet, SpotBugs 0, `dotnet format`; `.feature`/hashes de 001-014 intactos; sin rutas absolutas ni cuerpos de procedimientos en advertencias (FR-017)
**Scale/Scope**: 5 historias, 31 FR, 8 SC; ~8 clases .NET nuevas (`Analysis/Data/`), 3 archivos .NET tocados (`Program`, `ProjectAnalyzer`, `SqlTableParser`), 1 record Java nuevo + 6 clases Java tocadas (loader/validator/defaults, puente, extracción, clustering, métricas, viabilidad, nombrado), schema + tipos TS, corpus sintético ampliado, `docs/VB-LEGACY.md`

## Constitution Check

*GATE: evaluado antes de research y re-evaluado tras el diseño.*

```
CONSTITUTION GATE ACTIVE — CONSTITUTION.md v2.0.0 (7 principios + Quality Standards + Workflow + Governance)
```

| Principio / regla | Evaluación | Estado |
|---|---|---|
| I. Compatibilidad hacia atrás; contratos públicos; misma salida por cualquier entrada | Pasada nueva tras `dataAccess.procedures = auto` (solo VB); C#/Java sin configuración ⇒ el puente no añade `--config` y el analizador no ejecuta la pasada ⇒ salidas idénticas, verificadas por `BaselineParityTest`, `DefaultOutputsRegressionTest` y golden C# de 009. `sp:` es un valor más del conjunto abierto `tables_used`. `inference-config.schema.json` cambia de forma aditiva (sección opcional `dataAccess` con defaults) ⇒ sin bump de contrato (precedente 008: `detection.maxDepth`). CLI/MCP/REST comparten `InferenceConfig` | PASS |
| II. Única fuente de verdad; adaptadores delgados | Reconocimiento en `DotNetAnalyzer.Analysis.Data` compartido por C# y VB mediante un pequeño adaptador sintáctico por lenguaje (`IProcedureCallSyntax`) sobre un emparejador único (research D2), para no repetir la deuda de walkers duplicados registrada en 014b. Catálogo y canonicalización en una clase. En Java, un solo `DataResources` decide qué entradas de `tables_used` cuentan y con qué peso; clustering, métricas y viabilidad lo usan | PASS |
| III. TDD | testify antes de tasks; escenarios Reqnroll (.NET) y Cucumber (@engine) rojos antes del código; golden del corpus sintético ampliado capturado tras el verde y versionado | PASS |
| IV. Determinismo | Nombres canónicos; catálogo leído en orden ordinal de ruta, duplicados resueltos por menor ruta; advertencias ordenadas; `tables_used` pasa por la ordenación final existente de `ProjectAnalyzer`; sin tiempo ni entorno (límite de 8192 caracteres heredado de BUG-002); escenario de doble corrida con catálogo; prueba en macOS y CI Linux | PASS |
| V. Degradación con avisos claros | Nombre no literal ⇒ advertencia (componente:línea), sin tabla; catálogo ausente/ilegible/CSV sin cabecera ⇒ se continúa sin catálogo con advertencia de causa; procedimientos no resueltos ⇒ una advertencia ordenada; `--config` inválido en el analizador ⇒ error con mensaje; la activación efectiva se informa en diagnóstico (`[WARN]`/`[info]` en stderr, no contrato) | PASS |
| VI. Huella mínima | 0 dependencias nuevas; el analizador sigue siendo un artefacto; el catálogo es entrada del usuario, nunca se descarga | PASS |
| VII. Contrato único versionado; tipos generados | Sección `dataAccess` añadida a `schema/1.0.0/inference-config.schema.json`; `npm run generate -w schema` regenera `types.ts`/`validators.ts`; la web no declara tipos a mano | PASS |
| Quality: unitarias de métodos públicos; integración sobre proyectos representativos; estático limpio | Unitarias por clase nueva (canonicalización, catálogo scripts/CSV, matcher, `DataResources`); corpus sintético + demos; Checkstyle/SpotBugs/`dotnet format` | PASS |
| Workflow: rama + PR + CI; conventional commits | Rama `020-stored-procedures` sobre `014b-engine-debt` (prerrequisito del criterio de doble corrida) | PASS |
| Governance | Sin enmiendas | PASS |

**Post-design re-check**: PASS (ver Complexity Tracking: la opción `--config` del analizador es una interfaz nueva, aditiva y opcional; el comando actual sigue válido).

## Architecture

```text
 CLI --config=<json> ─┐                 ┌─ MCP analyze_project(config) / reinfer_architecture(config)
                      ▼                 ▼
          InferenceConfig (+ dataAccess) ──► ExtractionService ──► DotNetBridgeAnalyzer
                      │                                                 │ dataAccess ≠ default ⇒
                      │                                                 │ temp json + "--config=<file>"
                      │                                                 ▼
                      │                               dotnet-analyzer <path> [--config=<file>]
                      │                                 ProjectAnalyzer (AnalysisOptions.DataAccess)
                      │                                   pass 5 TableExtractor (C#)   ┐ unchanged
                      │                                   pass 5b VbTableExtractor     ┘
                      │                                   pass 5c ProcedureCallExtractor (NEW)
                      │                                      ├ IProcedureCallSyntax: CSharp | VisualBasic
                      │                                      ├ ProcedureName.Canonical
                      │                                      └ ProcedureCatalog (scripts | csv) ──► tables
                      │                                   tables_used += "sp:X" | tables (mode)
                      ▼
          InferenceService: DataResources(tables_used, procedureWeight)
             ├ ClusteringAlgorithm.groupBySharedTables  (sp: included when weight > 0)
             ├ MetricsCalculator.findSharedTables       (tables first, then sp:, ordinal)
             ├ ViabilityScorer.calculateDataCohesion    (weighted)
             └ MicroserviceNameGenerator (entityHeuristic, off) ─ "Policy" from sp:usp_Policy_Read
```

Nodos: CLI/MCP (client); InferenceConfig, ExtractionService, DotNetBridgeAnalyzer, dotnet-analyzer, InferenceService (server); Procedure catalog scripts/CSV (storage, entrada del usuario).

## Design

1. **Configuración `dataAccess`** (Java, `com.extractor.inference.config.DataAccessConfig`): `procedures` ∈ {`auto`,`on`,`off`} (default `auto`), `procedureCatalog` (ruta o `null`), `catalogMode` ∈ {`complement`,`replace`} (default `complement`), `procedureWeight` ≥ 0 (default 1.0), `entityHeuristic` booleano (default `false`). Se añade a `InferenceConfig`, `inference-defaults.json`, `InferenceConfigValidator` y al schema. `isDefault()` sigue funcionando por igualdad de records. Research D1; contrato [contracts/inference-config-dataaccess.md](./contracts/inference-config-dataaccess.md).
2. **Transporte al analizador** (`DotNetBridgeAnalyzer`): recibe `DataAccessConfig`; si es distinta de la de por defecto, serializa `{ "dataAccess": {...} }` a un archivo temporal (ruta del catálogo ya resuelta a absoluta respecto del directorio de trabajo) y añade `--config=<archivo>`; en otro caso la línea de comandos es exactamente la actual. El archivo se borra al terminar. `ExtractionService` pasa la sección desde `InferenceConfig`. Research D3; contrato [contracts/dotnet-analyzer-config.md](./contracts/dotnet-analyzer-config.md).
3. **Opciones del analizador** (`Program.cs` → `AnalysisOptions`): `dotnet-analyzer <path> [--config=<file>]`; el archivo es JSON con la sección `dataAccess` (claves desconocidas ignoradas, valores inválidos ⇒ exit 1 con `Error:`); sin opción, `AnalysisOptions.Default` (comportamiento actual). `ProjectAnalyzer.AnalyzeProjectAsync(path, options)`; la sobrecarga actual delega con `Default`.
4. **Pasada 5c `ProcedureCallExtractor`** (`Analysis/Data/`): se ejecuta tras 5/5b cuando `Enabled(options, compilation.Language)` (`auto` ⇒ VB; `on` ⇒ todas; `off` ⇒ ninguna). Recorre cada tipo (índice de tipos: `VbTypeIndex` en VB; un índice equivalente mínimo para C# construido sobre `ClassDeclarationSyntax`/`StructDeclarationSyntax` con el mismo nombre calificado que `TypeAnalyzer`) y pregunta al adaptador del lenguaje por **candidatos** `(nombre de método, argumentos, receptor, asignaciones)`; el emparejador común decide con las cuatro reglas (data-model §Reglas). Nombres plegados con `VbStringFolder` (VB) y un `CsStringFolder` análogo (literales, `+`, `string.Concat`, verbatim, interpolaciones ⇒ hueco). Research D2, D4.
5. **Canonicalización** (`ProcedureName`): quita delimitadores `[]`, `""`, `` ` ``, toma la última parte tras `.`, conserva mayúsculas del código; clave de comparación en minúsculas invariantes. Compartida por código y catálogo. Research D5.
6. **Catálogo** (`ProcedureCatalog`): `Load(path)`: si es directorio ⇒ scripts (`*.sql` recursivo, orden ordinal, sin `bin/`/`obj/`); si es archivo `.csv` ⇒ CSV. Scripts: `ProcedureScriptParser` localiza `CREATE [OR ALTER] PROC[EDURE] <ref>` / `ALTER PROC[EDURE] <ref>` hasta el siguiente `CREATE`/`ALTER`/`GO`/fin; del cuerpo extrae tablas con `SqlTableParser` aplicado por sentencia (`SELECT/INSERT/UPDATE/DELETE/MERGE`) y `EXEC[UTE] <ref>` como dependencias. CSV: cabecera obligatoria `procedimiento,tabla,operación` o `procedure,table,operation` (sin distinguir mayúsculas), separador `,`, comillas opcionales; `operación` se conserva pero no se usa. `Resolve(name)`: tablas propias ∪ transitivas (DFS con conjunto de visitados), ordenadas; `Unresolved` acumulado. Duplicados: menor ruta ordinal gana, advertencia con ambas rutas relativas al catálogo. Research D6.
7. **Emisión**: por componente, `sp:<canónico>` por procedimiento reconocido; con catálogo: modo `complement` ⇒ tablas + `sp:`; `replace` ⇒ solo tablas (si no se resuelve, se conserva `sp:`). La ordenación final de `ProjectAnalyzer` (distinct + ordinal) ya cubre FR-005. Advertencias de usuario (canal 009): nombre no literal (`<componente> (<archivo>:<línea>)`), catálogo no cargado (causa), procedimientos no resueltos (lista), duplicados; estado efectivo de la pasada como `[WARN]`/`[info]` de diagnóstico, no como advertencia de usuario (FR-032).
8. **Inferencia** (`com.extractor.inference.DataResources`): `resourcesOf(component, config)` devuelve pares (recurso, peso): tablas ⇒ 1.0; `sp:` ⇒ `procedureWeight` (omitido si 0). `ClusteringAlgorithm.groupBySharedTables`, `MetricsCalculator.findSharedTables` (tablas primero, luego `sp:`, ordinal), `ViabilityScorer.calculateDataCohesion` y el Jaccard de datos de `EvidenceGraph`/`RecommendationEngine` (`dataJaccardMode`) consumen `DataResources`. Con `procedureWeight = 1.0` y sin `sp:` el resultado es idéntico al actual por construcción (las tablas pesan 1 y los conjuntos no cambian); `BaselineParityTest` lo verifica. Research D7.
9. **Heurística de entidad** (`ProcedureEntityHeuristic`, Java, en nombrado): con `entityHeuristic = true`, `MicroserviceNameGenerator` añade a los tokens de nombrado la entidad deducida de los `sp:` del clúster (quita prefijo `^(?:[a-z]+)?sp_|^usp_|^sp_` sin distinguir mayúsculas, verbos de la lista fija al inicio o final, separadores `_`); nunca toca `tables_used`. Research D8.
10. **Pruebas y corpus**: `Fixtures/VbLegacy/SyntheticDesktop` gana `DataAccess/PolicyAdapter.vb` (las cuatro formas + negativo no literal + comando de texto) y `Catalog/` (`procs/*.sql`, `procs.csv` equivalentes); golden `SyntheticDesktop.golden.json` (sin catálogo) y `SyntheticDesktop.catalog.golden.json`; fixture C# `Fixtures/CSharpLegacyEntLib/` para la activación por configuración. Reqnroll enlaza `specs/020-stored-procedures/tests/features/*.feature` (segundo `ItemGroup` del csproj, excluyendo `*-engine.feature`); Cucumber-JVM `RunStoredProceduresFeaturesTest` corre los `@engine` (configuración, puente, inferencia). Prueba `Corpus` opt-in con SC-002. Research D9.
11. **Docs**: `docs/VB-LEGACY.md` (sección "Procedimientos almacenados"), `docs/SCHEMA.md` (sección `dataAccess`), `CHANGELOG.md`.

## Project Structure

### Documentation (this feature)

```text
specs/020-stored-procedures/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── dotnet-analyzer-config.md
│   └── inference-config-dataaccess.md
├── checklists/requirements.md
└── tests/features/*.feature            # /iikit-04-testify
```

### Source Code (repository root)

```text
engine/src/main/dotnet/DotNetAnalyzer/
  Program.cs                                   # --config=<file> → AnalysisOptions
  Analysis/AnalysisOptions.cs                  # DataAccessOptions (procedures, catalog, mode)
  Analysis/ProjectAnalyzer.cs                  # pass 5c dispatch; user warnings of the pass
  Analysis/Data/ProcedureName.cs               # canonical name + comparison key
  Analysis/Data/ProcedureCallMatcher.cs        # the four rules over language-neutral candidates
  Analysis/Data/IProcedureCallSyntax.cs        # candidates of a type (per language)
  Analysis/Data/CSharpProcedureCallSyntax.cs
  Analysis/Data/VisualBasicProcedureCallSyntax.cs
  Analysis/Data/CsStringFolder.cs              # C# literal folding (mirror of VbStringFolder)
  Analysis/Data/ProcedureCatalog.cs            # scripts | csv, resolve, unresolved, duplicates
  Analysis/Data/ProcedureScriptParser.cs       # CREATE/ALTER PROCEDURE, EXEC, tables per statement
  Analysis/Data/ProcedureCallExtractor.cs      # pass 5c
  Analysis/Vb/SqlTableParser.cs                # + statement splitting helper used by the script parser
engine/src/main/java/com/extractor/
  inference/config/DataAccessConfig.java       # record
  inference/config/InferenceConfig.java        # + dataAccess
  inference/config/InferenceConfigValidator.java
  inference/DataResources.java                 # weighted data resources of a component
  inference/ClusteringAlgorithm.java           # groupBySharedTables via DataResources
  inference/MetricsCalculator.java             # findSharedTables via DataResources
  inference/ViabilityScorer.java               # data cohesion via DataResources
  inference/ProcedureEntityHeuristic.java      # entity from sp: names (opt-in)
  inference/MicroserviceNameGenerator.java     # uses the heuristic when enabled
  analyzer/DotNetBridgeAnalyzer.java           # --config temp file when dataAccess ≠ default
  service/ExtractionService.java               # passes DataAccessConfig
engine/src/main/resources/static-inference/inference-defaults.json
schema/1.0.0/inference-config.schema.json      # + dataAccess (additive)
schema/generated/{types,validators}.ts         # regenerated
engine/src/test/dotnet/DotNetAnalyzer.Tests/
  DotNetAnalyzer.Tests.csproj                  # + 020 features ItemGroup
  Analysis/Data/*Tests.cs
  Bdd/ProcedureSteps.cs                        # Reqnroll steps of 020
  Fixtures/VbLegacy/SyntheticDesktop/DataAccess/PolicyAdapter.vb
  Fixtures/VbLegacy/SyntheticDesktop/Catalog/{procs/*.sql,procs.csv}
  Fixtures/CSharpLegacyEntLib/**               # C# EntLib/ADO.NET/Dapper sample
  Fixtures/Golden/SyntheticDesktop*.golden.json
engine/src/test/java/com/extractor/
  inference/DataResourcesTest.java, config/DataAccessConfigTest.java
  storedprocsbdd/{RunStoredProceduresFeaturesTest,StoredProceduresSteps}.java
docs/VB-LEGACY.md, docs/SCHEMA.md, CHANGELOG.md
```

**Structure Decision**: el reconocimiento vive en `Analysis/Data/` (namespace `DotNetAnalyzer.Analysis.Data`), neutral al lenguaje, con dos adaptadores sintácticos pequeños; nada de `Analysis/Vb/` cambia salvo un helper de `SqlTableParser`. En Java, un único `DataResources` evita repetir la regla "¿cuenta un `sp:`?" en cuatro sitios.

## Complexity Tracking

| Riesgo / desviación | Por qué | Mitigación |
|---|---|---|
| Opción nueva `--config` en `dotnet-analyzer` | Es la única vía para que la configuración del motor llegue al analizador; una variable de entorno sería invisible en la línea de comandos y menos reproducible | Opcional y aditiva; el puente la omite con configuración por defecto; contrato documentado; prueba de que el comando por defecto no cambia |
| `CommandType.StoredProcedure` y `CommandText` en instrucciones distintas | Sin flujo de datos no se puede unir el comando a su texto | Regla por tipo (ambos en el mismo tipo y texto con forma de identificador); limitación documentada; caso negativo en la matriz |
| Reconocimiento sintáctico por nombre de método (`ExecuteDataSet` de cualquier receptor) | Las bibliotecas no están resueltas en fidelidad reducida | Exigir la firma (segundo argumento literal) y, para ADO.NET, la señal explícita de tipo de comando; casos negativos (`ExecuteReader()` sin argumentos de un `SqlCommand` de texto) |
| Peso de procedimientos con `evidence.weights.table` ya existente | Dos pesos podrían confundirse | `procedureWeight` es relativo a una tabla (1.0 = igual); documentado en contrato y `docs/SCHEMA.md` |
| Dos índices de tipos (VB existente, C# mínimo nuevo) | `TypeAnalyzer` no expone un índice reutilizable para C# | El índice C# reutiliza el cálculo de nombre de `TypeAnalyzer` (mismo método estático); registrado como extensión de la deuda de walkers de 014b si 016 abstrae sobre `IOperation` |

## Requirement Coverage

| Requisitos | Diseño |
|---|---|
| FR-001, FR-002, FR-003, FR-004, FR-007, FR-008 | Design 4 (data-model §Reglas; research D2, D4) |
| FR-005, FR-006 | Design 5, 7 (research D5) |
| FR-010, FR-011, FR-012, FR-013, FR-014, FR-015, FR-016, FR-017 | Design 6, 7 (data-model §Catálogo; research D6) |
| FR-020, FR-021, FR-022, FR-023, FR-024 | Design 8 (research D7); contrato inference-config-dataaccess |
| FR-030, FR-031, FR-032 | Design 1, 2, 3, 4 (research D1, D3); contratos |
| FR-040, FR-041, FR-042 | Design 9 (research D8) |
| FR-050 | Design 5, 6, 7 + ordenación final existente; escenario de doble corrida |
| FR-051, FR-053 | Design 10 (research D9) |
| FR-052 | Design 11 |
| SC-001, SC-003, SC-005, SC-006, SC-007 | corpus sintético + escenarios Reqnroll/@engine + golden |
| SC-002, SC-008 | prueba `Corpus` opt-in |
| SC-004 | `BaselineParityTest`, `DefaultOutputsRegressionTest`, golden C# 009, comando del puente sin cambios |
