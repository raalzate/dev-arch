#!/usr/bin/env bash
# Decides whether the published .NET analyzer can be reused by the local tests (011-quality-delivery, FR-029/030).
#   dotnet-analyzer-freshness.sh <publication-stamp> <analyzer-source-dir> [--force]
# Prints one line and exits 0:
#   reuse                              the stamp is newer than every source and project file
#   rebuild: missing                   no stamp (never published, or published before 011)
#   rebuild: forced                    --force
#   rebuild: <relative path> is newer  a source/project file (outside bin/ and obj/) changed after publishing
set -u
stamp="${1:?usage: $0 <publication-stamp> <analyzer-source-dir> [--force]}"
src="${2:?usage: $0 <publication-stamp> <analyzer-source-dir> [--force]}"
if [ "${3:-}" = "--force" ]; then echo "rebuild: forced"; exit 0; fi
if [ ! -f "$stamp" ]; then echo "rebuild: missing"; exit 0; fi
newer="$(cd "$src" && find . \( -name bin -o -name obj \) -prune -o -type f \
  \( -name '*.cs' -o -name '*.vb' -o -name '*.csproj' -o -name '*.vbproj' -o -name '*.props' -o -name '*.targets' \
     -o -name '*.json' -o -name '*.resx' \) -newer "$stamp" -print | sort | head -n 1)"
if [ -n "$newer" ]; then echo "rebuild: ${newer#./} is newer"; else echo "reuse"; fi
