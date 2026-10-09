# Contract: user warnings from dotnet-analyzer to the engine

Extends the warnings channel of 007 (`specs/007-native-engine-runtime/contracts/engine-mcp.md`, *Warnings*). No change to stdout JSON nor to the MCP response schema.

## dotnet-analyzer (producer)

- stdout: unchanged (the dependency-graph JSON).
- stderr: after the JSON is written, one line per **user warning**, in ordinal order, without duplicates:

  ```
  [warning] <text>
  ```

- Existing diagnostic lines (`[WARN] …`, `Error: …`) are unchanged and are **not** user warnings.
- Sources in 009: one warning per VB project loaded through the Adhoc fallback:

  ```
  VB project '<file>.vbproj' analyzed with reduced fidelity (Adhoc fallback: MSBuild with Visual Studio Build Tools and the VB workload is unavailable). .NET Framework types are unresolved; coupling to framework types and detections that need them may be incomplete. See docs/VB-LEGACY.md.
  ```

  `<file>` is the project file name (no directory). When the global fallback loads VB sources of a directory without a `.vbproj`, `<file>.vbproj` is replaced by `sources in '<directory name>'` (`VB sources in '<dir>' analyzed with reduced fidelity …`).
- C# analyses emit no `[warning]` lines.

## DotNetBridgeAnalyzer (consumer)

- After a successful run (exit code 0), each stderr line that starts with exactly `[warning] ` contributes the remainder of the line (trimmed of the trailing line break) to `getWarnings()`, in order, without duplicates, after any contract-version warning of 005.
- Lines are not parsed when the process fails (the existing error path is unchanged).

## Exposure (unchanged from 007)

- MCP `analyze_project`: `_meta["static-inference/warnings"]` lists the warnings (present only when there are warnings).
- CLI: `[warning] <text>` on stderr after the outputs are written; output files unchanged.
