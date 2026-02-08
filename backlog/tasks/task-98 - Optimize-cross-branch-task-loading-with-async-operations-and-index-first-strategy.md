---
id: TASK-98
title: >-
  Optimize cross-branch task loading with async operations and index-first
  strategy
status: Done
assignee: []
created_date: '2026-02-07 13:37'
updated_date: '2026-02-08 00:52'
labels:
  - performance
  - git
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The current cross-branch task loading implementation in GitBranchService and CrossBranchTaskLoader uses synchronous `execSync` calls and fetches full file content for every task on every branch. The upstream Backlog.md implementation is significantly more optimized:

**Current issues:**
- Uses `execSync` (blocking) for all git operations
- Fetches full task content from every file on every branch (expensive)
- No progress indication during loading
- No bounded concurrency

**Upstream optimizations to adopt:**
1. **Async git operations** - Replace `execSync` with async `execFile` to avoid blocking the extension host
2. **Index-first, hydrate-later pattern** - Build a cheap file index first (just filenames + modification timestamps), then only fetch full content for tasks that are actually needed (newer or more progressed than local copies)
3. **Batch modification time collection** - Get all timestamps in one git operation per branch instead of one per file
4. **Bounded concurrency** - Limit parallel git operations (upstream uses 4 for indexing, 8 for hydration)
5. **Remote branch support** - Add `git fetch` + remote branch listing when `remote_operations` config is true

**Reference implementation:** `/workspace/tmp/mrlesk-Backlog.md-src/` - look at the cross-branch loading logic there.

**Key files to modify:**
- `src/core/GitBranchService.ts` - Replace execSync with async operations
- `src/core/CrossBranchTaskLoader.ts` - Implement index-first pattern
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rewrote cross-branch task loading to use async git operations and an index-first strategy.\n\n**Changes:**\n\n1. **GitBranchService** (`src/core/GitBranchService.ts`): Replaced all `execSync` calls with async `execFile` via `promisify`. Uses args array (no shell) for safety. Added `getFileModifiedMap()` for batch timestamp collection in a single `git log` call per branch.\n\n2. **CrossBranchTaskLoader** (`src/core/CrossBranchTaskLoader.ts`): Rewrote with 4-phase index-first approach:\n   - Phase 0: Load current branch tasks from disk + batch git timestamps\n   - Phase 1: Build cheap index for other branches (file list + timestamps only, no content reads) in parallel batches of 5\n   - Phase 2: Filter — only hydrate tasks that are new or newer than local copies\n   - Phase 3: Read full content only for needed entries in parallel batches of 8\n   - Phase 4: Merge with conflict resolution\n\n3. **BacklogParser** (`src/core/BacklogParser.ts`): Updated `isGitRepository()` call to await the now-async method.\n\n4. **Tests**: Updated all tests to async API. Added new tests for `getFileModifiedMap` batch operation, index-first skip behavior, and single-branch fast path.\n\n**Result:** All 468 tests pass, zero lint errors, zero type errors.
<!-- SECTION:FINAL_SUMMARY:END -->
