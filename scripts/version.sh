#!/usr/bin/env bash
# Single product version (FR-020..FR-022, contracts/version.md).
#   sync   write VERSION into every declaration:  [version] <file>: <before> -> <after>
#   check  compare every declaration with VERSION: [version] <file>: <declared> != <VERSION>  (exit 1)
# Declarations: engine/pom.xml (project version), the .NET analyzer <Version>, web/package.json and
# package.json. schema/VERSION is the contract version and is never read or written here.
set -u
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$PRODUCT_ROOT" || exit 2

POM="engine/pom.xml"
CSPROJ="engine/src/main/dotnet/DotNetAnalyzer/DotNetAnalyzer.csproj"
DECLARATIONS=("$POM" "$CSPROJ" "web/package.json" "package.json")

source_version() {
  local v
  v="$(tr -d '[:space:]' < VERSION 2>/dev/null)"
  if ! [[ "$v" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "[version] VERSION: '${v}' is not MAJOR.MINOR.PATCH" >&2
    exit 2
  fi
  echo "$v"
}

declared() { # file
  case "$1" in
    "$POM") perl -0ne 'print $1 if m{<artifactId>java-dependency-extractor</artifactId>\s*<version>([^<]+)</version>}' "$1" ;;
    *.csproj) perl -0ne 'print $1 if m{<Version>([^<]+)</Version>}' "$1" ;;
    *.json) perl -0ne 'print $1 if m{"version"\s*:\s*"([^"]+)"}' "$1" ;;
  esac
}

write() { # file version
  case "$1" in
    "$POM") V="$2" perl -0pi -e 's{(<artifactId>java-dependency-extractor</artifactId>\s*<version>)[^<]+(</version>)}{$1$ENV{V}$2}' "$1" ;;
    *.csproj)
      if grep -q '<Version>' "$1"; then
        V="$2" perl -0pi -e 's{<Version>[^<]+</Version>}{<Version>$ENV{V}</Version>}' "$1"
      else
        V="$2" perl -0pi -e 's{(<PropertyGroup>\r?\n)(\s*)}{$1$2<Version>$ENV{V}</Version>\n$2}' "$1"
      fi ;;
    *.json) V="$2" perl -0pi -e 's{("version"\s*:\s*")[^"]+(")}{$1$ENV{V}$2}' "$1" ;;
  esac
}

cmd_sync() {
  local version file before
  version="$(source_version)" || exit 2
  for file in "${DECLARATIONS[@]}"; do
    before="$(declared "$file")"
    if [ "$before" != "$version" ]; then
      write "$file" "$version"
      echo "[version] $file: ${before:-none} -> $version"
    fi
  done
  cmd_check
}

cmd_check() {
  local version file value failed=0
  version="$(source_version)" || exit 2
  for file in "${DECLARATIONS[@]}"; do
    value="$(declared "$file")"
    if [ "$value" != "$version" ]; then
      echo "[version] $file: ${value:-none} != $version"
      failed=1
    fi
  done
  if [ "$failed" -ne 0 ]; then
    echo "[version] check: FAIL — edit VERSION only and run make version-sync"
    return 1
  fi
  echo "[version] check: OK — $version (${#DECLARATIONS[@]} declarations)"
}

case "${1:-}" in
  sync) cmd_sync ;;
  check) cmd_check ;;
  *) echo "usage: $0 sync|check" >&2; exit 64 ;;
esac
