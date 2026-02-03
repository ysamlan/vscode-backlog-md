# Contributing to Backlog.md for VS Code

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the project.

## Development Setup

### Prerequisites

- Node.js 22 (use [fnm](https://github.com/Schniz/fnm) for version management)
- npm 10+
- VS Code 1.85+

### Getting Started

```bash
# Clone the repository
git clone https://github.com/ysamlan/vscode-backlog-md.git
cd vscode-backlog.md

# Set up Node version (if using fnm)
fnm use

# Install dependencies
npm install

# Build the extension
npm run build

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
npm test

# Webview UI tests - Cypress standalone for webview interactions
npm run test:webview

# Interactive Cypress mode
npm run test:webview:open

# Extension e2e tests - Full VS Code integration
npm run test:e2e
```

Run all tests:

```bash
npm test && npm run lint && npm run typecheck
```

## Test-Driven Development

You should have comprehensive test coverage for any new features, changes, or bugs fixed.

We recommend writing failing tests first, especially if using AI-based tools.

## Code Style

We use ESLint and Prettier for consistent code style:

```bash
# Check for linting errors
npm run lint

# Format code
npm run format

# Check formatting without changes
npm run format:check

# Type checking
npm run typecheck
```

### UI Guidelines

- Use [Lucide icons](https://lucide.dev/) (inline SVG) instead of emojis in webviews
- Follow VS Code's [webview best practices](https://code.visualstudio.com/api/extension-guides/webview)
- Support all theme types: Light, Dark, and High Contrast

## Pull Request Process

1. **One feature/fix per PR** — Keep changes focused and reviewable
2. **Include tests** — New features need tests; bug fixes need regression tests
3. **Update documentation** — If your change affects user-facing behavior
4. **Run the full test suite** — `npm test && npm run lint && npm run typecheck`
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
