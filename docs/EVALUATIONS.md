# Evaluaciones

Esta página reúne las evaluaciones hechas sobre dev-arch, con sus datos reales: qué se midió, cómo, con qué
resultado y qué se encontró. Respalda la tesis del proyecto (ver [README](../README.md#la-tesis)): una
modernización asistida por IA es confiable cuando se apoya en un análisis **determinista**, que dice cómo está
el sistema sin inventar y que puede repetirse y compararse en cada cambio.

Fecha de las mediciones: 2026-10-24 · versión del producto `1.2.0` · contrato `schema/1.0.0`.

---

## 1. Determinismo y reproducibilidad

**Pregunta:** ¿la misma entrada produce la misma salida, en ejecuciones distintas y en máquinas distintas?

### 1.1 Misma máquina, dos ejecuciones

Cada proyecto de demostración se analizó dos veces con el motor (CLI) y se compararon los documentos generados
(`output.json`, `output_architecture.json`, `output_entrypoints.json`) con SHA-256.

| Proyecto | Tecnología | Ejecución 1 vs 2 |
|---|---|---|
| `java-standar` | Java (Spoon) | idénticas |
| `jee-architecture-master` | Java EE (Spoon) | idénticas |
| `legacy-erp` | Java legacy (Spoon) | idénticas |
| `dotnet-ecommerce` | .NET C# (Roslyn) | idénticas |
| `dotnet-legacy-clinic` | .NET C# (Roslyn) | idénticas |
| `dotnet-unstructured` | .NET C# sin solución en la raíz | idénticas |

Además, la CI verifica en cada cambio que dos ejecuciones sean byte a byte iguales
(`SchemaVersionContractTest.twoRunsAreByteIdentical`) y que la salida coincida con las líneas base versionadas
(`BaselineParityTest`, `DefaultOutputsRegressionTest`).

### 1.2 Máquinas distintas

La primera ejecución de la CI en GitHub (Linux) comparó sus salidas con las líneas base capturadas en macOS y
encontró **dos dependencias del entorno** que el análisis local no podía ver. Las dos se corrigieron:

| Hallazgo | Causa | Corrección | Verificación |
|---|---|---|---|
| **BUG-008** — `CBO promedio 1,9` en macOS (español) y `1.9` en Linux (inglés) | formato numérico con el locale por defecto de la JVM | locale fijo para el texto de justificación | `LocaleIndependenceTest`: misma arquitectura con locale `en-US` y `es-CO` |
| **BUG-009** — `ControllerBase` sin resolver en macOS, `Microsoft.AspNetCore.Mvc.ControllerBase` en Linux | la resolución semántica .NET depende de los *targeting packs* instalados | SDK 8 fijado en `global.json` (el de la CI y del contenedor); aviso `[WARN] … unresolved type references` cuando falta | la salida de `dotnet-ecommerce` en macOS con SDK 8 es idéntica a la del runner de GitHub |

Conclusión: el determinismo no es solo "sin aleatoriedad": también exige declarar el entorno canónico y avisar
cuando una máquina no puede reproducirlo. Ese aprendizaje quedó en el principio IV de la
[Constitución](../CONSTITUTION.md).

---

## 2. Análisis de proyectos de demostración

Motor de `main`, SDK .NET 8, MacBook (Apple Silicon). Tiempos de la CLI, incluida la carga de la JVM.

| Proyecto | Componentes | LOC | Dependencias internas | Endpoints | Tablas | Propuestas (Alta / Media / Baja) | Hallazgos (Crít. / Error / Adv. / Info) | Con secretos | Tiempo |
|---|---:|---:|---:|---:|---:|:---:|:---:|---:|---:|
| `java-standar` | 27 | 431 | 44 | 15 | 6 | 0 / 2 / 0 | 0 / 0 / 0 / 23 | 0 | 2,2 s |
| `jee-architecture-master` | 19 | 581 | 17 | 4 | 3 | 1 / 1 / 1 | 0 / 0 / 0 / 5 | 1 | 2,1 s |
| `legacy-erp` | 20 | 1006 | 42 | 7 | 10 | 0 / 1 / 3 | 0 / 0 / 7 / 6 | 5 | 2,7–3,9 s |
| `dotnet-ecommerce` | 22 | 591 | 25 | 10 | 5 | 0 / 1 / 4 | 2 / 2 / 8 / 17 | 2 | 6,7 s |
| `dotnet-legacy-clinic` | 19 | 899 | 14 | 15 | 5 | 0 / 0 / 5 | 10 / 10 / 71 / 90 | 0 | 7,1–8,0 s |
| `dotnet-unstructured`¹ | 19 | 741 | 4 | 4 | — | — | 0 / 0 / 1 / 2 | — | <1 s |

¹ Su proyecto está en una subcarpeta (`Api/`). Por diseño (feature 008), la detección automática mira solo la raíz
salvo que se active la búsqueda anidada con la configuración de inferencia `{"detection": {"maxDepth": 1}}`: sin
ella el tipo es `UNKNOWN` y el análisis sale vacío (con un aviso). La fila muestra el resultado del analizador .NET
sobre la carpeta, en modo de resolución reducida porque no hay solución ni proyecto en la raíz.

Lectura: el sistema clínico legacy concentra 20 hallazgos críticos o de error y ninguna propuesta viable sin
refactorizar (las 5 son de viabilidad baja). Es justo el caso en que la IA debe refactorizar primero y el análisis
determinista verificar después que esos números bajan (ver
[modernización continua](CONTINUOUS-MODERNIZATION.md)).

---

## 3. Uso desde un agente de IA (Claude Code por MCP)

**Pregunta:** ¿un agente puede enviar un proyecto, recibir el análisis y razonar sobre él sin acceso al disco del
servidor?

Sesión real de `claude -p` (Claude Code 2.1.310) con dev-arch registrado por el puente MCP
(`dev-arch-mcp.mjs`), contra un servidor que no ve el disco del agente.

| Medida | Resultado |
|---|---|
| Herramientas usadas | `analyze_project` → `get_proposals` → `get_findings` (`min_severity: ERROR`) |
| Duración total de la sesión | 14,9 s |
| Costo de la sesión | USD 0,31 |
| Resultado | 27 componentes, 2 propuestas de viabilidad media con sus métricas, 0 hallazgos ERROR/CRITICAL y el enlace al mismo análisis en la web |
| Fidelidad | Los números de la respuesta coinciden con el resumen de la web para ese análisis (también verificado por el escenario 013 TS-009) |

![Claude Code usando dev-arch por MCP](images/agent-claude-code.png)

Otra evaluación hecha durante esta prueba: lanzado a través de un enlace simbólico (rutas temporales de macOS), el
puente no respondía (**BUG-012**, corregido: compara rutas reales).

---

## 4. Batería de pruebas

| Capa | Herramienta | Cantidad | Resultado |
|---|---|---:|---|
| Motor Java | JUnit 5 + Cucumber-JVM | 723 pruebas (113 omitidas a propósito por condiciones declaradas, p. ej. el corpus VB externo o los escenarios de extremo a extremo del schema-check, que corren en su propio job) | verde |
| Analizador .NET | xUnit + Reqnroll | 309 (categoría `Corpus` excluida) | verde |
| Web | `node:test` | 269 | verde · cobertura de líneas **97,2 %** (umbral 85 %) |
| Aceptación | Cucumber-JS | 334 escenarios rápidos; 362 con los lentos (motor real, web en marcha, clones limpios) | verde |
| Navegador | Playwright | 32 escenarios (incluye ícono, margen y enlace `?analysis=`) | verde |
| Contrato | `make schema-check` | Java, .NET, MCP y tipos TypeScript contra `schema/1.0.0` | verde |

Integridad de las pruebas: los escenarios BDD de las features 001–014 están bloqueados por hash (`context.json`
+ nota de git); todos los hashes verifican.

## 5. Puertas de calidad

| Puerta | Valor | Límite |
|---|---|---|
| Checkstyle (motor) | 4589 avisos | ≤ 4589 (línea base que solo puede bajar) |
| SpotBugs (motor) | 0 | 0 |
| `dotnet format` | sin cambios | sin cambios |
| Typecheck y lint (web) | sin errores | sin errores |
| Cobertura web | 97,2 % | ≥ 85 % |
| Secretos en la historia publicada | 0 (escaneo de patrones y GitGuardian en cada PR) | 0 |

## 6. Integración continua

Primera ejecución completa en GitHub Actions tras el traslado a este repositorio (`main`, commit `2aa2786`,
2026-10-24): **todos los jobs en verde**. Cada job de área tiene un límite de 20 minutos; los clones limpios, 45.

| Job | Duración |
|---|---:|
| Engine Java — pruebas / análisis estático | 6 min / <1 min |
| Engine .NET | 2 min |
| Web | 2 min |
| Contrato — schema-check / escenarios 005 | 2 min / ~18 min |
| Aceptación por grupos (006 ×3, 007, 010, 011, 012-013, 014) | 1–6 min cada uno |
| Navegador (Playwright) | 10 min |
| Imagen Docker (build, salud, doctor, análisis de demo) | 3 min |
| Distribución por plataforma (linux-x64, osx-arm64, osx-x64, win-x64) | 1 min cada una |
| Clon limpio (`make build && make test`) — 006 TS-007 | 14 min |
| Clon limpio — 006 TS-006 | 23 min |
| Clon limpio — 014 TS-003 (producto en la raíz) | 23 min |

Antes de repartirla (BUG-011), la aceptación nunca terminaba dentro de su límite: la CI no se había ejecutado nunca
en el monorepo de origen, y la primera ejecución real lo destapó.

---

## 7. Hallazgos de la evaluación

| Id | Hallazgo | Estado |
|---|---|---|
| BUG-007 | Fallo intermitente de `twoRunsAreByteIdentical[dotnet-ecommerce]` | cerrado 2026-10-30: no reproducido tras BUG-009 (CI verde y 6 corridas locales consecutivas); se reabre con el diff si vuelve |
| BUG-008 | Números de la justificación según el locale de la JVM | corregido |
| BUG-009 | Resolución .NET según los SDK instalados | corregido (SDK 8 canónico + aviso) |
| BUG-010 | Fases de progreso perdidas cuando llegan junto con la respuesta | corregido |
| BUG-011 | Jobs de CI fuera de su límite de tiempo | corregido (matrices) |
| BUG-012 | Puente MCP mudo al lanzarse por un enlace simbólico | corregido |
| — | La detección automática solo mira la raíz del proyecto | **por diseño** (008): búsqueda anidada opcional con `detection.maxDepth` (TS-048 la verifica) |
| BUG-014 | Un análisis rápido no mostraba fase "en ejecución" en la web | corregido |
| 009 BUG-001 | Un fallo de Roslyn al construir el árbol de operaciones de una expresión descartaba todos los issues del tipo VB | corregido (deuda del motor 014b) |
| 009 BUG-002 | `RegexMatchTimeout` en `SqlTableParser`: las tablas dependían de la carga de la máquina | corregido: límite de 8192 caracteres por literal, sin timeout |
| 002 BUG-008 | Enumeraciones de archivos sin ordenar (`LoadCSharpAdhoc`, `Files.walk`) | corregido: orden ordinal en todas; comprobación de fuentes en `bugfix_BUG-008.feature` |

Detalle de cada uno (síntoma, causa, corrección y prueba): [`specs/014-standalone-repo/bugs.md`](../specs/014-standalone-repo/bugs.md), [`specs/009-vb-legacy-completion/bugs.md`](../specs/009-vb-legacy-completion/bugs.md) y [`specs/002-dotnet-roslyn-analyzer/bugs.md`](../specs/002-dotnet-roslyn-analyzer/bugs.md) (BUG-007 y BUG-008).

## 8. Feature 020 (procedimientos almacenados) sobre el corpus de referencia VB

Corrida local 2026-10-30 (macOS, SDK 8, fidelidad reducida), `engine/target/dotnet-analyzer <referencia>` dos veces
seguidas (opt-in, corpus externo no redistribuible):

| Métrica | Antes (009) | Después (020) |
|---|---|---|
| Componentes | 1 110 | 1 110 |
| Componentes `*Adapter` con `tables_used` | 1 de 159 | 139 de 156 (89 %) |
| Procedimientos distintos (`sp:`) | 0 | 899 |
| Advertencias "Procedure name is not a literal" | — | 4 |
| Doble corrida (JSON y advertencias) | — | byte a byte idéntica |

Criterios de salida del plan (`PLAN-VB-PLATAFORMA-LEGACY.md` §4, feature 015): ≥ 80 % de adaptadores con datos y
≥ 850 procedimientos distintos: cumplidos. Las salidas de `test-for-demo/*` (líneas base v1.1.0 y v1.2.0) no cambian.
La prueba opt-in `VbCorpusSmokeTests` ("020 SC-002/SC-008") repite esta medición con el límite de tiempo.

## 9. Feature 021 (identidad, capas, deuda) sobre el corpus de referencia VB

Corrida local 2026-10-30 (macOS, SDK 8, fidelidad reducida, carpeta sin `.sln` con 14 `.vbproj`):

| Métrica | Antes (020) | Después (021) |
|---|---|---|
| Compilaciones Adhoc | 1 (todo el directorio) | 14 (una por proyecto, orden de `ProjectReference`) + 1 C# |
| Componentes sin namespace | 229 | 47 (todos en los 11 proyectos sin `<RootNamespace>`) |
| Aristas / entre proyectos | 1 249 / 971 | 1 251 / 973 |
| `*.Win.*` con `Layer:Presentación`/`Reportes` | — | 161 de 171 (94 %) |
| Puntos de entrada por lotes | 0 | 1 (`Layer:Batch`, `EntryPoint:Main`) |
| Issues de deuda nuevos | — | `PROJECT_OPTION_STRICT_OFF` 90, `UI_CALL_IN_BUSINESS_LAYER` 37, `STATIC_FACADE` 33, `GOD_CLASS` 13, `MIXED_TRANSACTION_MODELS` 5, `SQL_CONCAT_INJECTION` 4 |
| Avisos BUG-001 (árbol de operaciones) | 2 | 0 (los `Import` globales resuelven `Int64`) |
| Tiempo analizador .NET / doble corrida | ~40 s | ~16 s / byte a byte idéntica |

Hallazgo: al compilar por proyecto, cada proyecto debe referenciar solo sus `ProjectReference` declaradas (referenciar
todas las compilaciones anteriores no cambia la resolución pero no es lo que hace MSBuild) y las pasadas de invocación
deben compartir el ámbito de componentes de todas las compilaciones VB: con el ámbito por compilación se perdían las
971 aristas entre proyectos. La prueba opt-in `VbCorpusSmokeTests` ("021 SC-001/SC-006") fija estos umbrales.

## 10. Feature 022 (integraciones externas, dependencias EOL, proyectos ausentes) sobre el corpus de referencia VB

Corrida local 2026-10-30 (macOS, SDK 8, fidelidad reducida):

| Métrica | Valor |
|---|---|
| Integraciones salientes distintas (`Integration:*`) | 19 (WCF 3: Articulo140Service, BanguatServiceReference, OFACService; SOAP 2: Milliman*; REST 14 claves de configuración + `dynamic`) |
| Componentes con integraciones | 30 |
| Proyectos referenciados ausentes de la entrega | 36 (una advertencia) |
| Dependencias EOL distintas | 13 (Enterprise Library 3.1, ActiveReports 3, ReportViewer) |
| Direcciones completas en la salida | ninguna (solo hosts y claves) |
| Doble corrida | byte a byte idéntica; ~17 s |

Hallazgo: los clientes generados se consumen desde otros proyectos con `Imports <Referencia>` y nombres sin calificar,
y las URL REST llegan por campos (`BaseURL`) inicializados desde `appSettings`; sin esas dos resoluciones (referencias
globales e inicializadores) la detección era 1 integración. La prueba opt-in `VbCorpusSmokeTests` ("022 SC-001") fija
los umbrales (≥ 12 integraciones, ≥ 11 proyectos ausentes, ≥ 3 EOL, sin direcciones).

## 11. Feature 023 (preset `legacy-desktop`, nombres por dominio, soporte, índice de deuda) sobre el corpus de referencia VB

Corrida local 2026-10-30 (macOS, SDK 8, fidelidad reducida, CLI Java `--language=dotnet --config='{"detection":{"maxDepth":3}}'`, preset `auto` → `legacy-desktop`):

| Métrica | Sin preset (`inference.preset = none`) | Con preset `legacy-desktop` | Criterio SC-001 |
|---|---|---|---|
| Propuestas | 103 (Alta 2, Media 6, Baja 95) | 44 (Media 2, Baja 42) | ≤ 25 · ≥ 50 % Media/Alta — **no cumplido** |
| Librerías de soporte | 4 | 16 (WebServices 120+46+28…, Generics 54, Utilities 46, infraestructura 33) | — |
| Propuesta mayor | 234 componentes | 152 (clúster residual sin arista ni raíz de entidad) | ≤ 120 — **no cumplido** |
| Línea `Deuda técnica` por propuesta | ninguna | 44 de 44 (0.34–0.80) | todas — cumplido |
| Nombres | tokens de clase (`Componente de Controllers y Annualbasesalar`) | `Componente de Model.Policies · PolicyPremiumDetail`, `… · PolicyLog`, `… · PolicyMember` | dominio reconocible — cumplido salvo el clúster residual |
| Doble corrida | idéntica | byte a byte idéntica | cumplido |
| `test-for-demo/*` | — | byte a byte idénticos (preset no aplica a Java/C#) | cumplido |

Hallazgos:

- El corpus no tiene campo `domain` (el analizador VB no lo emite) y sus namespaces son **capas técnicas** (`Model.Policies` 330, `Common.WebServices` 245, `Win.Policies` 171, `Common.Adapters` 71, `Common.Controllers` 42). La agrupación por dominio inferido produce capas horizontales; el preset fuerza la ruta de entidades (`clustering.singleDomainRatio` 0.25) y agrupa por la **raíz de la entidad de procedimiento** (`clustering.procedureGrouping = entity`: 142 adaptadores → 60 raíces; `AMPsp_Policy*` con prefijo de corpus `Policy`), porque la unión transitiva por procedimientos compartidos colapsa 858 componentes en un grupo por los procedimientos concentradores.
- Controladores, formularios y clases de modelo se adhieren a su corte vertical por llamadas (`clustering.attachCallersToTargets`: llamadas salientes, luego llamadores, luego raíz en el nombre de la clase), con tope `consolidation.domainMergeMaxSize`; 152 componentes sin aristas ni raíz reconocible quedan en un clúster residual.
- La similitud de tokens (`highTokenSimilarity`) debía quedar en 1.0: en este perfil todos los nombres comparten tokens y la regla levantaba el tope de tamaño.
- La viabilidad sigue mayoritariamente **Baja** con métricas honestas: la cohesión interna por llamadas de los cortes es 1–57 % y el acoplamiento entre cortes 33–100 %, aun ignorando las llamadas a soporte (`viability.ignoreSupportCoupling`) y con umbrales 0.6/0.4. El índice de deuda (0.34–0.80) resta 0.05–0.12. Conclusión para la referencia: el monolito es un único dominio (pólizas) en capas; la propuesta útil son cortes por entidad con deuda visible, no microservicios "viables" en la escala original. SC-001 queda registrado como **parcial**; decisión pendiente del usuario (§7 del plan): aceptar la escala o reducir los umbrales/recalibrar la cohesión para el perfil.
- BUG-010 (022): el modelo Java no aceptaba `code_issues[].type = DEPENDENCY`, por lo que la CLI Java fallaba sobre cualquier grafo VB con dependencias EOL (la medición de 022 se hizo con el analizador .NET directo). Corregido en 023.

## Cómo reproducir

```bash
export DOTNET_ROOT="$HOME/.dotnet8" PATH="$HOME/.dotnet8:$PATH"     # SDK 8 canónico (ver INSTALL.md)
make build && make test                                              # pruebas y puertas
DEVARCH_E2E=true make test-acceptance && make test-e2e-browser       # escenarios lentos y navegador
java -jar engine/target/java-dependency-extractor.jar engine/test-for-demo/java-standar out.json   # un análisis
java -jar engine/target/java-dependency-extractor.jar "$(realpath engine/test-for-demo/vb-demo-legacy)" out.json --language=dotnet --config=cfg.json  # referencia VB (cfg: {"detection":{"maxDepth":3}})
```
