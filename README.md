<p align="center"><img src="web/src/app/icon.svg" width="72" alt="dev-arch"></p>

<h1 align="center">dev-arch</h1>

<p align="center"><b>Análisis estático determinista para modernizar sistemas legacy Java y .NET<br>— la base de verdad sobre la que la IA puede refactorizar sin inventar.</b></p>

<p align="center">
  <img src="docs/images/step-1-summary.png" width="900" alt="Resumen del análisis de un sistema .NET legacy">
</p>

---

## La tesis

> **Los modelos de IA pueden refactorizar, pero solo un modelo de inferencia determinista sabe cómo está el
> proyecto sin inventar. Para modernizar hay que apalancarse en él: es la fuente de verdad del estado del sistema y,
> ejecutado en cada cambio, el guardrail que mantiene principios y buenas prácticas. Eso es lo que hace posible la
> modernización continua.**

### 1. La IA generativa refactoriza; no es fuente de verdad

Un modelo de lenguaje es excelente escribiendo y transformando código, pero cuando se le pregunta *cómo está* un
sistema grande responde con una estimación: lee una parte del código, completa el resto por probabilidad y puede
alucinar dependencias, capas o tablas que no existen. Su respuesta además cambia entre ejecuciones. Para decidir
qué extraer de un monolito eso no alcanza: una decisión de arquitectura apoyada en una descripción inventada es peor
que no tener ninguna.

### 2. La inferencia determinista dice cómo está el proyecto, sin inventar

dev-arch no genera: **mide**. Su motor recorre el árbol sintáctico completo (Spoon para Java, Roslyn para C# y
VB.NET) y construye el grafo real de dependencias, las capas, las tablas que toca cada componente, los contratos
REST, los secretos expuestos y los problemas de código. Sobre ese grafo aplica un algoritmo de inferencia con
pesos y umbrales explícitos (cohesión, acoplamiento, datos compartidos) para proponer microservicios con su
viabilidad.

- **Reproducible:** misma entrada, misma salida, byte a byte (lo verifican las pruebas de contrato en cada
  ejecución de la CI).
- **Explicable:** cada propuesta trae sus métricas, sus señales y su justificación; nada es una caja negra.
- **Contrato versionado:** las salidas cumplen un esquema JSON versionado (`schema/1.0.0`) que consumen la web,
  el CLI y los agentes por igual.
- **Ajustable sin reanalizar:** los umbrales de inferencia se cambian y las propuestas se recalculan sobre el mismo
  grafo.

### 3. La IA + el análisis determinista: cada uno en su papel

El agente (por ejemplo Claude Code) usa dev-arch como servidor MCP: **envía** el proyecto, **recibe** el análisis
estructurado y razona sobre hechos, no sobre suposiciones. El modelo decide *cómo* refactorizar; dev-arch le dice
*qué hay* y *si quedó mejor*.

<p align="center">
  <img src="docs/images/agent-claude-code.png" width="900" alt="Claude Code analizando un proyecto con dev-arch por MCP">
  <br><sub>Sesión real de Claude Code (<code>claude -p</code>) usando dev-arch por MCP: envía la carpeta, recibe propuestas y hallazgos, y el enlace para abrir el mismo análisis en la web.</sub>
</p>

### 4. Guardrail y modernización continua

Como el análisis es determinista, **dos análisis se pueden comparar**. Ejecutado en cada cambio —en la CI o por el
agente después de cada refactorización— se convierte en un guardrail objetivo: no deja que aumenten los
hallazgos críticos, que crezca el acoplamiento, que baje la cohesión ni que una propuesta pierda viabilidad. Los
principios y las buenas prácticas dejan de depender de una revisión manual y pasan a medirse en cada paso.

```mermaid
flowchart LR
  A[Analizar<br/>dev-arch determinista] --> B[Decidir<br/>propuestas + plan]
  B --> C[Refactorizar<br/>agente de IA]
  C --> D[Reanalizar y comparar<br/>hallazgos · acoplamiento · cohesión · viabilidad]
  D -- mejora --> B
  D -- retrocede --> C
```

