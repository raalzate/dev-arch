# Feature Specification: Calidad, CI/CD y entrega de dev-arch

**Feature Branch**: `011-quality-delivery`
**Created**: 2026-10-10
**Status**: Draft
**Input**: User description: "Fase 6 — Calidad, CI/CD y entrega (PLAN-INTEGRACION-DEV-ARCH.md), alcance acotado por el usuario (2026-10-10): pruebas unitarias de la web para el cliente del motor, las rutas de la API y las utilidades (ampliando lo existente); escenarios Gherkin heredados de 001–003 y de los bugfix de 002 ejecutables en la verificación del motor mediante definiciones de pasos nuevas (aditivas, sin tocar `.feature` ni hashes); quitar las tolerancias de errores de tipos y de lint del build web y volver bloqueantes la comprobación de tipos y el lint (corrigiendo el código; los errores de extensión `.ts` de los módulos generados se resuelven por configuración, no editando pruebas bloqueadas de 005); cobertura reportada para Java, .NET y TypeScript; release unificada en tags `dev-arch-v*` reutilizando la matriz actual (la imagen Docker es de 012); observabilidad mínima (logs estructurados por trabajo y métricas de duración por fase en el ejecutor de trabajos de la web). Además registrar y corregir el defecto conocido de `make test` que reutiliza un `dotnet-analyzer` publicado obsoleto, e investigar BUG-007 solo si es barato."

## Contexto

Las features 006–010 dejaron un producto único (`apps/dev-arch`): motor Java + analizador .NET, contrato versionado, web Next.js con ejecución asíncrona de análisis y una experiencia de modernización. La calidad de entrega todavía tiene huecos heredados:

- El build de la web tolera errores de tipos y de lint: hoy existen decenas de errores de tipos que nadie ve, y no hay configuración de lint.
- Los escenarios Gherkin bloqueados de las features 001 (servidor MCP), 002 (analizador .NET, incluidos los seis bugfix) y 003 (problemas de código .NET) no se ejecutan en ninguna verificación: sus criterios de aceptación solo están cubiertos indirectamente por pruebas unitarias.
- No se reporta cobertura de pruebas para ninguna de las tres pilas (Java, .NET, TypeScript).
- La release por tag publica solo los binarios del motor por plataforma; no comprueba que el tag coincida con la versión única del producto ni empaqueta los skills.
- El ejecutor de trabajos de la web no deja un registro estructurado ni tiempos por fase: diagnosticar un análisis lento o fallido exige leer la salida de error del motor.
- Defecto conocido: el comando de pruebas local reutiliza el analizador .NET publicado en `engine/target` aunque sus fuentes hayan cambiado, de modo que las pruebas pueden validar un analizador obsoleto.

La Constitución vigente (v1.0.0) obliga a: no romper salidas ni contratos (I), lógica de análisis única en el motor (II), TDD con aserciones inmutables (III), determinismo (IV), errores claros (V) y dependencias mínimas justificadas (VI). Por decisión del usuario (2026-10-09) la feature es **aditiva**: no se modifica ningún `.feature`, `context.json`, especificación, definición de pasos ni prueba existente de las features 001–010, y no se relaja ninguna puerta de calidad (Checkstyle ≤ 4763, SpotBugs 0, formato .NET).

## User Stories *(mandatory)*

### User Story 1 — Errores de tipos y de lint bloquean el build web (Priority: P1)

Como mantenedor, quiero que la web no pueda construirse ni pasar las pruebas con errores de tipos o de lint, para que los defectos de tipado no lleguen a producción sin ser vistos.

**Why this priority**: Hoy el build oculta errores reales; es la deuda de calidad más visible del plan y condición para que el resto de verificaciones de la web tengan sentido.

**Independent Test**: Ejecutar la comprobación de tipos, el lint y el build de la web sobre la rama: terminan sin errores; introducir un error de tipos en un archivo temporal hace fallar el build.

**Acceptance Scenarios**:

