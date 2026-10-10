# Quickstart: 011-quality-delivery

```bash
cd apps/dev-arch && source scripts/iikit-env.sh
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
npm run typecheck -w web && npm run lint -w web          # US1
(cd engine && mvn -B verify)                              # US2 + JaCoCo (US3)
npm run coverage -w web                                   # US3/US4 (umbral 85 %)
make coverage                                             # tres informes + resumen
bash scripts/release-check.sh dev-arch-v$(cat VERSION)    # US5
bash scripts/dotnet-analyzer-freshness.sh engine/target/dotnet-analyzer-publish/.published engine/src/main/dotnet/DotNetAnalyzer   # US7
NODE_OPTIONS="--import tsx" npx cucumber-js specs/011-quality-delivery/tests/features   # escenarios 011
```
