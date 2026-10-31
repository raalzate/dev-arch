# Guía de Configuración del Motor de Inferencia

Este documento describe la **configuración de inferencia** (feature 008-configurable-inference): todos los pesos, umbrales, factores y listas que determinan la agrupación, la consolidación, los nombres, la viabilidad y el ensamblado de propuestas. Para la descripción de los algoritmos ver [ALGORITHMS.md](ALGORITHMS.md).

> [!IMPORTANT]
> **Sin configuración, el motor se comporta exactamente como la versión 1.2.0**: los valores por defecto son los antiguos literales del código y los documentos producidos son byte a byte idénticos (regresión `src/test/resources/baseline-v1.2.0`). Solo cambia lo que se declara.

El analizador .NET (`src/main/dotnet/DotNetAnalyzer`) no contiene umbrales de inferencia: solo extrae el grafo; la inferencia es común y ocurre en Java.

## Cómo se configura

Una configuración es un objeto JSON **parcial**: cada propiedad es opcional y las omitidas conservan su valor por defecto. Los objetos se fusionan recursivamente; las listas, los textos, los números y el mapa `naming.infrastructureLabels` reemplazan el valor por defecto completo.

```json
{
  "viability": { "thresholds": { "high": 0.8, "medium": 0.6 } },
  "evidence": { "evidenceThreshold": 0.6, "weights": { "token": 0.45, "call": 0.20 } },
  "detection": { "maxDepth": 2 }
}
```

| Punto de entrada | Cómo |
|---|---|
| Línea de comandos | `java -jar engine.jar <proyecto> <salida.json> [--language=java\|dotnet\|auto] [--config=<archivo.json>]` (opciones en cualquier orden tras los dos argumentos posicionales) |
| MCP `analyze_project`, `reinfer_architecture`, `score_proposal` | `config` (objeto en línea) **o** `configPath` (ruta absoluta a un archivo JSON); ambos a la vez es un error |

No se descubre automáticamente ningún archivo dentro del proyecto analizado: la configuración siempre es explícita. Contrato formal: `schema/1.0.0/inference-config.schema.json`. Los valores por defecto vigentes también se publican como recurso MCP `static-inference://configuration/defaults`.

En el modo servidor, solo los análisis con la configuración por defecto se reutilizan (caché en memoria de 007); un análisis con otra configuración se calcula siempre y no se guarda.

### Validación y errores

La configuración se valida **antes** de analizar; ante un error no se escribe ningún documento (CLI: mensaje en la salida de error y código de salida 1; MCP: `isError: true`).

| Caso | Mensaje |
|---|---|
| parámetro desconocido | `Invalid inference configuration: <ruta>: unknown parameter` |
| tipo JSON incorrecto | `Invalid inference configuration: <ruta>: must be a number` (o `an integer`, `a string`, `an array of strings`, `an object`) |
| fuera de rango | `Invalid inference configuration: <ruta>: must be between 0 and 1` (o `must be >= 0`, `must be between 0 and 5`) |
| par incoherente | `Invalid inference configuration: viability.thresholds.medium: must be <= viability.thresholds.high` |
| enumerado | `Invalid inference configuration: recommendation.dataJaccardMode: must be one of legacy, data_cohesion` |
| archivo | `Inference configuration file '<ruta>' does not exist` / `is not readable` / `is not valid JSON: <detalle>` |

Los pesos de evidencia y de viabilidad no tienen por qué sumar 1, pero conviene mantener la suma para que los umbrales conserven su significado.

## Parámetros

