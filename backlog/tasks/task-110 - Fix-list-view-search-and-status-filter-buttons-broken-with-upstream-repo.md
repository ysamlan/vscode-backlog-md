---
id: TASK-110
title: Fix list view search and status filter buttons broken with upstream repo
status: To Do
priority: high
created_date: 2026-02-08
labels: [bug, list-view]
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When loading the upstream MrLesk Backlog.md repo (~67 active tasks, `task_prefix: "back"`, `check_active_branches: true`), the list view's search bar and status filter buttons do not work. No errors are logged in the console. The same features work correctly in our test project.

**Symptoms:**
- Typing in the search bar does not filter the task list
- Clicking status filter buttons (To Do, In Progress, Done) does not filter tasks
- No console errors are produced

**Investigation findings:**

The filter logic in `ListView.svelte` (lines 98-112) uses a hardcoded switch statement mapping filter keys like `'todo'` to `t.status === 'To Do'`. The filter buttons (lines 405-453) are also hardcoded HTML rather than generated from the `statuses` prop. The status sort order (line 147) is similarly hardcoded.

While the upstream repo happens to use the same three default statuses, the issue may be related to:
1. A reactivity problem with the filter state not propagating to the derived filtered list when the task set is large
2. Cross-branch loaded tasks having different data shapes or status values
3. The `currentFilter` state not being properly bound between the filter buttons and the filtering logic
4. Some interaction between the `activeTab` state and filter state when switching views

**Key files:**
- `src/webview/components/list/ListView.svelte` — filter logic (lines 98-112), filter buttons (lines 405-453), sort order (line 147)
- `src/webview/components/tasks/Tasks.svelte` — state management and message handler for filters

**Repro steps:**
1. Clone the upstream repo: `git clone https://github.com/MrLesk/Backlog.md.git`
2. Open it in VS Code with the extension installed
3. Switch to list view
4. Try typing in search or clicking filter buttons — nothing happens
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [ ] #1 Search bar filters tasks by title and description in real time
- [ ] #2 Status filter buttons correctly filter the task list
- [ ] #3 Works with upstream MrLesk repo (67+ tasks, custom prefix)
- [ ] #4 Works with cross-branch loaded tasks
- [ ] #5 No regressions in the test project
<!-- AC:END -->
