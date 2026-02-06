---
id: TASK-87
title: Audit config YAML parsing/writing test coverage
status: To Do
assignee: []
created_date: '2026-02-06 02:37'
labels:
  - testing
  - compatibility
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ensure our config YAML parser and writer have comprehensive test coverage for all configuration options supported by Backlog.md.

**Context:** TASK-73 implemented cross-branch config reading and TASK-49 fixed config.yml reading, but we need to verify test coverage is comprehensive for ALL config fields, not just the ones we actively use.

**Reference:** Check upstream `src/types/index.ts` (BacklogConfig type) and `src/file-system/operations.ts` at https://github.com/MrLesk/Backlog.md for the canonical config schema.

**Known config fields to verify:**
- `statuses` - Array of status strings (already used for Kanban columns)
- `priorities` - Array of priority strings
- `labels` - Array of label strings
- `check_active_branches` / `checkActiveBranches` - Boolean
- `remote_operations` / `remoteOperations` - Boolean
- `active_branch_days` / `activeBranchDays` - Number
- `task_resolution_strategy` / `taskResolutionStrategy` - Enum
- `zero_padded_ids` / `zeroPaddedIds` - Boolean
- `auto_commit` / `autoCommit` - Boolean
- `bypass_git_hooks` / `bypassGitHooks` - Boolean
- `id_prefix` / `idPrefix` - String (custom task ID prefix)
- `milestones` - Array of milestone objects
- Any other fields added upstream since we last checked

**What to check:**
1. Config parser reads each field correctly (both snake_case and camelCase variants)
2. Sample workspace has a config.yml with all fields populated
3. Unit tests cover parsing each config field
4. Unit tests cover edge cases (missing config, empty config, partial config)
5. Config types match upstream schema

**Related tasks:** TASK-59 (advanced config features), TASK-73 (cross-branch config), TASK-49 (config.yml reading)

**Sample workspace config location:** `src/test/e2e/fixtures/test-workspace/backlog/config.yml`
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every upstream config field has a corresponding TypeScript type
- [ ] #2 Config parser handles both snake_case and camelCase field names
- [ ] #3 Unit tests exist for parsing each config field
- [ ] #4 Unit tests cover edge cases (missing/empty/partial config)
- [ ] #5 Sample workspace config.yml includes all supported fields
- [ ] #6 Config types are verified against upstream BacklogConfig type
<!-- AC:END -->
