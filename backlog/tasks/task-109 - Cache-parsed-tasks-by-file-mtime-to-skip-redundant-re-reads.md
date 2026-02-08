---
id: TASK-109
title: Cache parsed tasks by file mtime to skip redundant re-reads
status: To Do
assignee: []
created_date: '2026-02-08 19:50'
labels:
  - performance
  - backend
dependencies:
  - TASK-39
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Apply the same mtime-based caching strategy used for config.yml to task file parsing. On each refresh, stat each .md file and only re-parse files whose mtime has changed since the last read. Return cached Task objects for unchanged files.

**Current behavior:** Every refresh calls `getTasksFromFolder()` which does `readdirSync` + `readFileSync` + YAML parse for every .md file, even if nothing changed. With 100 tasks, that's 200+ sync syscalls per refresh.

**Target behavior:** First refresh reads all files and caches `{ mtime, task }` per file path. Subsequent refreshes stat each file and only re-read/re-parse files with changed mtimes. Deleted files are evicted from cache. New files are parsed and cached.

**Implementation approach:**
- Add a `Map<string, { mtimeMs: number; task: Task }>` cache to BacklogParser
- In `getTasksFromFolder()`, after `readdirSync`, stat each file and compare mtime to cache
- Only call `readFileSync` + `parseTaskContent` for files with changed/new mtimes
- Evict cache entries for files no longer in the directory listing
- Add `invalidateTaskCache()` method for writers to call after mutations
- BacklogWriter should call `invalidateTaskCache()` (or invalidate specific files) after writes

**Testing:**
- Verify cache hit: second `getTasks()` call with same mtimes doesn't re-read files
- Verify cache miss: changed mtime triggers re-read
- Verify eviction: deleted file removed from cache
- Verify `invalidateTaskCache()` forces full re-read
- Ensure existing tests pass (mock `statSync` with default return value)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Second getTasks() call with unchanged files does zero readFileSync calls
- [ ] #2 Changed file mtime triggers re-read of only that file
- [ ] #3 Deleted files are evicted from cache
- [ ] #4 BacklogWriter invalidates cache after mutations
- [ ] #5 All existing tests pass
<!-- AC:END -->
