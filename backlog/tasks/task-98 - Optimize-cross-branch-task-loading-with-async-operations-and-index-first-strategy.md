---
id: TASK-98
title: >-
  Optimize cross-branch task loading with async operations and index-first
  strategy
status: To Do
assignee: []
created_date: '2026-02-07 13:37'
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
