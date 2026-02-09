---
id: TASK-94
title: Add customizable keyboard shortcuts with settings screen
status: To Do
assignee:
  - '@openai-5.3-codex'
created_date: '2026-02-06'
updated_date: '2026-02-09 21:47'
labels:
  - ui
  - ux
  - settings
dependencies:
  - TASK-84
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the ability for users to customize keyboard shortcuts via a settings screen within the extension.

**Current state:**
- Keyboard shortcuts are hardcoded in Tasks.svelte's global keydown handler
- Shortcuts popup (KeyboardShortcutsPopup.svelte) displays static shortcut definitions
- No settings UI or configuration storage exists

**Settings screen requirements:**
- New "Settings" tab or gear icon accessible from the webview
- Section for keyboard shortcut customization
- Each action shows its current keybinding with an editable field
- "Record shortcut" mode: click a field, press desired key combo, it captures the binding
- Conflict detection: warn if a key is already assigned to another action
- Reset to defaults button
- Settings persisted via VS Code globalState or workspace settings

**Keybinding storage format:**
```json
{
  "backlog.keybindings": {
    "kanbanView": "z",
    "listView": "x",
    "draftsView": "c",
    "archivedView": "v",
    "nextTask": "j",
    "prevTask": "k",
    "nextColumn": "l",
    "prevColumn": "h",
    "createTask": "n",
    "refresh": "r",
    "search": "/",
    "help": "?"
  }
}
```

**Implementation approach:**
- Create a KeybindingConfig type and default bindings constant
- Load bindings from globalState on mount, fall back to defaults
- Global keydown handler reads from config instead of hardcoded switch
- KeyboardShortcutsPopup reads from config to display current bindings
- Settings screen component for editing bindings
- TasksViewProvider handles persistence messages

**Files:** New settings component, Tasks.svelte, KeyboardShortcutsPopup.svelte, TasksViewProvider.ts, types.ts
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Settings screen accessible from webview UI
- [ ] #2 All keyboard shortcuts are customizable
- [ ] #3 Shortcut changes persist across sessions
- [ ] #4 Conflict detection warns about duplicate bindings
- [ ] #5 Reset to defaults restores original keybindings
- [ ] #6 Shortcuts popup reflects customized bindings
- [ ] #7 Unit tests for keybinding configuration loading and saving
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Design keybinding configuration model and default map for all supported actions.
2. Add settings UI to view/edit bindings, including record mode and duplicate-key conflict warnings.
3. Persist keybindings through extension state and load them in Tasks webview on initialization.
4. Refactor global keydown handling to consume configured bindings instead of hardcoded keys.
5. Update shortcuts help popup to render current configured bindings.
6. Add/adjust unit tests for load/save behavior and conflict detection, then run full validation (`bun run test && bun run lint && bun run typecheck`).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope correction on 2026-02-09: default shortcut/nav behavior changes were split out to a separate task; TASK-94 remains focused on configurable/customizable keyboard shortcuts via settings UI and persistence.
<!-- SECTION:NOTES:END -->
