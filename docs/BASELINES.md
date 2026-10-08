# Baselines of locked artifacts

Stable git references used by acceptance scenarios that compare the product with an earlier, closed feature.
Tags survive squash merges and history rewrites of feature branches; commit hashes of a feature branch do not.

| Tag | Commit | Fixes | Used by |
|-----|--------|-------|---------|
| `dev-arch-006-baseline` | `889c95a` (006-devarch-monorepo closed) | `.feature` files, `context.json` assertion hashes and test assertions of features 001–006 | 007 TS-076 (`tests/acceptance/steps/native-runtime-compat.steps.ts`) |

Publish a new baseline tag together with the branch that introduces it:

```bash
git push origin dev-arch-006-baseline
```

A clone without the tag fails TS-076 with an explicit message instead of comparing against an arbitrary commit.
