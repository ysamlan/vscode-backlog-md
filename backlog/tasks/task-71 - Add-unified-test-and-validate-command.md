---
id: TASK-71
title: Add unified test and validate command
status: Backlog
priority: Low
type: DX
created: 2026-02-04
---

# Add unified test and validate command

## Objective

Add a single npm script that runs all tests, linting, and type checking in one command, instead of requiring multiple separate commands.

## Current State

Developers must run multiple commands to fully validate the codebase:

```bash
npm test           # Unit tests (vitest)
npm run test:webview  # Cypress webview tests
npm run test:e2e      # VS Code extension e2e tests
npm run lint          # ESLint
npm run typecheck     # TypeScript type checking
```

## Proposed Solution

Add new npm scripts to package.json:

```json
{
  "scripts": {
    "validate": "npm run typecheck && npm run lint && npm test && npm run test:webview",
    "test:all": "npm test && npm run test:webview && npm run test:e2e"
  }
}
```

### Script breakdown

- **`npm run validate`** - Quick CI-style check: typecheck, lint, unit tests, webview tests (skip slow e2e)
- **`npm run test:all`** - Run all three test suites

### Considerations

- E2E tests are slow and require display/fnm setup, so `validate` excludes them by default
- Could also add `validate:full` that includes e2e tests
- Order matters: run fast checks (typecheck, lint) first to fail fast

## Acceptance Criteria

- [ ] Add `validate` script to package.json
- [ ] Add `test:all` script to package.json
- [ ] Update CLAUDE.md to document the new commands
- [ ] Verify all scripts work correctly
