---
id: TASK-93
title: Add "more fields" collapsible section and settings screen for field visibility
status: To Do
assignee: []
created_date: '2026-02-06 03:22'
labels:
  - feature
  - ux
dependencies: []
references:
  - src/webview/components/task-detail/MetaSection.svelte
  - src/webview/components/task-detail/TaskDetail.svelte
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Summary

The task detail view currently shows all metadata fields (labels, assignees, milestone, dependencies, blocks) in a flat grid. Some fields are rarely used and should be tucked into an expandable "More Fields" section to reduce visual clutter.

## What to implement

### 1. "More Fields" collapsible section in task detail
- Move less-common fields into a collapsible "More Fields" section in MetaSection
- Candidate fields for "more fields": milestone, dependencies, blocks, assignees (configurable)
- The section should have a disclosure triangle / chevron toggle
- Expand/collapse state should persist (via vscode global state or webview state)

### 2. Settings screen
- Add a settings/preferences view accessible from the extension (gear icon or command palette)
- Setting: which fields appear in "primary" vs "more fields" sections
- Setting: whether "more fields" is expanded or collapsed by default
- Store preferences in VS Code extension settings (`contributes.configuration` in package.json) so they sync across machines
- Could be a simple webview or use VS Code's native settings UI via `contributes.configuration`

### Design notes
- Default: labels and status are always primary; milestone, deps, blocks, assignees in "more fields"
- "More fields" collapsed by default
- Users who use all fields heavily can set it to expanded by default in settings
- Consider using VS Code's native `contributes.configuration` for simplicity (no custom settings webview needed initially)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Task detail has a collapsible 'More Fields' section for secondary metadata
- [ ] #2 Expand/collapse state persists across task views
- [ ] #3 VS Code setting controls whether 'More Fields' is expanded or collapsed by default
- [ ] #4 Primary fields (labels, status) always visible without expanding
<!-- AC:END -->
