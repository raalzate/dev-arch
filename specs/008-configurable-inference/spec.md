# Feature Specification: Extracción e inferencia separadas y configurables

**Feature Branch**: `008-configurable-inference`
**Created**: 2026-10-08
**Status**: Draft
**Input**: User description: "Fase 4 — 008 de PLAN-INTEGRACION-DEV-ARCH.md (decisión D4): separar en el motor la extracción del grafo de dependencias (costosa) de la inferencia de arquitectura (barata), con la fachada de análisis completo conservada (principio II); reunir todos los umbrales, pesos y listas hoy fijos en el código en una configuración de inferencia con nombre, cargable desde un archivo de configuración del análisis o desde los parámetros del modo servidor, con valores por defecto idénticos al comportamiento actual (regresión byte a byte sobre los proyectos de demostración); nuevas operaciones del modo servidor para re-inferir la arquitectura sobre un grafo ya extraído (por ruta o por identificador de análisis) y para puntuar una propuesta editada por el usuario; detección de proyectos anidados y multi-módulo; exposición de la documentación de algoritmos, de configuración y del contrato como recursos de solo lectura; documentación de configuración completa. Incluye los problemas conocidos: tres listas de palabras clave de infraestructura desalineadas, el valor fijo de `data_jaccard` sin relación con la puntuación, la comprobación de librería de soporte limitada al grupo raíz y exclusiones heredadas del análisis estático marcadas para 008. Criterio de salida: la re-inferencia responde en menos de 2 s sobre un grafo de 500 componentes y las salidas por defecto son idénticas a las de la versión vigente."

## Contexto

Hoy el motor ejecuta en un solo paso la extracción del grafo de dependencias (lectura y análisis sintáctico del código, que tarda de segundos a minutos) y la inferencia de la arquitectura (agrupación, consolidación, nombres y viabilidad, que tarda milisegundos). Todos los parámetros de la inferencia —pesos de las señales de consolidación, umbral de evidencia, salvaguardas de tamaño, fórmula y cortes de viabilidad, listas de palabras clave— son literales en el código (documentados uno a uno en la guía de algoritmos y en la guía de configuración, sección "No implementado — feature 008"). Consecuencias:

- Ajustar un umbral exige recompilar y volver a analizar el proyecto completo.
- No es posible responder "¿qué pasaría si…?" sobre umbrales, ni volver a puntuar una propuesta que el usuario editó, sin repetir la extracción.
- Hay inconsistencias conocidas que hoy afectan a las salidas: tres listas de palabras clave de infraestructura distintas, un indicador `data_jaccard` emitido con un valor fijo (0,8 o 0,0) sin relación con la puntuación de datos y una comprobación de "librería de soporte" que mira solo el primer grupo de una fusión.
- La detección del tipo de proyecto solo mira la carpeta raíz; un proyecto cuyos marcadores están en subcarpetas se analiza como Java por defecto.
- El documento de premisas promete exponer la documentación de algoritmos y de configuración a los agentes, y no existe.

La Constitución v1.0.0 gobierna el cambio: las salidas actuales son contrato público y no pueden cambiar sin versionado (principio I), la lógica vive en el núcleo compartido con adaptadores delgados (principio II), TDD obligatorio (principio III), determinismo byte a byte (principio IV), errores claros sin abortar todo (principio V) y huella mínima (principio VI).

## User Stories *(mandatory)*

### User Story 1 — Re-inferir la arquitectura con otros umbrales sin volver a analizar (Priority: P1)

Como arquitecto que revisa un monolito (directamente o a través de un agente de IA o de la web), tomo el grafo de dependencias de un análisis ya hecho, cambio uno o varios parámetros de la inferencia y obtengo en segundos la nueva propuesta de arquitectura, sin volver a leer el código fuente.

**Why this priority**: Es el objetivo de la decisión D4 y el criterio de salida de la fase: habilita el "qué pasaría si" y es la base de la evaluación de propuestas y de la futura experiencia de usuario (feature 010).

**Independent Test**: Analizar un proyecto de demostración, borrar sus fuentes y re-inferir sobre el grafo guardado: con la configuración por defecto se obtiene la misma arquitectura que la guardada; con un umbral cambiado se obtiene una arquitectura distinta en la dirección esperada; el tiempo sobre un grafo de 500 componentes es menor de 2 s.

**Acceptance Scenarios**:

