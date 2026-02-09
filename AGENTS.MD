<!-- BACKLOG.MD MCP GUIDELINES START -->

<CRITICAL_INSTRUCTION>

## BACKLOG WORKFLOW INSTRUCTIONS

This project uses Backlog.md MCP for all task and project management activities.

**CRITICAL GUIDANCE**

- If your client supports MCP resources, read `backlog://workflow/overview` to understand when and how to use Backlog for this project.
- If your client only supports tools or the above request fails, call `backlog.get_workflow_overview()` tool to load the tool-oriented overview (it lists the matching guide tools).

- **First time working here?** Read the overview resource IMMEDIATELY to learn the workflow
- **Already familiar?** You should have the overview cached ("## Backlog.md Overview (MCP)")
- **When to read it**: BEFORE creating tasks, or when you're unsure whether to track work

These guides cover:

- Decision framework for when to create tasks
- Search-first workflow to avoid duplicates
- Links to detailed guides for task creation, execution, and finalization
- MCP tools reference

You MUST read the overview resource to understand the complete workflow. The information is NOT summarized here.

</CRITICAL_INSTRUCTION>

<!-- BACKLOG.MD MCP GUIDELINES END -->

## Project: vscode-backlog-md

VS Code extension providing a beautiful UI for browsing and managing Backlog.md tasks.

### Development Workflow

**Test-Driven Development (TDD)**: Write tests BEFORE or alongside implementation, not after.

```
1. Mark task as In Progress
2. Write failing tests for the new functionality
3. Implement the feature to make tests pass
4. Run ALL tests (`bun run test`) to verify nothing broke
5. Run lint and typecheck
6. Commit with message referencing the task ID
7. Mark task as Done
8. Move to next task
```

**When TDD doesn't apply**:

- UI-only changes (webview HTML/CSS) - document why in commit
- Pure refactoring with existing test coverage
- Configuration changes

**CRITICAL**: Always run `bun run test && bun run lint && bun run typecheck` before marking a task as Done. Never skip this step.

**CRITICAL**: Always mark backlog tasks as Done (via `task_edit` MCP tool) BEFORE committing work or telling the user the task is complete. Do not defer until after the commit or assume it's enough to just mention it in the commit message.

**One commit per task**: When a backlog task is self-contained and testable, commit it individually before moving to the next task. This keeps the git history clean and makes it easier to review/revert changes.

**Commit message format**:

