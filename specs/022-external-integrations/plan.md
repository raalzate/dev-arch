# Implementation Plan: Integraciones externas, proyectos ausentes y dependencias EOL

**Branch**: `022-external-integrations` | **Date**: 2026-10-30 | **Spec**: [spec.md](./spec.md) (plan feature 017)

## Summary

Una pasada VB nueva (12b, `VbIntegrationAnalyzer`) detecta las integraciones salientes de cada componente por evidencia sintáctica y de archivos de proyecto — carpetas `Service References`/`Web References` y su uso por espacio de nombres, herencia de `ClientBase(Of T)`/`SoapHttpClientProtocol`, clientes REST (`RestClient`, `HttpClient`, `WebRequest.Create`) con URL literal, clave de configuración o dinámica — y las emite como anotaciones `Integration:<wcf|soap|rest>:<destino>` y entradas `service:`/`http:` de `external_dependencies`; `AppConfigParser` lee `system.serviceModel/client/endpoint` y añade `Integration:wcf:<contract>@<host>`. `VbProjectFile` gana `packages.config`, `<Reference Include>` y la detección de `ProjectReference` ausentes y `.vdproj`; una pasada de dependencias (12c, `VbDependencyAnalyzer`) rellena `external_dependencies` con los nombres simples de terceros, marca `EOL_DEPENDENCY` según `schema/eol-dependencies.json` (embebido en el analizador, ampliable por `dependencies.eol`) y advierte de los proyectos ausentes. Secciones `integrations` y `dependencies` de la configuración (auto = VB), transportadas por el `--config` de 020. Contrato 1.0.0 intacto.

## Technical Context

**Language/Version**: C# / .NET 8 (Roslyn 4.9.2 VB), Java 17 (configuración, puente)
**Primary Dependencies**: existentes; `System.Xml.Linq` (BCL) para `.svcmap`/`Reference.map`/`packages.config`/`app.config`. 0 nuevas
**Testing**: Reqnroll + xUnit (.NET), Cucumber `@engine` (Java), goldens, prueba `Corpus` opt-in
**Constraints**: contrato 1.0.0; baselines y escenarios bloqueados 001-021 intactos; `auto` = VB; sin red; sin direcciones completas ni valores de configuración en la salida; determinismo
**Scale/Scope**: 4 historias, 20 FR, 5 SC; .NET: `VbIntegrationAnalyzer`, `VbDependencyAnalyzer`, `EolCatalog`, `VbProjectFile` (+packages/references/missing), `AppConfigParser` (+client endpoints), `AnalysisOptions` (+2 secciones), `ProjectAnalyzer` (pasadas 12b/12c); Java: `IntegrationsConfig`, `DependenciesConfig`, `InferenceConfig`, validador, defaults, puente; `schema/eol-dependencies.json`, schema `inference-config` aditivo, tipos TS; fixture `SyntheticIntegrations`; docs

## Constitution Check

```
CONSTITUTION GATE ACTIVE — CONSTITUTION.md v2.0.0
```
| Principio | Evaluación | Estado |
|---|---|---|
| I | Sin cambio de contrato (anotaciones, cadenas, issue con tipo abierto); pasadas `auto` solo VB; C#/Java byte-idénticos; schema `inference-config` aditivo | PASS |
| II | Lectura de archivos de proyecto en `VbProjectFile`/`AppConfigParser`; una pasada por responsabilidad; proyección host en un helper (`Hosts.Of`) | PASS |
| III | testify antes de tasks; rojo antes del código | PASS |
| IV | Orden ordinal de carpetas, archivos, anotaciones, dependencias y advertencias; lista EOL versionada; sin red ni tiempo | PASS |
| V | Archivos de referencia/paquetes ilegibles ⇒ diagnóstico y se continúa; URL dinámica ⇒ advertencia; proyectos ausentes ⇒ advertencia única | PASS |
| VI | 0 dependencias; lista EOL embebida (sin descarga) | PASS |
| VII | `inference-config` regenerado; documentos sin cambio | PASS |

## Architecture