1. **Given** el grafo y la arquitectura guardados de un análisis de un proyecto de demostración, **When** se re-infiere sobre ese grafo sin configuración, **Then** la arquitectura obtenida es byte a byte idéntica a la guardada.
2. **Given** el grafo guardado de un análisis, **When** se re-infiere elevando los umbrales de viabilidad "Alta" y "Media" por encima de cualquier puntuación posible, **Then** ninguna propuesta resulta con viabilidad "Alta" ni "Media" y el documento conserva su forma de contrato.
3. **Given** el grafo guardado de un análisis, **When** se re-infiere con una configuración que impide toda consolidación basada en evidencia (umbral de evidencia por encima de cualquier puntuación posible), **Then** el número de propuestas y librerías de soporte es igual o mayor que con la configuración por defecto.
4. **Given** un grafo de 500 componentes, **When** se re-infiere con la configuración por defecto en el modo servidor ya en marcha, **Then** la respuesta llega en menos de 2 segundos.
5. **Given** el identificador de un análisis terminado de la web, **When** se re-infiere indicando ese identificador en lugar de una ruta, **Then** se usa el grafo de ese análisis y el resultado es el mismo que indicando la ruta de su grafo.
6. **Given** un grafo guardado sin la arquitectura del mismo análisis a su lado, **When** se re-infiere, **Then** la arquitectura se produce igualmente y una advertencia indica que las dependencias declaradas a nivel de proyecto y las ubicaciones de secretos no están disponibles y se omitieron.
7. **Given** una ruta que no existe, un archivo que no es un grafo del contrato, un grafo de otra versión de contrato o un identificador de análisis inexistente o mal formado, **When** se re-infiere, **Then** la operación se rechaza con un mensaje que indica qué falló, sin resultado parcial.
8. **Given** el mismo grafo y la misma configuración, **When** se re-infiere dos veces, **Then** ambas respuestas son byte a byte idénticas.

---

### User Story 2 — Configurar la inferencia de un análisis (Priority: P1)

Como usuario de la línea de comandos o del modo servidor, declaro en un archivo de configuración (o en los parámetros de la petición) los pesos, umbrales y listas de la inferencia que quiero usar; los parámetros que no declaro conservan su valor por defecto, y si me equivoco se me dice exactamente qué parámetro está mal.

**Why this priority**: Sin configuración externa la re-inferencia no tiene qué variar; además resuelve el "editar el literal y recompilar" que hoy documenta la guía de configuración.

**Independent Test**: Analizar un proyecto de demostración con un archivo de configuración parcial desde la línea de comandos y desde el modo servidor; comparar ambos resultados entre sí y con el análisis por defecto; enviar configuraciones inválidas de cada tipo.

**Acceptance Scenarios**:

1. **Given** un proyecto de demostración, **When** se analiza sin configuración, **Then** los tres documentos son idénticos a los de la versión vigente.
2. **Given** un archivo de configuración que declara solo los umbrales de viabilidad, **When** se analiza desde la línea de comandos con ese archivo, **Then** las propuestas usan esos umbrales y todos los demás parámetros conservan su valor por defecto.
3. **Given** el mismo proyecto y la misma configuración, **When** se analiza desde la línea de comandos y desde el modo servidor, **Then** los documentos producidos son idénticos (paridad, principio I).
4. **Given** una configuración con un parámetro desconocido, con un tipo incorrecto, con un valor fuera de rango o con umbrales incoherentes ("Media" mayor que "Alta"), **When** se usa, **Then** la petición se rechaza antes de analizar, con un mensaje que nombra el parámetro y el motivo.
5. **Given** un archivo de configuración inexistente o que no es un documento válido, **When** se usa, **Then** se rechaza con un mensaje que indica el archivo y el motivo.
6. **Given** una configuración idéntica a los valores por defecto declarada explícitamente, **When** se analiza, **Then** los documentos son idénticos a los del análisis sin configuración.

---

### User Story 3 — Las salidas por defecto no cambian (Priority: P1)

Como consumidor de las salidas actuales (web, agentes, scripts), sigo obteniendo exactamente los mismos documentos para los mismos proyectos después de la reestructuración del motor.

**Why this priority**: Principio I (no negociable) y criterio de salida; la reestructuración es interna y no debe ser observable.

**Independent Test**: Comparar byte a byte los tres documentos de los seis proyectos de demostración, producidos por la línea de comandos y por el modo servidor, contra la línea base capturada antes del cambio.

