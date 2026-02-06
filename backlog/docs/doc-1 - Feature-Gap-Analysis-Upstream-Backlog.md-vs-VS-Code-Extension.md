---
id: doc-1
title: 'Feature Gap Analysis: Upstream Backlog.md vs VS Code Extension'
type: other
created_date: '2026-02-06 18:09'
---
# Feature Gap Analysis: Upstream Backlog.md vs VS Code Extension

Comparison of upstream MrLesk/Backlog.md (TUI + web UI + CLI) against the vscode-backlog-md extension.

**Date**: 2026-02-06
**Source**: `/workspace/tmp/mrlesk-Backlog.md-src/`

---

## Summary

| Category | Upstream | Extension | Gap Count |
|----------|----------|-----------|-----------|
| Task CRUD | Full | Full | 0 |
| Views (Board/List/Detail) | Full | Full | 0 |
| Drag-and-drop reorder | Yes | Yes | 0 |
| Status management | Full | Full | 0 |
| Filtering & sorting | Full | Partial | 1 |
| Search | Global fuzzy | List view only | 1 |
| Subtask support | Full | Read-only | 1 |
| Cross-branch tasks | Full | Read-only | 0 |
| Documents (docs/) | Full CRUD | None | 1 |
| Decisions (decisions/) | Full CRUD | None | 1 |
| Milestone management | Full UI | Read-only | 1 |
| Bulk operations | Yes | None | 1 |
| Export | CSV/JSON/MD | None | 1 |
| Config/settings UI | Yes | None | 1 |
| Project initialization | Yes (wizard) | None | 1 |
| Sequence planning | Full | None | 1 |
| Draft promotion/demotion | Full | Promote only | 1 |
| Dependency visualization | Graph | None | 1 |
| Status change callbacks | Yes | None | 1 |
| Mermaid rendering | Yes | None | 1 |
| Statistics/burndown | Rich | Basic dashboard | 1 |

---

## Detailed Gap Analysis

### Critical Gaps (blocks real usage)

**None.** Core CRUD, views, status management, drag-and-drop, and filtering all work. The extension is usable for day-to-day task management.

---

### Important Gaps (common workflows)

#### 1. Document Browsing/Editing
- **Upstream**: Full CRUD for `backlog/docs/` folder via web UI and CLI. Supports subdirectories, document types (readme, guide, specification, other), tags.
- **Extension**: No document support at all.
- **Impact**: Users managing project documentation alongside tasks must use CLI.
- **Related task**: TASK-92

#### 2. Decision Record Browsing/Editing
- **Upstream**: Full CRUD for `backlog/decisions/` folder. Structured body sections (Context, Decision, Consequences, Alternatives). Status lifecycle (proposed → accepted/rejected/superseded).
- **Extension**: No decision support at all.
- **Impact**: Decision log is invisible in VS Code.
- **Related task**: TASK-92 (covers both docs and decisions)

#### 3. Milestone Management UI
- **Upstream**: Dedicated milestones page with progress bars, add/rename/archive actions. Milestone files in `backlog/milestones/` with descriptions.
- **Extension**: Milestones shown read-only in dashboard stats and as a filter dropdown. No create/edit/archive/progress view.
- **Impact**: Users can't manage milestones without CLI.

#### 4. Sequence/Execution Order Management
- **Upstream**: Full sequence planning UI in both TUI and web. Tasks can be arranged into dependency chains (sequences). `moveTaskInSequences` and `listActiveSequences` APIs.
- **Extension**: Ordinal-based drag-and-drop reordering within status columns, but no sequence concept.
- **Impact**: Teams using sequence planning can't visualize or edit sequences in VS Code.

#### 5. Global Search
- **Upstream**: Full-text fuzzy search across all tasks with filters (status, assignee, priority, labels). Paginated results.
- **Extension**: Search available in list view only (filters title/description). No search in kanban view or across task detail.
- **Impact**: Finding tasks requires switching to list view.

#### 6. Bulk Operations
- **Upstream**: Bulk status changes, bulk label updates from board view.
- **Extension**: No multi-select or bulk actions.
- **Impact**: Changing status of many tasks requires one-by-one clicks.

#### 7. Export
- **Upstream**: CSV, JSON, and markdown export from board view.
- **Extension**: No export functionality.
- **Impact**: Users needing reports must use CLI.

#### 8. Settings/Config UI
- **Upstream**: Web UI settings page for editing `config.yml` — statuses, labels, milestones, project name, all options.
- **Extension**: No settings UI. Config must be edited manually.
- **Impact**: New users may not know about config.yml.
- **Related task**: TASK-93 (partially covers this)

