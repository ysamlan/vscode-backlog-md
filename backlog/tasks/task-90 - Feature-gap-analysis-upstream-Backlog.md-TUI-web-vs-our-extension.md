---
id: TASK-90
title: 'Feature gap analysis: upstream Backlog.md TUI/web vs our extension'
status: To Do
assignee: []
created_date: '2026-02-06 02:48'
labels:
  - research
  - compatibility
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Conduct a comprehensive review of the upstream MrLesk/Backlog.md TUI and web interface to identify all features they support that our VS Code extension does not.

**Methodology:**
1. Fetch and review upstream source code from https://github.com/MrLesk/Backlog.md
2. Document every user-facing feature in their TUI (`src/tui/` or `src/ui/`)
3. Document every user-facing feature in their web UI (`src/web/`)
4. Document CLI commands and their capabilities (`src/cli.ts`)
5. Cross-reference each feature against our extension's current capabilities
6. Categorize gaps as: critical (blocks real usage), important (common workflows), nice-to-have

**Key areas to compare:**
- Task CRUD (create, read, update, delete)
- Task fields supported (all frontmatter fields)
- Views (board, list, detail)
- Filtering and sorting
- Search
- Drag-and-drop / status changes
- Subtask support (parent-child)
- Cross-branch task visibility
- Config options respected
- Milestone management
- Label management
- Keyboard navigation
- Bulk operations
- Import/export
- Any other features

**Upstream source structure:**
- `src/tui/` or `src/ui/` — Terminal UI components
- `src/web/` — Web UI (React-based)
- `src/cli.ts` — CLI commands
- `src/core/` — Core business logic
- `src/mcp/` — MCP server tools (these we get via MCP, but good to compare)

**Deliverable:** A prioritized feature gap list that can be used to create follow-up tasks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All TUI features documented and compared
- [ ] #2 All web UI features documented and compared
- [ ] #3 All CLI capabilities documented and compared
- [ ] #4 Gaps categorized by importance (critical, important, nice-to-have)
- [ ] #5 Findings documented in a backlog document for reference
<!-- AC:END -->
