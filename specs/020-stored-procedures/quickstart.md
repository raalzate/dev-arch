# Quickstart: 020-stored-procedures

## Build
```bash
export DOTNET_ROOT="$HOME/.dotnet8" PATH="$HOME/.dotnet8:$PATH"   # canonical SDK 8
make build-engine
```

## Synthetic corpus (redistributable)
```bash
F=engine/src/test/dotnet/DotNetAnalyzer.Tests/Fixtures/VbLegacy/SyntheticDesktop
engine/target/dotnet-analyzer $F | jq '.components[] | select(.id | endswith("PolicyAdapter")) | .tables_used'
# → ["sp:usp_Policy_Read", "sp:usp_Policy_Update", ...]

printf '{"dataAccess":{"procedureCatalog":"%s/Catalog/procs","catalogMode":"replace"}}' "$PWD/$F" > /tmp/da.json
engine/target/dotnet-analyzer $F --config=/tmp/da.json | jq '.components[] | select(.id | endswith("PolicyAdapter")) | .tables_used'
# → ["Policies", "PolicyHolders", ...]
```

## Through the engine (CLI)
```bash
java -jar engine/target/java-dependency-extractor.jar $F out.json \
  --config='{"dataAccess":{"procedureCatalog":"'$PWD/$F'/Catalog/procs.csv","procedureWeight":1.0}}'
jq '.proposals[] | {name, tables_shared: .metrics.tables_shared}' out_architecture.json
```

## C# legacy with Enterprise Library (opt-in)
```bash
C=engine/src/test/dotnet/DotNetAnalyzer.Tests/Fixtures/CSharpLegacyEntLib
engine/target/dotnet-analyzer $C | jq '[.components[].tables_used[]] | length'          # 0 (default: off for C#)
printf '{"dataAccess":{"procedures":"on"}}' > /tmp/on.json
engine/target/dotnet-analyzer $C --config=/tmp/on.json | jq '[.components[].tables_used[]]'   # sp:...
```

## Tests
```bash
make test-engine                                    # Java + .NET (Category!=Corpus)
cd engine/src/test/dotnet/DotNetAnalyzer.Tests && dotnet test --filter "Category=Corpus"   # reference corpus, opt-in
```

## Exit criteria on the reference corpus (opt-in)
- ≥ 80 % of `*Adapter` components with non-empty `tables_used`; ≥ 850 distinct `sp:`.
- `test-for-demo/*` outputs unchanged; two consecutive runs byte-identical.
