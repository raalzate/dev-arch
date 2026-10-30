# Implementation Plan: Identidad, capas y puntos de entrada del perfil desktop .NET legacy

**Branch**: `021-desktop-identity-layers` | **Date**: 2026-10-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/021-desktop-identity-layers/spec.md` (feature 016 del `PLAN-VB-PLATAFORMA-LEGACY.md`)

## Summary

Cuatro extensiones acotadas del analizador .NET para el perfil de escritorio, todas detrás de la regla 4.0 del plan y sin tocar el contrato 1.0.0. (1) **Identidad**: `VbProjectLoader.LoadAdhoc` lee el `.vbproj` (`VbProjectFile`: `RootNamespace`, `Import`, `OptionStrict`, `OutputType`, `StartupObject`, archivos `.rdlc`) y compila con `VisualBasicCompilationOptions.WithRootNamespace(...).WithGlobalImports(...)`; los ids de `VbTypeIndex` salen del símbolo (ya incluye la raíz) y el nombre de respaldo sintáctico antepone la raíz. (2) **Capas finas**: `VbLayerClassifier` gana las reglas Presentación/Reportes/Batch/Validator por herencia (símbolo o cadena sintáctica), archivos asociados (`.Designer.vb`, `.rdlc`) y `Sub Main`, emite anotaciones `Layer:<fina>` y `EntryPoint:Main`, y proyecta a `Web`/`Negocio`; en Java `buildEntrypointFromComponents` produce `legacy_entrypoint` `internal` de proceso por lotes cuando un miembro lleva `EntryPoint:Main`. (3) **Issue de proyecto** `PROJECT_OPTION_STRICT_OFF`. (4) **Reglas de deuda** en una pasada 11c `VbDebtAnalyzer` (seis reglas sintácticas, umbrales de `GOD_CLASS` configurables) activada por la sección `debt` de la configuración (`enabled` auto/on/off, por defecto auto = VB), transportada al analizador por el mismo `--config` de 020. El fixture `SyntheticDesktop` deja de declarar `<OptionStrict>Off` a nivel de proyecto (su escenario bloqueado de 009 fija el conjunto exacto de issues; la declaración por archivo se conserva) y un fixture nuevo `SyntheticLegacyDebt` ejercita identidad, capas, punto de entrada y cada regla con caso positivo y negativo. `detection.maxDepth` no cambia.

## Technical Context

**Language/Version**: C# / .NET 8 (Roslyn 4.9.2 VB); Java 17 (configuración, puente, `legacy_entrypoint`)
**Primary Dependencies**: existentes; `System.Xml.Linq` de la BCL para el `.vbproj` (como `AppConfigParser`). 0 dependencias nuevas
**Storage**: N/A
**Testing**: Reqnroll + xUnit (.NET), Cucumber-JVM `@engine` (Java), golden files, prueba `Corpus` opt-in
**Target Platform**: macOS/Linux (fidelidad reducida) y Windows
**Project Type**: motor de análisis del producto dev-arch
**Performance Goals**: pasadas lineales en nodos; ≤ +10 % sobre la referencia (SC-006)
**Constraints**: contrato 1.0.0 intacto (`layer` y `legacy_entrypoint.type` cerrados → anotaciones y `internal`); `test-for-demo/*` y líneas base byte-idénticas; escenarios bloqueados de 005/008/009/020 intactos (fixture 009 ajustado solo en test data no afirmada); determinismo; Checkstyle/SpotBugs/`dotnet format`
**Scale/Scope**: 4 historias, 27 FR, 6 SC; ~4 clases .NET nuevas (`VbProjectFile`, `VbDebtAnalyzer`, `DebtOptions`, helpers), 5 tocadas (`VbProjectLoader`, `VbTypeIndex`, `VbLayerClassifier`, `AnalysisOptions`, `ProjectAnalyzer`); Java: `DebtConfig`, `InferenceConfig`, loader/validator/defaults, `DotNetBridgeAnalyzer`, `MicroserviceRecommendationEngine`; schema `inference-config` aditivo + tipos TS; fixture nuevo; docs

## Constitution Check

```
CONSTITUTION GATE ACTIVE — CONSTITUTION.md v2.0.0
```

| Principio / regla | Evaluación | Estado |
|---|---|---|
| I. Compatibilidad | Sin cambio de contrato: `annotations` (lista abierta), `layer` solo con valores existentes, `legacy_entrypoint.type = internal`; pasadas nuevas `debt.enabled = auto` (solo VB) y `<RootNamespace>` solo afecta a proyectos que lo declaran (los fixtures actuales lo declaran vacío). C#/Java byte-idénticos (`BaselineParityTest`, `DefaultOutputsRegressionTest`, golden C#). Sección `debt` aditiva en `inference-config.schema.json` (precedente 008/020) | PASS |
| II. Única fuente de verdad | Lectura del `.vbproj` en una clase (`VbProjectFile`) usada por loader, capas y deuda; proyección capa fina → `layer` en un solo mapa; el punto de entrada por lotes se decide en el motor Java a partir de la anotación, no en la web | PASS |
| III. TDD | testify antes de tasks; escenarios rojos antes del código; goldens tras el verde | PASS |
| IV. Determinismo | Anotaciones ordenadas por la ordenación final existente; issues ordenados (ubicación, regla); módulo de entrada = menor id ordinal; sin tiempo ni entorno | PASS |
| V. Degradación | `.vbproj` ilegible o `RootNamespace` inválido ⇒ diagnóstico y comportamiento actual; cada regla atrapa errores por tipo | PASS |
| VI. Huella mínima | 0 dependencias | PASS |
| VII. Contrato único; tipos generados | `inference-config` regenerado (`npm run generate -w schema`); documentos sin cambios | PASS |
| Quality / Workflow / Governance | Unitarias por clase nueva; rama + PR; sin enmiendas | PASS |

**Post-design re-check**: PASS. Desviación justificada: ajuste del fixture 009 `SyntheticDesktop.vbproj` (`<OptionStrict>Off` → `On`): es test data no afirmada por ningún escenario (la declaración por archivo en `CustomerForm.vb`, sí afirmada, se conserva); el escenario 009 "Issues of the synthetic desktop corpus" fija el conjunto exacto de issues y la regla nueva de proyecto lo rompería.

## Architecture

```text
 .vbproj ──► VbProjectFile (RootNamespace, Imports, OptionStrict, OutputType, StartupObject, .rdlc)
                │
                ├─► VbProjectLoader.LoadAdhoc: CompilationOptions(rootNamespace, globalImports)
                │       └─► VbTypeIndex ids (symbol) / fallback name with root
                ├─► Pass 8b VbLayerClassifier (+016): Presentación | Reportes | Batch | Validator
                │       annotations Layer:<fine>, EntryPoint:Main ; layer ← projection map
                └─► Pass 11c VbDebtAnalyzer (NEW, debt.enabled): PROJECT_OPTION_STRICT_OFF,
                        UI_CALL_IN_BUSINESS_LAYER, SQL_CONCAT_INJECTION, STATIC_FACADE,
                        MIXED_TRANSACTION_MODELS, GOD_CLASS(minLoc, minComplexity)
 InferenceConfig.debt ──► DotNetBridgeAnalyzer --config {dataAccess, debt} (only when non-default)
 Java MicroserviceRecommendationEngine.buildEntrypointFromComponents:
      EntryPoint:Main annotation ──► legacy_entrypoint { type: internal, primary_entry_class, exposed_operations:[Main], description "Proceso por lotes…" }
```

## Design

1. **`VbProjectFile`** (`Analysis/Vb/VbProjectFile.cs`): `Load(path)` lee con `XDocument` (DTD deshabilitada, como `AppConfigParser`): `RootNamespace` (validado como identificador calificado), `GlobalImports` (`<Import Include>`), `OptionStrictOff` (`<OptionStrict>Off`, sin distinguir mayúsculas), `IsExe` (`OutputType` `Exe`/`WinExe`), `StartupObject`, `ReportDefinitions` (`<None|Content|EmbeddedResource Include="*.rdlc">`). Errores ⇒ `[WARN]` y valores por defecto. `VbProjectContext` gana `FindProjectFile(directory)` (primer `.vbproj` ordinal). Research D1.
2. **Identidad**: `VbProjectLoader.LoadAdhoc(projectPath)` localiza el `.vbproj` (el propio si se pasó, o el primero ordinal del directorio) y compila con `new VisualBasicCompilationOptions(OutputKind.DynamicallyLinkedLibrary).WithRootNamespace(root).WithGlobalImports(GlobalImport.Parse(imports))`. `VbTypeIndex.FallbackName` antepone la raíz cuando se conoce (`VbTypeIndex.Build(compilation, rootNamespace)`); `TypeAnalyzer` sigue usando el símbolo (ya calificado). Research D2.
3. **Capas finas** (`VbLayerClassifier`, extendido): tras las reglas de 009, `FineLayer(entries, component, project)`: Presentación si bases ∋ nombre terminado en `Form|UserControl|XtraForm|XtraUserControl|WaitForm` o existe `<Nombre>.Designer.vb` junto al archivo; Reportes si bases ∋ nombre que contiene `Report`, el tipo menciona `LocalReport`, o existe `<Nombre>.rdlc` en el proyecto; Batch si `ModuleBlockSyntax` con `Sub Main` (o `StartupObject` lo nombra); Validator si el nombre termina en `Validator` o el proyecto en `.Validators`. Emisión: `Annotations += "Layer:Presentación|Reportes|Batch"`, `Annotations += "EntryPoint:Main"`; `layer` = `Web` (Presentación, Reportes), `Negocio` (Batch, Validator); las reglas 009 que ya dan `Web` se conservan (y ganan la anotación). Research D3.
4. **Punto de entrada por lotes** (Java): en `buildEntrypointFromComponents`, antes de mensajería/EJB: si algún componente tiene `annotations ∋ "EntryPoint:Main"` ⇒ `new LegacyEntrypoint("internal", <menor id ordinal>, List.of("Main"), null, List.of(), "Proceso por lotes (Sub Main) sin endpoints: se ejecuta por línea de comandos o planificador. Entrada principal: <Simple>.")`. Research D4.
5. **Configuración `debt`** (Java `DebtConfig(String enabled, int godClassMinLoc, int godClassMinComplexity)`; defaults `auto`, 1000, 15; validación: `enabled ∈ auto|on|off`, umbrales ≥ 1): sección en `InferenceConfig`, `inference-defaults.json`, schema, `engine/CONFIGURATION.md`, tipos TS. `DotNetBridgeAnalyzer` incluye `debt` en el archivo temporal cuando difiere del default (`DebtConfig.affectsAnalyzer()`); .NET `AnalysisOptions.Debt` (`DebtOptions`). Research D5.
6. **Pasada 11c `VbDebtAnalyzer`** (`Analysis/Vb/VbDebtAnalyzer.cs`), tras 11b, si `Enabled(options, language)`: por tipo (`VbTypeIndex.OwnNodes`) — `UI_CALL_IN_BUSINESS_LAYER` (invocación `MsgBox|MessageBox.Show|InputBox` y la capa fina no es Presentación); `SQL_CONCAT_INJECTION` (asignación/argumento de texto de comando con pliegue que contiene palabra clave SQL **y** un hueco); `STATIC_FACADE` (`ClassBlockSyntax` con todos los métodos/propiedades `Shared`, ≥ 1 campo `Shared` no `ReadOnly`/`Const`, y sin miembros de instancia salvo constructores); `MIXED_TRANSACTION_MODELS` (identificadores `BeginTransaction`/`*Transaction` y `TransactionScope` en el mismo tipo); `GOD_CLASS` (`component.Loc > minLoc && component.ComplexityMax > minComplexity`, tras 7b); `PROJECT_OPTION_STRICT_OFF` (una por componente del proyecto, `Line = 0`, `Location = <proyecto>.vbproj`). Ordenación final como `VbCodeAnalyzer`. Research D6.
7. **Fixture `SyntheticLegacyDebt`** (`Fixtures/VbLegacy/SyntheticLegacyDebt/`): `.vbproj` con `RootNamespace`, `OptionStrict Off`, `OutputType Exe`, `StartupObject`, un `.rdlc`; clases: formulario heredado de una base propia que hereda de `XtraForm` (nombre), control con `.Designer.vb`, reporte, módulo `Sub Main`, validador, fachada estática, componente con ambos modelos de transacción, SQL concatenado, `MsgBox` en negocio, clase dios (generada, > 1000 LOC); negativos por regla. Golden con y sin `debt.enabled=off`. `SyntheticDesktop.vbproj`: `OptionStrict` → `On` (README). Goldens 020 regenerados (anotaciones nuevas) con justificación.
8. **Pruebas**: Reqnroll para `specs/021-*/tests/features/*.feature` (tercer `ItemGroup`); Cucumber `RunDesktopIdentityFeaturesTest` para `@engine` (`legacy_entrypoint`, configuración `debt`, puente). Prueba `Corpus` opt-in: SC-001.
9. **Docs**: `docs/VB-LEGACY.md` (capas finas, punto de entrada, reglas), `engine/CONFIGURATION.md` (sección `debt`), `docs/SCHEMA.md`, `CHANGELOG.md`.

## Project Structure

### Documentation (this feature)

```text
specs/021-desktop-identity-layers/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/debt-config-and-annotations.md
├── checklists/requirements.md
└── tests/features/*.feature
```

### Source Code

```text
engine/src/main/dotnet/DotNetAnalyzer/
  Analysis/AnalysisOptions.cs                 # + DebtOptions (enabled, godClassMinLoc, godClassMinComplexity)
  Analysis/ProjectAnalyzer.cs                 # project file per compilation; pass 11c; root namespace to index/layers
  Analysis/Vb/VbProjectFile.cs                # NEW .vbproj reader
  Analysis/Vb/VbProjectContext.cs             # + FindProjectFile
  Analysis/Vb/VbProjectLoader.cs              # compilation options (root namespace, global imports)
  Analysis/Vb/VbTypeIndex.cs                  # fallback name with root namespace
  Analysis/Vb/VbLayerClassifier.cs            # fine layers, annotations, projection
  Analysis/Vb/VbDebtAnalyzer.cs               # NEW pass 11c
engine/src/main/java/com/extractor/
  inference/config/DebtConfig.java (NEW), InferenceConfig.java, InferenceConfigValidator.java
  analyzer/DotNetBridgeAnalyzer.java          # debt section in the temp config
  inference/MicroserviceRecommendationEngine.java  # batch entry point
engine/src/main/resources/static-inference/inference-defaults.json
schema/1.0.0/inference-config.schema.json · schema/extensions/*.ts (regenerated)
engine/CONFIGURATION.md · docs/VB-LEGACY.md · docs/SCHEMA.md · CHANGELOG.md
engine/src/test/dotnet/DotNetAnalyzer.Tests/
  DotNetAnalyzer.Tests.csproj                 # + 021 features
  Analysis/Vb/VbProjectFileTests.cs · VbDebtAnalyzerTests.cs · VbLayerClassifierFineTests.cs
  Bdd/DesktopSteps.cs                         # 021 steps
  Fixtures/VbLegacy/SyntheticLegacyDebt/**    # NEW fixture
  Fixtures/VbLegacy/SyntheticDesktop/SyntheticDesktop.vbproj  # OptionStrict On (test data)
  Fixtures/Golden/SyntheticLegacyDebt*.golden.json · SyntheticProcedures*.golden.json (regenerated)
engine/src/test/java/com/extractor/desktopbdd/{RunDesktopIdentityFeaturesTest,DesktopIdentitySteps}.java
engine/src/test/java/com/extractor/inference/config/DebtConfigTest.java
```

**Structure Decision**: las reglas de deuda viven en `Analysis/Vb/` (solo VB por ahora, como las pasadas 009); la lectura del `.vbproj` es una clase reutilizable por loader, capas y deuda.

## Complexity Tracking

| Riesgo / desviación | Por qué | Mitigación |
|---|---|---|
| Fixture 009 modificado (`OptionStrict` de proyecto) | El escenario 009 de issues fija el conjunto exacto; la regla nueva de proyecto añadiría 9 issues | Solo test data no afirmada; declaración por archivo conservada; README documenta |
| `Batch` → `Negocio` cambia la capa de módulos con `Sub Main` (hoy `Compartida`) | El plan define Batch como punto de entrada de negocio | Solo VB; ningún fixture actual tiene `Sub Main` |
| Goldens 020 cambian (anotaciones) | Las anotaciones de capa fina son nuevas | Regenerados en el mismo commit con justificación |
| Reglas sintácticas con falsos positivos (`*Transaction`, `Shared`) | Sin resolución semántica | Casos negativos en el fixture; limitaciones documentadas; perfil por capa queda para 019 |

## Requirement Coverage

| Requisitos | Diseño |
|---|---|
| FR-001..FR-004 | Design 1, 2 (research D1, D2) |
| FR-010..FR-016 | Design 3, 4 (research D3, D4) |
| FR-020 | Design 6 |
| FR-030..FR-036 | Design 5, 6 (research D5, D6); contrato debt-config-and-annotations |
| FR-040..FR-044 | Design 7, 8, 9; baselines y goldens |
| SC-001, SC-006 | prueba `Corpus` opt-in |
| SC-002..SC-005 | fixture nuevo, escenarios, baselines, `schema_version` |
