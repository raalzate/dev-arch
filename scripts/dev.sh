#!/usr/bin/env bash
# make dev (FR-008, FR-013): the web in development mode (http://localhost:9002) analyzing ZIPs with the engine
# built from this checkout. Builds the engine when engine/target has no archive, (re)stages it into
# web/engine-dist when the staged copy is missing or older, installs the workspace when needed, and exports
# JAVA_HOME/DOTNET_ROOT for the engine processes started by the web.
set -u
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$PRODUCT_ROOT" || exit 1

jar="$ENGINE_DIR/target/$ENGINE_JAR_NAME"
staged="$ENGINE_DIST/engine.jar"
if [ ! -f "$jar" ]; then
  bash scripts/engine-build.sh || exit 1
fi
if [ ! -f "$staged" ] || [ "$jar" -nt "$staged" ]; then
  bash scripts/engine-stage.sh || exit 1
fi
if [ ! -d node_modules ]; then
  npm ci --no-audit --no-fund || exit 1
fi

if [ -n "${JAVA_HOME:-}" ]; then export JAVA_HOME; fi
export_dotnet_root
NODE_OPTIONS="$(node_options_for_web)"
export NODE_OPTIONS
status dev web OK "http://localhost:9002 (engine: web/engine-dist/engine.jar)"
exec npm run dev -w web
