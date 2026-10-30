# Output contract and versioning policy

The JSON written by Static Inference — `output.json`, `output_architecture.json`, `output_entrypoints.json` — and
the successful responses of the five MCP tools are a **public contract** (Constitution, principle I). Since
feature `005-json-schema-contract` the contract is formal, machine readable and versioned:

| What | Where |
|------|-------|
| Source of truth (JSON Schema draft 2020-12) | [`schema/1.0.0/`](../schema/1.0.0/) |
| Current version | [`schema/VERSION`](../schema/VERSION) → `1.0.0` |
| Version declared by every artifact | `meta.schema_version` (graph, architecture, entrypoints) |
| Generated TypeScript types + zod validators | [`schema/generated/`](../schema/generated/) (never edited by hand) |
| Single verification entry point | `make schema-check` (blocking CI job `schema-check`) |

The schema files are the only normative description. Prose references (skill references, `MCP.md`, contracts
of features 001–003) point to `schema/1.0.0/` and must never contradict it.

## Documents

| Artifact / response | Schema | Root type |
|---------------------|--------|-----------|
| `output.json`, MCP `get_dependency_graph` | `dependency-graph.schema.json` | `DependencyGraph` |
| `output_architecture.json`, MCP `get_architecture_proposal` | `architecture.schema.json` | `ConsolidatedArchitecture` |
| `output_entrypoints.json`, MCP `get_api_contracts` | `entrypoints.schema.json` | `EntrypointsDocument` |
| MCP `get_component_metrics` | `mcp/get_component_metrics.response.schema.json` → `common#/$defs/Component` | `Component` |
| MCP `analyze_project` | `mcp/analyze_project.response.schema.json` | `AnalyzeProjectResponse` |
| MCP `reinfer_architecture` (008) | `mcp/reinfer_architecture.response.schema.json` → `architecture.schema.json` | `ReinferArchitectureResponse` |
| MCP `score_proposal` (008) | `mcp/score_proposal.response.schema.json` | `ScoreProposalResponse` |
| Inference configuration (008: `--config`, `config`, `configPath`) | `inference-config.schema.json` | `InferenceConfig` |

The last three rows (008) are generated into the separate extension module `schema/extensions/`
(`@static-inference/schema/extensions`, registry `extensionValidatorsByKind`, `parseInferenceConfig`,
`parseReinferArchitectureResponse`, `parseScoreProposalResponse`); the original module `schema/generated/` and its
`validatorsByKind` registry keep the eight kinds of 005. `npm --prefix schema run generate` regenerates both and
`make schema-check` detects drift in both.

Rules applied by the schemas: objects of known structure are **closed** (`additionalProperties: false`); the maps
`meta.microservice_candidates`, `api_contracts.schemas`, `project_metadata.external_dependencies`,
`project_metadata.package_dependencies` and `ApiSchema.properties` accept arbitrary keys; closed catalogues
(`layer`, `code_issues[*].type`, `code_issues[*].severity`, `viability`, `legacy_entrypoint.type`, `meta.source`)
are enums; nullable fields are optional and typed `T | null`; `Component.interface` is `deprecated`
(duplicate of `is_interface`).

## Semantic versioning

