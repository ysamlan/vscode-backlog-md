---
id: TASK-75
title: 'Research: Port cross-branch logic from upstream Backlog.md'
status: Done
assignee: []
created_date: '2026-02-04 18:47'
updated_date: '2026-02-04 19:18'
labels:
  - research
  - architecture
  - git
dependencies:
  - TASK-73
references:
  - >-
    https://github.com/MrLesk/Backlog.md/blob/main/src/core/cross-branch-tasks.ts
  - 'https://github.com/MrLesk/Backlog.md/blob/main/src/git/operations.ts'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

Currently we rely on the `backlog` CLI binary for cross-branch task functionality. As an alternative, we could port the relevant git/branch-handling logic directly from the upstream Backlog.md repository.

## Pros of Porting
- No external binary dependency for users
- Full control over behavior and customization
- Better integration with VS Code's git APIs
- Potentially simpler installation/setup for users

## Cons of Porting
- More code to maintain
- Need to keep in sync with upstream changes
- Increased complexity in extension codebase

## Research Questions
1. Can we isolate the cross-branch logic into a submodule or separate package?
2. What's the feasibility of using VS Code's built-in git extension APIs instead of spawning git commands?
3. Should we use `simple-git` or `isomorphic-git` as a middle ground?
4. How much of the upstream code would need to be ported?

## Upstream Reference Files
- `src/core/cross-branch-tasks.ts` - Main cross-branch state resolution logic
- `src/git/operations.ts` - Git operation layer
- `src/utils/task-sorting.ts` - Task sorting utilities

## Potential Approaches
1. **Git Submodule**: Add upstream as submodule, import TypeScript directly
2. **Vendored Copy**: Copy relevant files into `src/vendor/backlog-md/`
3. **NPM Package**: If upstream publishes core logic as package, use that
4. **Rewrite**: Implement from scratch using VS Code git APIs

## Next Steps
- Review upstream license compatibility
- Evaluate VS Code git extension APIs for branch operations
- Prototype minimal cross-branch detection with simple-git
- Estimate effort for each approach
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Document pros/cons of each approach (submodule, vendor, npm, rewrite)
- [x] #2 Evaluate VS Code git extension APIs for branch operations
- [x] #3 Prototype minimal cross-branch detection
- [x] #4 Make recommendation for best approach
- [x] #5 Estimate effort for recommended approach
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Test Infrastructure Available

The `CrossBranchIntegration.test.ts` file includes a reusable pattern for testing cross-branch functionality:

```typescript
// Creates temp git repo with:
// - Main branch with TASK-1
// - feature/new-feature branch with TASK-2  
// - old-feature branch with TASK-3 (backdated 60 days)
```

### Key patterns to reuse:
- `fs.mkdtempSync()` for temp directory
- Helper functions: `git()` wrapper, `createTask()` for task files
- `git for-each-ref` for branch date filtering
- `git show branch:path` for reading files from other branches
- `git ls-tree` for listing files on other branches
- Backdated commits with `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE` env vars

### Tests already written:
- Branch age filtering (activeBranchDays)
- Task resolution strategies (most_recent, most_progressed)
- Same task different status across branches

When implementing native cross-branch support, extend these tests rather than starting from scratch.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Implementation Summary

Successfully implemented native cross-branch task support without requiring the external Backlog.md CLI binary.

### New Components Created

**GitBranchService** (`src/core/GitBranchService.ts`)
- Provides git operations via `child_process.execSync`
- Key methods: `listLocalBranches()`, `listRecentBranches()`, `readFileFromBranch()`, `listFilesInPath()`, `getFileLastModified()`
- No external dependencies - uses raw git commands

**CrossBranchTaskLoader** (`src/core/CrossBranchTaskLoader.ts`)
- Loads and merges tasks from multiple branches
- Implements two resolution strategies: `most_recent` and `most_progressed`
- Adds `source` and `branch` metadata to tasks
- Respects `active_branch_days` config for branch filtering

### Modified Components

- **BacklogParser**: Added `getTasksWithCrossBranch()` method
- **TasksViewProvider**: Uses cross-branch loading when mode is 'cross-branch'
- **extension.ts**: Simplified to use native support instead of CLI detection

### Test Coverage

- **GitBranchService.test.ts**: 25 tests using temp git repos
- **CrossBranchTaskLoader.test.ts**: 11 tests including conflict resolution scenarios

### Key Features

- Graceful fallback to local-only on any git errors
- Branch prioritization: current branch > main/master > others by date
- Configurable via existing `check_active_branches`, `active_branch_days`, and `task_resolution_strategy` options
<!-- SECTION:FINAL_SUMMARY:END -->