| Parámetro | Tipo | Valor por defecto | Rango | Etapa | Efecto |
|---|---|---|---|---|---|
| `detection.maxDepth` | int | `0` | 0..5 | detección | Profundidad de búsqueda de marcadores (`pom.xml`, `build.gradle[.kts]`, `*.sln`, `*.csproj`, `*.vbproj`) en subcarpetas cuando la raíz no tiene ninguno. 0 = solo raíz (comportamiento 1.2.0). |
| `clustering.singleDomainRatio` | double | `0.75` | [0,1] | agrupación | Si el dominio más grande supera esta fracción de componentes, el proyecto se agrupa por entidades (proyecto de un solo dominio). |
| `clustering.largeClusterRatio` | double | `0.5` | [0,1] | agrupación | Si el clúster más grande de la agrupación por responsabilidad supera esta fracción, se recurre a la agrupación por dominio. |
| `evidence.weights.table` | double | `0.25` | [0,1] | evidencia | Peso del Jaccard de tablas en el `evidenceScore`. |
| `evidence.weights.call` | double | `0.35` | [0,1] | evidencia | Peso de la densidad de llamadas. |
| `evidence.weights.token` | double | `0.3` | [0,1] | evidencia | Peso de la similitud de tokens. |
| `evidence.weights.event` | double | `0.1` | [0,1] | evidencia | Peso (binario) de los enlaces de eventos. |
| `evidence.edgeThreshold` | double | `0.1` | [0,1] | evidencia | Se crea arista entre dos clústeres solo si `evidenceScore` es mayor que este valor. |
| `evidence.callDensitySaturation` | double | `0.5` | (0,1] | evidencia | `callDensity = min(1, cruzadas / (internas × valor))`. |
| `evidence.strongSignals.table` | double | `0.4` | [0,1] | evidencia | Jaccard de tablas a partir del cual la señal cuenta como fuerte. |
| `evidence.strongSignals.call` | double | `0.35` | [0,1] | evidencia | Densidad de llamadas a partir de la cual la señal es fuerte. |
| `evidence.strongSignals.token` | double | `0.6` | [0,1] | evidencia | Similitud de tokens a partir de la cual la señal es fuerte. |
| `evidence.evidenceThreshold` | double | `0.65` | [0,1] | evidencia | `evidenceScore` mínimo de un candidato a fusión. |
| `evidence.minStrongSignals` | int | `2` | 0..4 | evidencia | Señales fuertes mínimas de un candidato a fusión. |
| `evidence.roleKeywords` | string[] | `service, controller, repository, repo, usecase, operations, listener, publisher, adapter, factory, handler, db` | minúsculas | evidencia | Palabras de rol que habilitan la extracción de tokens; gana la primera que aparece en el nombre (orden declarado). |
| `evidence.excludeTokens` | string[] | `entity, model, data, dto, event, command, query` | no vacías | evidencia | Tokens ignorados por la similitud (se comparan tal cual; los segmentos de paquete conservan mayúsculas). |
| `evidence.minPackageTokenLength` | int | `3` | >= 0 | evidencia | Longitud mínima del último segmento de paquete usado como token. |
| `evidence.eventPublisherKeywords` | string[] | `publisher, event` | minúsculas | evidencia | Un componente cuyo FQCN contiene alguna se considera publicador de eventos. |
| `evidence.eventConsumerKeywords` | string[] | `listener, consumer` | minúsculas | evidencia | Un componente cuyo FQCN contiene alguna se considera consumidor de eventos. |
| `consolidation.genericNames` | string[] | `Componente de Negocio, Componente Desconocido, Componente de Infraestructura, Componente de Configuración` | no vacías | consolidación | Nombres que nunca disparan la fusión por nombre de dominio (fase 0). |
| `consolidation.domainMergeMaxSize` | int | `50` | >= 0 | consolidación | Tamaño combinado máximo de una fusión por nombre de dominio (fase 0). |
| `consolidation.significantInfrastructureRatio` | double | `0.3` | [0,1] | consolidación | Fracción de miembros con palabra de infraestructura que marca a un grupo como infraestructura (fase 0). |
| `consolidation.supportRatio` | double | `0.8` | [0,1] | consolidación | Fracción de miembros con palabra de infraestructura de un clúster de soporte (salvaguarda de soporte). |
| `consolidation.maxMergedSizeWithoutSimilarity` | int | `40` | >= 0 | consolidación | Tamaño combinado por encima del cual solo se fusiona con similitud de tokens alta. |
| `consolidation.highTokenSimilarity` | double | `0.75` | [0,1] | consolidación | Similitud de tokens que levanta la salvaguarda de tamaño. |
| `consolidation.separationCallDensity` | double | `0.15` | [0,1] | consolidación | Dos candidatos fuertes no se fusionan si la densidad de llamadas es menor que este valor y… |
| `consolidation.separationTableJaccard` | double | `0.2` | [0,1] | consolidación | …el Jaccard de tablas es menor que este valor. |
| `consolidation.strongCandidate.minCohesion` | double | `0.7` | [0,1] | consolidación | Cohesión mínima de un candidato fuerte. |
| `consolidation.strongCandidate.maxCoupling` | double | `0.3` | [0,1] | consolidación | El acoplamiento de un candidato fuerte debe ser menor que este valor. |
| `consolidation.strongCandidate.minSize` | int | `3` | >= 0 | consolidación | Miembros mínimos de un candidato fuerte. |
| `consolidation.infrastructureKeywords` | string[] | `config, configuration, security, application, exception, error, filter, interceptor, aspect, swagger, openapi, main` | minúsculas | consolidación | Palabras de infraestructura (nombre simple) de la consolidación. |
| `viability.weights.cohesion` | double | `0.5` | [0,1] | viabilidad | Peso de la cohesión ajustada en la puntuación. |
| `viability.weights.coupling` | double | `0.35` | [0,1] | viabilidad | Peso de `1 − acoplamiento externo`. |
| `viability.weights.data` | double | `0.15` | [0,1] | viabilidad | Peso de la cohesión de datos. |
| `viability.cohesionBlend.average` | double | `0.7` | [0,1] | viabilidad | Cohesión ajustada = este valor × cohesión media ponderada + … |
| `viability.cohesionBlend.density` | double | `0.3` | [0,1] | viabilidad | … este valor × densidad interna. |
| `viability.noTablesDataCohesion` | double | `0.5` | [0,1] | viabilidad | Cohesión de datos de una propuesta sin tablas. |
| `viability.smallSize.below` | int | `3` | >= 0 | viabilidad | Propuestas con menos miembros se penalizan (y la justificación lo indica). |
| `viability.smallSize.penalty` | double | `0.6` | [0,1] | viabilidad | Factor de la penalización de tamaño pequeño. |
| `viability.largeSize.above` | int | `50` | >= 0 | viabilidad | Propuestas con más miembros y densidad baja se penalizan (monolito). |
| `viability.largeSize.minDensity` | double | `0.5` | [0,1] | viabilidad | Densidad interna por debajo de la cual aplica la penalización de monolito. |
| `viability.largeSize.penalty` | double | `0.7` | [0,1] | viabilidad | Factor de la penalización de monolito. |
| `viability.thresholds.high` | double | `0.7` | [0,1], >= medium | viabilidad | Puntuación mínima de "Alta". |
| `viability.thresholds.medium` | double | `0.5` | [0,1] | viabilidad | Puntuación mínima de "Media". |
| `viability.rationale.cohesionGood` | double | `0.7` | [0,1] | justificación | Cohesión ajustada de un mensaje ✅. |
| `viability.rationale.cohesionFair` | double | `0.5` | [0,1], <= cohesionGood | justificación | Cohesión ajustada de un mensaje ⚠️ (por debajo: ❌ y razón de no viabilidad). |
| `viability.rationale.couplingGood` | double | `0.3` | [0,1], <= couplingFair | justificación | Acoplamiento por debajo del cual el mensaje es ✅. |
| `viability.rationale.couplingFair` | double | `0.5` | [0,1] | justificación | Acoplamiento por debajo del cual el mensaje es ⚠️ (desde aquí: ❌ y razón). |
| `viability.rationale.cboGood` | double | `5.0` | >= 0, <= cboFair | justificación | CBO medio de un mensaje ✅. |
| `viability.rationale.cboFair` | double | `10.0` | >= 0 | justificación | CBO medio de un mensaje ⚠️ (por encima: ❌ y razón). |
| `viability.rationale.lcomGood` | double | `0.3` | [0,1], <= lcomFair | justificación | LCOM medio de un mensaje ✅. |
| `viability.rationale.lcomFair` | double | `0.6` | [0,1] | justificación | LCOM medio de un mensaje ⚠️ (por encima: ❌ y razón). |
| `viability.rationale.dataGood` | double | `0.6` | [0,1] | justificación | Cohesión de datos de un mensaje ✅. |
| `viability.rationale.dataFair` | double | `0.3` | [0,1], <= dataGood | justificación | Cohesión de datos de un mensaje ⚠️ (por debajo y > 0: razón de no viabilidad). |
| `recommendation.supportRatio` | double | `0.8` | [0,1] | propuestas | Fracción de miembros con palabra de infraestructura que convierte un grupo en librería de soporte. |
| `recommendation.infrastructureKeywords` | string[] | `config, configuration, security, application, exception, error, filter, interceptor, aspect, swagger, openapi, main` | minúsculas | propuestas | Palabras de infraestructura (nombre simple) filtradas de las propuestas. |
| `recommendation.dataJaccardMode` | enum | `legacy` | legacy, data_cohesion | propuestas | `legacy`: `data_jaccard` fijo; `data_cohesion`: la cohesión de datos de la puntuación (opt-in). |
| `recommendation.legacyDataJaccard` | double | `0.8` | [0,1] | propuestas | `data_jaccard` emitido en modo `legacy` cuando la propuesta tiene tablas (0.0 sin tablas). |
| `naming.infrastructureRatio` | double | `0.8` | [0,1] | nombres | Fracción de miembros con palabra de infraestructura (FQCN) que produce un nombre de infraestructura. |
| `naming.infrastructureLabels` | map | `config→Configuración, security→Seguridad, auth→Autenticación, swagger→Documentación, email→Notificaciones por Email, notification→Notificaciones, log→Logging, audit→Auditoría, application→Aplicación Principal` | claves en minúsculas | nombres | Palabra de infraestructura → etiqueta del nombre. |
| `naming.roleKeywords` | string[] | `service, controller, repository, repo, usecase, operations, listener, publisher, adapter, factory, handler, db` | minúsculas | nombres | Palabras de rol de los nombres de negocio; gana la primera (orden declarado). |
| `naming.excludeTokens` | string[] | `entity, model, data, dto, event, command, query, impl, repository, service, controller, api, rest, http, adapter, port, localevents, rabbit, jpa, repo, dao, operations, listener, publisher, handler, factory, db, activityupdaterimpl, usecase, primaryports, secondaryports, userprofilejpa, tweetcrud, suggestion, suggestions` | no vacías | nombres | Tokens que nunca forman parte de un nombre (comparación exacta). |
| `naming.minTokenLength` | int | `3` | >= 0 | nombres | Longitud mínima de un token de nombre. |
| `dataAccess.procedures` | string | `auto` | auto, on, off | extracción | Detección de procedimientos almacenados en el analizador .NET (020): `auto` = solo compilaciones Visual Basic; `on` = todas; `off` = ninguna. |
| `dataAccess.procedureCatalog` | string | `null` | ruta o null | extracción | Carpeta de scripts `.sql` (`CREATE PROCEDURE`) o archivo `.csv` (`procedimiento,tabla,operación`) que traduce procedimientos a tablas; sin catálogo se emite `sp:<nombre>`. |
| `dataAccess.catalogMode` | string | `complement` | complement, replace | extracción | `complement` conserva `sp:<nombre>` junto a las tablas; `replace` emite solo tablas (y `sp:` para los no resueltos). |
| `dataAccess.procedureWeight` | double | `1.0` | >= 0 | agrupación | Peso de un recurso `sp:` respecto de una tabla en los datos compartidos, `tables_shared` y la cohesión de datos; 0 los ignora. |
| `dataAccess.entityHeuristic` | boolean | `false` | true, false | nombres | Deduce la entidad de negocio del nombre del procedimiento (`usp_Policy_Read` → `Policy`) solo para nombrar propuestas. |
| `debt.enabled` | string | `auto` | auto, on, off | extracción | Reglas de deuda legacy del analizador .NET (021): `auto` = solo compilaciones Visual Basic. |
| `debt.godClass.minLoc` | int | `1000` | >= 1 | extracción | Líneas de código a partir de las cuales un tipo puede ser `GOD_CLASS` (junto con la complejidad). |
| `debt.godClass.minComplexity` | int | `15` | >= 1 | extracción | Complejidad máxima de método a partir de la cual un tipo puede ser `GOD_CLASS` (junto con las líneas). |
| `integrations.outbound` | string | `auto` | auto, on, off | extracción | Integraciones salientes (SOAP/WCF/REST) del analizador .NET (022): `auto` = solo compilaciones Visual Basic. |
| `dependencies.enabled` | string | `auto` | auto, on, off | extracción | Dependencias externas, proyectos ausentes y fin de vida (022): `auto` = solo compilaciones Visual Basic. |
| `dependencies.eol` | string[] | `(vacía)` | no vacías | extracción | Prefijos de nombre añadidos a la lista versionada `schema/eol-dependencies.json` (issue `EOL_DEPENDENCY`). |

