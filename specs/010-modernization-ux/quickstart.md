# Quickstart: 010-modernization-ux

```bash
cd apps/dev-arch && source scripts/iikit-env.sh
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
make build                       # engine + web
npm test -w web                  # unit tests (node:test)
npx cucumber-js --tags "@US-001" # fast acceptance scenarios of 010 (example)
make test-e2e-browser            # Playwright flows (007 + 010), real engine
make dev                         # http://localhost:9002 (use PORT override for manual runs)
```

Manual walkthrough:
1. Upload `engine/test-for-demo/dotnet-ecommerce` as ZIP → header badge ".NET · C#"; no "EJB"/"@Deprecated" anywhere; Findings shows "Sin hallazgos: …" for empty sections.
2. Mapa del sistema: toggle `injection` in the legend → those edges disappear; group by proposal.
3. Propuestas: raise "Umbral de viabilidad media" to 0.9 → status "Propuestas recalculadas"; Reset → original.
4. Move a component to another proposal → both re-scored by the engine.
5. Plan → Exportar Markdown / PDF.
6. Historial → select two completed analyses → Comparar.
7. AI documentation: `LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=… make dev` (default `gemini`).