1. **Given** la configuración de build de la web, **When** se inspecciona, **Then** no contiene ninguna opción que ignore errores de tipos o de lint durante el build
2. **Given** el código de la web (producción y pruebas, incluidos los módulos generados del contrato que importa), **When** se ejecuta la comprobación de tipos, **Then** termina con 0 errores
3. **Given** el código de la web, **When** se ejecuta el lint con el conjunto de reglas recomendado del framework, **Then** termina con 0 errores
4. **Given** un archivo de la web con un error de tipos, **When** se ejecuta la comprobación de tipos, **Then** falla nombrando el archivo
5. **Given** el comando de pruebas de la web del producto y el trabajo de CI de la web, **When** se inspeccionan, **Then** ejecutan la comprobación de tipos y el lint sin tolerar fallos

---

### User Story 2 — Escenarios heredados de 001–003 ejecutados en la verificación del motor (Priority: P1)

Como mantenedor, quiero que todos los escenarios Gherkin bloqueados de 001, 002 (incluidos sus bugfix) y 003 se ejecuten contra el motor real en la verificación del motor, para que sus criterios de aceptación sean pruebas vivas y no documentación.

**Why this priority**: Son los criterios de aceptación del núcleo (servidor MCP, analizador .NET y problemas de código); sin ejecución pueden incumplirse en silencio.

**Independent Test**: Ejecutar la verificación del motor con el analizador .NET disponible y comprobar que cada escenario de 001–003 se ejecuta y pasa, sin pasos indefinidos ni pendientes; comprobar que los `.feature` y sus hashes son idénticos a la línea base.

**Acceptance Scenarios**:

1. **Given** los archivos `.feature` de 001, 002 y 003, **When** se ejecuta la verificación del motor, **Then** cada escenario se ejecuta con definiciones de pasos y ninguno queda indefinido, pendiente ni ambiguo
2. **Given** la verificación del motor con el analizador .NET disponible, **When** termina, **Then** todos los escenarios de 001–003 pasan y ninguno se omite
3. **Given** la verificación del motor sin el analizador .NET, **When** termina, **Then** los escenarios que lo necesitan se reportan como omitidos con un motivo explícito y el resto pasa
4. **Given** los `.feature`, los `context.json` y las pruebas existentes de 001–010, **When** se comparan con la línea base, **Then** ninguno ha cambiado y los hashes de aserción verifican
5. **Given** el trabajo de CI del motor Java, **When** se inspecciona, **Then** prepara el analizador .NET antes de la verificación, de modo que los escenarios .NET se ejecutan en CI

---

### User Story 3 — Cobertura reportada para Java, .NET y TypeScript (Priority: P1)

Como mantenedor, quiero un informe de cobertura de pruebas para cada pila del producto, local y en CI, para saber qué código no está probado.

**Why this priority**: Es el criterio de salida de la Fase 6 ("CI en verde con cobertura reportada para Java, .NET y TS").

**Independent Test**: Ejecutar el comando de cobertura del producto y comprobar que produce los tres informes legibles por máquina y un resumen por pila; inspeccionar CI y comprobar que publica los tres informes.

**Acceptance Scenarios**:

1. **Given** la verificación del motor Java, **When** termina, **Then** existe un informe de cobertura de líneas y ramas legible por máquina y en HTML
2. **Given** las pruebas del analizador .NET ejecutadas con el comando de cobertura, **When** terminan, **Then** existe un informe de cobertura legible por máquina
3. **Given** las pruebas unitarias de la web ejecutadas con el comando de cobertura, **When** terminan, **Then** existe un informe de cobertura legible por máquina y un resumen por archivo
4. **Given** el comando de cobertura del producto, **When** termina, **Then** imprime una línea de resumen por pila (porcentaje de líneas) y la ruta de cada informe
5. **Given** la definición de CI, **When** se inspeccionan los trabajos del motor Java, del motor .NET y de la web, **Then** cada uno genera su informe de cobertura y lo publica como artefacto

---

### User Story 4 — Pruebas unitarias de la web para cliente del motor, rutas de API y utilidades (Priority: P2)

Como mantenedor, quiero que cada ruta de la API, el cliente del motor y las utilidades del servidor tengan pruebas unitarias, para detectar regresiones sin arrancar la web ni el motor.

**Why this priority**: Hoy solo una ruta de API se carga en las pruebas unitarias; el resto se valida únicamente con escenarios lentos.

**Independent Test**: Ejecutar las pruebas unitarias de la web con cobertura y comprobar que cada módulo de rutas de API, del servidor y de utilidades aparece en el informe con al menos el umbral mínimo de líneas.

**Acceptance Scenarios**:

