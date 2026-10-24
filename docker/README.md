# docker/

Container area of the dev-arch product (012-install-doctor-docker). Full guide: [docs/INSTALL.md](../docs/INSTALL.md).

| File | Purpose |
|------|---------|
| `Dockerfile` | multi-stage image: engine (Maven, JDK 17) → analyzer (.NET 8 SDK) → web (Node 20, standalone) → `runtime` (JRE 17 + .NET 8 runtime + Node 20, non-root, `HEALTHCHECK` on `/api/health`) and `dev` |
| `Dockerfile.dockerignore` | build-context exclusions (BuildKit reads it next to the Dockerfile) |
| `compose.yaml` | default profile: service `web` (all-in-one, volume `dev-arch-data`); profile `dev`: service `web-dev` (mounted sources, :9003) |
| `smoke-test.sh` | CI smoke test: healthy container, `doctor --mode docker`, analysis of `engine/test-for-demo/java-standar` |

```bash
cd dev-arch   # repository root
docker compose -f docker/compose.yaml up -d
bash docker/smoke-test.sh
```

Nothing in this folder is used by `make build` or `make test`; the image is built and smoke-tested by the CI job
`docker` (`.github/workflows/dev-arch.yml`), which also publishes it to GHCR on `dev-arch-v*` tags.