**Acceptance Scenarios**:

1. **Given** la línea base de la versión vigente de los seis proyectos de demostración (grafo, arquitectura y contratos de API), **When** se analizan después del cambio sin configuración, **Then** cada documento es byte a byte idéntico a su línea base.
2. **Given** las cinco operaciones existentes del modo servidor, **When** se invocan sin configuración, **Then** sus respuestas no cambian y el servidor sigue ofreciendo exactamente esas cinco operaciones salvo que se habiliten explícitamente las nuevas.
3. **Given** la versión del contrato de datos, **When** se producen los documentos, **Then** siguen declarando la misma versión de contrato que antes del cambio.

---

### User Story 4 — Evaluar una propuesta editada (Priority: P2)

Como arquitecto, muevo componentes entre propuestas (o armo una propuesta nueva) y pido al motor que la puntúe con los mismos criterios que usa para sus propias propuestas, para saber si mi variante es más o menos viable.

**Why this priority**: Es la segunda operación nueva del plan y el complemento natural de la re-inferencia; no bloquea a US1.

**Independent Test**: Puntuar, sobre el grafo de un proyecto de demostración, los componentes de una propuesta existente (debe reproducir su viabilidad y su justificación) y luego una variante con componentes añadidos o quitados.

**Acceptance Scenarios**:

1. **Given** una propuesta existente sin componentes de infraestructura filtrados, **When** se puntúa la lista exacta de sus componentes sobre el mismo grafo con la configuración por defecto, **Then** la viabilidad y la justificación coinciden con las de esa propuesta.
2. **Given** una lista de componentes editada, **When** se puntúa, **Then** la respuesta incluye viabilidad, puntuación, cohesión ajustada, acoplamiento externo, cohesión de datos, tamaño, justificación, acciones recomendadas y un nombre sugerido, calculados con las mismas fórmulas y la misma configuración que las propuestas del motor.
3. **Given** una lista con componentes que no existen en el grafo, **When** se puntúa, **Then** se rechaza listando los componentes desconocidos.
4. **Given** una lista vacía, **When** se puntúa, **Then** se rechaza indicando que la propuesta debe tener al menos un componente; los duplicados se ignoran.
5. **Given** una configuración con otros umbrales de viabilidad, **When** se puntúa la misma lista, **Then** la clasificación usa esos umbrales.
6. **Given** la misma lista, grafo y configuración, **When** se puntúa dos veces, **Then** las respuestas son idénticas.

---

### User Story 5 — Consultar algoritmos, configuración y contrato desde el agente (Priority: P2)

Como agente de IA conectado al modo servidor, leo la documentación de los algoritmos, la guía de configuración (con los valores por defecto vigentes) y el contrato de datos para explicar y ajustar los resultados sin salir de la sesión.

**Why this priority**: Promesa explícita del documento de premisas; da al agente el conocimiento necesario para usar US1 y US4 con criterio.

**Independent Test**: Listar los recursos del modo servidor y leer cada uno; comparar su contenido con la documentación y el contrato publicados con la versión.

**Acceptance Scenarios**:

1. **Given** el modo servidor en marcha, **When** el agente lista los recursos, **Then** obtiene "algoritmos", "configuración", "valores por defecto de la configuración" y "esquema" (contrato), cada uno con descripción y tipo de contenido.
2. **Given** cada recurso, **When** se lee, **Then** su contenido es idéntico a la documentación o al contrato publicados con esa versión del motor; los valores por defecto coinciden con los que aplica la inferencia.
3. **Given** un recurso inexistente, **When** se pide, **Then** la respuesta es un error con mensaje claro.

---

### User Story 6 — Detectar proyectos anidados y multi-módulo (Priority: P3)

Como usuario que sube un repositorio cuyo proyecto Java o .NET no está en la carpeta raíz (por ejemplo, `backend/pom.xml` o `src/App.sln`), quiero que el motor pueda encontrar los marcadores en subcarpetas y elegir el analizador correcto, informándome de los módulos encontrados.

**Why this priority**: Mejora real pero acotada; por principio I se ofrece como opción para no alterar el resultado de proyectos ya analizados.

**Independent Test**: Analizar proyectos de prueba con marcadores solo en subcarpetas (Java, .NET, ambos, a distintas profundidades) con la profundidad de búsqueda por defecto y con una profundidad mayor.