```
Short description of what was done

- Bullet points for details if needed
- Reference task ID

Completes TASK-XX.

Co-Authored-By: ${model}
```
(where ${model} is the contributing agent's model, like "Claude 4.5-Opus" or "OpenAI 5.3-Codex)

**Adding dependencies**: Always use `bun add` to add new packages rather than manually editing package.json. This ensures the latest version is installed and bun.lockb is updated correctly.

```bash
bun add <package>           # production dependency
bun add --dev <package>     # dev dependency
```

### Commands

- `bun run compile` - Build extension with esbuild
- `bun run compile:webview` - Build Svelte webview components
- `bun run watch` - Watch mode for development
- `bun run build` - Build CSS + webview + extension
- `bun run test` - Run unit tests (Vitest)
- `bun run test:playwright` - Run Playwright webview UI tests
- `bun run test:playwright:ui` - Open Playwright interactive UI mode
- `bun run test:e2e` - Run VS Code extension e2e tests
- `bun run lint` - ESLint check
- `bun run format` - Format with Prettier
- `bun run typecheck` - TypeScript type checking

### Testing Strategy

**Three-tier approach:**

1. **Unit tests** (`bun run test`) - Vitest with vscode API mocking for core logic
2. **Webview UI tests** (`bun run test:playwright`) - Playwright for webview interactions
3. **Extension e2e tests** (`bun run test:e2e`) - vscode-extension-tester for extension activation

**Webview testing pattern:**

- Webview HTML fixtures are served via Vite (`bun run webview:serve`)
- `acquireVsCodeApi()` is mocked to capture postMessage calls
- Tests verify UI interactions send correct messages to extension
- Test fixtures in `e2e/fixtures/` load compiled Svelte bundles

**When to use Playwright webview tests:**

Playwright tests (`bun run test:playwright`) are REQUIRED for:

- **Drag-and-drop interactions** - Unit tests cannot simulate HTML5 drag events
- **Multi-element user flows** - Clicking, hovering, keyboard navigation sequences
- **DOM-dependent behavior** - Where visual order, positioning, or layout affects logic
- **State transitions** - Verifying UI updates in response to interactions

Signs you need Playwright instead of (or in addition to) unit tests:

- The behavior involves `addEventListener` for user events
- You're testing "what message gets sent when user does X"
- The logic depends on DOM element order or coordinates
- You need to verify visual feedback (classes added, elements inserted)

**Test fixture pattern:**

- HTML fixtures load compiled Svelte bundles from `dist/webview/`
- VS Code mock helpers in `e2e/fixtures/vscode-mock.ts`
- Use `data-testid` attributes for reliable selectors

### Testing the Extension Manually

1. Run `bun run build` to compile everything
2. Press **F5** to launch Extension Development Host
3. Open a folder containing a `backlog/` directory with task files
4. Click the **Backlog** icon in the activity bar to see views

The extension activates when it detects `backlog/tasks/*.md` files.

### Architecture

- `src/extension.ts` - Extension entry point
- `src/core/` - Business logic (parser, writer, file watcher, types, ordinalUtils)
- `src/language/` - Language providers for raw Markdown editing (completions, links, hover)
- `src/providers/` - Webview providers (load Svelte bundles, handle messages)
- `src/webview/` - Svelte 5 components
  - `components/` - UI components (dashboard, kanban, list, task-detail, shared)
  - `entries/` - Webview entry points (tasks.ts, dashboard.ts, task-detail.ts)
  - `stores/` - VS Code API bridge (vscode.svelte.ts)
  - `lib/` - Shared types
- `src/test/` - Unit and integration tests
- `e2e/` - Playwright webview E2E tests

### Language Providers (Editor Intelligence)

The `src/language/` directory contains VS Code language providers that enhance raw Markdown editing for backlog task files. These are scoped via `BACKLOG_DOCUMENT_SELECTOR` to only match files inside `backlog/{tasks,drafts,completed,archive}/` — they do not interfere with other Markdown files or extensions.

- `documentSelector.ts` — Shared `DocumentSelector` constant used by all providers
- `frontmatterContext.ts` — Determines if a cursor position is inside YAML frontmatter and which field
- `BacklogCompletionProvider.ts` — Autocomplete for frontmatter fields and task ID references
- `BacklogDocumentLinkProvider.ts` — Clickable links for task ID references
- `BacklogHoverProvider.ts` — Hover tooltips showing task details

All providers use `BacklogParser` as their data source (already mtime-cached). Registered in `extension.ts` inside the `if (parser)` block.

### UI Guidelines

**Icons**: Use Lucide icons (inline SVG copied from [lucide.dev](https://lucide.dev/)) instead of emojis in webviews. Example:

```html
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="14"
  height="14"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  ...
</svg>
```

### Upstream Backlog.md Reference

Upstream source: **https://github.com/MrLesk/Backlog.md**.

> **Research workflow**: A local checkout lives at `/workspace/tmp/mrlesk-Backlog.md-src/`. Always use this for researching upstream functionality instead of fetching from GitHub. If the directory is missing, clone it: `git clone https://github.com/MrLesk/Backlog.md.git /workspace/tmp/mrlesk-Backlog.md-src`

#### Task YAML Frontmatter (all fields)

```yaml
---
id: TASK-1 # string, auto-generated, uppercase prefix
title: Example task # string, required
status: To Do # string, from config statuses
priority: high # "high" | "medium" | "low" (optional)
assignee: ['@alice', '@bob'] # string[], @-prefixed values are quoted
reporter: '@carol' # string (optional)
created_date: 2024-01-15 # YYYY-MM-DD or YYYY-MM-DD HH:mm
updated_date: 2024-01-16 14:30 # same format (optional, set on updates)
labels: [feature, ui] # string[], inline bracket format
milestone: v1.0 # string (optional)
dependencies: [TASK-2, TASK-3] # string[], task IDs
references: [https://example.com] # string[] (optional, if non-empty)
documentation: [docs/spec.md] # string[] (optional, if non-empty)
parent_task_id: TASK-5 # string (optional, for subtasks)
subtasks: [TASK-5.1, TASK-5.2] # string[] (optional, dot notation)
ordinal: 1500 # number (optional, for ordering)
onStatusChange: './scripts/notify.sh' # string (optional, per-task callback)
---
```

**Serialization field order**: id, title, status, assignee, reporter, created_date, updated_date, labels, milestone, dependencies, references, documentation, parent_task_id, subtasks, priority, ordinal, onStatusChange. Optional fields are omitted when empty/undefined.

**Formatting rules:**

- Arrays: inline bracket format `[item1, item2]`
- Dates: `YYYY-MM-DD` (date-only) or `YYYY-MM-DD HH:mm` (space separator, not T)
- Legacy date formats auto-converted: `DD-MM-YY`, `DD/MM/YY`, `DD.MM.YY`
- Assignees with `@` prefix: auto-quoted in arrays `["@alice"]`
- Priority: always lowercase
- Subtask IDs: dot notation `TASK-5.1`, `TASK-5.2`

#### Body Sections

Task body uses markdown headers with HTML comment markers for machine-readable boundaries:

```markdown
## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Task description content.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 First criterion (checked)
- [ ] #2 Second criterion (unchecked)
<!-- AC:END -->

## Definition of Done

<!-- DOD:BEGIN -->

- [ ] #1 Code reviewed
- [ ] #2 Tests pass
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

1. Step one
2. Step two
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

Found that X required Y approach.

<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Completed with approach Z.

<!-- SECTION:FINAL_SUMMARY:END -->
```

**Marker formats:**

- Structured sections: `<!-- SECTION:{KEY}:BEGIN -->` / `<!-- SECTION:{KEY}:END -->` where KEY is `DESCRIPTION`, `PLAN`, `NOTES`, `FINAL_SUMMARY`
- Checklists: `<!-- AC:BEGIN -->` / `<!-- AC:END -->` and `<!-- DOD:BEGIN -->` / `<!-- DOD:END -->`
- Checklist items: `- [x] #N Text` or `- [ ] #N Text` (1-based index)
- Legacy checklists without markers are also parsed (backward compat)

#### Folder Structure

```
backlog/
├── config.yml                    # Project configuration
├── .user                         # Local user settings (optional, not committed)
├── tasks/                        # Active task files
│   └── TASK-1 - Task-title.md
├── drafts/                       # Draft task files (pre-promotion)
│   └── DRAFT-1 - Draft-title.md
├── completed/                    # Tasks moved here when done
│   └── TASK-5 - Done-task.md
├── archive/
│   ├── tasks/                    # Archived tasks (soft delete)
│   ├── drafts/                   # Archived drafts
│   └── milestones/               # Archived milestones
├── docs/                         # Project documents (supports subdirs)
│   └── doc-1 - Document-title.md
├── decisions/                    # Decision records
│   └── decision-1 - Decision-title.md
└── milestones/                   # Milestone files
    └── m-1 - Milestone-name.md
```

#### Config File (`config.yml`)

Parsed as line-by-line `key: value` (not strict YAML). Comments with `#`.

```yaml
project_name: 'My Project' # string, required
statuses: ['To Do', 'In Progress', 'Done'] # string[], valid task statuses
default_status: 'To Do' # string, default for new tasks (first status if omitted)
labels: ['bug', 'feature'] # string[], predefined labels
milestones: ['v1.0', 'v2.0'] # string[], predefined milestones
definition_of_done: ['Tests pass', 'Code reviewed'] # string[], default DoD for new tasks
task_prefix: 'task' # string, ID prefix (default "task" → TASK-1)
zero_padded_ids: 3 # number, pad IDs (→ TASK-001)
default_assignee: 'alice' # string (optional)
default_reporter: 'bob' # string (optional)
auto_commit: false # boolean, auto-commit changes to git
check_active_branches: true # boolean, include cross-branch tasks
active_branch_days: 30 # number, days to look back for branch tasks
remote_operations: true # boolean, enable remote branch operations
onStatusChange: './scripts/hook.sh' # string, global status change callback
bypass_git_hooks: false # boolean, skip pre-commit hooks
default_editor: 'vim' # string, editor for manual editing
auto_open_browser: true # boolean, auto-open browser on server start
default_port: 6420 # number, web server port
max_column_width: 20 # number, TUI column width
date_format: 'yyyy-mm-dd' # string, display format
```

#### File Naming Conventions

| Entity    | Prefix       | Pattern                          | Example                        |
| --------- | ------------ | -------------------------------- | ------------------------------ |
| Task      | configurable | `{TASK_PREFIX}-{N} - {Title}.md` | `TASK-1 - Add-login.md`        |
| Draft     | `draft`      | `DRAFT-{N} - {Title}.md`         | `DRAFT-3 - Explore-caching.md` |
| Document  | `doc`        | `doc-{N} - {Title}.md`           | `doc-1 - API-Reference.md`     |
| Decision  | `decision`   | `decision-{N} - {Title}.md`      | `decision-1 - Use-React.md`    |
| Milestone | `m`          | `m-{N} - {Title}.md`             | `m-1 - Launch-prep.md`         |

- Title sanitization: removes `<>:"/\|?*'(),!@#$%^&+=[]{}`, spaces → hyphens, collapse multiple hyphens
- IDs are uppercase in frontmatter (`TASK-1`) but lowercase in filenames may vary
- Zero-padding applies per config: `zero_padded_ids: 3` → `TASK-001`
- Subtask IDs use dot notation: `TASK-5.1`, `TASK-5.2`

#### Other Entity Frontmatter

**Documents** (`docs/`): `id`, `title`, `type` (`readme`|`guide`|`specification`|`other`), `created_date`, `updated_date`, `tags` (string[])

**Decisions** (`decisions/`): `id`, `title`, `date`, `status` (`proposed`|`accepted`|`rejected`|`superseded`). Body sections: `## Context`, `## Decision`, `## Consequences`, `## Alternatives`

**Milestones** (`milestones/`): `id`, `title`. Body: `## Description`

#### Key Operations & Business Rules

- **Draft vs Task**: Status "Draft" → draft workflow; any other status → task workflow
- **Promote**: draft → task (new TASK-N ID, old draft file deleted)
- **Demote**: task → draft (new DRAFT-N ID, old task file deleted)
- **Complete**: moves task file to `completed/`
- **Archive**: moves to `archive/{tasks,drafts,milestones}/` (soft delete, IDs reusable)
- **Status callbacks**: per-task `onStatusChange` overrides global config
- **Timestamps**: `created_date` set once; `updated_date` on every modification

Always check the upstream repo (or the local checkout at `/workspace/tmp/mrlesk-Backlog.md-src/`) when:

- Adding new frontmatter field support
- Implementing sorting/ordering features
- Questions about expected behavior or compatibility

### Version Management

This project uses [Mise](https://mise.jdx.dev/) to manage Node.js and Bun versions. The `mise.toml` file pins:

- Node.js 22
- Bun (latest)

Mise automatically activates when you enter the project directory (if shell integration is set up).

### Exploratory Testing with agent-browser

Use the `agent-browser` skill and CLI for visual exploratory testing of webview UIs before writing Playwright e2e tests. This is useful for:

- **Debugging e2e test failures**: Reproduce failures visually, inspect DOM state, check CSS variable resolution
- **Exploratory testing before writing e2e tests**: Interact with the UI to understand flows and discover edge cases
- **Visual regression checking**: Screenshot before/after changes at different viewport sizes

**Setup:**

```bash
bun run build                # Build webview bundles first
bun run vite &               # Start fixture dev server on port 5173
```

**Basic workflow:**

**LOAD THE agent-browser skill** first when exploratory testing! Do not skip this even if you think you know how to use the CLI tool.

```bash
agent-browser open http://localhost:5173/tasks.html   # Open a fixture
agent-browser screenshot output.png                    # Capture state
agent-browser snapshot -i                              # List interactive elements with @refs
agent-browser click @e1                                # Interact using refs
agent-browser eval "someJS()"                          # Run JS in page context
```

**Injecting webview data** (since there's no extension host, data must be injected via postMessage):

```bash
# Inject statuses first, then tasks
agent-browser eval "window.postMessage({ type: 'statusesUpdated', statuses: ['Draft', 'To Do', 'In Progress', 'Done'] }, '*')"
agent-browser eval "window.postMessage({ type: 'tasksUpdated', tasks: [...] }, '*')"

# For dashboard (use correct field names from DashboardStats type):
agent-browser eval "window.postMessage({ type: 'statsUpdated', stats: { totalTasks: 7, byStatus: {...}, byPriority: {...}, milestones: [{ name: 'v1.0', total: 4, done: 1 }] } }, '*')"

# For task detail (use TaskDetailData type):
agent-browser eval "window.postMessage({ type: 'taskData', data: { task: {...}, statuses: [...], priorities: [...], ... } }, '*')"
```

**Important notes:**

- The VS Code mock is NOT auto-installed when navigating directly (only via Playwright's `installVsCodeMock`). Interactions that call `vscode.postMessage()` will log to console but won't be captured in a test helper.
- Use `agent-browser eval` (not `evaluate`) to run JavaScript
- `agent-browser scroll right` scrolls the page body, not inner scrollable elements. For elements with `overflow-x: auto` (like the kanban board), use `agent-browser eval "document.querySelector('.kanban-board').scrollLeft = 300"` instead.
- Set viewport to test sidebar dimensions: `agent-browser set viewport 400 600`
- Always re-run `agent-browser snapshot -i` after DOM changes to get fresh element refs
- Data shapes must match the TypeScript interfaces exactly (e.g., `totalTasks` not `total`, `done` not `completed` on MilestoneStats)

**Fixture theme variables:**

The fixtures load `vscode-theme-dark-plus.css` which sets all 44 `--vscode-*` CSS variables to VS Code Dark+ defaults. This makes fixtures render with realistic colors outside VS Code. To test with a different theme, create a new CSS file with the same variables and swap the `<link>` in the HTML fixtures.

> **Note:** The user's VS Code theme may differ from the Dark+ defaults in fixtures. Visual differences between agent-browser screenshots and the real extension are expected — structure and layout should match, but accent colors may differ.

**Fixture URLs:**

| URL                 | Webview          | Message to inject                  |
| ------------------- | ---------------- | ---------------------------------- |
| `/tasks.html`       | Kanban/List view | `statusesUpdated` + `tasksUpdated` |
| `/task-detail.html` | Task editor      | `taskData`                         |

**Testing error/empty states:**

```bash
# No backlog folder
agent-browser eval "window.postMessage({ type: 'noBacklogFolder' }, '*')"
# Switch view modes
agent-browser eval "window.postMessage({ type: 'viewModeChanged', viewMode: 'list' }, '*')"
```

# Svelte MCP guidance

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.
