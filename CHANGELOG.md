# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versionado [SemVer](https://semver.org/lang/es/).

## [Unreleased]

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
