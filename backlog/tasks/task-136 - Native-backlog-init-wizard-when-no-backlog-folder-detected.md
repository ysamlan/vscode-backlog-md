---
id: TASK-136
title: Native backlog init wizard when no backlog folder detected
status: Done
assignee: []
created_date: '2026-02-10 03:35'
updated_date: '2026-02-10 15:52'
labels:
  - feature
  - ux
  - upstream-parity
dependencies: []
references:
  - src/webview/components/tasks/Tasks.svelte
  - src/providers/BaseViewProvider.ts
  - src/providers/TasksViewProvider.ts
  - src/core/types.ts
documentation:
  - /workspace/tmp/mrlesk-Backlog.md-src/src/core/init.ts
  - /workspace/tmp/mrlesk-Backlog.md-src/src/file-system/operations.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a workspace has no `backlog/` folder, our extension currently shows a static "No Backlog Found" empty state. We should offer to initialize a new backlog project directly from the extension, matching upstream's `backlog init` wizard functionality.

**Current state:**
- `BaseViewProvider` and `TasksViewProvider` send `noBacklogFolder` message
- `Tasks.svelte` shows an empty state with a folder icon and "No Backlog Found" heading
- User must go to terminal and run `backlog init` manually

**Goal:**
Replace the empty state with an "Initialize Backlog" button/wizard that creates the backlog folder structure and `config.yml` without requiring the CLI.

**Upstream `backlog init` wizard steps to support:**

Essential (Phase 1 — minimum for VS Code init):
1. **Project name** — text input, default to workspace folder name
2. **Task prefix** — text input, default "task" (creates TASK-1, TASK-2, etc.)
3. **Statuses** — editable list, default `["To Do", "In Progress", "Done"]`

Nice-to-have (Phase 2 — advanced settings):
4. **Zero-padded IDs** — toggle + digit count (e.g., 3 → TASK-001)
5. **Labels** — comma-separated initial labels
6. **Milestones** — comma-separated initial milestones

**Skip for VS Code extension** (CLI/web-specific):
- AI integration mode (MCP vs CLI) — not relevant in extension context
- Agent instruction files (CLAUDE.md, AGENTS.md) — separate concern
- Shell completions — CLI only
- Web UI port / auto-open browser — CLI only
- Default editor — VS Code is the editor
- Cross-branch settings, remote operations, auto-commit, bypass git hooks — advanced config users can edit in config.yml directly

**What init needs to create:**
```
backlog/
├── config.yml
├── tasks/
├── drafts/
├── completed/
├── archive/
│   ├── tasks/
│   ├── drafts/
│   └── milestones/
├── docs/
├── decisions/
└── milestones/
```

**config.yml format** (from upstream):
```yaml
project_name: 'My Project'
statuses: ['To Do', 'In Progress', 'Done']
default_status: 'To Do'
labels: []
milestones: []
date_format: 'yyyy-mm-dd'
max_column_width: 20
task_prefix: 'task'
```

**UX approach options (decide during implementation):**

Option A — Inline wizard in the webview empty state:
- Replace "No Backlog Found" with a step-by-step form inside the existing webview
- Feels native, no context switching
- Send a `requestInit` message to the extension host with the config values

Option B — VS Code input boxes (quickpick/inputbox API):
- Use `vscode.window.showInputBox` and `vscode.window.showQuickPick` for each step
- Consistent with VS Code UX patterns
- Triggered by a button in the empty state or a command palette entry

Option C — Hybrid:
- Simple "Initialize with defaults" button in empty state for quick start
- "Customize..." button opens the VS Code quickpick wizard for advanced options
- Best of both worlds — fast path + customization

**After init:**
- Extension should detect the new `backlog/` folder via the file watcher
- Parser re-initializes automatically
- Views update from empty state to the normal task views
- Optionally offer to create a first task

**Also register a command:**
- `backlog.init` command in the command palette so users can trigger init even without the sidebar open
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Empty state shows an Initialize Backlog button/action instead of just a static message
- [ ] #2 Project name input with sensible default (workspace folder name)
- [ ] #3 Task prefix input with default 'task'
- [ ] #4 Status list configuration with default ['To Do', 'In Progress', 'Done']
- [ ] #5 Creates correct directory structure (tasks/, drafts/, completed/, archive/*, docs/, decisions/, milestones/)
- [ ] #6 Generates valid config.yml matching upstream format
- [ ] #7 Extension automatically detects new backlog folder and refreshes views after init
- [ ] #8 backlog.init command registered in command palette
- [ ] #9 Re-running init on existing project is blocked or warns (no accidental overwrite)
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the native Backlog Init Wizard feature with all planned components:

**New files:**
- `src/core/initBacklog.ts` — Pure init logic with `generateConfigYml()`, `initializeBacklog()`, and `validateTaskPrefix()` functions
- `src/test/unit/initBacklog.test.ts` — 11 unit tests covering config generation, directory creation, validation, and error cases

**Modified files:**
- `src/core/types.ts` — Added `initBacklog` message type to `WebviewMessage` union
- `src/providers/BaseViewProvider.ts` — Made `parser` mutable, added `setParser()` method
- `src/providers/TaskDetailProvider.ts` — Same pattern: mutable parser + `setParser()`
- `src/providers/ContentDetailProvider.ts` — Same pattern: mutable parser + `setParser()`
- `src/providers/TasksViewProvider.ts` — Added `initBacklog` message handler that delegates to `backlog.init` command
- `src/webview/components/tasks/Tasks.svelte` — Replaced static empty state with "Initialize with Defaults" (primary) and "Customize..." (secondary) buttons
- `src/webview/styles.css` — Added `.init-actions`, `.init-button.primary`, `.init-button.secondary`, `.init-hint` styles
- `src/extension.ts` — Registered `backlog.init` command with defaults/customize flows, reinitialize logic that creates parser + file watcher + updates all providers
- `package.json` — Added `backlog.init` command and `onCommand:backlog.init` activation event

All 666 tests pass, lint clean, typecheck clean.
<!-- SECTION:FINAL_SUMMARY:END -->
