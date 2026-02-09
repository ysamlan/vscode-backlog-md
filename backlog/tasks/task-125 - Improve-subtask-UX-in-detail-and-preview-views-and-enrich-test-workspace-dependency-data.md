---
id: TASK-125
title: >-
  Improve subtask UX in detail and preview views and enrich test workspace
  dependency data
status: Done
assignee:
  - '@codex'
created_date: '2026-02-09 16:50'
updated_date: '2026-02-09 16:58'
labels:
  - ui
  - subtasks
  - fixtures
  - testing
dependencies:
  - TASK-124
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add richer dependency/subtask fixture data in the e2e test workspace for manual testing. Improve task detail and native compact preview so subtasks are visible and actionable, with click-through to open subtask detail/edit view.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 E2E test workspace contains clear dependency chains and parent/subtask relationships suitable for manual QA.
- [x] #2 Task detail view renders subtasks as explicit linked items (not plain bullets) and clicking opens the selected subtask in full detail editor.
- [x] #3 Compact/native preview panel shows subtasks when present and allows click-through to open selected subtask detail.
- [x] #4 Behavior works for normal local tasks and remains read-only-safe for read-only tasks (no mutation side effects).
- [x] #5 Automated tests cover new subtask click-through behavior and pass with full validation gate.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Updated e2e test workspace fixture tasks to include explicit IDs and a clearer dependency chain (`TASK-6 -> TASK-3 -> TASK-2.3 -> TASK-2.2 -> TASK-2.1`) plus explicit parent subtasks on `TASK-2`.

Task detail subtasks now use a full-row clickable button target (not just task ID text), preserving keyboard accessibility and click-through behavior.

Task preview now receives and renders subtask summaries, including merged explicit `subtasks` and `parent_task_id`-derived children, with click-through to full detail/edit view.

Restored and improved delete action button styling in task detail actions after regression shown in `tmp/trash.png`.

Added/updated automated coverage: unit tests for preview subtask summary emission and Playwright task-detail test for subtask row click-through; full validation gate passed.
<!-- SECTION:NOTES:END -->
