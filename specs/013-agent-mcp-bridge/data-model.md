# Data Model: 013-agent-mcp-bridge

Sin persistencia nueva. Entidades de intercambio:

## AnalysisRef (salida de `analyze_project`, `get_analysis`, `list_analyses`)

| Campo | Tipo | Nota |
|---|---|---|
| `analysis_id` | string (UUID) | id del trabajo del almacén |
| `name` | string | raíz del proyecto o nombre del ZIP |
| `technology` | string \| null | `Java`, `.NET · C#`, `.NET · VB`… (perfil de la web) |
| `status` | `queued` \| `running` \| `completed` \| `failed` | estado del trabajo |
| `phase` | string \| null | fase actual si no terminó |
| `finished_at` | string \| null | del trabajo (no se generan marcas nuevas) |
| `url` | string | `<base>/?analysis=<id>` |
| `warnings` | string[] | advertencias del análisis |
| `error` | {code,message} \| null | solo si `failed` |

## AnalysisSummary (`summary` en `analyze_project`/`get_analysis` completados y `get_summary`)

El objeto `Summary` de `lib/modernization/summary.ts` tal cual (sin proyección propia): `profile`, `components`,
`loc`, `edges`, `externalDependencies`, `endpoints`, `severity`, `componentsWithSecrets`, `sensitiveProposals`,
`tables`, `proposals`, `candidates` (3 primeras propuestas), `risky` (8 componentes de mayor riesgo).

## ProposalView (`get_proposals`)

`{ proposals }`: las propuestas del documento de arquitectura en el orden de `orderProposals`, sin proyección
(`id`, `name`, `viability`, `components`, `metrics` {`cohesion_avg`, `external_coupling`, …}, `tables`, …).

## FindingsView (`get_findings`)

`min_severity`, `group_by` (`severity` \| `pattern`, los modos de la web), `total`, `groups` [{key, count, issues}]
— de `allIssues` + `groupIssues`.

## PlanView (`get_plan`)

`markdown` (de `planToMarkdown`) + `plan` (objeto `ModernizationPlan` de `buildPlan` con parámetros por defecto o
los dados).

## InferenceParameter (`get_inference_parameters`)

`name`, `label`, `description`, `default`, `min`, `max`, `step` (de `inferenceDefaults`).

## Validación

- `analysis_id`: UUID del almacén (`isJobId`); otro → `INVALID_INPUT`.
- `wait_seconds`: entero 0..900 (por defecto 300 en `analyze_project`, 0 en `get_analysis`).
- `language`: `java` \| `dotnet` \| `auto`.
- `config`: claves y rangos de `parseConfig` (008).

## Transiciones

`queued → running → completed | failed` (007, sin cambios).
