# Implementation Plan: dev-arch como repositorio propio + documentación de la tesis

**Branch**: `014-standalone-repo` | **Date**: 2026-10-23 | **Spec**: [spec.md](spec.md)

## Summary

El producto se extrajo de `maestria-ia/apps/dev-arch` con `git subtree split` (historia conservada, 133 commits)
y se publicó en `raalzate/dev-arch` (público). Esta feature lo deja autosuficiente con el producto en la raíz:
(1) soporte de pruebas sin `apps/dev-arch` (`PRODUCT_REL` desaparece; la raíz del repositorio es la raíz del
producto); (2) CI en `.github/workflows/dev-arch.yml` con filtros por área en la raíz; (3) guardas aditivas acotadas
a su rango histórico (base → cierre de la propia feature) y con los commits remapeados; (4) re-testificación de
los escenarios atados al monorepo (aprobación explícita del usuario, 2026-10-23); (5) README con la tesis,
capturas reales y `docs/ARCHITECTURE.md` / `docs/CONTINUOUS-MODERNIZATION.md`.

## Technical Context

Sin tecnologías nuevas. Capturas con Playwright (ya presente) contra la web construida y el motor real; imágenes
PNG en `docs/images/`. Etiqueta `dev-arch-006-baseline` recreada en el commit equivalente y publicada.

## Commit remapping (subtree split)

| Referencia | Monorepo | Repositorio propio |
|---|---|---|
| Base 006 (`dev-arch-006-baseline`) | 889c95a | de1df5a24b49 |
| Cierre 007 | 7bc8170 | 616381ce1875 |
| Entrega 010 | 3b32def8 | 69c3f8e192ac |
| Cierre 011 | 8bd71ef | b64722a15602 |
| Cierre 012 | 22e8471 | b5cec37b9b24 |
| Cierre 013 | — | último commit de 013 antes de esta rama |

## Re-testify (escenarios bloqueados afectados)

| Feature | Escenario | Cambio |
|---|---|---|
| 006 | TS-001 | "clean clone of the repository"; entradas de raíz permitidas incluyen documentación (`README.md`, `LICENSE`) y CI (`.github`) |
| 006 | TS-002, TS-004, TS-039 | DEPRECATED: historia del motor importada, copias de trabajo del monorepo y reglas globales del monorepo no existen en el repositorio propio |
| 006 | TS-042 | "imported into the repository" |
| 006 | TS-025 | rutas de ejemplo sin `apps/dev-arch/` |
| 006 | TS-038 | rutas sin prefijo; "the product ignore rules" |
| 006 | build-and-test | "clean clone of the repository" |
| 007 | TS-076 | rango acotado: base 006 → cierre 007 |
| 011 | TS-033 | rango acotado: entrega 010 → cierre 011, hash remapeado |
| 012 | TS-036 | rango acotado: cierre 011 → cierre 012 |
| 012 | container | ruta sin prefijo; "workspace tracing root" |
| 013 | TS-033 | rango acotado: cierre 012 → cierre 013 |

## Constitution Check

| Principio | Estado | Nota |
|---|---|---|
| I. Compatibilidad | PASS | Sin cambios de comportamiento ni contratos (FR-008) |
| II. Fuente única | PASS | Solo ubicación, CI, pruebas y documentación |
| III. TDD | PASS | Escenarios 014 en rojo antes de mover; re-testificación aprobada por el usuario |
| IV. Determinismo | PASS | Capturas fuera del contrato; salidas sin cambios |
| V. Errores claros | PASS | Sin cambios |
| VI. Huella mínima | PASS | Sin dependencias nuevas |

## Project Structure

```text
README.md                         # portada: tesis, capturas, inicio rápido
docs/ARCHITECTURE.md              # motor determinista + web + MCP, diagrama
docs/CONTINUOUS-MODERNIZATION.md  # bucle agente ↔ análisis determinista, guardrail
docs/images/*.png                 # capturas reales
.github/workflows/dev-arch.yml    # CI en la raíz
tests/acceptance/support/layout.ts (+ pasos con rutas)
engine/pom.xml, engine/src/test/.../ProductLayout*.java   # ruta del workflow
specs/014-standalone-repo/
```
