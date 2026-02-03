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
4. Run ALL tests (`npm test`) to verify nothing broke
5. Run lint and typecheck
6. Commit with message referencing the task ID
7. Mark task as Done
8. Move to next task
```

**When TDD doesn't apply**:
- UI-only changes (webview HTML/CSS) - document why in commit
- Pure refactoring with existing test coverage
- Configuration changes

**CRITICAL**: Always run `npm test && npm run lint && npm run typecheck` before marking a task as Done. Never skip this step.

**One commit per task**: When a backlog task is self-contained and testable, commit it individually before moving to the next task. This keeps the git history clean and makes it easier to review/revert changes.

**Commit message format**:
```
Short description of what was done

- Bullet points for details if needed
- Reference task ID

Completes TASK-XX.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

### Commands

- `npm run compile` - Build extension with esbuild
- `npm run watch` - Watch mode for development
- `npm run build` - Build CSS + extension
- `npm test` - Run unit tests (vitest)
- `npm run test:webview` - Run Cypress webview UI tests
- `npm run test:webview:open` - Open Cypress interactive mode
- `npm run test:e2e` - Run VS Code extension e2e tests
- `npm run lint` - ESLint check
- `npm run format` - Format with Prettier
- `npm run typecheck` - TypeScript type checking

### Testing Strategy

**Three-tier approach:**

1. **Unit tests** (`npm test`) - Vitest with vscode API mocking for core logic
2. **Webview UI tests** (`npm run test:webview`) - Cypress standalone for webview interactions
3. **Extension e2e tests** (`npm run test:e2e`) - vscode-extension-tester for extension activation

**Webview testing pattern** (based on Nx Console approach):
- Webview HTML is served standalone via Vite (`npm run webview:serve`)
- `acquireVsCodeApi()` is mocked to capture postMessage calls
- Tests verify UI interactions send correct messages to extension

Reference repos for webview testing patterns:
- [Nx Console](https://github.com/nrwl/nx-console/tree/master/apps/generate-ui-v2-e2e) - Cypress standalone
- [wdio-vscode-service](https://github.com/webdriverio-community/wdio-vscode-service) - Frame switching
- [Marquee](https://github.com/stateful/marquee) - vscode API mocking

### Testing the Extension Manually

1. Run `npm run build` to compile everything
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

### Known Issues / Tech Debt

- Webviews use inline styles instead of external CSS (TASK-46)
- Inline styles duplicate VS Code theme variable mappings