The contract follows [SemVer](https://semver.org/). A change is **major** whenever a consumer that validated
the previous version could reject or misinterpret an output of the new one.

| Change | Increment | Migration note | Example |
|--------|-----------|----------------|---------|
| remove a field | major | required | drop `components[*].interface` |
| rename a field | major | required | `tables_used` → `tables` |
| change the type of a field | major | required | `components_with_secrets` integer → list |
| add a value to a closed catalogue | major | required | new `layer` value `Servicio` |
| make an input field required | major | required | `response_schema` becomes required |
| add an optional field | minor | not required | new optional `components[*].owner` |
| clarify a description without validation effect | patch | not required | reword a `description` |

Notes:

- Adding a value to a closed catalogue is major on purpose: a consumer with exhaustive handling of the catalogue
  breaks.
- Open-valued fields (`endpoints[*].method`, `edges[*].type`, `code_issues[*].pattern`, `messaging_type`, …) can
  gain values without a version change.
- `meta.schema_version` uses `const` in each published schema, so a consumer validating with contract `X` rejects
  an output of contract `Y` explicitly by version.

## Migration note format

Every **major** change ships a migration note in this document (section *Migration notes*, newest first) with
this format:

```markdown
### <previous version> → <new version> (YYYY-MM-DD)

- **Previous version**: <x.y.z>
- **New version**: <x'.0.0>
- **Affected fields**: <JSON Pointer of every changed field, e.g. /components/*/interface>
- **Change**: <what changed and why>
- **Consumer action**: <what a consumer must do: field mapping, new enum value handling, re-validation>
- **Producers**: <Java engine / .NET analyzer release that emits the new version>
```

Minor and patch changes are listed in `CHANGELOG.md` only.

## Changing the contract

1. Edit `schema/<VERSION>/*.schema.json` (and, for a new version, copy the directory to `schema/<new>/` and update
   every `$id`, the `SchemaVersion` `const` and `schema/VERSION`).
2. Update the producers' single constants: `com.extractor.model.SchemaVersion.CURRENT` (Java) and
   `DotNetAnalyzer.Model.SchemaVersion.Current` (.NET).
3. Regenerate the consumer types: `npm --prefix schema run generate` (or `make schema-generate`) and commit
   `schema/generated/`.
4. Add or update fixtures under `schema/fixtures/` when the shape changes.
5. Run `make schema-check`; it fails if Java, .NET, the generated types or the version constants diverge.
6. Classify the change with the table above; for a major change add the migration note below.

## Running the checks

- `make schema-check` — the four fronts (`version`, `java`, `dotnet`, `ts`). It publishes the current .NET analyzer
  (framework-dependent) and installs `target/dotnet-analyzer` as a launcher for it, replacing any previous file
  there (a self-contained single-file build always runs in `roslyn-fallback` mode, see research E18).
  Optional: `JAVA_HOME` (JDK 17), `MVN_ARGS=-o`, `SCHEMA_CHECK_SKIP_BUILD=1`, `SCHEMA_CHECK_VERBOSE=1`.
- `mvn verify` runs the JUnit contract tests (`@Tag("schema-contract")`) and the Cucumber scenarios of
  `specs/005-json-schema-contract/tests/features`. Scenarios needing `dotnet-analyzer` or Node 20 are skipped
  when the tool is missing; the end-to-end `schema-check` divergence scenarios (TS-034..TS-038, ~5 min) run only
  with `SCHEMA_CHECK_E2E=true` (the CI job `schema-check` enables them).
- Contract tests analyze hermetic copies of `test-for-demo/` (git-tracked files only) under `target/schema-demo/`.

## Additive definitions without a version bump (008)

Feature 008-configurable-inference added three **new** definitions (two MCP responses and the inference configuration)
inside contract `1.0.0`. No existing schema changed and no produced document changed, so `meta.schema_version` stays
`1.0.0` (a bump would change every existing output and the locked assertions of 005–007). Decision pending user
confirmation; the alternative is a `1.1.0` minor release.

The TypeScript types and zod validators of `schema/generated/` are **not** extended with these definitions yet: the
locked acceptance of 005 (TS-028) fixes the generated registry to the three documents and the five original MCP
responses. The new schemas are verified by the Java contract tests (`SchemaRegistry`) and served by the MCP resource
`static-inference://schema`; generating their TypeScript types is left to the web feature that consumes them (010),
together with a re-lock of TS-028.

## Migration notes

_None yet — 1.0.0 is the first formal version. It describes the v1.1.0 output plus the additive
`meta.schema_version` (and the new `meta` objects of the architecture and entrypoints documents)._

## `inference-config` — section `inference`, presets and debt index (feature 023, additive)

| Key | Type | Default | Meaning |
|---|---|---|---|
| `inference.preset` | `auto` \| `none` \| `legacy-desktop` | `auto` | inference preset; `auto` = `legacy-desktop` for Visual Basic graphs |
| `inference.presentationInCohesion` | boolean | `true` | `false` = presentation members do not count in cohesion/density |
| `consolidation.verticalSliceRatio` | [0,1] | `0` | share of outgoing calls to one cluster that merges both (0 = off) |
| `viability.debtWeight` | [0,1] | `0` | weight of the debt index subtracted from the score |
| `naming.strategy` | `tokens` \| `domain` | `tokens` | proposal naming strategy |
| `recommendation.supportNamespaces` | string[] | `[]` | namespace segments of support libraries |
| `recommendation.minReferencingDomains` | integer ≥ 0 | `0` | calling domains from which a group is a support library |

Output conventions without schema change: `summary` ends with `Preset de inferencia: <name>` when a preset applies;
`proposals[].rationale` contains `Deuda técnica: <0.000-1.000>` and `Mayor deuda: …` when `viability.debtWeight > 0`.

## `inference-config` — sections `integrations` and `dependencies` (feature 022, additive)

| Key | Type | Default | Meaning |
|---|---|---|---|
| `integrations.outbound` | `auto` \| `on` \| `off` | `auto` | outbound integration detection (SOAP/WCF/REST); `auto` = Visual Basic only |
| `dependencies.enabled` | `auto` \| `on` \| `off` | `auto` | external dependencies, end of life and missing projects |
| `dependencies.eol` | string[] | `[]` | name prefixes added to `schema/eol-dependencies.json` |

Output conventions without schema change: annotations `Integration:<wcf|soap|rest>:<target>`, `Dependency:eol:<name>`;
`external_dependencies` entries (third-party names, `service:`, `http:`, `project:`); `code_issues[].rule`
`EOL_DEPENDENCY` (`type` `DEPENDENCY`).

## `inference-config` — section `debt` (feature 021, additive)

| Key | Type | Default | Meaning |
|---|---|---|---|
| `enabled` | `auto` \| `on` \| `off` | `auto` | legacy debt rules of the .NET analyzer; `auto` = Visual Basic compilations only |
| `godClass.minLoc` | integer ≥ 1 | `1000` | lines of code above which a type may be a god class |
| `godClass.minComplexity` | integer ≥ 1 | `15` | maximum method complexity above which a type may be a god class |

Output conventions without schema change: `components[].annotations` may contain `Layer:Presentación`,
`Layer:Reportes`, `Layer:Batch` and `EntryPoint:Main`; `proposals[].legacy_entrypoint` of a batch proposal is
`internal` with `exposed_operations = ["Main"]`; new `code_issues[].rule` values are listed in `docs/VB-LEGACY.md`.

## `inference-config` — section `dataAccess` (feature 020, additive)

| Key | Type | Default | Meaning |
|---|---|---|---|
| `procedures` | `auto` \| `on` \| `off` | `auto` | stored procedure detection in the .NET analyzer; `auto` = Visual Basic compilations only |
| `procedureCatalog` | string or null | `null` | directory of `.sql` scripts or `.csv` file (`procedimiento,tabla,operación`) translating procedures to tables |
| `catalogMode` | `complement` \| `replace` | `complement` | keep `sp:` next to the tables, or tables only |
| `procedureWeight` | number ≥ 0 | `1.0` | weight of an `sp:` resource relative to a table in the inference; `0` ignores procedures |
| `entityHeuristic` | boolean | `false` | derive a business entity from procedure names for proposal naming |

Output conventions without schema change: `components[].tables_used` may contain `sp:<Name>`;
`proposals[].metrics.tables_shared` lists tables first and `sp:` entries after, each group in ordinal order. The
generated TypeScript types (`schema/generated`, `schema/extensions`) include the section.
