# Contract: result steps and sections (010)

Stable DOM hooks (Playwright and accessibility). Existing 007 hooks are preserved: `upload-input`, `analyze-button`, `language-select`, `analysis-status[data-status]`, `analysis-phase[data-phase]`, `analysis-id`, `analysis-warnings`, `analysis-expired`, `api-token-input`, `api-token-submit`, `import-input`, `import-submit`, `proposal-card`, `component-node[data-component-id][data-file]`, `component-open-source`, `code-viewer-content`.

## Shell

| Hook | Meaning |
|---|---|
| `technology-badge[data-technology]` | `java|csharp|vb|dotnet-mixed|dotnet`; text = profile label |
| `step-nav` / `step-link[data-step]` | `summary, map, proposals, findings, plan`; active has `aria-current="step"` |
| `step-panel[data-step]` | visible step |
| `section[data-section][data-count]` | every rendered section; `data-count` ≥ 1 |
| `no-findings[data-step]` | "Sin hallazgos: …" line; `data-sections` = comma-separated ids |
| `theme-toggle` | switches `light|dark` (`html.dark`) |
| `reduced-fidelity-warning` | shown when `reducedFidelity` |
| `run-progress` | queued/running panel, `run-phase-step[data-phase][data-state=done|current|pending]`, `run-elapsed` |

## Section catalogue (id → step → applies to → items)

| id | step | applies | items |
|---|---|---|---|
| `java-deprecated` | findings | java | components with annotation `Deprecated` |
| `java-ejb` | findings | java | components with `ejb_type` |
| `java-jndi` | findings | java | components with `uses_jndi` |
| `csharp-di` | findings | csharp | edges whose types include `injection` or `registration` |
| `vb-desktop-ui` | findings | vb | components with layer `Web` |
| `vb-modules` | findings | vb | components with layer `Compartida` |
| `vb-legacy-risks` | findings | vb | code issues with pattern in `OPTION_STRICT_OFF, ON_ERROR_RESUME_NEXT, GOTO_STATEMENT, LATE_BINDING` |
| `dotnet-app-config` | findings | dotnet | `secrets_locations` whose path ends in `.config` |
| `interfaces` | findings | all | components with `is_interface` |
| `messaging` | findings | all | components with `messaging_type` |
| `data-access` | findings | all | components with `tables_used` |
| `external-deps` | findings | all | entries of `project_metadata.external_dependencies` |
| `tab-issues` | findings | all | code issues |
| `tab-secrets` | findings | all | components with `secrets_references` + `secrets_locations` |
| `tab-contracts` | findings | all | `api_contracts.endpoints` |
| `tab-entrypoints` | findings | all | proposals with a `legacy_entrypoint` of type ≠ `internal` |
| `summary-warnings` | summary | all | analysis warnings |
| `summary-risky` | summary | all | top-8 risky components (≥1 issue or secrets) |
| `summary-candidates` | summary | all | top-3 proposals |
| `support-libraries` | proposals | all | `support_libraries` |

Java-only ids: `java-*`. .NET-only ids: `csharp-*`, `vb-*`, `dotnet-*`.

## Proposals / plan / history hooks

`inference-panel`, `inference-param[data-path]` (slider, `aria-valuemin/max/now`), `inference-min-viability`, `inference-reset`, `inference-status[data-state=original|recalculated|error]`, `inference-error`, `proposal-card[data-proposal-id][data-viability]`, `proposal-edit`, `proposal-move-select`, `proposal-score[data-viability]`, `map-canvas`, `map-edge[data-types][data-weight]`, `map-legend-type[data-type]` (toggle), `map-group-mode`, `map-severity`, `map-node[data-component-id][data-highlighted]`, `findings-tab[data-tab]`, `issues-group-mode`, `issues-severity-filter`, `issue-group[data-group][data-count]`, `contract-row`, `plan-stage[data-viability]`, `export-json`, `export-markdown`, `export-pdf`, `print-report`, `history-open`, `history-row[data-job-id][data-status]`, `history-select-compare`, `history-compare`, `comparison-view`, `comparison-only-a`, `comparison-only-b`.
