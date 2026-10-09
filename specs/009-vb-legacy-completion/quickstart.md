# Quickstart: Cierre de VB.NET legacy

Desde `apps/dev-arch`, con JDK 17 y .NET 8 (`DOTNET_ROOT`):

```bash
make build
# Analizador .NET directo sobre el corpus sintético
engine/target/dotnet-analyzer \
  engine/src/test/dotnet/DotNetAnalyzer.Tests/Fixtures/VbLegacy/SyntheticDesktop/SyntheticDesktop.vbproj > /tmp/vb.json
jq '[.components[] | select(.tables_used|length>0) | {id, tables_used}]' /tmp/vb.json
jq '[.components[] | {id, layer, cbo, lcom, complexity_max, issues: [.code_issues[].pattern]}]' /tmp/vb.json
# Advertencia de fidelidad reducida (macOS/Linux): última línea de stderr "[warning] VB project 'SyntheticDesktop.vbproj' …"

# Endpoints ASMX/WCF
engine/target/dotnet-analyzer \
  engine/src/test/dotnet/DotNetAnalyzer.Tests/Fixtures/VbLegacy/SyntheticWebServices/SyntheticWebServices.vbproj \
  | jq '.api_contracts.endpoints[] | .id'

# Motor (CLI): advertencia en stderr con prefijo [warning]
java -jar engine/target/java-dependency-extractor.jar \
  engine/src/test/dotnet/DotNetAnalyzer.Tests/Fixtures/VbLegacy/SyntheticDesktop /tmp/out.json --language=dotnet

# Pruebas
dotnet test engine/src/test/dotnet/DotNetAnalyzer.Tests/DotNetAnalyzer.Tests.csproj --filter "Category!=Corpus"
(cd engine && mvn -B -Dtest='DotNetBridge*,RunVbLegacyCompletionFeaturesTest' test)
make test
```

Escenarios de verificación: tablas `AuditLog`, `Customers`, `InvoiceLines`, `Invoices`, `Orders`, `TempImport` en el escritorio sintético; 5 endpoints en los servicios web sintéticos; issues `ON_ERROR_RESUME_NEXT`, `OPTION_STRICT_OFF`, `GOTO_STATEMENT`, `LATE_BINDING`, `PLAINTEXT_SECRET_IN_CONFIG`, `HARDCODED_SECRET_IN_CODE`, `EMPTY_CATCH_BLOCK`, `CATCH_GENERIC_EXCEPTION`, `MISSING_SWITCH_DEFAULT`, `HIGH_CYCLOMATIC_COMPLEXITY`.

Corpus real (opcional, si existe `engine/test-for-demo/vb-demo-legacy` o un ancestro con `test-for-demo/vb-demo-legacy`):

```bash
dotnet test engine/src/test/dotnet/DotNetAnalyzer.Tests/DotNetAnalyzer.Tests.csproj --filter "Category=Corpus"
```
