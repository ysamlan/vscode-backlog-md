# Backlog.md for VS Code

A VS Code extension that provides a beautiful UI for browsing and managing [Backlog.md](https://github.com/backlog-md/backlog) tasks.

> **Note**: This extension is under active development. See the backlog/ folder for current progress.

## Features (Planned)

- **Kanban Board** - Drag-and-drop tasks between status columns
- **Task List** - Sortable, filterable table view with search
- **Task Details** - Rich view with checklist management
- **Real-time Updates** - File watcher syncs changes automatically

## Development

```bash
npm install
npm run build
```

Press **F5** to launch the Extension Development Host and test the extension.

### Testing

```bash
# Unit tests (core logic)
npm test

# Webview UI tests (Cypress)
npm run test:webview

# Interactive Cypress mode
npm run test:webview:open

# Extension e2e tests
npm run test:e2e
```

The project uses a three-tier testing strategy:
1. **Unit tests** - Vitest for parser, writer, and business logic
2. **Webview UI tests** - Cypress standalone for testing webview interactions
3. **Extension e2e tests** - vscode-extension-tester for full integration

## Requirements

- VS Code 1.85.0 or later
- A workspace with a `backlog/` folder containing Backlog.md task files

## License

MIT
