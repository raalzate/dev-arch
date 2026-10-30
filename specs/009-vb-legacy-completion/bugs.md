# Bug Reports: 009-vb-legacy-completion

## BUG-001

**Reported**: 2026-10-30
**Severity**: medium
**Status**: reported
**GitHub Issue**: _(none)_

**Description**: `VbCodeAnalyzer` drops every code issue of a type when Roslyn fails to build its operation tree ("An item with the same key has already been added. Key: Public Sub New()")

**Reproduction Steps**:
1. Analyze a VB project through the Adhoc fallback (no MSBuild) with a base class whose constructor has an optional parameter typed with an unresolved name (`Public Sub New(Optional ByVal permissions As Int64 = 0)` without `Imports System`) and a derived class with a parameterless constructor that does not call `MyBase.New` explicitly but has a body.
2. Run `dotnet-analyzer <project>`.
3. Observe on stderr `[WARN] VbCodeAnalyzer: error analyzing type '<derived>': An item with the same key has already been added. Key: Public Sub New()` and that the derived component has none of the VB code issues (late binding, generic catch, missing Case Else…), even those unrelated to the constructor. On the policy-manager reference corpus two types are lost (`AmigosPlus.Common.Contacts.ContactCompany`, `ContactIndividual`).

**Root Cause**: `IsLateBound` calls `SemanticModel.GetOperation(node)` for every invocation and member access. With the implicit `MyBase.New()` bound to a constructor whose optional parameter has an error type, Roslyn 4.9.2 (`OperationMapBuilder.Walker.RecordOperation`, visiting a `NoneOperation`) records the constructor block twice and throws `ArgumentException`. The analyzer catches at type level, so one failing node discards all the issues of the type (principle V: a failure on one element must not drop the rest).

**Fix Reference**: _(empty until implementation)_

---

## BUG-002

**Reported**: 2026-10-30
**Severity**: medium
**Status**: reported
**GitHub Issue**: _(none)_

**Description**: `SqlTableParser` uses a 1-second `RegexMatchTimeout`, so the tables of a component depend on the load of the machine (non-deterministic output, principle IV)

**Reproduction Steps**:
1. Build a VB class with a very long folded SQL literal (tens of KB) or run the analyzer on a heavily loaded machine.
2. Run the analysis twice.
3. Observe that `tables_used` may be empty in one run (regex timed out, `[WARN] SqlTableParser: literal too complex to analyze; ignored.`) and populated in the other.

**Root Cause**: every `Regex` of `SqlTableParser` is constructed with `TimeSpan.FromSeconds(1)`; a wall-clock timeout makes the output depend on the environment. The deterministic equivalent is a fixed input bound.

**Fix Reference**: _(empty until implementation)_
