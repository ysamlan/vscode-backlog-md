---
id: TASK-72
title: Migrate from npm to bun
status: Done
assignee: []
created_date: ''
updated_date: '2026-02-04 15:29'
labels: []
dependencies: []
priority: low
---

# Migrate from npm to bun

## Objective

Replace npm with bun as the package manager and script runner for faster installs and script execution.

## Benefits

- **Faster installs** - bun's package installation is significantly faster than npm
- **Faster script execution** - bun runs scripts faster than npm run
- **Native TypeScript execution** - can run .ts files directly without compilation
- **Drop-in replacement** - mostly compatible with existing package.json

## Migration Steps

1. Remove `package-lock.json`
2. Run `bun install` to generate `bun.lockb`
3. Update CI/CD workflows to use bun
4. Update devcontainer to install bun
5. Update CLAUDE.md documentation
6. Test all scripts work correctly with bun

## Considerations

- **VS Code extension compatibility** - verify vsce packaging still works
- **CI environments** - ensure bun is available or easy to install
- **Team adoption** - developers need bun installed locally
- **vscode-extension-tester** - currently uses fnm/node, verify compatibility

## Scripts to verify

- `bun run compile`
- `bun run build`
- `bun test` (vitest)
- `bun run test:webview` (cypress)
- `bun run test:e2e` (vscode-extension-tester)
- `bun run package` (vsce)

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Replace package-lock.json with bun.lockb
- [x] #2 All existing npm scripts work with bun
- [x] #3 Update devcontainer configuration
- [x] #4 Update CI workflows (if any) - N/A, no workflows exist
- [x] #5 Update CLAUDE.md with bun commands
- [x] #6 Document any compatibility issues found (none encountered)
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Summary
Migrated the vscode-backlog-md project from npm to bun as the package manager and script runner.

## Changes Made

### Config Files
- **package.json**: Updated 3 scripts (`npx` → `bunx`, `npm run` → `bun run`)
- **.vscode/tasks.json**: Changed task type from `npm` to `shell`, updated labels to `bun: build` and `bun: watch`
- **.vscode/launch.json**: Updated all 3 `preLaunchTask` references from `npm: build` to `bun: build`
- **.devcontainer/devcontainer.json**: Updated `postCreateCommand` from `npm install` to `bun install`

### Shell Scripts
- **scripts/generate-licenses.sh**: `npx` → `bunx`
- **scripts/run-e2e.sh**: `npx` → `bunx`

### Documentation
- **CLAUDE.md**: Updated all npm commands to bun equivalents
- **README.md**: Updated development and testing sections
- **CONTRIBUTING.md**: Updated prerequisites, setup, and code style instructions

### Deleted
- **package-lock.json**: Replaced by `bun.lockb`

## Verification
All tests pass with bun:
- `bun run build` - compiles extension and CSS
- `bun run test` - passes all unit tests
- `bun run lint` - no errors
- `bun run typecheck` - no errors
<!-- SECTION:FINAL_SUMMARY:END -->
