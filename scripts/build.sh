#!/usr/bin/env bash
# make build (FR-009): engine (Java + .NET) -> staged into web/engine-dist -> npm workspace -> web build.
# Prints "[build] <stage>: OK|FAIL — detail"; stops at the first failing stage.
set -u
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

bash "$PRODUCT_ROOT/scripts/engine-build.sh" || exit 1
bash "$PRODUCT_ROOT/scripts/engine-stage.sh" || exit 1

cd "$PRODUCT_ROOT" || exit 1
# Reproducible install from the single lockfile (FR-012); skipped when node_modules already matches it.
if [ -f node_modules/.package-lock.json ] && [ node_modules/.package-lock.json -nt package-lock.json ] \
   && [ node_modules/.package-lock.json -nt web/package.json ] && [ node_modules/.package-lock.json -nt schema/package.json ]; then
  status build npm-install OK "node_modules up to date with package-lock.json"
elif npm ci --no-audit --no-fund > /dev/null 2> "$ENGINE_DIR/target/build-logs/npm-ci.log"; then
  status build npm-install OK "npm ci"
else
  tail -n 40 "$ENGINE_DIR/target/build-logs/npm-ci.log" >&2
  status build npm-install FAIL "npm ci failed"
  exit 1
fi

log="$ENGINE_DIR/target/build-logs/web.log"
if npm run build -w web > "$log" 2>&1; then
  status build web OK "web/.next"
else
  tail -n 60 "$log" >&2
  status build web FAIL "see ${log#"$PRODUCT_ROOT"/}"
  exit 1
fi