```text
 .vbproj / packages.config / Service References / Web References / app.config / *.vdproj
        └─► VbProjectFile (+ Packages, AssemblyReferences, ServiceReferences, MissingProjectReferences)
            AppConfigParser (+ ClientEndpoints)
 Pass 12b VbIntegrationAnalyzer (integrations.outbound): Integration:wcf|soap|rest:<target>, service:/http: deps, warnings
 Pass 12c VbDependencyAnalyzer (dependencies.enabled): third-party deps, EOL_DEPENDENCY (EolCatalog ← schema/eol-dependencies.json + dependencies.eol), project:<missing>, warnings (.vdproj)
 InferenceConfig.integrations / .dependencies ──► DotNetBridgeAnalyzer --config (only when non-default)
```

## Design

1. **`VbProjectFile`**: `Packages` (`packages.config` junto al proyecto: `package/@id`), `AssemblyReferences` (`<Reference Include>` nombre simple antes de la coma, sin framework), `ServiceReferences` (subcarpetas de `Service References` → kind `wcf`; de `Web References` → `soap`), `MissingProjectReferences(analyzedRoot)` (ProjectReference cuyo archivo no está bajo la raíz analizada), `SetupProjects` (`*.vdproj` bajo la raíz: detectado por `ProjectAnalyzer`).
2. **`AppConfigParser`**: `ClientEndpoints` (`contract`, `host` = `Hosts.Of(address)`, `binding`, `name`), sin direcciones completas.
3. **`Hosts.Of(url)`**: `Uri.TryCreate` ⇒ `Host` (sin puerto, credenciales, ruta ni consulta); si no es URI absoluta ⇒ null.
4. **`VbIntegrationAnalyzer`** (pasada 12b, tras 11c): por tipo (`VbTypeIndex.OwnNodes`): (a) `QualifiedNameSyntax`/`MemberAccess` cuyo primer identificador es el nombre de una referencia de servicio del proyecto (o de cualquier proyecto analizado) ⇒ `Integration:<kind>:<Nombre>` + `service:<Nombre>`; (b) `Inherits ClientBase(Of T)` ⇒ `Integration:wcf:<T>` + `service:<T>`; `Inherits SoapHttpClientProtocol` ⇒ `Integration:soap:<Clase>` + `service:<Clase>`; (c) `New RestClient(x)`, `New HttpClient()` + `.BaseAddress = x`, `WebRequest.Create(x)`/`HttpWebRequest.Create(x)` ⇒ `x` literal plegado con host ⇒ `Integration:rest:<host>` + `http:<host>`; `ConfigurationManager.AppSettings("K")`/`My.Settings.K`/`Settings.Default.K` ⇒ `Integration:rest:<K>` + `http:<K>`; otro ⇒ `Integration:rest:dynamic` + advertencia `Outbound URL is not a literal or a configuration key in <id> (<file>:<line>)`. (d) Endpoints de cliente: para cada anotación `Integration:wcf:<Ref>` y endpoint cuyo `contract` empieza por `<Ref>.` ⇒ `Integration:wcf:<contract>@<host>`.
5. **`EolCatalog`**: `schema/eol-dependencies.json` (`[{ "prefix": "Microsoft.Practices.EnterpriseLibrary.", "maxVersion": "5.*", "reason": "Enterprise Library reached end of life in 2013" }, …]`) embebido como recurso enlazado del analizador; `Matches(name, version?)` por prefijo sin mayúsculas y versión mayor ≤ `maxVersion`; `dependencies.eol` añade prefijos sin razón.
6. **`VbDependencyAnalyzer`** (pasada 12c): por proyecto: `external_dependencies` += paquetes ∪ referencias de terceros (una vez cada uno) + `project:<Ausente>`; por coincidencia EOL ⇒ `EOL_DEPENDENCY` (`DEPENDENCY`, `WARNING`, `Line 0`, `Location = <proyecto>.vbproj`, mensaje con nombre y razón) + `Dependency:eol:<nombre>` en cada componente del proyecto; advertencias de usuario: `Referenced projects not included in the analyzed sources: A, B` (una por análisis, nombres ordenados) y `Setup project(s) without support since Visual Studio 2010: X.vdproj` (una por análisis).
7. **Configuración**: Java `IntegrationsConfig(String outbound)` y `DependenciesConfig(String enabled, List<String> eol)`; validación (`auto|on|off`, lista de cadenas no vacías); `inference-defaults.json`; schema; `engine/CONFIGURATION.md`; .NET `AnalysisOptions.Integrations/Dependencies`; puente incluye las secciones cuando no son las de por defecto.
8. **Fixture `SyntheticIntegrations`** (`Fixtures/VbLegacy/SyntheticIntegrations/`): `Service References/Ofac` (`Ofac.svcmap`, `Ofac.wsdl`), `Web References/Holiday` (`Reference.map`, `Holiday.wsdl`), `Clients/OfacGateway.vb` (usa `Ofac.OfacClient`), `Clients/HolidayGateway.vb` (usa `Holiday.HolidayService`), `Clients/PricingClient.vb` (`ClientBase(Of IPricing)`), `Clients/LegacySoapClient.vb` (`SoapHttpClientProtocol`), `Clients/RatesClient.vb` (REST literal, clave, dinámico), `Rules/NoIntegration.vb` (negativo), `app.config` con dos endpoints, `packages.config`, `.vbproj` con referencias de terceros (una EOL) y `ProjectReference` ausente, `Setup/Installer.vdproj`; golden con y sin flags.
9. **Pruebas**: Reqnroll para `specs/022-*/tests/features/*.feature` (cuarto `ItemGroup`); Cucumber `RunExternalIntegrationsFeaturesTest` (`@engine`, glue propio + `storedprocsbdd`); prueba `Corpus` opt-in (SC-001).
10. **Docs**: `docs/VB-LEGACY.md`, `engine/CONFIGURATION.md`, `docs/SCHEMA.md`, `CHANGELOG.md`.

