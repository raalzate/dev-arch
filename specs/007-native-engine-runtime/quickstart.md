# Quickstart: 007-native-engine-runtime

Desde la raíz del producto (`apps/dev-arch`), JDK 17 vía `JAVA_HOME`, .NET 8, Node ≥ 20.

## 1. Construir y arrancar

```bash
make build                      # motor + dotnet-analyzer en web/engine-dist/ + web
make dev                        # http://localhost:9002 (modo desarrollo: carpeta local habilitada)
```

## 2. Análisis asíncrono por API

```bash
(cd engine/test-for-demo && zip -qr /tmp/java-standar.zip java-standar)
curl -s -X POST --data-binary @/tmp/java-standar.zip -H 'Content-Type: application/zip' \
  'http://localhost:9002/api/analyses?language=auto'           # → 202 {"jobId":"…"}
curl -s http://localhost:9002/api/analyses/<jobId>               # status/phase/warnings
curl -s http://localhost:9002/api/analyses/<jobId>/architecture  # tras status=completed
```

Comprobaciones: 202 en < 2 s (SC-004); fases `detection → extraction → inference → writing`; `meta.schema_version` = `1.0.0`; `.archview/jobs/<jobId>/out/` contiene los tres JSON; ningún `output*.json` nuevo en `web/`.

## 3. Seguridad

```bash
python3 - <<'PY'
import zipfile; z = zipfile.ZipFile('/tmp/evil.zip', 'w'); z.writestr('../../evil.txt', 'x'); z.close()
PY
curl -s -X POST --data-binary @/tmp/evil.zip -H 'Content-Type: application/zip' http://localhost:9002/api/analyses
# → 400 ZIP_ENTRY_OUTSIDE_ROOT, entry "../../evil.txt"
curl -s 'http://localhost:9002/api/source?jobId=<jobId>&path=../../../../etc/passwd'   # → 400 INVALID_PATH
curl -s 'http://localhost:9002/api/source?path=/etc/passwd'                             # → 400 INVALID_PATH
```

## 4. Importación

```bash
node -e 'const f=require("fs");const d="schema/fixtures/valid/java-standar/";process.stdout.write(JSON.stringify({graph:JSON.parse(f.readFileSync(d+"output.json")),architecture:JSON.parse(f.readFileSync(d+"output_architecture.json"))}))' \
 | curl -s -X POST -H 'Content-Type: application/json' --data-binary @- http://localhost:9002/api/analyses/import   # → 201
```

## 5. Motor

```bash
java -jar web/engine-dist/engine.jar engine/test-for-demo/java-standar /tmp/o.json --language=java   # [warning] … en stderr si aplica
```

MCP (progreso): enviar `tools/call` `analyze_project` con `_meta.progressToken` → 4 `notifications/progress` antes del resultado.

## 6. Pruebas

```bash
make test                          # unitarias + contrato + aceptación sin @slow (incluye 007 no-@slow)
DEVARCH_E2E=true make test-acceptance   # + escenarios @slow (motor real)
make test-e2e-browser              # Playwright (Chromium) vía Cucumber-JS, escenarios @e2e
```
