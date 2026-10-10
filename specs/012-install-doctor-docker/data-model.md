# Data Model: 012-install-doctor-docker

## Requirement (`scripts/doctor/requirements.mjs`)

| Campo | Tipo | Regla |
|---|---|---|
| id | `jdk\|maven\|dotnet-sdk\|dotnet-runtime\|node\|engine-jar\|dotnet-analyzer\|vs-build-tools\|docker\|env\|port\|resources` | único |
| name, requiredFor, minimum, detection | string | no vacíos |
| modes | `('local'\|'docker')[]` | ≥ 1 |
| platforms | `string[]?` | solo `vs-build-tools` = `['win32']` |
| hints | `{brew, apt, winget, choco}` | strings (vacío = no aplica en esa plataforma) |

## Check (resultado)

`{ id, name, status: OK|WARN|FAIL, detected, required, requiredFor, detail, fix: string[] }` — `fix` = sugerencias del SO actual solo cuando `status ≠ OK`.

## DoctorReport (`--json`)

`{ tool: "dev-arch doctor", version, mode, platform, status, checks: Check[], engine: EngineDoctor | null }` — `status` = FAIL si algún FAIL, WARN si algún WARN, si no OK. Código de salida 1 ⇔ FAIL; 64 uso inválido.

## EngineDoctor (`java -jar engine.jar --doctor`)

`{"engine":"static-inference","version":"<VERSION>","schema_version":"1.0.0","java_version":"17.x","dotnet_analyzer":{"found":true|false,"path":"…"|null}}` — una línea, orden fijo.

## Health (`GET /api/health`)

`{ service: "dev-arch", status, version, engine: { jar: {found, version, detail}, dotnetAnalyzer: {found, detail}, mcpProcess: "running"|"idle" }, checks: Check[] }` — HTTP 200 / 503; `Cache-Control: no-store`.

## Mode → checks

| Modo | Verificaciones |
|---|---|
| local | jdk, maven, dotnet-sdk, dotnet-runtime, node, engine-jar, dotnet-analyzer, vs-build-tools, docker (WARN), env, port, resources |
| docker | docker (FAIL), env (+ `docker/.env`), port, resources |
| salud web | jdk, dotnet-runtime, engine-jar, dotnet-analyzer, env, resources |