## Project Structure

```text
engine/src/main/dotnet/DotNetAnalyzer/
  Analysis/AnalysisOptions.cs                      # + IntegrationsOptions, DependenciesOptions
  Analysis/ProjectAnalyzer.cs                      # passes 12b/12c, .vdproj discovery, missing references
  Analysis/Vb/VbProjectFile.cs                     # + Packages, AssemblyReferences, ServiceReferences, MissingProjectReferences
  Analysis/Vb/AppConfigParser.cs                   # + ClientEndpoints
  Analysis/Vb/Hosts.cs                             # NEW host projection
  Analysis/Vb/EolCatalog.cs                        # NEW (embedded schema/eol-dependencies.json)
  Analysis/Vb/VbIntegrationAnalyzer.cs             # NEW pass 12b
  Analysis/Vb/VbDependencyAnalyzer.cs              # NEW pass 12c
  DotNetAnalyzer.csproj                            # EmbeddedResource link to ../../../../schema/eol-dependencies.json
schema/eol-dependencies.json · schema/1.0.0/inference-config.schema.json · schema/extensions/*.ts
engine/src/main/java/com/extractor/inference/config/{IntegrationsConfig,DependenciesConfig}.java, InferenceConfig, Validator, defaults
engine/src/main/java/com/extractor/analyzer/DotNetBridgeAnalyzer.java · service/ExtractionService.java · service/AnalysisService.java
engine/src/test/dotnet/DotNetAnalyzer.Tests/{Bdd/IntegrationSteps.cs, Analysis/Vb/*Tests.cs, Fixtures/VbLegacy/SyntheticIntegrations/**, Fixtures/Golden/SyntheticIntegrations*.golden.json}
engine/src/test/java/com/extractor/integrationsbdd/{RunExternalIntegrationsFeaturesTest,ExternalIntegrationsSteps}.java
docs/VB-LEGACY.md · engine/CONFIGURATION.md · docs/SCHEMA.md · CHANGELOG.md
```

## Complexity Tracking

| Riesgo | Mitigación |
|---|---|
| Uso de referencias por espacio de nombres es sintáctico (puede confundir con otro namespace homónimo) | Solo nombres de carpetas de referencia realmente presentes; caso negativo en el fixture |
| Lista EOL subjetiva | Archivo versionado con razón por entrada; ampliable por configuración; documentada |
| Transporte de más secciones por `--config` | Mismo mecanismo probado en 020/021 |

## Requirement Coverage

| FR | Diseño |
|---|---|
| FR-001..005 | Design 1, 3, 4 |
| FR-010 | Design 2, 4(d) |
| FR-020 | Design 1, 6 |
| FR-030..033 | Design 1, 5, 6 |
| FR-040..044 | Design 7, 8, 9, 10 |
