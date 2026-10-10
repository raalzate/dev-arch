# Contract: escenarios heredados en la verificación del motor (US2)

| Feature | Runner (nuevo) | Glue | Informe |
|---|---|---|---|
| specs/001-mcp-server-local | `com.extractor.legacybdd.mcp.RunMcpServerLocalFeaturesTest` | `com.extractor.legacybdd.mcp` | `target/cucumber-reports/legacy-001.json` |
| specs/002-dotnet-roslyn-analyzer (incl. bugfix_BUG-001..006) | `com.extractor.legacybdd.dotnet.RunDotnetRoslynAnalyzerFeaturesTest` | `com.extractor.legacybdd.dotnet` | `target/cucumber-reports/legacy-002.json` |
| specs/003-dotnet-code-issues | `com.extractor.legacybdd.codeissues.RunDotnetCodeIssuesFeaturesTest` | `com.extractor.legacybdd.codeissues` | `target/cucumber-reports/legacy-003.json` |

- Analizador .NET ausente ⇒ pasos que lo requieren omitidos con `requires-dotnet: …`; `-Dlegacybdd.analyzer=absent` fuerza la ausencia.
- Indefinido / pendiente / ambiguo ⇒ fallo (Cucumber estricto).
