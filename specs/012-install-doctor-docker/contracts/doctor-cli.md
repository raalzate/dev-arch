# Contract: dev-arch doctor CLI

```
npm run doctor [-- <options>]
npx dev-arch doctor [<options>]
make check-env                      (= doctor --mode local)
node scripts/doctor/cli.mjs [doctor] [<options>]
```

| Opción | Efecto |
|---|---|
| `--mode local\|docker` | verificaciones del modo (defecto `local`) |
| `--json` | `DoctorReport` en stdout (data-model.md) |
| `--fix` | añade "Suggested commands (not executed)" con las sugerencias del SO para cada verificación no OK |
| `--only a,b` | solo esas verificaciones (ids de `REQUIREMENTS`) |
| `--requirements-table` | imprime la tabla Markdown de requisitos (la de `docs/INSTALL.md`) |
| `--help` | uso |

Salida humana: cabecera `dev-arch doctor <VERSION> — mode <mode> (<platform>)`, tabla `STATUS CHECK DETECTED REQUIRED DETAIL`, `Result: <STATUS> (n OK, n WARN, n FAIL)`.

Códigos: 0 sin FAIL · 1 con FAIL · 64 uso inválido (mensaje + uso en stderr).

Estados (resumen): FAIL = JDK < 17/ausente/`JAVA_HOME` roto, Maven < 3.6 sin `mvnw`, sin SDK ≥ 8, sin runtime 8, Node < 20 o npm < 10, `ENGINE_JAR_PATH` roto, Docker/Compose ausente o daemon caído (modo docker). WARN = motor/analizador sin construir o de otra versión, VS Build Tools (Windows), Docker (modo local), clave de IA ausente, puerto ocupado por otro proceso, RAM < 4 GB o disco < 2 GB.