Las reglas internas de puntuación de clústeres (`HighCohesionRule`, `LowCouplingRule`, `SharedDataRule`) no forman parte de la configuración: su resultado no llega a ningún documento de salida.

## Re-inferencia y evaluación de propuestas (modo servidor)

La extracción (Spoon/Roslyn) y la inferencia son etapas separadas: la inferencia es una función pura del grafo, de las dependencias declaradas por el proyecto y de las ubicaciones de secretos, sin acceso a las fuentes.

| Herramienta MCP | Entrada | Salida |
|---|---|---|
| `reinfer_architecture` | `graphPath` **o** `jobId`; `config` \| `configPath`; `minViability` opcional | documento de arquitectura (mismo formato que `get_architecture_proposal`) |
| `score_proposal` | `components[]` (ids de componentes); `graphPath` **o** `jobId`; `config` \| `configPath` | nombre, viabilidad, puntuación, métricas (`cohesion_adjusted`, `external_coupling`, `data_cohesion`, `internal_edge_density`, `size`, `cluster_count`), componentes, clústeres, justificación y acciones |

- Las dos herramientas se registran solo si el servidor arranca con `STATIC_INFERENCE_INFERENCE_TOOLS=true` (variable de entorno o `-D`); por defecto el servidor ofrece exactamente las cinco herramientas de 001. La web siempre las habilita.
- `jobId` se resuelve como `<STATIC_INFERENCE_JOBS_DIR>/<jobId>/out/output.json` (la web fija la variable a `<ARCHVIEW_DATA_DIR>/jobs`); sin la variable solo se admite `graphPath`.
- Las dependencias de proyecto y las ubicaciones de secretos se toman de `<nombre>_architecture.json` junto al grafo; si falta, se omiten y la respuesta lleva la advertencia `Project metadata not found next to the graph …` en `_meta["static-inference/warnings"]`. Con la configuración por defecto, re-inferir el grafo de un análisis reproduce byte a byte su arquitectura.
- `score_proposal` descompone la lista en los fragmentos de los clústeres inferidos (misma configuración) que toca y la puntúa como un grupo de clústeres: puntuar exactamente los componentes de una propuesta existente sin infraestructura filtrada reproduce su viabilidad y su justificación.
- Rendimiento: `reinfer_architecture` sobre un grafo de 500 componentes responde en decenas de milisegundos con el servidor en marcha (criterio < 2 s).

