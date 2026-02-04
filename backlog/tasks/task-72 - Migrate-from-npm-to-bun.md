---
id: TASK-72
title: Migrate from npm to bun
status: Backlog
priority: Low
type: DX
created: 2026-02-04
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

- [ ] Replace package-lock.json with bun.lockb
- [ ] All existing npm scripts work with bun
- [ ] Update devcontainer configuration
- [ ] Update CI workflows (if any)
- [ ] Update CLAUDE.md with bun commands
- [ ] Document any compatibility issues found
