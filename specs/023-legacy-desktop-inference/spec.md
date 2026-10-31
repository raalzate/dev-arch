# Feature Specification: Inferencia para el perfil desktop legacy (preset, dominio, soporte y deuda)

**Feature Branch**: `023-legacy-desktop-inference`
**Created**: 2026-10-30
**Status**: Draft
**Input**: User description: "Inferencia para el perfil desktop legacy: preset legacy-desktop, nombrado por dominio, librerías de soporte e índice de deuda como tercer factor de viabilidad (feature 018 del PLAN-VB-PLATAFORMA-LEGACY.md)."

> Numeración: feature 018 del plan; en el repositorio recibe el número 023.

## Contexto

Con 020-022 el grafo de la referencia tiene procedimientos compartidos, capas finas, puntos de entrada, integraciones y deuda. La inferencia, sin embargo, sigue calibrada para servicios web Java/.NET Core: produce 102 propuestas (93 "Baja") con nombres por tokens ("Componente de Controllers y Annualbasesalar"), mezcla librerías comunes con dominios y no considera la deuda. Esta feature añade un **preset de inferencia `legacy-desktop`** (pesos y umbrales, presentación fuera de la cohesión, nombrado por dominio de namespace, librerías de soporte por namespace y fan-in) y un **índice de deuda** por componente y propuesta que entra como tercer factor de viabilidad con peso 0 fuera del preset. Todo es configuración e inferencia Java: las salidas actuales de `test-for-demo/*` no cambian (preset `auto` solo se activa en grafos VB/escritorio; pesos nuevos valen 0 por defecto). El contrato 1.0.0 es cerrado en `proposals[].signals`/`metrics`, por lo que el índice de deuda y el preset aplicado se exponen en campos de texto abiertos (`rationale`, `summary`); la forma rica (`debt_score`, `meta.inference_preset`) queda para 1.1.0.

## User Stories *(mandatory)*

### User Story 1 — Preset de inferencia para escritorio legacy (Priority: P1)

Como arquitecto, quiero que la inferencia use una calibración para el perfil desktop legacy, activada sola cuando el grafo lo es, de modo que la propuesta tenga pocas agrupaciones grandes y coherentes en lugar de un centenar de pares.

**Independent Test**: Inferir un grafo sintético de escritorio (formularios, controladores, adaptadores con `sp:` compartidos) con el preset y comprobar menos propuestas, mayor tamaño medio y la línea de preset en el resumen; con `preset = none` la salida es la actual.

**Acceptance Scenarios**:

1. **Given** un grafo cuyo `meta.source` es `roslyn-fallback` o cuyos componentes son mayoritariamente (≥ 50 %) archivos `.vb`, **When** se infiere con `inference.preset = auto` (por defecto), **Then** se aplica `legacy-desktop` y el resumen contiene `Preset de inferencia: legacy-desktop`
2. **Given** un grafo Java o C# sin esas señales, **When** se infiere con `auto`, **Then** no se aplica ningún preset, el resumen no menciona preset y la salida es byte a byte la actual
3. **Given** `inference.preset = legacy-desktop` sobre cualquier grafo, **When** se infiere, **Then** se aplica; **Given** `none`, **Then** nunca se aplica
4. **Given** el preset aplicado y una configuración explícita de un parámetro que el preset también fija, **When** se infiere, **Then** gana la configuración explícita del usuario
5. **Given** componentes de Presentación (`Layer:Presentación`/`Layer:Reportes`) que llaman a controladores, **When** se infiere con el preset, **Then** la cohesión y la densidad de las propuestas se calculan sin los componentes de presentación, que siguen contando como miembros y consumidores

---

### User Story 2 — Nombres por dominio de namespace y entidad (Priority: P1)

**Acceptance Scenarios**:

1. **Given** una propuesta cuyos miembros comparten el namespace `Acme.Policies.Amendment` (tras quitar el prefijo común a todo el grafo), **When** se infiere con el preset, **Then** se llama `Componente de Policies.Amendment`
2. **Given** miembros con namespaces distintos bajo `Acme.Policies`, **Then** se llama `Componente de Policies`; **Given** la heurística de entidad (020) activa y una entidad dominante `Policy`, **Then** se llama `Componente de Policies · Policy`
3. **Given** `naming.strategy = tokens` (por defecto fuera del preset), **Then** los nombres son los actuales

---

### User Story 3 — Librerías de soporte (Priority: P2)

**Acceptance Scenarios**:

1. **Given** componentes cuyo namespace contiene un segmento de `recommendation.supportNamespaces` (preset: `Commons`, `Shared`, `Utils`, `Utilities`, `Helpers`, `Generics`, `WebServices`), **When** se infiere con el preset, **Then** forman una librería de soporte, no una propuesta
2. **Given** un componente con `calls_in` desde al menos `recommendation.minReferencingDomains` (preset: 0, regla apagada) dominios distintos, **Then** es librería de soporte
3. **Given** la configuración por defecto (lista vacía, mínimo 0), **Then** solo aplica la regla actual por palabras de infraestructura

---

### User Story 4 — Índice de deuda como tercer factor de viabilidad (Priority: P1)

**Acceptance Scenarios**:

1. **Given** un componente con issues CRITICAL, ERROR, WARNING e INFO, dependencias `Dependency:eol:*` y complejidad máxima alta, **When** se calcula su índice, **Then** vale entre 0 y 1, es determinista y crece con la severidad, la densidad por LOC, las dependencias EOL y la complejidad
2. **Given** una propuesta, **When** se infiere con el preset, **Then** su `rationale` incluye `Deuda técnica: <0.000-1.000>` (media ponderada por LOC de sus miembros) y los tres componentes con más deuda
3. **Given** `viability.debtWeight = 0` (por defecto), **Then** la puntuación de viabilidad es la actual y no aparece la línea de deuda; **Given** peso > 0, **Then** la puntuación se reduce en `peso × deuda` y la línea aparece
4. **Given** la herramienta de re-inferencia, **When** se cambia `viability.debtWeight` o `inference.preset`, **Then** la propuesta refleja el cambio

---

### Edge Cases

- Grafo sin issues ni LOC: deuda 0; la línea indica `0.000`.
- Prefijo común a todo el grafo igual al id completo de un componente (un solo componente): el dominio es el último segmento del namespace.
- Componentes sin namespace: dominio `(global)`; nombre `Componente de (global)` solo si todos lo son; en otro caso se ignoran para el dominio.
- Presentación como única capa de una propuesta: la cohesión se calcula con ellos (no se excluye el 100 %).
- `preset = auto` sobre grafo mixto C#/VB: se decide por el 50 % de archivos `.vb`.

## Requirements *(mandatory)*

- **FR-001**: La configuración MUST ofrecer `inference.preset` ∈ {`auto`, `none`, `legacy-desktop`} (default `auto`) y `inference.presentationInCohesion` (boolean, default `true`); `auto` aplica `legacy-desktop` si `meta.source = roslyn-fallback` o ≥ 50 % de los componentes tienen algún archivo `.vb`.
- **FR-002**: El preset MUST ser un conjunto versionado de valores en el repositorio aplicado sobre los defaults y por debajo de la configuración explícita del usuario: `evidence.weights` (table 0.40, call 0.30, token 0.20, event 0.10), `consolidation.domainMergeMaxSize` 120, `consolidation.maxMergedSizeWithoutSimilarity` 120, `consolidation.highTokenSimilarity` 1.0, `viability.weights` (cohesion 0.40, coupling 0.30, data 0.15), `viability.thresholds` (high 0.60, medium 0.40), `viability.debtWeight` 0.15, `viability.ignoreSupportCoupling` true, `clustering.singleDomainRatio` 0.25, `clustering.procedureGrouping` entity, `clustering.attachCallersToTargets` true, `consolidation.entityStemMerge` true, `consolidation.verticalSliceRatio` 0.6, `inference.presentationInCohesion` false, `naming.strategy` `domain`, `recommendation.supportNamespaces` [Commons, Shared, Utils, Utilities, Helpers, Generics, WebServices], `recommendation.minReferencingDomains` 0 (la regla de fan-in queda disponible pero apagada en el preset: en un monolito en capas los dominios de namespace son técnicos), `dataAccess.entityHeuristic` true.
- **FR-003**: El preset aplicado MUST registrarse en el `summary` de la arquitectura (`Preset de inferencia: legacy-desktop`); sin preset no se añade texto.
- **FR-010**: Con `presentationInCohesion = false`, cohesión y densidad interna MUST excluir los miembros con `Layer:Presentación`/`Layer:Reportes` salvo que fueran todos; tamaño y acoplamiento externo los incluyen.
- **FR-020**: `naming.strategy` ∈ {`tokens`, `domain`} (default `tokens`); `domain` nombra por el namespace común más largo de los miembros tras quitar el prefijo común del grafo, con hasta dos segmentos; empates por orden ordinal; sufijo ` · <Entidad>` con la heurística de entidad activa; si no hay dominio, se usa `tokens`.
- **FR-030**: `recommendation.supportNamespaces` (lista, default vacía) y `recommendation.minReferencingDomains` (entero ≥ 0, default 0): un clúster cuyos miembros tienen mayoritariamente (≥ `supportRatio`) un segmento de la lista en su namespace, o cuyos miembros reciben `calls_in` desde ≥ N dominios distintos, MUST ser librería de soporte.
- **FR-040**: Índice de deuda por componente MUST ser determinista: `issues = Σ(CRITICAL 8, ERROR 4, WARNING 2, INFO 0.5)`; `densidad = issues / max(1, loc/100)`; `base = 1 − 1/(1 + densidad/10)`; `+0.10` por cada `Dependency:eol:*` (máx. 0.30); `+0.10` si `complexity_max > 15`; acotado a [0, 1], 3 decimales.
- **FR-041**: Índice de una propuesta MUST ser la media de sus miembros ponderada por LOC (LOC 0 → peso 1).
- **FR-042**: `viability.debtWeight` (default 0, [0, 1]) MUST restar `peso × deuda` a la puntuación antes de los umbrales; con peso 0 la puntuación y la salida MUST ser las actuales.
- **FR-043**: Con `debtWeight > 0`, `rationale` MUST incluir `Deuda técnica: <índice>` y `Mayor deuda: A (x), B (y), C (z)` (hasta tres, orden descendente, empates ordinales).
- **FR-050**: Sin configuración, las salidas de `test-for-demo/*` MUST ser byte a byte idénticas; dos corridas MUST ser idénticas.
- **FR-051**: Documentación: `engine/CONFIGURATION.md` (parámetros y preset), `docs/VB-LEGACY.md`, `docs/SCHEMA.md`, `CHANGELOG.md`.