## Correcciones opcionales e inconsistencias conocidas

| Tema | Por defecto (1.2.0) | Opción |
|---|---|---|
| `data_jaccard` emitido | 0.8 con tablas, 0.0 sin tablas: no está relacionado con la puntuación | `recommendation.dataJaccardMode = data_cohesion` emite la cohesión de datos usada en la viabilidad |
| Palabras clave de infraestructura | tres listas distintas: `consolidation.infrastructureKeywords` y `recommendation.infrastructureKeywords` (nombre simple, sin `auth`) y las claves de `naming.infrastructureLabels` (FQCN, con `auth`, `email`, `log`, `audit`, `notification`) | declarar la misma lista en las tres (ver ejemplo) |
| Salvaguarda de librería de soporte | evalúa solo el clúster raíz del grupo | no hace falta opción: solo se fusionan grupos con el mismo estado de soporte, por lo que todos los clústeres de un grupo comparten el estado de su raíz y la proporción del grupo completo cae del mismo lado del umbral (media ponderada). Lo verifica una prueba de invariante (TS-042). |

Configuración alineada recomendada (cambia la salida respecto de 1.2.0):

```json
{
  "consolidation": { "infrastructureKeywords": ["config", "configuration", "security", "auth", "application", "exception", "error", "filter", "interceptor", "aspect", "swagger", "openapi", "main"] },
  "recommendation": { "infrastructureKeywords": ["config", "configuration", "security", "auth", "application", "exception", "error", "filter", "interceptor", "aspect", "swagger", "openapi", "main"], "dataJaccardMode": "data_cohesion" }
}
```

