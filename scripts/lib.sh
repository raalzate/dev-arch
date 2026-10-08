#!/usr/bin/env bash
# Shared helpers of the dev-arch product scripts (006-devarch-monorepo, research D4).
# Source it: . "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
#
# Paths (single source for scripts): PRODUCT_ROOT, ENGINE_DIR, SCHEMA_DIR, WEB_DIR, ENGINE_DIST.
# Output convention: "[<stage>] <item>: OK|FAIL — detail".

PRODUCT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENGINE_DIR="$PRODUCT_ROOT/engine"
SCHEMA_DIR="$PRODUCT_ROOT/schema"
WEB_DIR="$PRODUCT_ROOT/web"
ENGINE_DIST="$WEB_DIR/engine-dist"
ENGINE_JAR_NAME="java-dependency-extractor.jar"
export PRODUCT_ROOT ENGINE_DIR SCHEMA_DIR WEB_DIR ENGINE_DIST

# status <stage> <item> <OK|FAIL> [detail]
status() {
  local line="[$1] $2: $3"
  [ -n "${4:-}" ] && line="$line — $4"
  echo "$line"
}

# Java executable honoring JAVA_HOME (FR-011); empty when none is found.
java_bin() {
  if [ -n "${JAVA_HOME:-}" ]; then
    [ -x "$JAVA_HOME/bin/java" ] && echo "$JAVA_HOME/bin/java"
  else
    command -v java 2>/dev/null
  fi
}

# Major version of a java executable (1.8 -> 8, 17.0.15 -> 17, 25 -> 25).
java_major() {
  "$1" -version 2>&1 | head -n 1 | sed -E 's/.*version "([0-9]+)(\.([0-9]+))?.*/\1 \3/' \
    | awk '{ if ($1 == 1) print $2; else print $1 }'
}

# Maven command: mvn on the PATH, else the engine wrapper.
mvn_cmd() {
  if command -v mvn >/dev/null 2>&1; then echo mvn; elif [ -x "$ENGINE_DIR/mvnw" ]; then echo "$ENGINE_DIR/mvnw"; fi
}

# Exports DOTNET_ROOT from the installed SDK when it is not set (Homebrew installs need it for apphosts).
export_dotnet_root() {
  local sdk_dir
  [ -n "${DOTNET_ROOT:-}" ] && return 0
  command -v dotnet >/dev/null 2>&1 || return 0
  sdk_dir="$(dotnet --list-sdks 2>/dev/null | tail -n 1 | sed -E 's/.*\[(.*)\]$/\1/')"
  if [ -n "$sdk_dir" ] && [ -d "$sdk_dir/.." ]; then
    DOTNET_ROOT="$(cd "$sdk_dir/.." && pwd)"
    export DOTNET_ROOT
  fi
}

# Node >= 25 exposes a global localStorage that breaks Next.js 15.3 server rendering ("localStorage.getItem is
# not a function"); the flag (known since Node 22) keeps the Node 20 behaviour. Prints NODE_OPTIONS to use.
node_options_for_web() {
  local major
  major="$(node --version 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/')"
  if [ -n "$major" ] && [ "$major" -ge 22 ] 2>/dev/null; then
    echo "--no-experimental-webstorage ${NODE_OPTIONS:-}"
  else
    echo "${NODE_OPTIONS:-}"
  fi
}
