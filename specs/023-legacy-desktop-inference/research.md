# Research: 023
- D1 Preset como overlay JSON versionado aplicado entre defaults y overrides del usuario: reproducible, documentable, sin lógica dispersa. Alternativa (if/else en cada clase) rechazada.
- D2 Selección `auto` por `meta.source = roslyn-fallback` o ≥ 50 % de componentes con `.vb`: señales del grafo, deterministas; nunca tiempo/entorno (Constitución IV).
- D3 Deuda en `rationale`/`summary`: `signals`, `metrics`, `meta` cerrados en 1.0.0 (005/008 bloquean `schema_version`). Fórmula FR-040 saturante (1 − 1/(1+x)) para acotar a [0,1] sin umbrales arbitrarios.
- D4 Nombrado por dominio: prefijo común del grafo eliminado (p. ej. `AmigosPlus`), namespace común de miembros, ≤ 2 segmentos; evita "Controllers y Annualbasesalar".
- D5 Soporte por namespace y fan-in: `Common*` y componentes llamados desde ≥ 3 dominios son infraestructura compartida, no microservicio.