1. **Given** cada módulo de ruta de la API de la web, **When** se ejecutan las pruebas unitarias, **Then** el módulo se ejerce con al menos un caso de éxito y uno de error (validación, no encontrado o no autorizado según aplique)
2. **Given** el cliente del motor, **When** se ejecutan las pruebas unitarias, **Then** se cubren el arranque, la respuesta correcta, el error de herramienta, la caída del proceso y el tiempo agotado
3. **Given** el informe de cobertura de la web, **When** se evalúa sobre los módulos del servidor, de rutas de API y de utilidades no visuales, **Then** todos aparecen en el informe y la cobertura de líneas agregada es al menos 85 %, y si baja del umbral la verificación falla

---

### User Story 5 — Release unificada y coherente con la versión del producto (Priority: P2)

Como responsable de entregas, quiero que un tag `dev-arch-vX.Y.Z` publique en una sola release los paquetes del motor por plataforma y los skills empaquetados, y que falle antes de publicar si el tag no coincide con la versión única del producto.

**Why this priority**: Evita publicar artefactos con versión incoherente; la imagen de contenedor se añade en 012 sobre esta misma release.

**Independent Test**: Inspeccionar la definición de release: comprueba tag contra versión antes de construir, mantiene la matriz de plataformas y añade el paquete de skills con su suma de verificación a la misma release.

**Acceptance Scenarios**:

1. **Given** un tag `dev-arch-vX.Y.Z`, **When** se ejecuta la release, **Then** antes de construir o publicar nada se comprueba que X.Y.Z coincide con la versión única del producto y, si no coincide, la release falla con un mensaje que muestra ambos valores
2. **Given** la definición de release, **When** se inspecciona, **Then** la matriz de plataformas del motor (linux-x64, osx-arm64, osx-x64, win-x64, dependiente del framework) se mantiene sin cambios
3. **Given** un tag `dev-arch-v*`, **When** se ejecuta la release, **Then** la misma release publica un paquete de skills con su suma de verificación
4. **Given** la comprobación de versión del tag, **When** se ejecuta localmente con un tag de ejemplo, **Then** acepta el tag de la versión actual y rechaza cualquier otro

---

### User Story 6 — Observabilidad mínima de los análisis de la web (Priority: P2)

Como operador de la web, quiero un registro estructurado por análisis y la duración de cada fase, para diagnosticar análisis lentos o fallidos sin leer la salida cruda del motor.

**Why this priority**: Es la observabilidad mínima pedida en la Fase 6 y prerrequisito para operar la imagen de contenedor de 012.

**Independent Test**: Ejecutar un análisis con un motor simulado que reporta fases y comprobar el registro estructurado del trabajo, las duraciones por fase en el estado del análisis y una línea estructurada en la consola al terminar.

**Acceptance Scenarios**:

1. **Given** un análisis que termina, **When** se consulta su registro estructurado, **Then** contiene, una por línea y en orden, los eventos de encolado, inicio, inicio y fin de cada fase con su duración, y terminación (completado o fallido con su código) con la duración total
2. **Given** un análisis completado, **When** se consulta su estado por la API, **Then** incluye la duración de cada fase observada, el tiempo en cola y la duración total, y la suma de fases no supera el total
3. **Given** un análisis fallido, **When** se consulta su registro estructurado, **Then** el evento final incluye el código de error y la fase en la que falló
4. **Given** cualquier evento del registro, **When** se inspecciona, **Then** no contiene rutas absolutas del servidor ni secretos
5. **Given** un fallo al escribir el registro estructurado, **When** el análisis continúa, **Then** el análisis termina igual que sin el fallo
6. **Given** un análisis que termina, **When** se observa la consola del servidor, **Then** aparece una línea estructurada con el identificador, el estado, el código de error si lo hay y la duración total

---

### User Story 7 — El comando de pruebas local nunca valida un analizador .NET obsoleto (Priority: P2)

Como desarrollador, quiero que las pruebas locales reconstruyan el analizador .NET publicado cuando sus fuentes han cambiado, para que lo que pasa en local sea lo mismo que se publica.

**Why this priority**: Es un defecto conocido que puede dar verde en local con un analizador viejo.

**Independent Test**: Con un analizador publicado, tocar un archivo fuente del analizador y ejecutar la preparación del analizador de las pruebas: se reconstruye; sin cambios, se reutiliza; ambos casos lo anuncian.

