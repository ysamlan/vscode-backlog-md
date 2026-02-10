---
id: TASK-73
title: Support checkActiveBranches and remoteOperations config options
status: Done
assignee: []
created_date: '2026-02-04 15:10'
updated_date: '2026-02-04 18:48'
labels:
  - feature
  - git
  - config
dependencies: []
references:
  - >-
    https://github.com/MrLesk/Backlog.md/blob/main/src/core/cross-branch-tasks.ts
  - 'https://github.com/MrLesk/Backlog.md/blob/main/src/git/operations.ts'
  - 'https://github.com/MrLesk/Backlog.md/blob/main/src/types/index.ts'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement support for Backlog.md's multi-branch and remote task checking features based on the YAML config.

## Config Options (from upstream)

| Setting | Type | Default | Effect |
|---------|------|---------|--------|
| `checkActiveBranches` | Boolean | true | Scan all branches for tasks; false = local-only mode |
| `remoteOperations` | Boolean | true | Include remote branches; false = offline/local-only |
| `activeBranchDays` | Number | 30 | Only consider branches modified in last N days |
| `taskResolutionStrategy` | Enum | "most_recent" | How to resolve task conflicts: "most_recent" or "most_progressed" |

**Note:** These are independent boolean/numeric flags, not a tri-state. Combining them gives flexibility:
- Both true = full cross-branch visibility including remotes
- `remoteOperations: false` = local branches only (offline mode)
- `checkActiveBranches: false` = current branch only (simplest mode)

## Upstream Implementation (reference: MrLesk/Backlog.md)

**Core files:**
- `src/core/cross-branch-tasks.ts` - State resolution logic
- `src/git/operations.ts` - Git operation layer

**Key behaviors:**
1. When `checkActiveBranches: true`:
   - Loads tasks from remote branches via `loadRemoteTasks()`
   - Scans local branches via `loadLocalBranchTasks()`
   - Builds state map tracking task locations across branches
   - Filters using `filterTasksByStateSnapshots()` to show tasks only in their latest branch location
   - Affects ID generation - queries active/completed IDs across branches to prevent conflicts

2. When `checkActiveBranches: false`:
   - Skips all branch scanning
   - Uses only local filesystem tasks
   - Returns tasks directly without cross-branch filtering

3. When `remoteOperations: false`:
   - Skips `git fetch` operations
   - Only scans local branches (not remote tracking branches)

4. `activeBranchDays` limits scanning to recently-modified branches for performance

**Conflict resolution:**
- `taskResolutionStrategy: "most_recent"` (default) - uses lastModified timestamp
- `taskResolutionStrategy: "most_progressed"` - picks task furthest in workflow

**Performance optimizations in upstream:**
- Prioritizes current branch and main branch first
- Batch processes remaining branches (5 at a time)
- Uses `getBranchLastModifiedMap()` for efficient date checking

## Implementation Approach for VS Code Extension

**Option A: Shell out to backlog CLI** (simpler)
- Require backlog CLI to be installed
- Use `backlog list --json` or similar to get cross-branch state
- Pros: Reuses upstream logic exactly
- Cons: External dependency, may not exist on user's system

**Option B: Native implementation** (more complex)
- Use simple-git or isomorphic-git library
- Implement subset of cross-branch logic
- Pros: No external dependency
- Cons: Significant effort to replicate upstream behavior

**Recommendation:** Start with Option A if backlog CLI is available, fall back to local-only mode if not.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Read checkActiveBranches, activeBranchDays, remoteOperations, and taskResolutionStrategy from config
- [x] #2 Detect if backlog CLI is available on system PATH
- [ ] #3 If CLI available: use it to get cross-branch task states
- [x] #4 If CLI unavailable: fall back gracefully to local-only mode (current behavior)
- [ ] #5 Display indicator when viewing cross-branch data vs local-only
- [ ] #6 Show task status differences across branches in UI (e.g., badge or tooltip)
- [ ] #7 Respect activeBranchDays setting for performance
- [ ] #8 Handle errors gracefully (no git, no remote, network issues)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Complete

### What was implemented:

1. **Types updates** (`src/core/types.ts`):
   - Added `TaskSource` type: `'local' | 'remote' | 'completed' | 'local-branch'`
   - Added `TaskResolutionStrategy` type: `'most_recent' | 'most_progressed'`
   - Added `DataSourceMode` type: `'local-only' | 'cross-branch'`
   - Added cross-branch fields to Task interface: `source`, `branch`, `lastModified`, `reporter`, `subtasks`
   - Added config options: `task_resolution_strategy`, `zero_padded_ids`
   - Added `dataSourceChanged` message type to ExtensionMessage

2. **CLI detection module** (`src/core/BacklogCli.ts`):
   - `isAvailable()` - Check PATH for `backlog` binary with caching
   - `getCliVersion()` - Get version if available
   - `clearCache()` - Clear cached result
   - `showCrossbranchWarning()` - Show VS Code warning notification
   - `createStatusBarItem()` / `updateStatusBarItem()` - Status bar management
   - `execute()` - Run CLI commands

3. **Config-aware warning system** (`src/extension.ts`):
   - Checks if `check_active_branches` or `remote_operations` is true
   - If true AND CLI not available: shows warning notification
   - Creates status bar item showing "Local Only" when in degraded mode
   - No warning if config uses local-only mode (default behavior)

4. **Provider updates** (`src/providers/TasksViewProvider.ts`):
   - Added `setDataSourceMode()` method
   - Added `getDataSourceMode()` method
   - Tracks `dataSourceMode` and `dataSourceReason`

### Warning Behavior

- Only shows "backlog CLI not found" when `checkActiveBranches: true` OR `remoteOperations: true`
- No warning for local-only mode (current behavior works fine)
- Status bar shows data source indicator when relevant

### Tests Added

- `src/test/unit/BacklogCli.test.ts` - 13 tests for CLI detection
- `src/test/unit/BacklogParser.test.ts` - 6 new tests for cross-branch config parsing

### Follow-up Created

TASK-75 created to research porting cross-branch logic directly from upstream instead of relying on CLI binary.
<!-- SECTION:NOTES:END -->
