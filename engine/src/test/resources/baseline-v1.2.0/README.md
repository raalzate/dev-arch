# Regression baseline v1.2.0 (008-configurable-inference)

The three documents of the six demo projects produced by the engine of product **1.2.0** (commit `7bc8170`,
end of 007-native-engine-runtime) on the hermetic demo copies (`target/schema-demo`, git-tracked files only),
with the demo root replaced by `${REPO}` (research D1 of `specs/008-configurable-inference`).

Every change of the engine must keep the default outputs byte-identical to these files (scenarios TS-001 and
TS-002, Constitution principle I). Regenerate only from a checkout whose engine sources equal `7bc8170`:

```bash
cd engine
mvn test -Dtest=RegressionBaselineCaptureTest -Dbaseline.capture=true -Dsurefire.failIfNoSpecifiedTests=false
```