**Acceptance Scenarios**:

1. **Given** un analizador publicado más reciente que todas sus fuentes, **When** se preparan las pruebas, **Then** se reutiliza y se anuncia "reutilizado"
2. **Given** un analizador publicado y un archivo fuente o de proyecto del analizador modificado después, **When** se preparan las pruebas, **Then** se vuelve a publicar y se anuncia "reconstruido" con el motivo
3. **Given** que no hay analizador publicado, **When** se preparan las pruebas, **Then** se publica
4. **Given** la opción explícita de forzar la reconstrucción, **When** se preparan las pruebas, **Then** se publica aunque esté al día

---

### Edge Cases

- Analizador .NET ausente en la máquina: los escenarios .NET de 002/003 se omiten con motivo explícito; nunca se reportan como pasados.
- Escenario heredado cuya redacción no coincide con el comportamiento actual del motor: se corrige el código de producción si es un defecto; si el escenario contradice una decisión posterior registrada, se detiene y se reporta (no se edita el escenario).
- Pasos con el mismo texto en features distintas de 001–003 con significados distintos: cada feature tiene su propio conjunto de pasos aislado.
- Errores de tipos en pruebas bloqueadas de features anteriores: se corrigen en el código de producción o en la configuración, nunca editando la prueba.
- Tag que no sigue `dev-arch-vX.Y.Z`: la comprobación de versión lo rechaza.
- Fallo al escribir el registro estructurado (disco lleno): el análisis sigue y su estado final no cambia.
- Reloj del servidor que retrocede: las duraciones nunca son negativas.
- Análisis que nunca entra en una fase (fallo en la extracción del ZIP): solo se reportan las fases observadas.

## Requirements *(mandatory)*

### Functional Requirements

**Tipado y lint (US1)**

- **FR-001**: El build de producción de la web MUST fallar ante errores de tipos o de lint; la configuración de build MUST NOT contener opciones que los ignoren.
- **FR-002**: La comprobación de tipos MUST cubrir todo el código de la web (producción y pruebas) y los módulos generados del contrato que importa, sin excluir archivos para ocultar errores.
- **FR-003**: Los errores de tipos existentes MUST corregirse en el código de producción o en la configuración del proyecto (o de la generación); las pruebas y los módulos generados bloqueados de features anteriores MUST NOT editarse para ello.
- **FR-004**: La web MUST tener una configuración de lint basada en el conjunto de reglas recomendado del framework web; las violaciones existentes MUST corregirse en el código, sin desactivar reglas de forma global.
- **FR-005**: El comando de pruebas de la web del producto y el trabajo de CI de la web MUST ejecutar la comprobación de tipos y el lint y fallar si alguno falla.

**Escenarios heredados (US2)**

- **FR-006**: Cada escenario de los `.feature` de 001, 002 (incluidos `bugfix_BUG-001` … `bugfix_BUG-006`) y 003 MUST ejecutarse en la verificación del motor con definiciones de pasos que ejercen el motor real (línea de comandos, servidor MCP, analizador .NET) y aserciones reales.
- **FR-007**: Las definiciones de pasos MUST añadirse en archivos nuevos; ningún `.feature`, `context.json`, especificación, definición de pasos ni prueba existente de 001–010 MUST cambiar.
- **FR-008**: Ningún escenario de 001–003 MUST quedar indefinido, pendiente o ambiguo; la verificación MUST fallar si ocurre.
- **FR-009**: Los escenarios que requieren el analizador .NET MUST omitirse con un motivo explícito cuando no está disponible y MUST ejecutarse cuando lo está (comando de pruebas del producto y CI).
- **FR-010**: El trabajo de CI del motor Java MUST preparar el analizador .NET antes de la verificación del motor.

**Cobertura (US3)**

- **FR-011**: La verificación del motor Java MUST generar un informe de cobertura de líneas y ramas (legible por máquina y HTML).
- **FR-012**: Las pruebas del analizador .NET MUST poder generar un informe de cobertura legible por máquina; el comando de pruebas del producto y CI lo generan.
- **FR-013**: Las pruebas unitarias de la web MUST poder generar un informe de cobertura legible por máquina y un resumen por archivo.
- **FR-014**: El producto MUST ofrecer un comando de cobertura que genere los tres informes e imprima una línea de resumen por pila con el porcentaje de líneas y la ruta del informe.
- **FR-015**: Los trabajos de CI del motor Java, del motor .NET y de la web MUST publicar su informe de cobertura como artefacto.

