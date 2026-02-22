---
id: TASK-145
title: >-
  Mirror upstream archive-time sanitization of dependencies and task-ID
  references
status: Done
assignee: []
created_date: '2026-02-22 21:01'
updated_date: '2026-02-22 21:38'
labels:
  - compatibility
  - archive
  - upstream
dependencies: []
references:
  - /workspace/tmp/mrlesk-Backlog.md-src/src/core/backlog.ts
  - '/workspace/src/core/BacklogWriter.ts:80'
  - '/workspace/src/core/BacklogWriter.ts:158'
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement upstream-compatible cleanup when archiving a task (as of commit 2b2c8e0): remove archived task IDs from active task dependencies and remove exact task-ID references while preserving non-task references (URLs/paths/substrings). Extension currently moves files without this sanitation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Archiving a task removes that task ID from `dependencies` in active local tasks (`backlog/tasks`) while leaving unrelated dependency values untouched.
- [x] #2 Archiving a task removes only exact task-ID references from `references` (case-insensitive ID match), and preserves URLs/path references that merely contain similar text.
- [x] #3 Cleanup scope matches upstream intent: active tasks only; does not mutate drafts/completed/archive task files unless we intentionally document a different scope.
- [x] #4 Sanitization updates write back via existing writer flow and preserve frontmatter/body integrity.
- [x] #5 Regression tests cover dependency cleanup, reference cleanup, and at least one false-positive guard case (substring/URL should remain).
- [x] #6 Manual/archive action behavior remains unchanged from user perspective except expected cleanup side effects.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated archive flow to mirror upstream sanitization semantics. After moving a task to archive/tasks, BacklogWriter now scans active tasks (tasks/ only) and removes the archived task ID from dependencies and exact task-ID references using case-insensitive exact matching. Non-exact references (URLs/paths/substrings like TASK-20) are preserved. Sanitized changes are persisted via existing updateTask write flow so frontmatter/body formatting behavior remains consistent. Added unit tests covering dependency cleanup, reference cleanup, false-positive guards, and active-scope-only behavior.
<!-- SECTION:FINAL_SUMMARY:END -->
