# Quickstart: 023
```bash
java -jar engine/target/java-dependency-extractor.jar engine/test-for-demo/vb-demo-legacy out.json   # preset auto → legacy-desktop
jq '.summary' out_architecture.json | grep -o 'Preset de inferencia: [a-z-]*'
jq '.proposals | length, [.[] | .viability] | group_by(.) | map({(.[0]): length}) | add' out_architecture.json
jq '.proposals[] | {name, debt: (.rationale[] | select(startswith("Deuda")))}' out_architecture.json
java -jar engine/target/java-dependency-extractor.jar engine/test-for-demo/vb-demo-legacy out2.json --config='{"inference":{"preset":"none"}}'
```
