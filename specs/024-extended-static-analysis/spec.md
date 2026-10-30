# Feature Specification: Análisis estático extendido para el perfil desktop legacy

**Feature Branch**: `024-extended-static-analysis`
**Created**: 2026-10-30
**Status**: Draft
**Input**: User description: "Análisis estático extendido (feature 019 del PLAN-VB-PLATAFORMA-LEGACY.md): analizadores Roslyn oficiales, código muerto, duplicación, índice de mantenibilidad, lector SARIF y perfil de reglas por capa; determinista, sin red ni binarios externos."

> Numeración: feature 019 del plan; en el repositorio recibe el número 024.

## Contexto

El motor emite ≈ 16 reglas propias; un cliente espera el nivel de un analizador estándar y suele tener reportes de otras herramientas. Esta feature añade, bajo `analysis.extended` (`auto` = solo compilaciones Visual Basic): (1) los analizadores oficiales `Microsoft.CodeAnalysis.NetAnalyzers` (MIT, con soporte VB) en la misma compilación, con un conjunto de reglas **versionado** en `schema/extended-rules.json`; (2) código muerto `UNUSED_PUBLIC_MEMBER`; (3) duplicación `DUPLICATED_CODE`; (4) índice de mantenibilidad (fórmula de Microsoft) como anotación y como término del índice de deuda (023); (5) lector SARIF 2.1.0 (`analysis.sarif`) que fusiona reportes de otras herramientas en `code_issues`; (6) supresiones por capa (`analysis.layerSuppressions`). El contrato 1.0.0 cierra `code_issues[]` (`type` ∈ BUG_PATTERN|CODE_STYLE|SECURITY|PERFORMANCE, `pattern` abierto) y no tiene `maintainability_index`, así que: `pattern` = identificador de regla (`CA2200`, `UNUSED_PUBLIC_MEMBER`, regla SARIF), `type` se mapea al enumerado cerrado, el `message` lleva prefijos `[categoría]`, `[CWE-nnn]` y `[source:<herramienta>]`, y el índice de mantenibilidad es la anotación `Maintainability:<0-100>`. Forma rica (`rule_id`, `category`, `cwe`, `source`, `maintainability_index`) para 1.1.0.

Fuera de alcance (decisiones §7 del plan pendientes): `SecurityCodeScan` (LGPL) — las reglas de seguridad son las de NetAnalyzers (`CA2100`, `CA53xx`) y las propias (`SQL_CONCAT_INJECTION`, `HARDCODED_SECRET_IN_CODE`), todas con `[CWE-nnn]`; `Roslynator.Analyzers` no incluye analizadores Visual Basic y se descarta.

## User Stories *(mandatory)*

### User Story 1 — Analizadores oficiales con conjunto de reglas versionado (Priority: P1)

**Acceptance Scenarios**:

1. **Given** el proyecto sintético `SyntheticExtended`, **When** se analiza, **Then** los componentes reciben issues `CAxxxx` de al menos cinco categorías (`[reliability]`, `[security]`, `[performance]`, `[globalization]`, `[design]`, `[usage]`…) con `type` del enumerado cerrado y al menos uno con `[CWE-nnn]`
2. **Given** `analysis.extended = off`, **Then** ningún componente tiene issues `CA*`, `UNUSED_PUBLIC_MEMBER`, `DUPLICATED_CODE` ni anotación `Maintainability:`
3. **Given** un proyecto C# o Java, **When** se analiza sin configuración, **Then** la salida es byte a byte la actual
4. **Given** `analysis.rules` explícito, **Then** solo esas reglas se evalúan; vacío = lista versionada

### User Story 2 — Código muerto y duplicación (Priority: P1)

1. **Given** un miembro `Public` sin referencia por nombre en ninguna otra parte del código, sin `Handles`, que no es punto de entrada ni implementación de interfaz ni `Overrides`, **Then** `UNUSED_PUBLIC_MEMBER` (INFO) en su línea; el miembro llamado desde otro tipo no lo recibe
2. **Given** dos métodos de componentes distintos con ≥ `analysis.duplicateMinTokens` tokens normalizados idénticos, **Then** ambos reciben `DUPLICATED_CODE` (WARNING) con la lista ordenada de los otros componentes; un método único no lo recibe

### User Story 3 — Índice de mantenibilidad en la deuda (Priority: P2)

1. **Given** el análisis extendido, **Then** cada componente con métodos tiene `Maintainability:<entero 0-100>`
2. **Given** `viability.maintainabilityWeight > 0`, **Then** el índice de deuda suma `peso × (1 − MI/100)`; con 0 (default) el índice es el de 023

### User Story 4 — Importación SARIF (Priority: P2)

1. **Given** `analysis.sarif = ["reports/sonar.sarif"]`, **Then** los resultados se fusionan en `code_issues` del componente cuyo archivo coincide, `pattern` = `ruleId`, `message` con prefijo `[source:<tool.driver.name>]`, severidad por `level`, deduplicados por (archivo, línea, regla) y ordenados; los resultados sin archivo coincidente producen una advertencia con el conteo
2. **Given** un archivo SARIF inexistente o inválido, **Then** advertencia de usuario y análisis completo

### User Story 5 — Supresiones por capa (Priority: P3)

1. **Given** `analysis.layerSuppressions = ["Presentación:HIGH_CYCLOMATIC_COMPLEXITY"]` y un formulario (`Layer:Presentación`) con complejidad alta, **Then** no recibe `HIGH_CYCLOMATIC_COMPLEXITY`; un controlador sí

### Edge Cases

