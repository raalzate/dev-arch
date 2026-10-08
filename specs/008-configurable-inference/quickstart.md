# Quickstart: 008-configurable-inference

```bash
cd apps/dev-arch
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
make build-engine
JAR=engine/target/java-dependency-extractor.jar

# 1. Default analysis — identical to 1.2.0
java -jar $JAR engine/test-for-demo/java-standar /tmp/si/output.json

# 2. Partial configuration from the CLI
cat > /tmp/si/strict.json <<'JSON'
{ "viability": { "thresholds": { "high": 0.8, "medium": 0.6 } } }
JSON
java -jar $JAR engine/test-for-demo/java-standar /tmp/si/strict/output.json --config=/tmp/si/strict.json

# 3. Server mode with the inference tools
STATIC_INFERENCE_INFERENCE_TOOLS=true java -jar $JAR --mcp
#   tools/call reinfer_architecture {"graphPath":"/tmp/si/output.json","config":{"evidence":{"evidenceThreshold":0.99}}}
#   tools/call score_proposal {"graphPath":"/tmp/si/output.json","components":["…"]}
#   resources/read static-inference://configuration/defaults
```

Scenarios to verify (tests in `specs/008-configurable-inference/tests/features/`):

1. Regression: 6 demo projects × 3 documents byte-identical to `engine/src/test/resources/baseline-v1.2.0` (CLI and MCP).
2. `reinfer_architecture` with defaults on each stored graph reproduces the stored architecture.
3. Synthetic 500-component graph: 5 reinfer calls < 2 s each.
4. Invalid configurations rejected with the parameter path.
5. `score_proposal` reproduces viability and rationale of existing proposals.
6. Resources list and read.
7. Nested detection with `detection.maxDepth`.
