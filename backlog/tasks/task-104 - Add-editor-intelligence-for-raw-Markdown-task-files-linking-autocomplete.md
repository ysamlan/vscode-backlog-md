---
id: TASK-104
title: 'Add editor intelligence for raw Markdown task files (linking, autocomplete)'
status: To Do
assignee: []
created_date: '2026-02-08 13:13'
labels:
  - feature
  - editor
  - dx
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add VS Code editor features that enhance the raw Markdown editing experience for backlog task files. When a user opens a task file (e.g. via "Open Raw Markdown"), they should get smart editor support.

**Desired features:**

1. **Task link autocomplete** — When typing a task ID prefix (e.g. `TASK-`), offer completions from all known task IDs with their titles. Useful in `dependencies`, `references`, description text, etc.

2. **Task link navigation** — Make task IDs (e.g. `TASK-42`, `DRAFT-3`) in the Markdown body clickable links that open the referenced task's detail view (or raw file).

3. **Status autocomplete** — When editing the `status:` frontmatter field, offer completions from the project's configured statuses (from `config.yml`).

4. **Priority autocomplete** — When editing the `priority:` field, suggest `high`, `medium`, `low`.

5. **Milestone/label autocomplete** — Suggest configured milestones and existing labels.

**Scoping to backlog files only (not all Markdown):**

The extension currently has NO language providers registered. To scope these features to only backlog task files and not arbitrary `.md` files, consider:

- **DocumentSelector approach**: Use a `DocumentSelector` with a file path pattern like `**/backlog/{tasks,drafts,completed,archive/tasks}/*.md`. VS Code `CompletionItemProvider` and `DocumentLinkProvider` accept a `DocumentSelector` that can filter by scheme, language, AND pattern. Example: `{ language: 'markdown', pattern: '**/backlog/{tasks,drafts,completed,archive}/**/*.md' }`.
- **Custom language ID**: Alternatively, register a custom language (e.g. `backlog-markdown`) via `package.json` `languages` contribution with a file glob pattern. This would let the extension register providers against that language ID. Downside: loses built-in Markdown language features unless the extension also activates the Markdown language for those files.
- **Runtime check**: In provider methods, check if the file path contains the backlog folder path before returning results. Simplest but least clean.

The `DocumentSelector` pattern approach is likely best — it keeps the file as `markdown` language (preserving syntax highlighting, preview, etc.) while scoping our providers to only backlog paths.

**Implementation considerations:**

- The extension already watches `backlog/**/*.md` via FileWatcher and parses all tasks via BacklogParser — the task list is already available in memory.
- Config statuses, labels, and milestones are already parsed from `config.yml`.
- The activation event is `workspaceContains:**/backlog/tasks/*.md`, so the extension will be active when these providers are needed.
- Task IDs follow the pattern `^([a-zA-Z]+-\d+(?:\.\d+)*)` (e.g. TASK-1, DRAFT-3, TASK-5.1).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Task ID autocomplete suggests known task IDs with titles when typing in frontmatter or body
- [ ] #2 Task ID references in Markdown body are clickable and navigate to the task
- [ ] #3 Status field autocomplete suggests configured statuses from config.yml
- [ ] #4 Priority field autocomplete suggests high/medium/low
- [ ] #5 Providers are scoped to backlog task files only — no interference with other Markdown files
- [ ] #6 Existing Markdown language features (syntax highlighting, preview) still work on task files
<!-- AC:END -->
