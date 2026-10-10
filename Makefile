# dev-arch product commands (006-devarch-monorepo, contracts/make-targets.md).
# Run from apps/dev-arch. Honors JAVA_HOME (JDK 17), DOTNET_ROOT, MVN_ARGS, DEVARCH_E2E,
# SCHEMA_CHECK_SKIP_BUILD and SCHEMA_CHECK_VERBOSE.

SHELL := /bin/bash

.PHONY: help prereqs build build-engine test test-engine test-web test-acceptance e2e schema-check \
        schema-generate dev clean doctor version-sync version-check test-e2e-browser coverage

help:
	@echo "make build | test | test-engine | test-web | test-acceptance | schema-check | dev | clean"
	@echo "make e2e | doctor (reserved) | schema-generate | version-sync | version-check | coverage"

## Verify JDK 17, .NET SDK >= 8 + .NET 8 runtime and Node >= 20 before compiling anything.
prereqs:
	@bash scripts/check-prereqs.sh

## Engine (Java + .NET), staged into web/engine-dist, npm workspace and web build.
build: prereqs
	@bash scripts/build.sh

## Engine only (Java fat JAR + .NET analyzer under engine/target).
build-engine: prereqs
	@bash scripts/engine-build.sh

## Every test subset: engine, contract, web and acceptance.
test: prereqs
	@bash scripts/test.sh all

test-engine: prereqs
	@bash scripts/test.sh engine

test-web:
	@bash scripts/test.sh web

test-acceptance:
	@bash scripts/test.sh acceptance

## Browser end-to-end scenarios of 007 (@e2e, Playwright/Chromium; needs `make build` and
## `npx playwright install chromium`). `make e2e` stays reserved for feature 011.
test-e2e-browser:
	@DEVARCH_E2E=true DEVARCH_E2E_BROWSER=true NODE_OPTIONS="--import tsx $${NODE_OPTIONS:-}" npx cucumber-js --tags @e2e

## Coverage of the three stacks (011-quality-delivery): JaCoCo, coverlet and the web unit tests, then one summary
## line per stack (contracts/coverage.md).
coverage: prereqs
	@bash scripts/coverage.sh

## Verify Java, .NET and generated TypeScript types against the output contract (005-json-schema-contract).
schema-check:
	bash scripts/schema-check.sh

## Regenerate schema/generated/ and the extension module schema/extensions/ from schema/<VERSION>/*.schema.json.
schema-generate:
	npm --prefix schema run generate

## Web in development mode (http://localhost:9002) with the engine built from this checkout.
dev: prereqs
	@bash scripts/dev.sh

## Single product version: edit VERSION, then propagate it to every declaration.
version-sync:
	@bash scripts/version.sh sync

version-check:
	@bash scripts/version.sh check

clean:
	@bash scripts/clean.sh

e2e:
	@echo "[e2e] not implemented yet (feature 011)"

doctor:
	@echo "[doctor] not implemented yet (feature 012)"
