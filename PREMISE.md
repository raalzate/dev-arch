# dev-arch Premise

## What

dev-arch es una plataforma de modernización de sistemas legacy Java y .NET basada en **inferencia determinista**. Su
motor analiza estáticamente el proyecto completo (Spoon para Java; Roslyn para C# y VB.NET), construye el grafo
real de dependencias, detecta capas, tablas, contratos REST, secretos y problemas de código, e infiere propuestas
de extracción de microservicios con su viabilidad y un plan por etapas. Se usa desde una web (recorrido de cinco
pasos), desde la línea de comandos y la CI, y desde agentes de IA por MCP (Claude Code envía el proyecto y recibe
el análisis).

## Who

- Arquitectos y equipos de modernización que deben decidir qué extraer de un monolito y en qué orden
- Desarrolladores que refactorizan con agentes de IA y necesitan una fuente de verdad objetiva del estado del código
- Responsables de calidad que quieren un guardrail medible de principios y buenas prácticas en cada cambio

## Why

Los modelos de IA generativa pueden refactorizar, pero cuando describen el estado de un sistema grande estiman,
cambian de respuesta entre ejecuciones y pueden inventar. Una modernización segura necesita apalancarse en un
modelo de inferencia determinista que diga cómo está el proyecto sin inventar —misma entrada, misma salida— y que,
ejecutado en cada cambio, actúe como guardrail: los hallazgos críticos no aumentan, el acoplamiento no crece, la
cohesión y la viabilidad no bajan. Esa combinación —IA que ejecuta, análisis determinista que mide y verifica—
hace posible la modernización continua.

## Domain

- **Análisis estático de código**: AST completo sin ejecución (Spoon, Roslyn), grafo de dependencias y métricas
- **Descomposición en microservicios**: clustering por cohesión, acoplamiento y datos compartidos con umbrales
  explícitos y ajustables
- **Model Context Protocol (MCP)**: herramientas para agentes (stdio en el motor; HTTP y puente stdio en la web)
- **Modernización continua**: análisis repetible y comparable como guardrail de calidad

## Scope

**Dentro del alcance:**
- Análisis de Java, C# y VB.NET (incluido .NET Framework 4.8 legacy) con contrato JSON versionado
- Web de modernización (resumen, mapa, propuestas, hallazgos, plan, historial y comparación)
- Servidor MCP del motor y servidor MCP para agentes en la web, con puente para enviar carpetas locales
- Instalación local, contenedor Docker/Compose y diagnóstico de requisitos

**Fuera del alcance:**
- Generar o reescribir código automáticamente (lo hace el agente de IA; dev-arch mide y verifica)
- Análisis dinámico o en tiempo de ejecución
- Decisiones de negocio: las propuestas son inferencias estructurales con su evidencia