- Analizador oficial que lanza excepción: el tipo conserva el resto de issues y se registra `[WARN]` (principio V).
- Método duplicado dentro del mismo componente: no cuenta (se exige ≥ 2 componentes).
- `Maintainability` de componente sin métodos: no se emite.
- SARIF con `uri` absoluta o `file://`: se compara por sufijo de ruta normalizado.

## Requirements *(mandatory)*

- **FR-001**: Configuración `analysis.extended` ∈ {auto, on, off} (default auto: solo Visual Basic), `analysis.rules` (string[], default vacía = `schema/extended-rules.json`), `analysis.duplicateMinTokens` (int ≥ 10, default 30), `analysis.sarif` (string[] rutas, default vacía), `analysis.layerSuppressions` (string[] `Capa:REGLA`, default vacía); `viability.maintainabilityWeight` ([0,1], default 0). El preset `legacy-desktop` fija `maintainabilityWeight` 0.10 y `layerSuppressions` [`Presentación:HIGH_CYCLOMATIC_COMPLEXITY`, `Presentación:UNUSED_PUBLIC_MEMBER`, `Reportes:UNUSED_PUBLIC_MEMBER`].
- **FR-010**: Pasada `VbExtendedAnalyzer` MUST ejecutar los analizadores de `Microsoft.CodeAnalysis.NetAnalyzers` (VB) sobre la compilación con exactamente las reglas activas; cada diagnóstico → issue `pattern` = id, `type` = mapeo (Security→SECURITY, Performance→PERFORMANCE, Naming/Style→CODE_STYLE, resto→BUG_PATTERN), severidad (Error→ERROR, Warning→WARNING, Info/Hidden→INFO; reglas de seguridad → CRITICAL cuando el paquete las marca Error), `message` = `[<categoría en minúsculas>]` + `[CWE-nnn]` si la regla tiene CWE en la lista versionada + texto; ordenados por ubicación y regla.
- **FR-011**: La lista versionada `schema/extended-rules.json` MUST declarar cada regla activa con `category` y `cwe` opcional; versionada en el repositorio y embebida en el analizador.
- **FR-020**: `UNUSED_PUBLIC_MEMBER` (INFO) MUST emitirse para métodos, propiedades y tipos `Public`/`Friend` sin referencia por nombre fuera de su declaración, excluyendo `Sub Main`, formularios y controles, `WebMethod`/`OperationContract`, implementaciones (`Implements`), `Overrides`, `Handles`, eventos y constructores.
- **FR-030**: `DUPLICATED_CODE` (WARNING) MUST emitirse para métodos con ≥ `duplicateMinTokens` tokens normalizados (identificadores → `ID`, literales → `LIT`) cuyo hash coincide en ≥ 2 componentes; mensaje con los otros componentes en orden ordinal.
- **FR-040**: Anotación `Maintainability:<n>` MUST calcularse con la fórmula de Microsoft `max(0, (171 − 5.2·ln(HV) − 0.23·CC − 16.2·ln(LOC)) × 100 / 171)` sobre el tipo (volumen Halstead de sus tokens, suma de complejidades ciclomáticas, líneas), redondeada a entero.
- **FR-041**: Índice de deuda (023) MUST sumar `viability.maintainabilityWeight × (1 − MI/100)` cuando el componente tiene la anotación; sin anotación o peso 0, inalterado.
- **FR-050**: Lector SARIF 2.1.0 MUST importar `runs[].results[]` (ruleId, level, message.text, primera ubicación física) a los componentes por sufijo de ruta, con `[source:<driver.name>]`, deduplicación y orden; rutas relativas al proyecto analizado; errores → advertencia de usuario, nunca fallo.
- **FR-060**: Supresiones por capa MUST eliminar, al final de todas las pasadas, los issues cuya regla esté suprimida para la capa fina (`Layer:<Capa>` de 021) del componente.
- **FR-070**: Salidas C#/Java y `test-for-demo/*` MUST ser byte a byte idénticas sin configuración; doble corrida idéntica con los analizadores activos.
- **FR-080**: Documentación: `engine/CONFIGURATION.md`, `docs/VB-LEGACY.md`, `docs/SCHEMA.md`, `CHANGELOG.md`, fixture `SyntheticExtended` con README y golden.

## Success Criteria *(mandatory)*

- **SC-001**: Referencia (opt-in): ≥ 5 categorías `[…]` presentes; ≥ 1 issue con `[CWE-`; doble corrida idéntica con analizadores activos (tiempo registrado en `docs/EVALUATIONS.md`).
- **SC-002**: Fixture sintético: `UNUSED_PUBLIC_MEMBER` y `DUPLICATED_CODE` con caso positivo y negativo; SARIF de ejemplo importado.
- **SC-003**: `test-for-demo/*` y líneas base byte a byte idénticas; `meta.schema_version` 1.0.0.

## Clarifications

### Session 2026-10-30

- SecurityCodeScan excluido (LGPL, §7.6 pendiente); Roslynator excluido (sin analizadores VB en 4.12.4).
- `analysis.extended` default `auto` (= VB) por la decisión ya tomada en §7 ("pasadas con flag activas solo en VB").
- El tipo `DEPENDENCY` emitido por 022 para `EOL_DEPENDENCY` viola el enumerado cerrado del contrato; se corrige a `SECURITY` (dependencias sin soporte = riesgo de seguridad), con prueba que compara el enumerado Java con el del esquema (BUG-010, bugs.md de 022).

## Assumptions

- Los ensamblados de referencia de .NET Framework siguen sin resolverse en macOS/Linux (transversal 1 pendiente): las reglas que dependen de tipos no resueltos (`CA2100` sobre `SqlCommand`) solo se disparan con fidelidad completa; el fixture usa reglas resolubles con el runtime.
