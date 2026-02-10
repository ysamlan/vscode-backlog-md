---
id: TASK-84
title: 'Add keyboard shortcuts help popup (? key, Gmail-style)'
status: Done
assignee: []
created_date: '2026-02-06 02:12'
updated_date: '2026-02-06 17:57'
labels:
  - ui
  - ux
  - documentation
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a visible "?" indicator in the webview that, when clicked or when the user presses "?", shows a temporary overlay/popup listing all keyboard shortcuts — similar to Gmail's keyboard shortcuts dialog.

**Popup content should include:**
- Navigation: switching between Kanban/List/Drafts/Archived tabs
- Task actions: open task, create task, etc.
- View actions: search, filter, etc.
- Any other registered keybindings

**UI design:**
- Small "?" icon/button in the bottom-right corner of the webview (or in the tab bar)
- Pressing "?" key opens the popup
- Popup is a modal overlay with a clean grid layout of shortcut → description
- Clicking outside or pressing Escape/? again closes it
- Subtle fade-in/out animation

**Also update README.md** with a keyboard shortcuts section documenting all available shortcuts.

**Files:** src/webview/components/shared/KeyboardShortcuts.svelte (new), src/webview/components/tasks/Tasks.svelte, README.md
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Pressing ? key opens shortcuts popup in webview
- [ ] #2 Visible ? icon/button that also opens the popup on click
- [ ] #3 Popup lists all keyboard shortcuts with descriptions
- [ ] #4 Popup closes on Escape, clicking outside, or pressing ? again
- [ ] #5 README.md includes keyboard shortcuts section
- [ ] #6 Shortcuts popup works in all view modes (kanban, list, drafts, archived)
<!-- AC:END -->
