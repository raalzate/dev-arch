#!/usr/bin/env bash
# Release version check (011-quality-delivery, FR-019/FR-022, contracts/release.md): a release tag must be exactly
# dev-arch-v<VERSION>. Usage: scripts/release-check.sh <tag>   (CI passes $GITHUB_REF_NAME)
set -u
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
tag="${1:?usage: $0 <tag>}"
version="$(tr -d '[:space:]' < "$PRODUCT_ROOT/VERSION")"
if [[ ! "$tag" =~ ^dev-arch-v([0-9]+\.[0-9]+\.[0-9]+)$ ]]; then
  echo "[release] malformed tag '$tag' (expected dev-arch-vX.Y.Z)" >&2
  exit 1
fi
if [ "${BASH_REMATCH[1]}" != "$version" ]; then
  echo "[release] tag version ${BASH_REMATCH[1]} != VERSION $version" >&2
  exit 1
fi
echo "[release] tag $tag matches VERSION $version"
