# Contract: java -jar engine.jar --doctor

- Primer argumento `--doctor` (ningún otro argumento requerido); escribe exactamente una línea JSON en stdout y termina con 0.
- `{"engine":"static-inference","version":<recurso static-inference-version.properties>,"schema_version":SchemaVersion.CURRENT,"java_version":<java.version>,"dotnet_analyzer":{"found":bool,"path":string|null}}`
- La localización usa `new DotNetToolLocator(<directorio del JAR>).locate()` (hermano del JAR → `DOTNET_ANALYZER_PATH` → `PATH`).
- Sin efectos sobre `<proyecto> <salida>`, `--language=`, `--config=` ni `--mcp`.
