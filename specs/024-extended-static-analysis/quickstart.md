# Quickstart: 024
```bash
dotnet run --project engine/src/main/dotnet/DotNetAnalyzer -- engine/src/test/dotnet/DotNetAnalyzer.Tests/Fixtures/VbLegacy/SyntheticExtended | jq '[.components[].code_issues[].pattern]|unique'
java -jar engine/target/java-dependency-extractor.jar <vb-project> out.json --language=dotnet --config='{"analysis":{"sarif":["reports/sonar.sarif"]}}'
```