**Pruebas unitarias de la web (US4)**

- **FR-016**: Cada módulo de ruta de la API de la web MUST tener pruebas unitarias con al menos un caso de éxito y uno de error.
- **FR-017**: El cliente del motor MUST tener pruebas unitarias del arranque, respuesta correcta, error de herramienta, caída del proceso y tiempo agotado.
- **FR-018**: Todos los módulos no visuales del servidor, de rutas de API y de utilidades MUST aparecer en el informe de cobertura de la web; la cobertura de líneas agregada de ese conjunto MUST ser ≥ 85 % y la verificación de cobertura de la web MUST fallar si un módulo falta o si baja del umbral.

**Release (US5)**

- **FR-019**: En un tag `dev-arch-vX.Y.Z` la release MUST comprobar, antes de construir o publicar, que X.Y.Z es igual a la versión única del producto; si difiere MUST fallar mostrando ambos valores.
- **FR-020**: La matriz de plataformas del motor de la release MUST mantenerse (linux-x64, osx-arm64, osx-x64, win-x64, dependiente del framework) y seguir dependiendo de los trabajos del motor.
- **FR-021**: En un tag `dev-arch-v*` la release MUST publicar en la misma release un paquete con los skills del producto y su suma de verificación.
- **FR-022**: La comprobación de tag contra versión MUST poder ejecutarse localmente.

**Observabilidad (US6)**

- **FR-023**: Cada análisis de la web MUST tener un registro estructurado propio (un evento por línea con instante, identificador del análisis, tipo de evento, fase y duración cuando aplique) con los eventos: encolado, inicio, inicio de fase, fin de fase, completado y fallido.
- **FR-024**: El estado de un análisis MUST incluir las métricas de tiempo: duración de cada fase observada, tiempo en cola y duración total, en milisegundos y nunca negativas; la suma de fases MUST NOT superar el total.
- **FR-025**: El evento final de un análisis fallido MUST incluir el código de error y la última fase observada.
- **FR-026**: Ningún evento ni métrica MUST contener rutas absolutas del servidor ni secretos.
- **FR-027**: Un fallo al escribir el registro estructurado MUST NOT cambiar el resultado del análisis.
- **FR-028**: Al terminar un análisis, el servidor MUST emitir una línea estructurada en su consola con identificador, estado, código de error si lo hay y duración total.

**Analizador .NET de pruebas (US7)**

- **FR-029**: La preparación del analizador .NET de las pruebas locales MUST publicarlo cuando falta o cuando algún archivo fuente o de proyecto del analizador es más reciente que el publicado, y reutilizarlo en otro caso; MUST anunciar "reutilizado" o "reconstruido" con el motivo.
- **FR-030**: La opción existente de forzar la reconstrucción MUST seguir funcionando.

**Guardas (transversal)**

- **FR-031**: Ninguna puerta de calidad MUST relajarse: límite de Checkstyle ≤ 4763 (el conteo real no aumenta), SpotBugs sin hallazgos, verificación de formato .NET; los escenarios bloqueados de 001–010 MUST seguir pasando.
- **FR-032**: La investigación de BUG-007 MUST quedar registrada (hallazgos y siguiente paso) aunque no se corrija.

### Key Entities

