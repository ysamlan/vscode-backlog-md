---
id: TASK-59
title: Support Backlog.md advanced configuration options
status: Done
assignee: []
created_date: '2026-02-03 14:53'
updated_date: '2026-02-07 14:49'
labels:
  - 'epic:foundation'
  - research
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The VS Code extension currently reads task markdown files directly, but Backlog.md has advanced configuration options that may require integration with the CLI binary:

**Cross-branch features (complex):**
- `checkActiveBranches` - View/track tasks across multiple git branches
- `remoteOperations` - Sync with remote repositories
- `activeBranchDays` - Control branch activity window

**Git workflow features:**
- `autoCommit` - Auto-commit when tasks are modified via extension
- `bypassGitHooks` - Skip hooks for automated commits

**Config reading:**
- Read `backlog.config.yaml` or equivalent config file
- Respect user's configuration choices

**Approach options to investigate:**
1. **Shell out to Backlog CLI** - Call `backlog` binary for operations that need cross-branch/remote access
2. **Use Backlog MCP server** - Connect to the MCP server that's already running
3. **Reimplement in extension** - Use git libraries (simple-git, isomorphic-git) to replicate logic
4. **Hybrid** - Read local files directly, shell out for complex operations

Need to determine:
- Which features are most valuable for the VS Code experience
- Performance implications of each approach
- Whether Backlog.md exposes a programmatic API we can use
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Research Backlog.md config file format and location
- [ ] #2 Decide on integration approach (CLI, MCP, reimpl, hybrid)
- [ ] #3 Read and parse backlog config if present
- [ ] #4 Display config-aware behavior (e.g., respect zeroPaddedIds)
- [ ] #5 Implement at least one cross-branch feature OR document why not feasible
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented full config-awareness for the extension. All parsed config fields now influence behavior:

**Step 1: zero_padded_ids** - Changed type from `boolean` to `number`. Added backward-compat normalization (`true` → `3`, `false` → `undefined`). Task IDs and filenames are now zero-padded (e.g., `TASK-001`).

**Step 2: task_prefix** - Fully respected in filenames (`proj-1 - Title.md`), ID scanning (`new RegExp(prefix-\\d+)`), and parser filename extraction (generic `[a-zA-Z]+-\\d+` pattern).

**Step 3: Config defaults** - `default_status`, `default_assignee`, `default_reporter` applied to new tasks and subtasks. `definition_of_done` items generate a DoD section in new task bodies. `promoteDraft()` uses `default_status` instead of hardcoded `'To Do'`.

**Step 4: project_name display** - Added `configUpdated` message type. Provider sends project name on refresh. Dashboard shows it as a header.

**Step 5: Cross-branch activation** - `dataSourceMode` is set to `'cross-branch'` when `check_active_branches: true` in config, activating the already-implemented cross-branch code path.

All 463 unit tests pass. No lint errors, no type errors. Extension builds successfully.
<!-- SECTION:FINAL_SUMMARY:END -->
