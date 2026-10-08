#!/usr/bin/env bash
# Product test subsets (FR-010, contracts/make-targets.md):
#   all         version-check, engine (Java + .NET), schema-check, web, acceptance
#   engine      mvn -B verify in engine/ + dotnet test --filter "Category!=Corpus"
#   web         npm test -w web (node:test + tsx)
#   acceptance  Cucumber-JS scenarios of 006 (@slow only with DEVARCH_E2E=true; ACCEPTANCE_TAGS narrows them)
# Prints "[test] <subset>: OK|FAIL" per subset and a final summary; exits 1 when any subset fails.
set -u
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$PRODUCT_ROOT" || exit 1

FAILED=()
record() { # subset exit_code
  if [ "$2" -eq 0 ]; then status test "$1" OK; else status test "$1" FAIL; FAILED+=("$1"); fi
}
announce() { echo "[test] run: $*"; }

run_version() {
  if [ -f "$PRODUCT_ROOT/scripts/version.sh" ]; then
    announce "bash scripts/version.sh check"
    bash "$PRODUCT_ROOT/scripts/version.sh" check; record version-check $?
  fi
}

run_engine() {
  local mvn rc
  # The Java tests analyze the .NET demos through engine/target/dotnet-analyzer: publish it when missing.
  if [ ! -x "$ENGINE_DIR/target/dotnet-analyzer" ]; then
    bash "$PRODUCT_ROOT/scripts/engine-build.sh" --dotnet-only
  fi
  export_dotnet_root
  mvn="$(mvn_cmd)"
  announce "(cd engine && $mvn -B ${MVN_ARGS:-} verify)"
  # shellcheck disable=SC2086
  (cd "$ENGINE_DIR" && "$mvn" -B ${MVN_ARGS:-} verify); rc=$?
  record engine-java $rc
  announce "dotnet test engine/src/test/dotnet/DotNetAnalyzer.Tests/DotNetAnalyzer.Tests.csproj --filter \"Category!=Corpus\""
  dotnet test "$ENGINE_DIR/src/test/dotnet/DotNetAnalyzer.Tests/DotNetAnalyzer.Tests.csproj" --filter "Category!=Corpus"
  record engine-dotnet $?
}

run_schema_check() {
  # Reuse the installed workspace and the published analyzer inside make test (set to 0 to force a rebuild).
  announce "bash scripts/schema-check.sh"
  SCHEMA_CHECK_SKIP_BUILD="${SCHEMA_CHECK_SKIP_BUILD:-1}" bash "$PRODUCT_ROOT/scripts/schema-check.sh"
  record schema-check $?
}

run_web() {
  announce "npm test -w web"
  npm test -w web; record web $?
}

run_acceptance() {
  local args=()
  [ -n "${ACCEPTANCE_TAGS:-}" ] && args=(--tags "$ACCEPTANCE_TAGS")
  announce "cucumber-js ${args[*]:-} (DEVARCH_E2E=${DEVARCH_E2E:-false})"
  NODE_OPTIONS="--import tsx ${NODE_OPTIONS:-}" npx cucumber-js "${args[@]+"${args[@]}"}"; record acceptance $?
}

case "${1:-all}" in
  all) run_version; run_engine; run_schema_check; run_web; run_acceptance ;;
  engine) run_engine ;;
  web) run_web ;;
  acceptance) run_acceptance ;;
  *) echo "usage: $0 [all|engine|web|acceptance]" >&2; exit 64 ;;
esac

if [ "${#FAILED[@]}" -eq 0 ]; then
  echo "[test] RESULT: OK"
  exit 0
fi
echo "[test] RESULT: FAIL (${FAILED[*]})"
exit 1
