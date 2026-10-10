# Contract: cobertura (US3, US4)

| Pila | Generado por | Informe | Resumen |
|---|---|---|---|
| Java | `mvn verify` (engine) | `engine/target/site/jacoco/jacoco.xml` + `index.html` | contador `LINE` del informe |
| .NET | `dotnet test --collect "XPlat Code Coverage" --results-directory engine/target/coverage/dotnet` | `engine/target/coverage/dotnet/*/coverage.cobertura.xml` | `line-rate` |
| TS | `npm run coverage -w web` | `web/coverage/lcov.info`, `web/coverage/summary.json` | `lines.pct` |

- `make coverage`: ejecuta las tres y luego `bash scripts/coverage.sh summary`, que imprime por pila `[coverage] java|dotnet|web: <pct>% lines (<ruta>)` o `[coverage] <pila>: MISSING (<ruta>)` y sale 1 si falta alguno.
- Conjunto objetivo web (FR-018): `src/server/**/*.ts`, `src/app/api/**/route.ts`, `src/lib/**/*.ts`, excepto `*.test.ts`, `src/lib/modernization/test-fixtures.ts`, `src/lib/placeholder-images.ts`. Umbral: ≥ 85 % de líneas agregadas; un módulo ausente o el umbral incumplido ⇒ salida 1.
- CI: artefactos `engine-java-coverage`, `engine-dotnet-coverage`, `web-coverage`.
