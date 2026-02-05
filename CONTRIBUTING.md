# Contributing to Backlog.md for VS Code

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the project.

## Development Setup

### Prerequisites

- [Mise](https://mise.jdx.dev/) for version management (manages Node.js 22 and Bun automatically)
- VS Code 1.85+

The project includes a `mise.toml` file that pins the correct Node.js and Bun versions.

### Getting Started

```bash
# Clone the repository
git clone https://github.com/ysamlan/vscode-backlog-md.git
cd vscode-backlog.md

# Install tools via mise (Node.js + Bun)
mise install

# Install dependencies
bun install

# Build the extension
bun run build

# Launch Extension Development Host
# Press F5 in VS Code, or run:
code --extensionDevelopmentPath="$(pwd)"
```

## Project Structure

```
src/
├── extension.ts       # Extension entry point
├── core/              # Business logic (parser, writer, file watcher)
├── providers/         # Webview providers (Kanban, TaskList, TaskDetail)
├── webview/           # Webview HTML/CSS/JS
└── test/              # Unit and integration tests
```

## Testing

We use a three-tier testing strategy:

```bash
# Unit tests - Vitest for parser, writer, and business logic
bun run test

# Webview UI tests - Playwright for webview interactions
bun run test:playwright

# Interactive Playwright UI mode
bun run test:playwright:ui

# Extension e2e tests - Full VS Code integration
bun run test:e2e
```

Run all tests:

```bash
bun run test && bun run lint && bun run typecheck
```

## Test-Driven Development

You should have comprehensive test coverage for any new features, changes, or bugs fixed.

We recommend writing failing tests first, especially if using AI-based tools.

## Code Style

We use ESLint and Prettier for consistent code style:

```bash
# Check for linting errors
bun run lint

# Format code
bun run format

# Check formatting without changes
bun run format:check

# Type checking
bun run typecheck
```

### UI Guidelines

- Use [Lucide icons](https://lucide.dev/) (inline SVG) instead of emojis in webviews
- Follow VS Code's [webview best practices](https://code.visualstudio.com/api/extension-guides/webview)
- Support all theme types: Light, Dark, and High Contrast

## Pull Request Process

1. **One feature/fix per PR** — Keep changes focused and reviewable
2. **Include tests** — New features need tests; bug fixes need regression tests
3. **Update documentation** — If your change affects user-facing behavior
4. **Run the full test suite** — `bun run test && bun run lint && bun run typecheck`
5. **Write a clear description** — Explain what, why, and how

### Commit Message Format

```
Short description of what was done

- Bullet points for details if needed
- Reference task ID if applicable
```

## Backlog Tasks

This project uses [Backlog.md](https://github.com/backlog-md/backlog) for task management. Check the `backlog/tasks/` folder to see current work items and pick up unassigned tasks.

## Getting Help

- Check existing [issues](https://github.com/ysamlan/vscode-backlog-md/issues)
- Read the [VS Code Extension API docs](https://code.visualstudio.com/api)
- Open a new issue for bugs or feature requests

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