**Acceptance Scenarios**:

1. **Given** la profundidad de búsqueda por defecto, **When** se analiza cualquier proyecto, **Then** la detección es la actual (solo la carpeta raíz) y los resultados no cambian.
2. **Given** una profundidad de búsqueda N > 0 y un proyecto sin marcadores en la raíz con marcadores Java solo en subcarpetas a profundidad ≤ N, **When** se analiza en modo automático, **Then** se usa el analizador Java y una advertencia lista las carpetas de módulo encontradas.
3. **Given** profundidad N > 0 y marcadores .NET (solución o proyectos C#/VB) solo en subcarpetas a profundidad ≤ N, **When** se analiza en modo automático, **Then** se usa el analizador .NET y se advierte de los módulos encontrados.
4. **Given** profundidad N > 0 y marcadores de ambos lenguajes en subcarpetas, **When** se analiza en modo automático, **Then** el análisis falla como ambiguo indicando los marcadores encontrados y pidiendo elegir el lenguaje.
5. **Given** marcadores solo a profundidad mayor que N, o dentro de carpetas de salida de construcción, dependencias o control de versiones, **When** se analiza, **Then** esos marcadores se ignoran.
6. **Given** un proyecto con marcadores en la raíz, **When** se analiza con cualquier profundidad, **Then** la detección es idéntica a la actual (la raíz manda).

---

### User Story 7 — Correcciones opcionales de inconsistencias conocidas (Priority: P3)

Como usuario avanzado, puedo activar por configuración las correcciones de las inconsistencias conocidas de la inferencia (listas de palabras clave de infraestructura alineadas, `data_jaccard` calculado) sin que cambien los resultados de quien no las active, y tengo la garantía documentada de que la comprobación de librería de soporte sobre el grupo raíz equivale a la del grupo completo.

**Why this priority**: Corrige defectos documentados sin violar el principio I; su activación por defecto requeriría un cambio de contrato versionado (fuera de alcance).

**Independent Test**: Re-inferir un grafo de demostración con cada corrección activada y desactivada; comprobar que desactivada (por defecto) el resultado es el de siempre y activada el efecto es el descrito.

**Acceptance Scenarios**:

1. **Given** la configuración por defecto, **When** se infiere, **Then** `data_jaccard` sigue valiendo 0,8 con tablas y 0,0 sin tablas y las tres listas de palabras clave conservan sus valores actuales.
2. **Given** el modo calculado de `data_jaccard`, **When** se infiere, **Then** cada propuesta emite como `data_jaccard` la cohesión de datos usada en su puntuación de viabilidad.
3. **Given** una configuración que declara la misma lista de palabras clave de infraestructura para la consolidación, el filtrado de propuestas y los nombres, **When** se infiere, **Then** las tres etapas usan esa lista.
4. **Given** cualquier grafo y cualquier configuración, **When** se consolidan grupos, **Then** todos los grupos de origen de cada grupo consolidado tienen el mismo estado de librería de soporte que su grupo raíz (por eso evaluar solo el grupo raíz equivale a evaluar el grupo completo).

---

### Edge Cases

- Grafo con cero componentes: la re-inferencia devuelve una arquitectura sin propuestas (como el análisis actual de un proyecto vacío), no un error.
- Grafo con componentes que llaman a componentes inexistentes en el grafo: se tratan igual que en el análisis completo (llamadas externas).
- Grafo producido por el analizador .NET: la re-inferencia funciona igual que con grafos Java (la inferencia es común).
- Grafo con la marca de tiempo opcional de recolección: se acepta; no afecta a la arquitectura.
- Configuración con pesos de evidencia que no suman 1: se acepta (la guía advierte del efecto en el significado de los umbrales); solo se exige que cada peso esté en [0, 1].
- Configuración con listas vacías (por ejemplo, sin palabras clave de infraestructura): se acepta; ningún componente se considera de infraestructura.
- Configuración declarada con valores idénticos a los por defecto: resultado idéntico al de no declararla (US2-AS6).
- Identificador de análisis con caracteres de ruta (`..`, `/`, `\`): se rechaza como mal formado sin acceder al disco.
- Identificador de análisis válido pero sin área de resultados configurada en el servidor: se rechaza indicando que solo se admite la ruta del grafo.
- Propuesta a puntuar con un único componente: se puntúa (con la penalización de tamaño pequeño vigente).
- Propuesta a puntuar formada por todos los componentes del grafo: se puntúa (puede aplicarse la penalización de monolito).
- Lectura de recursos con el motor empaquetado: los recursos se sirven desde el propio artefacto distribuido, no desde el repositorio.
- Análisis con configuración no por defecto en el modo servidor: no reutiliza ni contamina los análisis reutilizados sin configuración.
- Profundidad de búsqueda negativa o desmesurada: rechazada por validación (rango permitido acotado).
- Configuración que solo cambia parámetros de inferencia: el grafo de dependencias y los contratos de API no cambian; solo la profundidad de detección puede cambiar el analizador elegido (y con él todos los documentos).
- Ruta de archivo de configuración en el modo servidor: se lee con los mismos permisos y el mismo modelo de confianza que la ruta del proyecto (servidor local de un solo usuario).

## Requirements *(mandatory)*

### Functional Requirements

**Separación de etapas**

- **FR-001**: El motor MUST separar la extracción del grafo de dependencias de la inferencia de arquitectura, de modo que la inferencia pueda ejecutarse sobre un grafo ya extraído sin acceder al código fuente del proyecto.
- **FR-002**: El análisis completo existente (línea de comandos y las cinco operaciones del modo servidor) MUST seguir disponible como composición de extracción e inferencia, con la lógica en el núcleo compartido y los adaptadores sin lógica de negocio (principio II).
- **FR-003**: Toda la información de nivel de proyecto que la inferencia necesita y que no está en el grafo (dependencias declaradas por el proyecto, ubicaciones de secretos) MUST obtenerse en la etapa de extracción, de modo que la inferencia no lea el sistema de archivos del proyecto.

**Configuración de inferencia**

- **FR-004**: Todos los pesos, umbrales, factores y listas que hoy determinan la agrupación, la consolidación, los nombres, la viabilidad (incluidos los cortes de la justificación) y el ensamblado de propuestas MUST estar disponibles como parámetros con nombre de una configuración de inferencia, agrupados por etapa.
- **FR-005**: Los valores por defecto de la configuración MUST ser exactamente los valores vigentes, de modo que sin configuración los tres documentos de cada proyecto sean byte a byte idénticos a los de la versión vigente.
- **FR-006**: La línea de comandos MUST aceptar un archivo de configuración opcional; sin él, el comportamiento y la invocación actuales no cambian.
- **FR-007**: El modo servidor MUST aceptar la configuración como parámetro opcional en la operación de análisis completo y en las nuevas operaciones, tanto en línea (objeto) como por ruta a un archivo de configuración; si se dan ambas, se rechaza la petición como ambigua.
- **FR-008**: Una configuración MUST poder ser parcial: los parámetros no declarados conservan su valor por defecto.
- **FR-009**: Una configuración inválida (parámetro desconocido, tipo incorrecto, valor fuera de rango, umbrales incoherentes, archivo inexistente o ilegible) MUST rechazarse antes de ejecutar ningún análisis, con un mensaje que nombre el parámetro o archivo y el motivo (principio V).
- **FR-010**: Para la misma entrada y la misma configuración, la línea de comandos y el modo servidor MUST producir documentos idénticos (principio I), y dos ejecuciones consecutivas MUST producir documentos idénticos (principio IV).
- **FR-011**: En el modo servidor, los análisis con configuración distinta de la por defecto MUST NOT reutilizar análisis previos ni quedar guardados para reutilización.

**Re-inferencia**

- **FR-012**: El modo servidor MUST ofrecer una operación de re-inferencia que reciba un grafo de dependencias (por ruta o por identificador de análisis), una configuración opcional y un filtro opcional de viabilidad mínima, y devuelva un documento de arquitectura con la misma forma que el de la operación de propuesta de arquitectura; un filtro de viabilidad con un valor fuera de "Alta", "Media" o "Baja" se rechaza.
- **FR-013**: Con la configuración por defecto, la re-inferencia del grafo de un análisis MUST producir una arquitectura byte a byte idéntica a la guardada por ese análisis cuando el documento de arquitectura de ese análisis está disponible junto al grafo (de él se toman las dependencias de nivel de proyecto y las ubicaciones de secretos).
- **FR-014**: Cuando la arquitectura del análisis no está disponible junto al grafo, la re-inferencia MUST producir el documento igualmente, sin dependencias declaradas de nivel de proyecto ni ubicaciones de secretos, y con una advertencia que lo indique.
- **FR-015**: La resolución por identificador de análisis MUST limitarse al área de resultados que el servidor tenga configurada, aceptar solo identificadores sin separadores ni componentes de ruta y rechazar con mensaje claro los identificadores mal formados, inexistentes o sin área configurada.
- **FR-016**: Un grafo que no es un documento válido o que declara otra versión de contrato MUST rechazarse con un mensaje que indique el motivo.
- **FR-017**: La re-inferencia de un grafo de 500 componentes con la configuración por defecto MUST responder en menos de 2 segundos en el modo servidor en marcha.

**Evaluación de propuestas**

- **FR-018**: El modo servidor MUST ofrecer una operación que puntúe una propuesta definida por una lista de componentes sobre un grafo (por ruta o por identificador de análisis), con configuración opcional, y devuelva viabilidad, puntuación, cohesión ajustada, acoplamiento externo, cohesión de datos, tamaño, justificación, acciones recomendadas y un nombre sugerido.
- **FR-019**: La puntuación MUST usar las mismas fórmulas, la misma agrupación de referencia y la misma configuración que la inferencia, de modo que puntuar exactamente los componentes de una propuesta existente sin infraestructura filtrada reproduzca su viabilidad y su justificación (la justificación expresa sus submétricas).
- **FR-020**: La operación de puntuación MUST rechazar listas vacías y componentes inexistentes (listándolos), ignorar duplicados y no modificar ningún documento guardado.

**Recursos y documentación**

- **FR-021**: El modo servidor MUST exponer como recursos de solo lectura la guía de algoritmos, la guía de configuración, los valores por defecto vigentes de la configuración y el contrato de datos de la versión, servidos desde el artefacto distribuido.
- **FR-022**: La guía de configuración MUST documentar cada parámetro (nombre, valor por defecto, rango, efecto, etapa), el formato del archivo de configuración, su uso desde la línea de comandos y el modo servidor, las nuevas operaciones y las correcciones opcionales; la guía de algoritmos MUST referirse a los parámetros por su nombre.

**Detección de proyectos**

- **FR-023**: La detección automática del tipo de proyecto MUST admitir una profundidad de búsqueda configurable; con la profundidad por defecto (0) la detección es la actual.
- **FR-024**: Con profundidad N > 0 y sin marcadores en la raíz, la detección MUST buscar marcadores Java y .NET (incluido VB) en subcarpetas hasta profundidad N, ignorando carpetas de salida de construcción, de dependencias y de control de versiones; un solo lenguaje elige su analizador y advierte de las carpetas de módulo encontradas; ambos lenguajes producen el error de proyecto ambiguo con los marcadores encontrados.

**Correcciones opcionales**

- **FR-025**: La configuración MUST permitir, como opción desactivada por defecto, emitir `data_jaccard` como la cohesión de datos usada en la puntuación, y declarar por separado cada lista de palabras clave de infraestructura (para poder alinearlas). La comprobación de librería de soporte sobre el grupo raíz MUST mantenerse y documentarse como equivalente a la del grupo completo (invariante: solo se fusionan grupos con el mismo estado de soporte), verificada por pruebas.

**Contrato, calidad y compatibilidad**

- **FR-026**: Las respuestas de las nuevas operaciones y el formato de la configuración MUST describirse en el contrato de datos sin cambiar los documentos existentes ni la versión del contrato que declaran.
- **FR-027**: Las nuevas operaciones MUST ofrecerse en el modo servidor solo cuando se habiliten explícitamente al arrancarlo, de modo que la lista de operaciones por defecto siga siendo exactamente la actual; la web MUST habilitarlas y comunicar al motor su área de resultados.
- **FR-028**: Las exclusiones heredadas del análisis estático marcadas para esta feature MUST eliminarse mediante limpieza que no cambie el comportamiento, sin aumentar el número de avisos de estilo vigente.
- **FR-029**: Los errores de las nuevas operaciones MUST seguir el formato de error de las operaciones existentes, con mensajes accionables (principio V).

### Key Entities

- **Configuración de inferencia**: conjunto con nombre de parámetros agrupados por etapa (agrupación, evidencia entre grupos, consolidación, viabilidad y su justificación, propuestas, nombres) y de detección; cada parámetro tiene nombre, tipo, rango y valor por defecto igual al vigente. Puede ser parcial; se valida antes de usarse.
- **Resultado de extracción**: grafo de dependencias más la información de nivel de proyecto (dependencias declaradas, ubicaciones de secretos) y advertencias.
- **Arquitectura inferida**: documento de arquitectura del contrato (propuestas, librerías de soporte, metadatos de proyecto, resumen).
- **Propuesta a evaluar**: lista de identificadores de componentes de un grafo; su evaluación incluye viabilidad, puntuación, submétricas, justificación, acciones y nombre sugerido.
- **Recurso**: documento de solo lectura del modo servidor (algoritmos, configuración, valores por defecto, contrato) con identificador, descripción y tipo de contenido.
- **Línea base de regresión**: los tres documentos de cada proyecto de demostración producidos por la versión vigente antes del cambio.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En los 6 proyectos de demostración, los 18 documentos producidos sin configuración por la línea de comandos y por el modo servidor son byte a byte idénticos a la línea base capturada antes del cambio (18/18 en cada modo).
- **SC-002**: En los 6 proyectos de demostración, la re-inferencia con la configuración por defecto sobre el grafo guardado reproduce byte a byte la arquitectura guardada (6/6).
- **SC-003**: Sobre un grafo sintético determinista de 500 componentes, cada una de 5 re-inferencias consecutivas en el modo servidor en marcha responde en menos de 2 segundos.
- **SC-004**: El 100 % de los parámetros listados en la guía de configuración vigente (sección de parámetros fijos) existen como parámetros con nombre y ninguno de esos valores queda como literal en la lógica de inferencia.
- **SC-005**: Para cada etapa configurable (agrupación, evidencia, consolidación, viabilidad, propuestas, nombres) existe al menos una prueba que cambia un parámetro y observa el efecto esperado en el resultado.
- **SC-006**: El 100 % de las configuraciones inválidas de prueba (desconocido, tipo, rango, incoherencia, archivo) se rechazan con el nombre del parámetro o archivo en el mensaje y sin escribir documentos.
- **SC-007**: Puntuar los componentes de cada propuesta existente sin infraestructura filtrada de los proyectos de demostración reproduce su viabilidad y su justificación en el 100 % de los casos.
- **SC-008**: Los recursos de algoritmos, configuración, valores por defecto y contrato se listan y su contenido es idéntico al publicado (4/4); los valores por defecto del recurso son iguales a los que aplica la inferencia.
- **SC-009**: Todas las verificaciones de calidad del producto siguen en verde: construcción, pruebas, análisis estático con 0 hallazgos y 3 exclusiones heredadas menos, número de avisos de estilo no superior al vigente (4655), formato .NET, determinismo y paridad entre modos.
- **SC-010**: Con la profundidad de detección por defecto, los 6 proyectos de demostración se detectan igual que antes; con profundidad > 0, los 4 casos de proyectos anidados de prueba (Java, .NET, ambos, demasiado profundo) se detectan como se especifica.

## Clarifications

### Session 2026-10-08

- Q: ¿Se sube la versión del contrato de datos (a 1.1.0) por las nuevas respuestas? -> A: No. Las respuestas nuevas y el formato de configuración se añaden como definiciones nuevas dentro del contrato 1.0.0, sin tocar los documentos existentes; subir la versión cambiaría la versión declarada por todas las salidas actuales (rompe la regresión byte a byte) y las aserciones bloqueadas de 005/006/007 sobre 1.0.0. Alternativa: subir a 1.1.0 con nota de cambio menor y relajar la regresión en el campo de versión. (default elegido por agente — confirmado por usuario 2026-10-09) [FR-026, SC-001]
- Q: Las aserciones bloqueadas de las features 001 y 005 exigen que el modo servidor ofrezca exactamente 5 operaciones; ¿cómo se añaden las nuevas? -> A: Las nuevas operaciones se habilitan explícitamente al arrancar el modo servidor (opción de arranque); por defecto se siguen ofreciendo exactamente las 5 actuales y la web las habilita siempre. Alternativa: re-bloquear las aserciones de 001/005 a "al menos las 5 operaciones" con aprobación explícita del usuario y exponerlas siempre. (default elegido por agente — confirmado por usuario 2026-10-09) [FR-027, US3-AS2]
- Q: ¿`data_jaccard` se corrige? -> A: No por defecto (cambiaría las salidas, principio I); se ofrece el modo calculado como opción desactivada por defecto. Corregirlo por defecto requiere un cambio versionado del contrato en otra feature. (default elegido por agente — confirmado por usuario 2026-10-09) [FR-025, US7]
- Q: ¿Se unifican las tres listas de palabras clave de infraestructura? -> A: No por defecto; cada lista es un parámetro con su valor vigente y el usuario puede alinearlas por configuración. La guía documenta la divergencia y la configuración recomendada. (default elegido por agente — confirmado por usuario 2026-10-09) [FR-025, US7]
- Q: ¿La salvaguarda de librería de soporte mira el grupo completo? -> A: No hace falta: las fusiones solo ocurren entre grupos con el mismo estado de soporte, así que todos los grupos de origen de un grupo consolidado comparten el estado de su raíz y la proporción del grupo completo cae del mismo lado del umbral (media ponderada). La limitación conocida no tiene efecto observable; se documenta y se verifica con una prueba de invariante, sin añadir opción. (default elegido por agente — confirmado por usuario 2026-10-09) [FR-025, US7-AS4]
- Q: ¿La detección anidada está activa por defecto? -> A: No: profundidad 0 por defecto (detección actual); un proyecto sin marcadores en la raíz que hoy se analiza como Java podría pasar a .NET y cambiar su salida. Rango permitido 0..5. (default elegido por agente — confirmado por usuario 2026-10-09) [FR-023, FR-024, US6]
- Q: ¿De dónde se carga la configuración? -> A: Línea de comandos: archivo indicado explícitamente con una opción; modo servidor: objeto en línea o ruta de archivo en la petición. No se descubre automáticamente un archivo de configuración dentro del proyecto analizado (evita cambios silenciosos de salida). (default elegido por agente — confirmado por usuario 2026-10-09) [FR-006, FR-007]
- Q: ¿Cómo resuelve el motor un identificador de análisis de la web? -> A: La web comunica al motor, al arrancarlo, su área de resultados; el motor busca el grafo del análisis dentro de esa área. Sin área configurada solo se admite la ruta. (default elegido por agente — confirmado por usuario 2026-10-09) [FR-015, FR-027]
- Q: ¿De dónde salen las dependencias de proyecto y las ubicaciones de secretos al re-inferir sin fuentes? -> A: Del documento de arquitectura guardado junto al grafo por el mismo análisis; si falta, se omiten con advertencia. (default elegido por agente — confirmado por usuario 2026-10-09) [FR-013, FR-014]
- Q: ¿Qué agrupación de referencia usa la evaluación de propuestas? -> A: La agrupación que produce la inferencia sobre el mismo grafo con la misma configuración; la propuesta se descompone en los fragmentos de cada grupo que contiene y se puntúa con la fórmula vigente, lo que reproduce la viabilidad y la justificación de las propuestas existentes (la puntuación numérica no se emite en el documento de arquitectura). (default elegido por agente — confirmado por usuario 2026-10-09) [FR-019]
- Q: ¿Los cortes de los mensajes de justificación son configurables? -> A: Sí, como parámetros de la etapa de viabilidad (solo afectan al texto). (default elegido por agente — confirmado por usuario 2026-10-09) [FR-004]
- Q: ¿Cómo se mide el criterio de 2 s? -> A: En el proceso del modo servidor ya en marcha (larga vida), sobre un grafo sintético determinista de 500 componentes, cada una de 5 llamadas consecutivas tras la primera. (default elegido por agente — confirmado por usuario 2026-10-09) [FR-017, SC-003]
- Q: ¿Se modifica la interfaz web para usar la re-inferencia? -> A: No; la experiencia de usuario es la feature 010. En esta feature la web solo habilita las operaciones y comunica su área de resultados al motor. (default elegido por agente — confirmado por usuario 2026-10-09) [FR-027]

### Assumptions

- La línea base de regresión se captura con el motor de la versión vigente (1.2.0, commit de cierre de 007) sobre copias herméticas de los seis proyectos de demostración, con la misma normalización de rutas que usan las líneas base existentes.
- Las reglas internas de puntuación de grupos que no llegan a ningún documento de salida no forman parte de la configuración (no afectan a resultados observables).
- La Constitución v1.0.0 no se enmienda en esta feature.
- La feature 009 (VB legacy) se desarrolla en paralelo y no toca la inferencia; los conflictos de integración se resuelven al fusionar.
