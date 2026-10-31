# Contract: `integrations` / `dependencies` sections and the integration annotations (022, additive to 1.0.0)

`integrations.outbound`: `auto` (default, Visual Basic only) | `on` | `off`.
`dependencies.enabled`: `auto` | `on` | `off`; `dependencies.eol`: array of name prefixes added to `schema/eol-dependencies.json`.
Transport: the 020 `--config=<file>` (`{ "integrations": {…}, "dependencies": {…} }` only when non-default).

Output conventions (no schema change): `components[].annotations` may contain `Integration:wcf:<name>`, `Integration:soap:<name>`, `Integration:rest:<host|key|dynamic>`, `Integration:wcf:<contract>@<host>`, `Dependency:eol:<name>`; `components[].external_dependencies` may contain third-party package/assembly simple names, `service:<name>`, `http:<host|key>`, `project:<missing project>`; `code_issues[].rule` gains `EOL_DEPENDENCY` (`type` `DEPENDENCY`). Addresses are reduced to their host; configuration values are never emitted.
