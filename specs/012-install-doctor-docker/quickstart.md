# Quickstart: 012-install-doctor-docker

```bash
cd apps/dev-arch
npm run doctor                     # tabla OK/WARN/FAIL (modo local)
npm run doctor -- --fix            # + comandos sugeridos (no se ejecutan)
npx dev-arch doctor --json         # informe estructurado
make check-env                     # = doctor --mode local; falla con FAIL
make doctor                        # marcador de posición de 006 (sin cambios)
node scripts/doctor/cli.mjs --requirements-table   # tabla de docs/INSTALL.md

make build && java -jar web/engine-dist/engine.jar --doctor
make dev  # luego: curl -s localhost:9002/api/health

# Docker (requiere Docker 24 + Compose v2)
docker compose -f docker/compose.yaml up -d && npm run doctor -- --mode docker
bash docker/smoke-test.sh
docker compose -f docker/compose.yaml --profile dev up web-dev   # http://localhost:9003

# Pruebas
node --test scripts/doctor/*.test.mjs
NODE_OPTIONS="--import tsx" npx cucumber-js specs/012-install-doctor-docker/tests/features
```