### Key Entities

- **Preset de inferencia**: nombre, valores versionados, regla de selección automática, registro en `summary`.
- **Índice de deuda**: por componente (issues ponderados, densidad, EOL, complejidad) y por propuesta (media ponderada por LOC).
- **Dominio de propuesta**: namespace común tras el prefijo global; entidad opcional.
- **Librería de soporte**: por palabras de infraestructura (actual), por namespace de soporte o por fan-in de dominios.

## Success Criteria *(mandatory)*

- **SC-001**: Referencia (opt-in, grafo producido por 020-022): ≤ 25 propuestas; ≥ 50 % con viabilidad Media o Alta; ninguna con más de 120 componentes; cada propuesta con línea `Deuda técnica`; nombres con dominio reconocible (ningún nombre con dos tokens de clase). *Resultado 2026-10-30 (docs/EVALUATIONS.md §11): parcial — 44 propuestas, 2 Media, mayor 152 (clúster residual), deuda y nombres cumplidos; decisión del usuario pendiente sobre escala/umbrales.*
- **SC-002**: `test-for-demo/*` y líneas base byte a byte idénticas con la configuración por defecto.
- **SC-003**: Doble corrida byte a byte idéntica.
- **SC-004**: `meta.schema_version` sigue en `1.0.0`.

## Clarifications

### Session 2026-10-30

- `debt_score` y `meta.inference_preset` del plan: el contrato 1.0.0 cierra `signals`, `metrics` y `meta`; se exponen en `rationale` y `summary` (texto). Forma rica para 1.1.0 (decisión del usuario).
- Deuda de arquitectura (018.7, "si el tiempo lo permite") y prompts Genkit (018.5): fuera de esta feature.
- Preset `auto` usa señales del grafo (fuente, archivos `.vb`), nunca tiempo ni entorno.
- Implementación (2026-10-30): el preset además fija `clustering.singleDomainRatio` 0.25, `clustering.procedureGrouping` entity, `clustering.attachCallersToTargets` true, `consolidation.entityStemMerge` true, `consolidation.highTokenSimilarity` 1.0, `viability.ignoreSupportCoupling` true y `viability.thresholds` 0.6/0.4 (ver `engine/CONFIGURATION.md`, Presets); todos con valor por defecto igual al comportamiento previo.

## Assumptions

- El índice de deuda se calcula en la inferencia a partir del grafo (issues, LOC, anotaciones de 021/022); no modifica el grafo.
- Los presets no cambian la configuración por defecto de ningún parámetro existente.
