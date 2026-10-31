# Quickstart: 022-external-integrations
```bash
export DOTNET_ROOT="$HOME/.dotnet8" PATH="$HOME/.dotnet8:$PATH"; make build-engine
F=engine/src/test/dotnet/DotNetAnalyzer.Tests/Fixtures/VbLegacy/SyntheticIntegrations
engine/target/dotnet-analyzer $F 2>warn.txt | jq '.components[] | {id, annotations, external_dependencies, eol: [.code_issues[] | select(.pattern=="EOL_DEPENDENCY") | .message]}'; grep '^\[warning\]' warn.txt
printf '{"integrations":{"outbound":"off"},"dependencies":{"enabled":"off"}}' > /tmp/off.json
engine/target/dotnet-analyzer $F --config=/tmp/off.json | jq '[.components[].annotations[]] | map(select(startswith("Integration:") or startswith("Dependency:"))) | length'   # 0
```
