---
id: TASK-115.4
title: Fix ID/prefix and ordinal behavioral deltas
status: Done
assignee:
  - '@codex'
created_date: '2026-02-09 03:29'
updated_date: '2026-02-09 13:44'
labels:
  - upstream
  - ordering
  - testing
dependencies:
  - TASK-115.2
references:
  - /workspace/src/core/BacklogParser.ts
  - /workspace/src/core/BacklogWriter.ts
  - /workspace/tmp/mrlesk-Backlog.md-src/src/markdown/parser.ts
  - /workspace/tmp/mrlesk-Backlog.md-src/src/markdown/serializer.ts
parent_task_id: TASK-115
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Align ID normalization and ordinal logic with upstream where ported tests fail.

**Expected work** (from 115.1 audit):
1. **ID normalization edge cases** — Compare local ID generation (in BacklogWriter) with upstream's `normalizeId()`, `generateNextId()`, `generateNextSubtaskId()`. Fix any deltas revealed by ported prefix-config tests.
2. **Ordinal conflict resolution** — Local `calculateOrdinalsForDrop()` is extension-specific drag-and-drop logic that stays. But verify that ported reorder-utils tests for `calculateNewOrdinal()` behavior are compatible with local ordinal sorting/calculation logic. If upstream's `resolveOrdinalConflicts()` would be valuable, port it as a new utility function.
3. **Zero-padding and subtask dot-notation** — Verify edge cases match between implementations.

**NOT in scope:**
- Replacing `calculateOrdinalsForDrop()` — it's extension-specific
- Replacing `compareByOrdinal()` / `sortCardsByOrdinal()` — upstream doesn't have these
- Adding upstream's full prefix-config utility API unless tests require it

**Output:** ID and ordinal handling aligned where tests require it. Extension-specific features preserved.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All ported prefix-config compatibility tests pass
- [ ] #2 All ported reorder-utils compatibility tests pass
- [ ] #3 Extension-specific ordinal functions (calculateOrdinalsForDrop, sortCardsByOrdinal) unchanged
- [ ] #4 All existing ordinalUtils tests continue to pass
- [ ] #5 Full project validation passes (test, lint, typecheck)
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Ported `resolveOrdinalConflicts()` from upstream Backlog.md to local `ordinalUtils.ts`:

- Handles duplicate/non-increasing ordinals by bumping to next step
- Fills in missing ordinals with default spacing (1000)
- Supports `forceSequential` mode for even reassignment
- All 4 FIX-115.4 .todo tests converted to real passing tests
- All 50 upstream compat tests now pass with 0 todos
- Full test suite: 562 passed, 0 failures
- Extension-specific functions (calculateOrdinalsForDrop, sortCardsByOrdinal, compareByOrdinal) unchanged
<!-- SECTION:FINAL_SUMMARY:END -->
