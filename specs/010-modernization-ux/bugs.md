
## BUG-013

**Reported**: 2026-10-31
**Severity**: low
**Status**: fixed
**GitHub Issue**: _(none)_

**Description**: React warning `Encountered two children with the same key, Librería de Common.WebServices` in `PrintReport` when an architecture has several support libraries with the same name.

**Reproduction Steps**:
1. Analyze a Visual Basic project through the web (preset `legacy-desktop`, 023) whose support libraries share a namespace domain (e.g. several `Librería de Common.WebServices`).
2. Open the plan / print report. The browser console shows the duplicate-key warning; items may be duplicated or omitted.

**Root Cause**: `print-report.tsx` keyed the support-library list by `name`; 023 names support libraries by domain, so names are no longer unique (the contract already provides a unique `id`).

**Fix Reference**: `plan.ts` carries `id` for each support library and `print-report.tsx` keys by it. Found reviewing the reference corpus in the web on 2026-10-31.
