---
id: TASK-11
title: Handle multi-root workspaces
status: To Do
assignee: []
created_date: '2026-02-02 23:21'
updated_date: '2026-02-10 16:23'
labels:
  - 'epic:file-watching'
  - 'phase:3'
milestone: MVP Release
dependencies: []
documentation:
  - /workspace/tmp/vscode-beads/src/backend/BeadsProjectManager.ts
  - /workspace/tmp/vscode-beads/src/extension.ts
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Support VS Code multi-root workspaces by detecting `backlog/` in any workspace folder and introducing an explicit active-backlog selection model.

Recommended approach (based on `vscode-beads` behavior):
- Discover candidate backlog roots across all workspace folders.
- If exactly one backlog is found, auto-select it.
- If multiple are found, keep an active selection and expose a quick picker so the user can switch.
- Persist active selection in workspace state and restore it on reload when still valid.
- Refresh discovery when workspace folders change and gracefully recover if the selected folder disappears.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Discover backlog roots across all current VS Code workspace folders (not just the first folder).
- [ ] #2 When exactly one backlog root exists, it is selected automatically without prompting.
- [ ] #3 When multiple backlog roots exist, users can select/switch the active backlog via a command + Quick Pick UI showing folder name/path context.
- [ ] #4 Active backlog selection is persisted in workspace state and restored on reload when still present.
- [ ] #5 When workspace folders change, backlog roots are re-discovered; if the active backlog is removed, the extension falls back predictably (next available or explicit prompt).
- [ ] #6 All core views/providers use the active backlog root consistently for parsing, watching, and commands.
<!-- AC:END -->
