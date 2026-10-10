#!/usr/bin/env bash
# Smoke test of the dev-arch container (012-install-doctor-docker, CI job "docker").
# Run from apps/dev-arch after `docker compose -f docker/compose.yaml up -d`:
#   1. waits until the container reports healthy (HEALTHCHECK -> GET /api/health)
#   2. runs the doctor on the host in docker mode (FAIL fails the smoke test)
#   3. analyzes engine/test-for-demo/java-standar through POST /api/analyses and checks the graph has components
# Needs bash, curl, zip, node (doctor) and docker. BASE_URL defaults to http://127.0.0.1:9002.
set -euo pipefail

COMPOSE=(docker compose -f docker/compose.yaml)
BASE_URL="${BASE_URL:-http://127.0.0.1:9002}"
DEMO="${DEMO:-engine/test-for-demo/java-standar}"
HEALTH_TIMEOUT_S="${HEALTH_TIMEOUT_S:-300}"
ANALYSIS_TIMEOUT_S="${ANALYSIS_TIMEOUT_S:-600}"

step() { printf '\n[smoke] %s\n' "$*"; }
fail() { printf '[smoke] FAIL: %s\n' "$*" >&2; "${COMPOSE[@]}" logs --tail 200 web >&2 || true; exit 1; }

step "waiting for the web container to be healthy (max ${HEALTH_TIMEOUT_S}s)"
container="$("${COMPOSE[@]}" ps -q web)"
[ -n "$container" ] || fail "the web service is not running"
deadline=$((SECONDS + HEALTH_TIMEOUT_S))
until [ "$(docker inspect -f '{{.State.Health.Status}}' "$container")" = "healthy" ]; do
  [ "$SECONDS" -lt "$deadline" ] || fail "container not healthy after ${HEALTH_TIMEOUT_S}s"
  sleep 5
done
curl -fsS "$BASE_URL/api/health" | tee /tmp/dev-arch-health.json
echo

step "doctor --mode docker (host)"
node scripts/doctor/cli.mjs --mode docker || fail "doctor reported FAIL in docker mode"

step "doctor inside the container (engine runtime checks)"
"${COMPOSE[@]}" exec -T web node /opt/dev-arch/scripts/doctor/cli.mjs --only jdk,dotnet-runtime,engine-jar,dotnet-analyzer \
  || fail "doctor reported FAIL inside the container"

step "analyzing $DEMO"
[ -d "$DEMO" ] || fail "missing demo project $DEMO"
zipfile="$(mktemp -d)/demo.zip"
(cd "$(dirname "$DEMO")" && zip -qr "$zipfile" "$(basename "$DEMO")")
response="$(curl -fsS -X POST -H 'Content-Type: application/zip' --data-binary "@$zipfile" "$BASE_URL/api/analyses")" \
  || fail "POST /api/analyses was rejected"
job="$(printf '%s' "$response" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).jobId))')"
[ -n "$job" ] || fail "no jobId in $response"
echo "job $job"

deadline=$((SECONDS + ANALYSIS_TIMEOUT_S))
while :; do
  status="$(curl -fsS "$BASE_URL/api/analyses/$job" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).status))')"
  case "$status" in
    completed) break ;;
    failed) fail "analysis $job failed: $(curl -fsS "$BASE_URL/api/analyses/$job")" ;;
  esac
  [ "$SECONDS" -lt "$deadline" ] || fail "analysis $job not completed after ${ANALYSIS_TIMEOUT_S}s (status $status)"
  sleep 5
done

components="$(curl -fsS "$BASE_URL/api/analyses/$job/graph" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log((JSON.parse(s).components||[]).length))')"
[ "$components" -gt 0 ] || fail "the graph of $job has no components"
step "OK: $DEMO analyzed in the container ($components components)"
