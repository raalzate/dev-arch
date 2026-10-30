# Architecture

dev-arch is one product with three faces over a single deterministic engine.

```mermaid
flowchart TB
  subgraph Clients
    U[Browser<br/>modernization journey]
    A[Coding agent<br/>Claude Code]
    C[CLI / CI]
  end
  subgraph Web[web/ — Next.js :9002]
    UI[UI: summary · map · proposals · findings · plan]
    API[REST /api/analyses]
    MCPW[Agent MCP endpoint /api/mcp]
    L[lib/modernization<br/>summary · ordering · findings · plan]
    Q[Job store + queue]
  end
  B[dev-arch-mcp.mjs<br/>stdio bridge: zips the folder]
  subgraph Engine[engine/ — deterministic]
    J[Java 17 + Spoon]
    N[.NET 8 + Roslyn<br/>C# · VB.NET]
    I[Inference: clustering,<br/>cohesion, coupling, viability]
  end
  S[(schema/1.0.0<br/>versioned JSON contract)]
  U --> UI --> API
  A -- stdio --> B -- HTTP --> API
  B -- HTTP --> MCPW
  API --> Q -- MCP stdio --> Engine
  MCPW --> Q
  MCPW --> L
  UI --> L
  C --> Engine
  Engine --> S
```

| Piece | Responsibility | Deterministic? |
|---|---|---|
| `engine/` (Java + Spoon, .NET + Roslyn) | Parse the whole project, build the dependency graph, detect layers, tables, endpoints, secrets and code issues, infer microservice proposals | Yes: same input, same bytes (contract tests) |
| `schema/` | JSON Schema of every output (`graph`, `architecture`, `contracts`, MCP responses) and generated TypeScript types | — |
| `web/src/lib/modernization` | Pure functions that turn the documents into the five steps (summary, ordering, findings, plan, comparison) | Yes: pure functions |
| `web/src/server` | Asynchronous analyses (upload, queue, store, path redaction, API token), inference re-runs, health | — |
| `web/src/app/api/mcp` | MCP endpoint for agents: the same documents and the same `lib/modernization` functions as the UI | Yes: identical answers for identical requests |
| `web/public/dev-arch-mcp.mjs` | Dependency-free stdio bridge: packages the local folder (deterministic ZIP) and forwards MCP calls | Yes |

Single source of truth: the agent tools, the REST API and the UI all read the same engine documents and project
them with the same functions, so an agent and a person always see the same analysis.

## Registered technical debt

Debt known in the engine, with the decision it waits for. Fixing it is not required by any open feature; it is
recorded so that it is weighed explicitly instead of being rediscovered (014b of the VB legacy plan, 2026-10-30).

| Debt | Where | Why it stays | Decision pending |
|---|---|---|---|
| C# and VB syntax handled by parallel branches in the general passes | `Analysis/InvocationAnalyzer.cs`, `Analysis/DependencyInjectionAnalyzer.cs`, `Analysis/TypeAnalyzer.cs` (one walker per language, same rules) | Both branches are covered by the same scenarios through the C# demos and the synthetic VB corpus (009 `csharp-compatibility.feature` guards the C# outputs byte for byte); abstracting over `IOperation` would change the semantic resolution path of both languages at once | Keep the controlled duplication with mirror tests (current state) or abstract the three passes over `IOperation` (one source of truth, principle II; more work and a regression risk on the C# baselines). The user decides before feature 016 touches these passes |
| Dependency on the Roslyn operation tree for `LATE_BINDING` under reduced fidelity | `Analysis/Vb/VbCodeAnalyzer.cs` | Roslyn 4.9.2 throws for one constructor pattern (009 BUG-001); the pass degrades per expression | Applying the `.vbproj` imports and root namespace in the Adhoc fallback (feature 016) removes the trigger seen in the reference corpus; the guard stays |

See also: [INSTALL.md](INSTALL.md) · [AGENTS-MCP.md](AGENTS-MCP.md) · [SCHEMA.md](SCHEMA.md) ·
[CONTINUOUS-MODERNIZATION.md](CONTINUOUS-MODERNIZATION.md)
