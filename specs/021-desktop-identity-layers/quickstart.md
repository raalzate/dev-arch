# Quickstart: 021-desktop-identity-layers
```bash
export DOTNET_ROOT="$HOME/.dotnet8" PATH="$HOME/.dotnet8:$PATH"; make build-engine
F=engine/src/test/dotnet/DotNetAnalyzer.Tests/Fixtures/VbLegacy/SyntheticLegacyDebt
engine/target/dotnet-analyzer $F | jq '.components[] | {id, layer, annotations, rules: [.code_issues[].rule] | unique}'
printf '{"debt":{"enabled":"off"}}' > /tmp/debt-off.json
engine/target/dotnet-analyzer $F --config=/tmp/debt-off.json | jq '[.components[].code_issues[].rule] | unique'
java -jar engine/target/java-dependency-extractor.jar $F out.json && jq '.proposals[].legacy_entrypoint' out_architecture.json
make test-engine
```