## Detección de proyectos anidados

Con `detection.maxDepth = N > 0` y sin marcadores en la raíz, el motor busca `pom.xml`, `build.gradle[.kts]`, `*.sln`, `*.csproj` y `*.vbproj` en subcarpetas hasta profundidad N, ignorando `target`, `build`, `bin`, `obj`, `node_modules`, `.git`, `.svn`, `.hg`, `.idea`, `.vs`, `out` y `dist`. Un solo lenguaje elige su analizador y añade la advertencia `Nested project markers found (java|dotnet): <carpetas>`; ambos lenguajes producen el error de proyecto ambiguo con las carpetas encontradas. Los marcadores de la raíz siempre mandan. Ejemplo: `test-for-demo/dotnet-unstructured` (solo `Api/NominaDestajo.csproj`) se analiza hoy como Java sin componentes; con `maxDepth = 1` se detecta como .NET.

## Recursos MCP

| URI | Contenido |
|---|---|
| `static-inference://algorithms` | la guía de algoritmos (`ALGORITHMS.md`) |
| `static-inference://configuration` | esta guía |
| `static-inference://configuration/defaults` | la configuración por defecto en JSON |
| `static-inference://schema` | `{"schema_version": "1.0.0", "schemas": {<ruta>: <esquema>}}` |

