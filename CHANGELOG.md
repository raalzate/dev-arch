# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versionado [SemVer](https://semver.org/lang/es/).

## [Unreleased]

### Añadido (feature 023, inferencia para el perfil desktop legacy)
- Preset `legacy-desktop` (`inference.preset`: `auto` lo aplica a grafos Visual Basic) como configuración parcial versionada bajo la configuración explícita; se registra en `summary` (`Preset de inferencia: legacy-desktop`).
- Cortes verticales (`consolidation.verticalSliceRatio`), presentación fuera de la cohesión (`inference.presentationInCohesion`), nombres por dominio de namespace y entidad (`naming.strategy = domain`), librerías de soporte por namespace y fan-in (`recommendation.supportNamespaces`, `recommendation.minReferencingDomains`).
- Índice de deuda técnica por componente y propuesta como tercer factor de viabilidad (`viability.debtWeight`; líneas `Deuda técnica` y `Mayor deuda` en `rationale`). Contrato 1.0.0 sin cambios; salidas por defecto byte a byte idénticas.

### Añadido (feature 010, experiencia de modernización)
- Web: recorrido de cinco pasos (Resumen, Mapa del sistema, Propuestas, Hallazgos, Plan) con perfil tecnológico
  (Java / .NET · C# / VB.NET) que decide qué secciones se muestran; las secciones vacías no se muestran.
- Web: mapa d3 reescrito (tipos y pesos de dependencias, agrupación por capa o propuesta, severidad, tabla alternativa).
- Web: panel de parámetros de inferencia (`reinfer_architecture`) y re-puntuación de propuestas editadas
  (`score_proposal`); rutas `GET /api/analyses`, `GET /api/inference/defaults`, `POST /api/analyses/{id}/reinfer|score`.
- Web: hallazgos con contratos (endpoints) y puntos de entrada legacy; plan exportable a Markdown, JSON y PDF (impresión).
- Web: historial y comparación de dos análisis; tema claro/oscuro; documentación IA por tecnología con proveedor
  `gemini` o `anthropic`.
- Contrato: tipos TypeScript y validadores generados para `inference-config`, `mcp/reinfer_architecture` y
  `mcp/score_proposal` (re-testify aprobado de 005 TS-028); la web ya no declara tipos del contrato a mano.

### Añadido (feature 008, extracción e inferencia configurables)
- Motor: la extracción (`ExtractionService`) y la inferencia (`InferenceService`, pura) son etapas separadas;
  `AnalysisService` queda como fachada.
- Motor: configuración de inferencia con nombre (`InferenceConfig`) con todos los pesos, umbrales y listas; carga parcial
  validada desde `--config=<archivo>` (CLI) o `config`/`configPath` (MCP). **Sin configuración las salidas son byte a byte
  idénticas a 1.2.0** (línea base `engine/src/test/resources/baseline-v1.2.0`).
- MCP: `reinfer_architecture` y `score_proposal` (con `STATIC_INFERENCE_INFERENCE_TOOLS=true`), recursos `algorithms`,
  `configuration`, `configuration/defaults` y `schema`.
- Detección de proyectos anidados opcional (`detection.maxDepth`, 0 por defecto).
- Opción `recommendation.dataJaccardMode = data_cohesion` (opt-in).
- Contrato: `inference-config.schema.json` y dos respuestas MCP nuevas dentro de 1.0.0 (aditivo; los documentos existentes y
  `meta.schema_version` no cambian); sin tipos TypeScript generados todavía).

### Cambiado (feature 008)
- La elección de la palabra de rol en la similitud de tokens sigue el orden declarado (antes dependía del orden aleatorio
  por proceso de `Set.of`); sin cambios en los proyectos de demostración.
- SpotBugs: eliminadas las exclusiones heredadas marcadas para 008 con limpieza sin cambio de comportamiento.

