# Bug Reports: 022-external-integrations

## BUG-010

**Reported**: 2026-10-30
**Severity**: high
**Status**: fixed
**GitHub Issue**: _(none)_

**Description**: The Java bridge rejects every Visual Basic graph that contains an end-of-life dependency: `Failed to parse dotnet-analyzer JSON output: Cannot deserialize value of type CodeIssue$Type from String "DEPENDENCY"`.

**Reproduction Steps**:
1. Analyze through the Java CLI (`java -jar engine/target/java-dependency-extractor.jar <vb project> out.json --language=dotnet`) a VB project referencing an EOL assembly (e.g. `Microsoft.Practices.EnterpriseLibrary.Data` 3.1).
2. Observe the error on stderr and empty output documents (0 components, 0 proposals).

**Root Cause**: 022 added `code_issues[].type = DEPENDENCY` (rule `EOL_DEPENDENCY`) to the .NET analyzer and documented it, but the Java model enum `CodeIssue.Type` only knew `BUG_PATTERN, CODE_STYLE, SECURITY, PERFORMANCE`. The 022 measurement on the reference corpus ran the .NET analyzer directly, so the Java path was never exercised with EOL dependencies (the contract schema does not constrain the type, so no validation caught it).

**Fix Reference**: the contract enum (`schema/1.0.0/common.schema.json`, `CodeIssue.type`) is closed, so the analyzer now emits `type: SECURITY` for `EOL_DEPENDENCY` (an unsupported dependency is an unpatched security risk); the Java enum is unchanged and `CodeIssueTypeTest` asserts that the Java enums equal the schema enums. Golden `SyntheticIntegrations.golden.json` regenerated. Found while measuring feature 023 through the Java CLI; fixed on branch `024-extended-static-analysis`.