## Casos de uso

### Arquitectura hexagonal (adaptadores en clústeres separados)

```json
{ "evidence": { "weights": { "token": 0.45, "call": 0.20 }, "evidenceThreshold": 0.60 } }
```

### Microservicios orientados a eventos

```json
{ "evidence": { "weights": { "event": 0.25, "token": 0.20, "table": 0.20, "call": 0.35 } } }
```

La detección de eventos empareja por nombre simple idéntico (ver ALGORITHMS.md §1.4): subir el peso puede no tener efecto.

### Monolito muy acoplado (todo sale "Baja")

```json
{ "viability": { "weights": { "cohesion": 0.6, "coupling": 0.25, "data": 0.15 } } }
```

### Proyectos pequeños

```json
{ "viability": { "smallSize": { "below": 2 } }, "consolidation": { "strongCandidate": { "minSize": 2 } } }
```

### Consolidación más agresiva / más conservadora

```json
{ "evidence": { "evidenceThreshold": 0.55, "minStrongSignals": 1 }, "consolidation": { "maxMergedSizeWithoutSimilarity": 60 } }
```

```json
{ "evidence": { "evidenceThreshold": 0.75, "minStrongSignals": 3 }, "consolidation": { "maxMergedSizeWithoutSimilarity": 25 } }
```

## Variables de entorno

| Variable | Por defecto | Efecto |
|---|---|---|
| `STATIC_INFERENCE_COLLECTED_AT` | ausente | Con `true` se emite `meta.collected_at` en el grafo (rompe la comparación byte a byte). |
| `STATIC_INFERENCE_INFERENCE_TOOLS` | ausente | Con `true` el modo servidor registra `reinfer_architecture` y `score_proposal`. |
| `STATIC_INFERENCE_JOBS_DIR` | ausente | Carpeta de análisis de la web para resolver `jobId`. |

## Constantes de análisis (extracción)

`src/main/java/com/extractor/constants/AnalysisConstants.java` centraliza las palabras de datos sensibles, el patrón SQL de tablas y las anotaciones de repositorios/entidades usadas por la **extracción**; no forman parte de la configuración de inferencia y cambiarlas exige recompilar.

## Iteración recomendada

1. Analizar una vez (CLI o `analyze_project`).
2. Re-inferir con `reinfer_architecture` cambiando un parámetro cada vez y comparar las propuestas.
3. Evaluar variantes manuales con `score_proposal`.
4. Fijar la configuración elegida en un archivo y usarla con `--config` o `configPath`.