#### 9. Project Initialization
- **Upstream**: `backlog init` CLI wizard creates folder structure, config.yml with defaults.
- **Extension**: Shows error state ("No backlog folder found") but no way to create one.
- **Impact**: New projects require CLI to set up backlog structure.

#### 10. Task Demotion (Task → Draft)
- **Upstream**: Full support for demoting tasks back to drafts (new DRAFT-N ID, moved to drafts/).
- **Extension**: Only supports draft promotion (draft → task). No demotion action.
- **Impact**: Minor — demotion is less common than promotion.

---

### Nice-to-Have Gaps

#### 11. Dependency Chain Visualization
- **Upstream**: Visual dependency graphs showing task relationships.
- **Extension**: Dependencies shown as text list in task detail.
- **Impact**: Complex dependency chains hard to understand.

#### 12. Mermaid Diagram Rendering
- **Upstream**: Renders mermaid diagrams in task descriptions.
- **Extension**: Mermaid blocks shown as raw code.
- **Impact**: Cosmetic — users can use VS Code mermaid extensions separately.

#### 13. Status Change Callbacks
- **Upstream**: Fires `onStatusChange` hooks (global and per-task) when status changes.
- **Extension**: Ignores `onStatusChange` field entirely.
- **Impact**: Automation workflows (e.g., notify on status change) don't trigger from VS Code.

#### 14. Statistics/Burndown
- **Upstream**: Rich statistics module with detailed breakdowns.
- **Extension**: Basic dashboard with status/priority counts and milestone progress.
- **Impact**: Teams wanting detailed metrics must use upstream tools.

#### 15. Theme Toggle
- **Upstream**: Web UI has dark/light theme switcher.
- **Extension**: Inherits VS Code theme automatically.
- **Impact**: None — VS Code handles this natively. Not a real gap.

#### 16. Cross-Branch Conflict Resolution UI
- **Upstream**: UI for resolving conflicts when same task modified on multiple branches.
- **Extension**: Loads cross-branch tasks read-only, no conflict resolution.
- **Impact**: Rare scenario for most users.

#### 17. Subtask Creation/Management
- **Upstream**: Create subtasks with dot notation IDs (TASK-5.1, TASK-5.2), parent/child linking.
- **Extension**: Shows parent_task_id and subtasks fields read-only. No create subtask action.
- **Impact**: Users managing subtasks must use CLI.

#### 18. Agent Installation
- **Upstream**: `backlog agents install` command for AI agent config files.
- **Extension**: Not applicable for VS Code extension context.
- **Impact**: None.

---

## Prioritized Roadmap Suggestion

| Priority | Gap | Effort | Existing Task |
|----------|-----|--------|---------------|
| P1 | Document & decision browsing | Medium | TASK-92 |
| P1 | Project initialization wizard | Low | — |
| P1 | Settings/config UI | Medium | TASK-93 |
| P2 | Milestone management UI | Medium | — |
| P2 | Global search across views | Low | — |
| P2 | Task demotion action | Low | — |
| P2 | Bulk operations | Medium | — |
| P3 | Sequence planning UI | High | — |
| P3 | Export functionality | Low | — |
| P3 | Status change callbacks | Low | — |
| P3 | Subtask creation | Medium | — |
| P4 | Dependency visualization | High | — |
| P4 | Mermaid rendering | Medium | — |
| P4 | Statistics/burndown | Medium | — |

---

## Features at Parity (No Gap)

These features are fully implemented in the extension:

- **Task CRUD**: Create, read, update, delete tasks
- **Draft management**: Create drafts, promote to tasks
- **Board view (Kanban)**: Drag-and-drop between status columns
- **List view**: Sortable, filterable table of tasks
- **Task detail view**: Full field editing (all frontmatter fields)
- **Status management**: Change status via dropdown or drag-and-drop
- **Priority management**: Set/change priority
- **Label management**: Add/remove labels on tasks
- **Filtering**: By status, priority, milestone, assignee, labels
- **Sorting**: By various fields in list view
- **Ordinal reordering**: Drag-and-drop within status columns
- **Cross-branch task display**: Read-only tasks from other branches
- **Dashboard**: Status/priority/milestone stats overview
- **Acceptance criteria**: View and toggle checklist items
- **Definition of Done**: View and toggle checklist items
- **File watching**: Auto-refresh on file system changes