Ese bucle —**analizar, refactorizar con IA, reanalizar y comparar**— es la **modernización continua**: el sistema
se moderniza por pasos pequeños y verificables, en lugar de una reescritura a ciegas. Más detalle en
[docs/CONTINUOUS-MODERNIZATION.md](docs/CONTINUOUS-MODERNIZATION.md).

---

## Qué muestra

El recorrido de la web responde cinco preguntas, siempre sobre el mismo análisis determinista:

| Paso | Pregunta | |
|---|---|---|
| **1. Resumen** | ¿En qué estado está el sistema legacy? | ![Resumen](docs/images/step-1-summary.png) |
| **2. Mapa del sistema** | ¿Dónde está el acoplamiento real? | ![Mapa del sistema](docs/images/step-2-map.png) |
| **3. Propuestas** | ¿Qué se puede extraer y con qué viabilidad? | ![Propuestas](docs/images/step-3-proposals.png) |
| **4. Hallazgos** | ¿Qué riesgos y contratos hay que atender? | ![Hallazgos](docs/images/step-4-findings.png) |
| **5. Plan** | ¿En qué orden modernizar? | ![Plan](docs/images/step-5-plan.png) |

<details><summary>Más capturas: mapa de un proyecto Java y tema oscuro</summary>

![Mapa del sistema de un proyecto Java hexagonal](docs/images/step-2-map-java.png)
![Propuestas en tema oscuro](docs/images/step-3-proposals-dark.png)

</details>

Lenguajes: **Java** (Maven/Gradle, Spring, JEE), **C#** y **VB.NET** (incluido .NET Framework 4.8 legacy).

## Inicio rápido

```bash
git clone https://github.com/raalzate/dev-arch.git && cd dev-arch
npm run doctor        # revisa JDK 17, Maven, .NET 8, Node 20+ y te dice cómo instalar lo que falte
make build            # motor Java + analizador .NET + web
make dev              # web en http://localhost:9002
```

Solo con Docker:

```bash
docker compose -f docker/compose.yaml up -d    # http://127.0.0.1:9002
```

Conectar Claude Code (o cualquier agente MCP):

```bash
curl -fsSo ~/.dev-arch-mcp.mjs http://127.0.0.1:9002/dev-arch-mcp.mjs
claude mcp add dev-arch -- node ~/.dev-arch-mcp.mjs --url http://127.0.0.1:9002
```

Guías: [instalación](docs/INSTALL.md) · [conexión de agentes (MCP)](docs/AGENTS-MCP.md) ·
[arquitectura](docs/ARCHITECTURE.md) · [modernización continua](docs/CONTINUOUS-MODERNIZATION.md) ·
[contrato JSON](docs/SCHEMA.md)

## Cómo está hecho

| Área | Qué es |
|---|---|
| `engine/` | Motor determinista: Java 17 + Spoon (Java) y analizador .NET 8 + Roslyn (C#/VB.NET); CLI y servidor MCP por stdio |
| `schema/` | Contrato JSON versionado de todas las salidas, con tipos TypeScript generados |
| `web/` | Next.js: recorrido de modernización, API de análisis asíncronos, servidor MCP para agentes (`/api/mcp`) |
| `docker/` | Imagen todo-en-uno y Compose |
| `specs/` | Especificaciones por feature (001–014) con escenarios BDD bloqueados por hash |

El desarrollo sigue especificación → plan → pruebas BDD bloqueadas → implementación (TDD), bajo los principios de
[CONSTITUTION.md](CONSTITUTION.md): compatibilidad, una sola fuente de lógica, TDD, **determinismo**, errores
claros y huella mínima.

## Licencia y contexto

Proyecto de maestría (modernización de software asistida por IA). Ver [CHANGELOG.md](CHANGELOG.md).
