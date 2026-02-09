---
id: TASK-115.3
title: Fix parser/serializer behavioral deltas identified by compatibility tests
status: Done
assignee:
  - '@codex'
created_date: '2026-02-09 03:29'
updated_date: '2026-02-09 13:42'
labels:
  - upstream
  - parser
  - testing
dependencies:
  - TASK-115.2
references:
  - /workspace/src/test/unit/BacklogParser.test.ts
  - /workspace/src/test/unit/BacklogWriter.test.ts
  - /workspace/e2e/tasks.spec.ts
parent_task_id: TASK-115
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix behavioral deltas in local parser/writer where ported upstream tests fail, and the delta is unintentional.

**Scope rule:** Every change must be motivated by a failing ported test from 115.2. No refactoring for aesthetics. If local code differs but no test fails, document and move on.

**Expected fixes** (from 115.1 audit):
1. **Date normalization** — Fix `normalizeDateValue()` in BacklogParser to preserve `HH:mm` time components instead of truncating to `YYYY-MM-DD`. Port upstream's `normalizeDate()` logic.
2. **Legacy date format handling** — Add conversion for `DD-MM-YY`, `DD/MM/YY`, `DD.MM.YY` formats.
3. **Writer date preservation** — Ensure `updated_date` in BacklogWriter preserves time when present.
4. **Checklist parsing** — Verify `parseChecklistItem()` handles items without `#N` numbering (legacy format). Add support if missing.
5. **CRLF handling** — Low priority, add if tests require it.

**NOT in scope:**
- Serialization field order (intentional divergence, both produce valid YAML)
- Array format (local uses inline `[]`, upstream uses block-style — intentional divergence)
- Type field name changes (createdAt vs createdDate — internal naming, not format-level)
- Adding gray-matter dependency

**Output:** Local parser/serializer aligned with upstream on format-level behavior. All ported + existing tests green.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Date normalization preserves HH:mm time components when present
- [ ] #2 Legacy date formats (DD-MM-YY, DD/MM/YY, DD.MM.YY) are auto-converted to YYYY-MM-DD
- [ ] #3 All ported upstream compatibility tests pass (except documented intentional divergences)
- [ ] #4 All existing parser/writer tests continue to pass (no regressions)
- [ ] #5 Full project validation passes (test, lint, typecheck)
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed parser date normalization for upstream compatibility:

- `normalizeDateValue()` in BacklogParser.ts now preserves HH:mm time components (was truncating to date-only)
- Handles ISO datetime format (YYYY-MM-DDTHH:mm → space-separated YYYY-MM-DD HH:mm)
- Supports 3 legacy date formats: DD-MM-YY, DD/MM/YY, DD.MM.YY
- All 5 FIX-115.3 .todo tests converted to real passing tests
- Fixed TypeScript type errors in upstreamCompat.test.ts (imported Task/ChecklistItem types)
- Full test suite: 558 passed, 4 todo (ordinal tests for 115.4), 0 failures
<!-- SECTION:FINAL_SUMMARY:END -->