### Añadido (feature 009, cierre de VB.NET legacy)
- Analizador .NET: pasadas solo para compilaciones Visual Basic (las de C# no cambian): tablas desde SQL literal plegado
  (`&`/`+`, continuaciones de línea) y DataSets tipados `.xsd`; CBO, LCOM y complejidad ciclomática con
  `HIGH_CYCLOMATIC_COMPLEXITY`; referencias de configuración (`ConfigurationManager`, `ConfigurationSettings`,
  `My.Settings`) y credenciales en texto plano de `app.config`/`web.config` (`PLAINTEXT_SECRET_IN_CONFIG`, sin valores en la
  salida); issues VB (`ON_ERROR_RESUME_NEXT`, `OPTION_STRICT_OFF`, `GOTO_STATEMENT`, `LATE_BINDING`) y los patrones generales;
  capas de escritorio (formularios y reportes, controladores, acceso a datos, módulos, servicios web); endpoints ASMX y WCF.
- Fidelidad reducida declarada: un `.vbproj` sin biblioteca base resuelta por MSBuild cae a la carga Adhoc (sin `bin/`/`obj/`),
  `meta.source = roslyn-fallback` y una advertencia de usuario por proyecto VB (`[warning] …` en stderr del analizador, recogida
  por el motor en `_meta["static-inference/warnings"]` y en el CLI). Los análisis C# no producen advertencias nuevas.
- Corpus VB sintético redistribuible en las pruebas .NET; el corpus real sigue siendo opcional (categoría `Corpus`).
  Escenarios BDD con Reqnroll (.NET) y Cucumber-JVM (`@engine`). Documentación en `docs/VB-LEGACY.md`.
  **Sin cambio de contrato (1.0.0); salidas C# y Java byte-idénticas.**

### Añadido (feature 007, integración runtime nativa)
- Web: análisis asíncronos persistidos en disco (`/api/analyses*`), servicio único del motor en modo MCP con reinicio ante
  caída, cola y cuota de concurrencia, caducidad y limpieza, carga segura (límites, zip-slip, enlaces simbólicos, bombas ZIP,
  disco lleno), visor de código restringido al proyecto del análisis, importación de resultados validada contra el contrato,
  interfaz asíncrona que retoma el análisis tras recargar.
- Web: respuestas sin rutas absolutas del servidor, token compartido opcional `DEVARCH_API_TOKEN` y aviso de exposición.
- Motor: `language` en MCP y `--language` en CLI, progreso por fases (`notifications/progress`), reutilización en memoria del
  modo MCP, advertencias en `_meta` y en stderr del CLI. **Sin cambio de contrato (1.0.0).**

### Añadido (feature 022, integraciones externas, proyectos ausentes y dependencias EOL — plan VB legacy 017)
- Motor .NET: integraciones salientes (Service/Web References por espacio de nombres, `ClientBase(Of T)`,
  `SoapHttpClientProtocol`, REST con URL literal o clave de configuración, endpoints de cliente de `app.config`) como
  anotaciones `Integration:wcf|soap|rest:<destino>` y `external_dependencies` (`service:`, `http:`); solo el host.
- Motor .NET: `packages.config` y `<Reference Include>` de terceros en `external_dependencies`; lista versionada
  `schema/eol-dependencies.json` (ampliable con `dependencies.eol`) → `EOL_DEPENDENCY` y `Dependency:eol:<nombre>`;
  proyectos referenciados ausentes → advertencia y `project:<Nombre>`; `*.vdproj` → advertencia.
- Configuración: secciones `integrations` y `dependencies` (contrato aditivo, tipos regenerados); activas por defecto
  solo en fuentes VB. Corpus sintético `SyntheticIntegrations` con golden.

### Añadido (feature 021, identidad, capas y puntos de entrada del perfil desktop — plan VB legacy 016)
- Motor .NET: el cargador VB de fidelidad reducida aplica `<RootNamespace>` e `<Import>` globales del `.vbproj` y
  compila un proyecto por `.vbproj` anidado (orden de `ProjectReference`, referencias entre compilaciones).
- Motor .NET: capas finas de escritorio como anotaciones (`Layer:Presentación`, `Layer:Reportes`, `Layer:Batch`,
  `EntryPoint:Main`) proyectadas al catálogo `layer` de 1.0.0; validadores → Negocio; el motor declara
  `legacy_entrypoint` `internal` de proceso por lotes para las propuestas con `Sub Main`.
- Motor .NET: pasada de deuda legacy (`debt.enabled`, solo VB por defecto): `PROJECT_OPTION_STRICT_OFF`,
  `UI_CALL_IN_BUSINESS_LAYER`, `SQL_CONCAT_INJECTION`, `STATIC_FACADE`, `MIXED_TRANSACTION_MODELS`, `GOD_CLASS`
  (umbrales `debt.godClass.*`); sección `debt` de la configuración (contrato aditivo, tipos regenerados).
- Corpus sintético `SyntheticLegacyDebt` con golden; `SyntheticDesktop` y `SyntheticProcedures` compilan con
  `Option Strict On` a nivel de proyecto (test data).

### Añadido (feature 020, acceso a datos por stored procedures — plan VB legacy 015)
- Motor .NET: pasada 5c de procedimientos almacenados (Enterprise Library `GetStoredProcCommand`/`Execute*`, ADO.NET
  `CommandType.StoredProcedure` + `CommandText`, Dapper `commandType`) en VB y C#, emitidos en `tables_used` como
  `sp:<nombre>`; catálogo opcional sp → tablas (scripts `CREATE PROCEDURE` o CSV) con modos `complement`/`replace`,
  resolución transitiva de `EXEC` y advertencias deterministas; opción `dotnet-analyzer <path> --config=<file>`.
- Motor: sección `dataAccess` de la configuración de inferencia (`procedures`, `procedureCatalog`, `catalogMode`,
  `procedureWeight`, `entityHeuristic`), contrato aditivo en `inference-config.schema.json` y tipos regenerados;
  los `sp:` pesan como tablas en el agrupamiento, `tables_shared` y la cohesión de datos; heurística de entidad
  opcional para nombrar propuestas. Activa por defecto solo en fuentes VB: salidas C#/Java sin cambios.
- Corpus sintético `SyntheticDesktop` ampliado con `PolicyAdapter.vb` y catálogo (`Catalog/procs`, `procs.csv`);
  golden files con y sin catálogo.

### Corregido (014b, deuda del motor previa al plan VB legacy)
- Motor .NET: un fallo de Roslyn al construir el árbol de operaciones de una expresión (constructor base implícito con
  parámetro opcional de tipo no resuelto, fallback Adhoc) ya no descarta todos los issues del tipo VB; se omite solo la
  detección de enlace tardío de esas expresiones con un `[WARN]` que las nombra (009 BUG-001).
- Motor .NET: `SqlTableParser` sin `RegexMatchTimeout`; límite determinista de 8192 caracteres por literal SQL con aviso
  (009 BUG-002, principio IV).
- Motor: todas las enumeraciones de archivos se ordenan antes de usarse (`LoadCSharpAdhoc`, `Files.walk` en resolvers,
  escáner de secretos, detección anidada y recursos MCP); comprobación de fuentes en `bugfix_BUG-008.feature` (002 BUG-008).
- BUG-007 (doble corrida intermitente) cerrado como no reproducido tras BUG-009; deuda registrada en
  `docs/ARCHITECTURE.md` (walkers C#/VB duplicados) y origen único de binarios documentado en `docs/INSTALL.md`.

### Cambiado
- `POST /api/analyze` queda obsoleta (`Deprecation`, `Link` a `/api/analyses`); misma petición y respuesta.
- `GET /api/source` exige `jobId` y una ruta relativa; la forma `?path=<absoluta>` responde 400.

## [1.2.0] - 2026-10-08

### Añadido
- **Contrato de datos formal y versionado 1.0.0** (feature 005): JSON Schema 2020-12 en `schema/1.0.0/` para `output.json`, `output_architecture.json`, `output_entrypoints.json` y las 5 respuestas MCP; versión en `schema/VERSION`; política y notas de migración en `docs/SCHEMA.md`.
- `meta.schema_version` (`"1.0.0"`) en el grafo de Java y .NET, serializado justo después de `meta.source` (cambio aditivo).
- Objeto `meta` (`{ "schema_version": "1.0.0" }`) como primera clave de `output_architecture.json`, `output_entrypoints.json` y de `api_contracts` en el grafo (aditivo; `analyze_project` y `get_component_metrics` no cambian de forma).
- Advertencia del puente .NET cuando el analizador .NET declara otra versión del contrato (o ninguna); se emite la versión del motor.
- Paquete privado `schema/` (`@static-inference/schema`) con tipos TypeScript y validadores zod generados (`schema/generated/`).
- `make schema-check` (`scripts/schema-check.sh`): verificación única de Java, .NET, tipos generados y coherencia de versión; job CI bloqueante `schema-check`.
- Runner Cucumber JVM para los escenarios `.feature` de la feature 005 (solo scope `test`; sin dependencias nuevas en el fat JAR ni en `dotnet-analyzer`).

### Corregido (1.2.0)
- Release: `dotnet-analyzer` se publica framework-dependent; el bundle single-file nunca cargaba MSBuild y siempre emitía `roslyn-fallback` (BUG-005). **Requisito nuevo:** runtime .NET 8 (SDK para carga completa vía MSBuild).
- `DotNetToolLocator` admite entorno inyectable; tests herméticos (BUG-006).
- Checkstyle baseline ratchet 4788 → 4763.

## [1.1.0] - 2026-10-07

### Añadido
- Soporte VB.NET legacy (.NET Framework 4.8 desktop): carga de `.vbproj` (MSBuild + fallback Adhoc fuera de Windows), filtro de archivos autogenerados, tipos, invocaciones, DI, mensajería, LOC y capa (feature 004).
- `ProjectTypeDetector` reconoce `*.vbproj` como proyecto .NET.
- Variable `STATIC_INFERENCE_COLLECTED_AT=true` para emitir `meta.collected_at` (opt-in).

### Cambiado (comportamiento)
- **`meta.collected_at` ya no se emite por defecto** (Java y .NET). Salidas repetidas son byte-idénticas (principio IV). Consumidores que lo lean deben tratarlo como opcional o activar el opt-in.
- **Clasificación de capa C#:** una clase cuyo nombre termina en `Controller` pero sin atributos HTTP ni clase base de controlador web se clasifica `Negocio` en lugar de `Controlador` (antes era falso positivo). Aplica a C# y VB.
- Nombres de propuestas deterministas: precedencia fija de palabras de rol (antes variaba entre ejecuciones en clases con dos roles, p. ej. `OrderServiceHandler`).

### Corregido
- Puente Java↔.NET: lectura concurrente de stdout/stderr (sin deadlock) y timeout efectivo.
- `DotNetToolLocator` encuentra `dotnet-analyzer.exe` en Windows.
- Escritura de JSON con UTF-8 explícito (antes dependía del encoding por defecto de la plataforma).

### Infraestructura
- CI: SpotBugs, Checkstyle y `dotnet format` bloqueantes con baseline; tests de corpus VB excluidos en CI (`Category!=Corpus`).
- `obj/` y salidas generadas fuera de git.
- `ALGORITHMS.md` y `CONFIGURATION.md` alineados con el código.

## [1.0.0]
- Versión inicial: análisis Java (Spoon) y .NET C# (Roslyn), CLI y servidor MCP.