- **Escenario heredado**: escenario Gherkin bloqueado de 001–003 con su conjunto de pasos y su resultado (pasado, fallido, omitido con motivo).
- **Informe de cobertura**: pila, porcentaje de líneas (y ramas cuando exista), ruta del informe legible por máquina.
- **Evento de trabajo**: instante, análisis, tipo (encolado, inicio, inicio de fase, fin de fase, completado, fallido), fase, duración, código de error.
- **Métricas del análisis**: duración por fase, tiempo en cola, duración total.
- **Paquete de release**: plataforma o skills, nombre con el tag, suma de verificación.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: La comprobación de tipos y el lint de la web terminan con 0 errores y el build de producción se ejecuta sin opciones de tolerancia.
- **SC-002**: 100 % de los escenarios de 001–003 (incluidos los bugfix de 002) se ejecutan en la verificación del motor; con el analizador .NET disponible, 0 fallidos, 0 omitidos, 0 indefinidos.
- **SC-003**: El comando de cobertura del producto produce 3 informes (Java, .NET, TypeScript) y CI publica los 3.
- **SC-004**: La cobertura de líneas agregada de los módulos no visuales del servidor, rutas de API y utilidades de la web es ≥ 85 % y el 100 % de esos módulos aparece en el informe.
- **SC-005**: Un tag que no coincide con la versión del producto produce 0 artefactos publicados.
- **SC-006**: El 100 % de los análisis terminados tienen registro estructurado y métricas de tiempo coherentes (suma de fases ≤ total).
- **SC-007**: Tras modificar una fuente del analizador .NET, la siguiente ejecución de las pruebas locales usa un analizador reconstruido en el 100 % de los casos.
- **SC-008**: 0 cambios en artefactos bloqueados de 001–010; conteo de Checkstyle ≤ línea base, SpotBugs 0.

## Clarifications

### Session 2026-10-10 (decisiones del usuario)

- Q: ¿Alcance de la Fase 6? -> A: Pruebas unitarias web (cliente del motor, rutas API, utilidades), pasos Cucumber-JVM para 001–003 y bugfix de 002 integrados en la verificación del motor, tipos y lint bloqueantes, cobertura Java/.NET/TS, release unificada en `dev-arch-v*` reutilizando la matriz (imagen Docker en 012), logs estructurados por trabajo y métricas de duración por fase; registrar y corregir la reutilización de un analizador obsoleto; BUG-007 solo si es barato. [US1–US7]
- Q: ¿Se pueden modificar pruebas, escenarios o guardas de features anteriores? -> A: No; la feature es aditiva. Se permiten archivos nuevos de pasos para `.feature` existentes. Si un objetivo exige modificar pruebas anteriores, se detiene y se reporta. [FR-003, FR-007, FR-031]
- Q: ¿Cómo se resuelven los errores TS5097 (importaciones con extensión `.ts`) de los módulos generados? -> A: Por configuración del proyecto o del generador, nunca editando las pruebas bloqueadas de 005. [FR-003]

### Defaults elegidos por el agente

- Las pruebas unitarias de la web siguen con el ejecutor de pruebas existente del entorno de ejecución (sin añadir un framework nuevo; el plan mencionaba Vitest, pero "ampliar lo existente" y el principio VI favorecen no añadir dependencias); su cobertura usa la cobertura integrada del entorno. (default elegido por agente — pendiente confirmar) [FR-013, FR-016..018]
- Umbral de cobertura bloqueante solo para la web (≥ 85 % de líneas sobre servidor, rutas API y utilidades); Java y .NET se reportan sin umbral en esta feature. (default elegido por agente — pendiente confirmar) [FR-011, FR-012, FR-018]
- Reglas de lint: conjunto recomendado del framework web para Core Web Vitals; sin el conjunto estricto de TypeScript (que exigiría reescrituras masivas). (default elegido por agente — pendiente confirmar) [FR-004]
- Comando de cobertura del producto: `make coverage`. (default elegido por agente — pendiente confirmar) [FR-014]
- Registro estructurado por análisis en un archivo propio dentro de la carpeta del análisis (líneas JSON), separado del registro de errores del motor existente; métricas expuestas como campo adicional del estado del análisis. (default elegido por agente — pendiente confirmar) [FR-023, FR-024]
- Release: además de la matriz existente, un trabajo que empaqueta los skills y un paso inicial de comprobación de versión en tags; el disparo en `main` con cambios del motor se mantiene como pre-release. (default elegido por agente — pendiente confirmar) [FR-019..FR-021]
- El trabajo de e2e `make e2e` reservado (006 TS-012) no se implementa en esta feature: el escenario bloqueado exige su mensaje de marcador de posición. (default elegido por agente — pendiente confirmar)

## Assumptions

- El analizador .NET disponible en la máquina de desarrollo (SDK 10 + runtime 8) y en CI (SDK 8) es suficiente para los escenarios de 002/003.
- La línea base para comparar artefactos bloqueados es el tag `dev-arch-006-baseline` (para 001–006) y el historial de git de cada feature (007–010).
- El conteo real de violaciones de Checkstyle no aumenta con los archivos de pasos nuevos (son código de pruebas, fuera del alcance de Checkstyle del motor).
