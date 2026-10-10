# Legacy scenario exclusions — 011-quality-delivery

Version: 1.0.0 (2026-10-09)

Locked scenarios of 001–003 that contradict a later, deliberate and locked decision. The user decided on
2026-10-09 (option B, "Exclusión documentada"; spec Clarifications, FR-033) to keep their `.feature` files
unchanged and exclude them from the legacy engine runners.

This file is machine-readable and is the **only** source of exclusions:

- the legacy runners (`engine/src/test/java/com/extractor/legacybdd/*`) skip each listed scenario with the reason
  `excluded-by-decision: <feature> <scenario> — superseded by <decision> (<date>)`;
- 011 TS-007/TS-008/TS-009 accept exactly these exclusions and fail on any entry that does not match an existing
  scenario and on any skip that is neither listed here nor caused by an absent .NET analyzer.

Format rules: one table row per scenario; `Feature` is a folder under `specs/`; `Scenario` is its `@TS-XXX` tag;
`Decision date` is `YYYY-MM-DD`. Adding, removing or changing a row bumps the version above.

| Feature | Scenario | Locked assertion | Superseded by | Decision date |
|---|---|---|---|---|
| 001-mcp-server-local | TS-003 | A folder without Java sources is an MCP error (`isError: true`) | 007 FR-026 / TS-061: success with 0 components and a warning | 2026-10-09 |
| 002-dotnet-roslyn-analyzer | TS-014 | A folder without project markers is an UNKNOWN-type error | Deliberate Java fallback for UNKNOWN projects (Constitution I; 007 research E5) | 2026-10-09 |
| 003-dotnet-code-issues | TS-001 | `catch (Exception e) { }` yields exactly 1 code issue | 003 FR-001 / TS-003: the same snippet also raises CATCH_GENERIC_EXCEPTION | 2026-10-09 |
| 003-dotnet-code-issues | TS-018 | Every code issue has a `location` field | Contract 1.0.0 (005 research E3): `location` dropped, the schema rejects it | 2026-10-09 |
