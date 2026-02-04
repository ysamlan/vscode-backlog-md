---
id: TASK-73
title: Support checkActiveBranches and remoteOperations config options
status: To Do
assignee: []
created_date: '2026-02-04 15:10'
labels:
  - feature
  - git
  - config
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement support for Backlog.md's multi-branch and remote task checking features based on the YAML config.

**Config options to support:**
- `checkActiveBranches` (default: true) - Check task states across active git branches
- `activeBranchDays` (default: 30) - Number of days a branch is considered "active"
- `remoteOperations` (default: true) - Enable checking remote branches/repositories

**Functionality:**
When enabled, the extension should be able to show task states from other branches, helping users see:
- Tasks that exist in other active branches but not the current one
- Tasks with different statuses across branches (e.g., "Done" in feature branch, "To Do" in main)
- Potential merge conflicts in task files

**Implementation considerations:**
- Read config from `backlog.config.yaml` or `backlog/config.yml`
- Use git commands or a git library (simple-git, isomorphic-git) to access other branches
- Consider performance - don't block UI while fetching cross-branch data
- May need to cache branch data and refresh periodically
- UI to toggle/filter cross-branch view

**Reference:**
- Upstream Backlog.md repo: https://github.com/MrLesk/Backlog.md
- Check `src/core/` for how upstream implements this feature
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Read checkActiveBranches, activeBranchDays, and remoteOperations from config file
- [ ] #2 List active branches based on activeBranchDays threshold
- [ ] #3 Fetch task files from other active branches without checkout
- [ ] #4 Display cross-branch task status differences in UI
- [ ] #5 Respect remoteOperations setting for remote branch access
- [ ] #6 Handle errors gracefully (missing git, no remote, etc.)
<!-- AC:END -->
