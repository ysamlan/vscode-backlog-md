---
id: TASK-86
title: Audit all task frontmatter fields for parser/writer/test coverage
status: To Do
assignee: []
created_date: '2026-02-06 02:36'
labels:
  - testing
  - compatibility
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Comprehensively review ALL fields that can appear in Backlog.md task YAML frontmatter and ensure our parser, writer, tests, and sample workspace fixtures all cover them correctly.

**Reference:** Check upstream `src/markdown/parser.ts` and `src/types/index.ts` at https://github.com/MrLesk/Backlog.md for the canonical field list.

**Known fields to verify:**
- `id` - Task ID (string, e.g. "TASK-1", "TASK-1.01")
- `title` - Task title
- `status` - Status string
- `priority` - high/medium/low
- `milestone` - Milestone name
- `labels` - Array of strings `[label1, label2]`
- `assignee` - Array of strings, may have `@` prefix `[@user]`
- `created_date` / `created` - Date string (YYYY-MM-DD or with time)
- `updated_date` / `updated` - Date string
- `dependencies` - Array of task IDs `[TASK-2, TASK-3]`
- `parent_task_id` - Parent task reference (already found a bug: parser was only checking `fm.parent`, fixed to also check `fm.parent_task_id`)
- `subtasks` - Array of child task IDs
- `references` - Array of URLs/paths
- `documentation` - Array of URLs/paths
- `type` - Task type string
- `ordinal` - Ordering number
- `onStatusChange` - Status change hooks (object)
- `reporter` - Reporter string
- `due_date` / `due` - Due date

**What to check for each field:**
1. Parser reads it correctly from frontmatter (both field name variants if any)
2. Writer preserves it on round-trip (read → modify → write back)
3. Writer includes it in correct field order
4. Unit tests cover parsing the field
5. Unit tests cover writing/preserving the field
6. Sample workspace fixtures include at least one task with this field populated
7. TypeScript types match the upstream data model

**Sample workspace location:** `src/test/e2e/fixtures/test-workspace/backlog/tasks/`

**Known issues found so far:**
- `parent_task_id` parser bug (fixed: was only checking `fm.parent`, now checks both)
- Need to verify `subtasks` array is parsed
- Need to verify `reporter`, `due_date`, `onStatusChange` support
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every upstream frontmatter field has a corresponding TypeScript type
- [ ] #2 BacklogParser correctly parses every field (including alternate names like created vs created_date)
- [ ] #3 BacklogWriter preserves every field on round-trip without data loss
- [ ] #4 Unit tests exist for parsing each field
- [ ] #5 Unit tests exist for writing each field
- [ ] #6 Sample workspace tasks collectively cover all field variants
- [ ] #7 Fields with special formatting (arrays, dates, @-prefixed assignees) have edge case tests
<!-- AC:END -->
