# Feature Specification: Deuda del propio motor (014b)

**Feature Branch**: `014b-engine-debt` · **Created**: 2026-10-30 · **Status**: Implemented

Feature 014b del PLAN-VB-PLATAFORMA-LEGACY.md: determinismo (orden de enumeración de archivos, BUG-008), BUG-001/BUG-002 de 009 (operación Roslyn y `RegexMatchTimeout`) y cierre de BUG-007 de 002. Los registros de bugs viven en `specs/009-vb-legacy-completion/bugs.md` porque las especificaciones importadas 001-005 están congeladas (006 TS); el escenario `bugfix_BUG-008.feature` se ejecuta con el runner `RunEngineDebtFeaturesTest` (glue de 002, `legacybdd.dotnet`).
