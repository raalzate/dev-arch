# Contract: release unificada (US5)

- `bash scripts/release-check.sh <tag>` (local y CI): `dev-arch-v<VERSION>` ⇒ `[release] tag dev-arch-vX.Y.Z matches VERSION X.Y.Z`, salida 0; tag de otra versión ⇒ `[release] tag version A.B.C != VERSION X.Y.Z`, salida 1; tag sin el formato `dev-arch-vN.N.N` ⇒ `[release] malformed tag '<tag>' (expected dev-arch-vX.Y.Z)`, salida 1.
- Workflow: `release-version-check` (solo `refs/tags/dev-arch-v*`) → `release` (matriz sin cambios) y `release-skills` (`dev-arch-skills-<tag>.zip` + `.sha256`, misma release).
