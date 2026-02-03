---
id: TASK-59
title: Support Backlog.md advanced configuration options
status: To Do
assignee: []
created_date: '2026-02-03 14:53'
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
