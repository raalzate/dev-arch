# Install — `static-inference-expert-claude` skill

Drop this skill into a downstream project that wants to consume the dev-arch analysis engine (`static-inference` MCP).

## 1. Copy the skill folder

```bash
# from your consumer project root
mkdir -p .claude/skills
cp -R /path/to/static-inference/skills/static-inference-expert-claude .claude/skills/
```

Layout afterwards:

```
<your-project>/
├── .claude/
│   └── skills/
│       └── static-inference-expert-claude/
│           ├── SKILL.md
│           ├── INSTALL.md
│           ├── references/
│           ├── scripts/
│           └── hooks/
└── .mcp.json   ← step 2
```

## 2. Obtain the analyzer artifacts

The engine lives in [`raalzate/dev-arch`](https://github.com/raalzate/dev-arch). Build it once (JDK 17, Maven, and
the .NET SDK 8 for .NET projects; `npm run doctor` lists what is missing):

```bash
git clone https://github.com/raalzate/dev-arch.git && cd dev-arch
make build-engine     # engine/target/java-dependency-extractor.jar + engine/target/dotnet-analyzer
```

Distribute `engine/target/java-dependency-extractor.jar` and, for .NET projects, `engine/target/dotnet-analyzer`
(plus its folder) to a shared path. The engine finds the .NET analyzer next to the JAR or through
`DOTNET_ANALYZER_PATH`.

> **No local JDK?** Run dev-arch as a server (`docker compose -f docker/compose.yaml up -d`) and connect the agent
> to it instead: the agent sends the project folder and receives the same analysis plus the summary, proposals,
> findings and plan of the web. See [docs/AGENTS-MCP.md](https://github.com/raalzate/dev-arch/blob/main/docs/AGENTS-MCP.md).

## 3. Register the MCP server

Copy the template from the analyzer repo as a starting point:

```bash
cp /path/to/dev-arch/.mcp.json /your-project/.mcp.json
# then edit the JAR path
```

Or create `.mcp.json` at the consumer project root manually:

```json
{
  "mcpServers": {
    "static-inference": {
      "type": "stdio",
      "command": "java",
      "args": [
        "-jar",
        "/abs/path/to/java-dependency-extractor.jar",
        "--mcp"
      ]
    }
  }
}
```

The JAR path must be absolute. Ship `dotnet-analyzer` in the same directory as the JAR so it is found automatically.

## 4. Verify

Open the project in Claude Code, start a session, then check the tools list. You should see:

```
mcp__static-inference__analyze_project
mcp__static-inference__get_dependency_graph
mcp__static-inference__get_architecture_proposal
mcp__static-inference__get_api_contracts
mcp__static-inference__get_component_metrics
```

Plus a skill named `static-inference-expert-claude` in the available skills.

## 5. (Optional) Auto-report hook

Add to `.claude/settings.json` so every analysis writes `triage.md` + `risk-report.md` next to the JSON outputs:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "mcp__static-inference__analyze_project",
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/skills/static-inference-expert-claude/hooks/post-analysis.sh"
          }
        ]
      }
    ]
  }
}
```

## 6. Run an analysis

Just ask: *"analiza este proyecto y dime qué microservicios extraer"*. The skill activates, runs `analyze_project`, applies the decision rules in `references/decision-rules.md`, and produces an evidence-backed report.

## CLI fallback

If the MCP server is unavailable, scripts work standalone:

```bash
# locate JAR via STATIC_INFERENCE_JAR env, .mcp.json, or STATIC_INFERENCE_HOME
export STATIC_INFERENCE_JAR=/abs/path/java-dependency-extractor.jar

bash .claude/skills/static-inference-expert-claude/scripts/run-analysis.sh \
  /abs/path/to/your/project ./analysis-output

bash .claude/skills/static-inference-expert-claude/scripts/triage-proposals.sh \
  ./analysis-output/output_architecture.json --md

bash .claude/skills/static-inference-expert-claude/scripts/risk-report.sh \
  ./analysis-output/output.json \
  ./analysis-output/output_architecture.json
```

## Requirements

| Component | Where | Version |
|-----------|-------|---------|
| Java | consumer project | 17+ |
| `dotnet-analyzer` binary | only if analyzing .NET | platform-specific (osx-arm64, linux-x64, ...) |
| `jq` | for batch scripts + hook | any recent |

The `dotnet-analyzer` binary is located by `DotNetToolLocator` in this order: (1) sibling of the JAR, (2) `DOTNET_ANALYZER_PATH` env var, (3) system `PATH`. Recommended layout: ship the JAR and the platform-matching binary in the same directory.

See `references/build-setup.md` for full prerequisites and analyzer artifact distribution patterns.
