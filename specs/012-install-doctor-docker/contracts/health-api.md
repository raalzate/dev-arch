# Contract: GET /api/health

- Sin token de API; `Cache-Control: no-store`; `runtime = nodejs`, `dynamic = force-dynamic`.
- Ejecuta `node <DEVARCH_DOCTOR_CLI | ../scripts/doctor/cli.mjs> --json --mode local --only jdk,dotnet-runtime,engine-jar,dotnet-analyzer,env,resources` (desde `web/`), reutilizando el informe 30 s.
- `200` si el informe no tiene FAIL, `503` si lo tiene o si el doctor no produce un informe válido (verificación `doctor` FAIL con el motivo).

```json
{
  "service": "dev-arch", "status": "OK|WARN|FAIL", "version": "1.2.0",
  "engine": { "jar": { "found": true, "version": "1.2.0", "detail": "…" },
              "dotnetAnalyzer": { "found": true, "detail": "…" },
              "mcpProcess": "running|idle" },
  "checks": [ { "id": "jdk", "status": "OK", "...": "..." } ]
}
```
