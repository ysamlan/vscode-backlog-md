# Contributing to Backlog.md for VS Code

This document provides guidelines and instructions for contributing to the project.

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

### Installing from source into your main VS Code

For testing a local build as a real installed extension (not the Extension
Development Host), package it as a `.vsix` and install it with `--force` to
overwrite any previously installed version:

```bash
# Build and package into a .vsix in the repo root
bun run build
bun run package

# Install the freshly built .vsix, replacing any existing version
code --install-extension "$(pwd)/vscode-backlog-md-$(node -p "require('./package.json').version").vsix" --force
```

After installing, reload any open VS Code windows
(`Developer: Reload Window`) so the new extension is picked up. Uninstall
with `code --uninstall-extension ysamlan.vscode-backlog-md` to revert to the
Marketplace version.

## Visual proof for your PR

If your change affects what users see or how they interact with the
extension, a short "before/after" or "demo" section in your PR description
helps reviewers enormously. The repo ships a `visual-proof` Claude Code
skill at `.claude/skills/visual-proof/` that can capture screenshots of the
extension via CDP and assemble them into a
[`showboat`](https://github.com/simonw/showboat) markdown doc; you can
paste relevant screenshots from that into your PR.

We highly recommend all agents use the `visual-proof` skill flow. Humans
can also feel free to just use hand-taken screenshots.

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

We use a four-tier testing strategy:

```bash
# Unit tests - Vitest for parser, writer, and business logic
bun run test

# Webview UI tests - Playwright for webview interactions
bun run test:playwright

# Interactive Playwright UI mode
bun run test:playwright:ui

# Extension e2e tests - Full VS Code integration
bun run test:e2e

# CDP cross-view tests - Cross-panel coordination in a real VS Code instance
bun run test:cdp
```

Run all tests:

```bash
bun run test && bun run lint && bun run typecheck
```

### Local CI preflight

To run the exact suite GitHub Actions runs, in the same order:

```bash
bun run ci
```

This runs: `check:engines` → `lint` → `typecheck` → `depcheck` → `licenses:check` → unit tests → `build` → Playwright → CDP → e2e. It's the most reliable way to catch CI failures before pushing.

Individual checks you can also run standalone:

```bash
bun run depcheck         # audit for unused / missing dependencies
bun run licenses:check   # regenerate ThirdPartyNotices.txt and fail if it drifts
```

Depcheck configuration lives in `.depcheckrc.yml`. Each `ignores` entry is annotated with why the package looks unused to depcheck but isn't — please update those comments if you add or remove entries.

A Husky `pre-push` hook (`.husky/pre-push`) also runs `bun run depcheck` and `bun run licenses:check` automatically, so dependency drift and stale license notices are caught before a push reaches CI.

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
4. **Run the full CI suite locally** — `bun run ci` mirrors what GitHub Actions runs (engines, lint, typecheck, depcheck, licenses, unit, build, Playwright, CDP, e2e). The `pre-push` Husky hook also runs depcheck + license verification as a fast-fail safety net.
5. **Write a clear description** — Explain what, why, and how

### Commit Message Format

```
Short description of what was done

- Bullet points for details if needed
- Reference task ID if applicable
```

## Backlog Tasks

This project uses [Backlog.md](https://github.com/backlog-md/backlog) for task management. Check the `backlog/tasks/` folder to see current work items and pick up unassigned tasks.

### Cross-Branch Demo Workspace

Use this script to create a local demo repository with deterministic branch-divergent tasks:

```bash
bun run demo:cross-branch-setup
```

Optional:

```bash
# Create at a custom path and overwrite if it already exists
bash scripts/setup-cross-branch-demo.sh /tmp/my-cross-branch-demo --reset
```

What to verify in the UI for cross-branch functionality:

1. Open the generated workspace in VS Code and open the Backlog view.
2. `TASK-900` appears from `feature/cross-branch-demo` and is read-only.
3. `TASK-1` on `main` remains editable.

## Dependency Updates

### GitHub Actions

GitHub Actions are updated using [actions-up](https://github.com/actions-up/actions-up) so we can enforce a cooldown period and lock to deterministic versions, which we wrap in our project's `update:actions`:

```bash
bun run update:actions
```

Security updates from Dependabot are an exception — those PRs come in automatically.

## Releases

Releases are driven by [`release-it`](https://github.com/release-it/release-it) plus the [`@release-it/keep-a-changelog`](https://github.com/release-it/keep-a-changelog) plugin. The local command bumps the version, promotes the `[Unreleased]` CHANGELOG section, commits, tags, and pushes — then a tag-triggered GitHub Actions workflow takes over and ships the `.vsix`.

### Before releasing

Add release notes to the `## [Unreleased]` section of `CHANGELOG.md` as you merge PRs, using the standard [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) groupings (`Added`, `Changed`, `Fixed`, `Removed`, `Deprecated`, `Security`, or our extra `Internal` bucket for no-user-impact work). If `[Unreleased]` is empty at release time there's nothing to ship — add a bullet first.

### Cutting the release

From a clean `main` branch:

```bash
bun run release
```

This runs [release-it](https://github.com/release-it/release-it) configured via [`.release-it.json`](../.release-it.json), which will:

1. Run a fast preflight: `check:engines` → `lint` → `typecheck` → `test` → `build`. (Heavy tests — Playwright, CDP, e2e — run in CI after the tag push, not locally.)
2. Prompt for the new version (major / minor / patch / custom).
3. Rewrite `CHANGELOG.md`: rename `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD`, insert a fresh empty `[Unreleased]`, and update the compare-URL references at the bottom.
4. Bump `version` in `package.json`.
5. Show you the diff and prompt to continue.
6. Commit `Release vX.Y.Z`, tag `vX.Y.Z`, and push both to `origin/main`.

Pass `--dry-run` to preview without touching anything:

```bash
bun run release -- --dry-run
```

### What happens after the tag push

Pushing a `v*` tag triggers [`.github/workflows/release.yml`](.github/workflows/release.yml), which:

1. Checks out the tag, installs, and re-runs lint/typecheck/unit tests/build in CI.
2. Verifies `ThirdPartyNotices.txt` is current.
3. Packages the `.vsix` via `bun run package`.
4. Extracts the matching section from `CHANGELOG.md` as release notes.
5. Creates the GitHub release **with the `.vsix` attached in the same API call** (`gh release create TAG --notes-file ... *.vsix`). This avoids GitHub's immutable-release restriction that blocks `gh release upload` after the fact.
6. Publishes to the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=ysamlan.vscode-backlog-md) and [Open VSX](https://open-vsx.org/extension/ysamlan/vscode-backlog-md).

If the workflow fails partway (e.g. Marketplace is down), fix the cause, delete the tag + GitHub release, and re-run `bun run release` — don't try to patch a half-shipped release manually.

## Getting Help

- Check existing [issues](https://github.com/ysamlan/vscode-backlog-md/issues)
- Read the [VS Code Extension API docs](https://code.visualstudio.com/api)
- Open a new issue for bugs or feature requests

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
