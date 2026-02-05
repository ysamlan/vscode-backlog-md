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

**One commit per task**: When a backlog task is self-contained and testable, commit it individually before moving to the next task. This keeps the git history clean and makes it easier to review/revert changes.

**Commit message format**:

```
Short description of what was done

- Bullet points for details if needed
- Reference task ID

Completes TASK-XX.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

**Adding dependencies**: Always use `bun add` to add new packages rather than manually editing package.json. This ensures the latest version is installed and bun.lockb is updated correctly.

```bash
bun add <package>           # production dependency
bun add --dev <package>     # dev dependency
```

### Commands

- `bun run compile` - Build extension with esbuild
- `bun run watch` - Watch mode for development
- `bun run build` - Build CSS + extension
- `bun run test` - Run unit tests (vitest)
- `bun run test:webview` - Run Cypress webview UI tests
- `bun run test:webview:open` - Open Cypress interactive mode
- `bun run test:e2e` - Run VS Code extension e2e tests
- `bun run lint` - ESLint check
- `bun run format` - Format with Prettier
- `bun run typecheck` - TypeScript type checking

### Testing Strategy

**Three-tier approach:**

1. **Unit tests** (`bun run test`) - Vitest with vscode API mocking for core logic
2. **Webview UI tests** (`bun run test:webview`) - Cypress standalone for webview interactions
3. **Extension e2e tests** (`bun run test:e2e`) - vscode-extension-tester for extension activation

**Webview testing pattern** (based on Nx Console approach):

- Webview HTML is served standalone via Vite (`bun run webview:serve`)
- `acquireVsCodeApi()` is mocked to capture postMessage calls
- Tests verify UI interactions send correct messages to extension

**When to use Cypress webview tests:**

Cypress tests (`bun run test:webview`) are REQUIRED for:

- **Drag-and-drop interactions** - Unit tests cannot simulate HTML5 drag events
- **Multi-element user flows** - Clicking, hovering, keyboard navigation sequences
- **DOM-dependent behavior** - Where visual order, positioning, or layout affects logic
- **State transitions** - Verifying UI updates in response to interactions

Signs you need Cypress instead of (or in addition to) unit tests:

- The behavior involves `addEventListener` for user events
- You're testing "what message gets sent when user does X"
- The logic depends on DOM element order or coordinates
- You need to verify visual feedback (classes added, elements inserted)

**Test fixture pattern:**

- Create HTML fixtures in `cypress/webview-fixtures/`
- Include realistic test data with edge cases (e.g., mixed ordinal/no-ordinal cards)
- Use `data-cy` attributes for reliable selectors

Reference repos for webview testing patterns:

- [Nx Console](https://github.com/nrwl/nx-console/tree/master/apps/generate-ui-v2-e2e) - Cypress standalone
- [wdio-vscode-service](https://github.com/webdriverio-community/wdio-vscode-service) - Frame switching
- [Marquee](https://github.com/stateful/marquee) - vscode API mocking

### Testing the Extension Manually

1. Run `bun run build` to compile everything
2. Press **F5** to launch Extension Development Host
3. Open a folder containing a `backlog/` directory with task files
4. Click the **Backlog** icon in the activity bar to see views

The extension activates when it detects `backlog/tasks/*.md` files.

### Architecture

- `src/extension.ts` - Extension entry point
- `src/core/` - Business logic (parser, writer, file watcher, types)
- `src/providers/` - Webview providers (Kanban, TaskList, TaskDetail)
- `src/webview/` - Webview UI (HTML/CSS/JS embedded in providers)
- `src/test/` - Unit and integration tests

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

When researching Backlog.md data models, frontmatter fields, or functionality, consult the upstream source at **https://github.com/MrLesk/Backlog.md**.

**To fetch raw files from the repo** (for code inspection):

```
https://raw.githubusercontent.com/MrLesk/Backlog.md/main/src/<path>
```

**Key source files:**

- `src/markdown/parser.ts` - Frontmatter parsing, date formats, array handling
- `src/markdown/serializer.ts` - Task serialization with `gray-matter` library
- `src/file-system/operations.ts` - File I/O, config serialization
- `src/core/backlog.ts` - Core task operations (createTask, updateTask)
- `src/core/task-loader.ts` - Cross-branch task loading

**Task file format (canonical):**

```yaml
---
id: TASK-1
title: Example task
status: To Do
priority: high
milestone: v1.0
labels: [feature, ui]
assignee: [@user]
created: 2024-01-15
updated_date: 2024-01-16
dependencies: [TASK-2]
---

# Example task

Description content here.
```

**Key formatting rules:**

- Arrays use inline bracket format: `labels: [item1, item2]`
- Dates use `YYYY-MM-DD` format (no timestamps)
- Assignees with `@` prefix are quoted: `[@user]` or `["@user"]`
- Field order: id, title, status, priority, milestone, labels, assignee, created, updated_date, dependencies...

Always check the upstream repo when:

- Adding new frontmatter field support
- Implementing sorting/ordering features
- Questions about expected behavior or compatibility

### Version Management

This project uses [Mise](https://mise.jdx.dev/) to manage Node.js and Bun versions. The `mise.toml` file pins:

- Node.js 22
- Bun (latest)

Mise automatically activates when you enter the project directory (if shell integration is set up).

### Known Issues / Tech Debt

- Webviews use inline styles instead of external CSS (TASK-46)
- Inline styles duplicate VS Code theme variable mappings
