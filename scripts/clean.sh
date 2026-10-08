#!/usr/bin/env bash
# make clean (FR-008, US2-AS6): removes every generated artifact so the working tree matches a fresh clone:
# engine build output, staged engine, web build output, installed packages and .NET obj/bin folders.
set -u
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$PRODUCT_ROOT" || exit 1

rm -rf engine/target target web/.next web/engine-dist web/next-env.d.ts web/*.tsbuildinfo \
  node_modules web/node_modules schema/node_modules
find engine/src -type d \( -name obj -o -name bin \) -prune -exec rm -rf {} + 2>/dev/null
status clean product OK "engine/target, web/.next, web/engine-dist, node_modules, .NET obj/bin removed"
