---
id: TASK-115.2
title: Port upstream test cases as compatibility suite
status: Done
assignee: []
created_date: '2026-02-09 03:29'
updated_date: '2026-02-09 13:37'
labels:
  - testing
  - architecture
  - upstream
dependencies:
  - TASK-115.1
references:
  - /workspace/src/core
  - /workspace/src/providers
  - /workspace/tmp/mrlesk-Backlog.md-src/src/markdown
  - /workspace/tmp/mrlesk-Backlog.md-src/src/utils/prefix-config.ts
  - /workspace/tmp/mrlesk-Backlog.md-src/src/core/reorder.ts
parent_task_id: TASK-115
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Port test scenarios from upstream Backlog.md test files to run against local parser/writer APIs. This creates format-level compatibility guarantees without replacing working code.

**Source test files** (in /workspace/tmp/mrlesk-Backlog.md-src/src/test/):
- `markdown.test.ts` (605 LOC) — parse/serialize roundtrip tests
- `acceptance-criteria.test.ts` (653 LOC) — structured section and checklist tests
- `prefix-config.test.ts` (367 LOC) — ID normalization and prefix handling
- `reorder-utils.test.ts` (200 LOC) — ordinal calculations

**Approach:**
1. Create `src/test/unit/upstreamCompat.test.ts` importing local parser/writer APIs.
2. Port test scenarios from upstream, adapting to:
   - Vitest framework (instead of bun:test)
   - Local API shapes (e.g., `parseTaskContent()` instead of `parseTask()`)
   - Local type names (e.g., `ChecklistItem` with `id` instead of `AcceptanceCriterion` with `index`)
3. Run ported tests. Document each failure as a specific delta.
4. Categorize each delta: fix in 115.3/115.4, or document as intentional divergence.
5. Run full validation: `bun run test && bun run lint && bun run typecheck`

**Expected deltas** (from 115.1 audit):
- Date normalization: local drops HH:mm time → tests expecting time preservation will fail
- Legacy date formats: local doesn't handle DD-MM-YY etc. → tests for these will fail
- Checklist id vs index: naming difference only, behavior should match
- Serialization field order: intentional divergence, document and skip those tests

**Output:** ~80-120 ported test cases with a categorized list of behavioral deltas.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Create upstreamCompat.test.ts with ported test cases from all 4 upstream test files
- [x] #2 All ported tests that match current local behavior pass green
- [x] #3 Each failing test is categorized as: fix-in-115.3, fix-in-115.4, or intentional-divergence
- [x] #4 Full project validation passes (test, lint, typecheck)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Test porting results

**41 tests pass, 9 marked as .todo for known deltas:**

### Passing tests (41):
- Parse: complete task, minimal fields, unquoted dates, AC with checked items, @ assignee/reporter, inline assignee lists
- Date: date-only format, Date objects from YAML
- Priority: valid priorities, case-insensitive
- Checklist: #N numbering (stable format), legacy format (without markers), DoD items
- Structured sections: description, implementation notes, plan, final summary
- Ordinal: parse as number, missing = undefined
- Serializer: frontmatter field roundtrip
- AC parsing: stable markers, legacy, mixed AC+DoD
- ID handling: uppercase extraction, frontmatter override, dot-notation, case normalization
- Ordinal/reorder: drop at empty/between/after, sort behavior, hasOrdinal
- Roundtrip: all frontmatter fields preserved
- Document and Decision parsing

### Todo tests — FIX-115.3 (5 date-related):
1. DD-MM-YY legacy date format
2. DD/MM/YY legacy date format
3. DD.MM.YY legacy date format
4. HH:mm time preservation in created_date
5. ISO datetime T→space conversion

### Todo tests — FIX-115.4 (4 ordinal-related):
1. resolveOrdinalConflicts: already increasing → empty
2. resolveOrdinalConflicts: duplicate ordinals
3. resolveOrdinalConflicts: missing ordinals → default spacing
4. resolveOrdinalConflicts: force sequential
<!-- SECTION:NOTES:END -->
