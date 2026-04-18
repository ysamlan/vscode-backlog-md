---
id: TASK-156
title: Document installing local build as .vsix in CONTRIBUTING
status: To Do
priority: medium
labels: [docs]
assignee: []
created_date: "2026-04-18 18:55"
updated_date: 2026-04-18
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a CONTRIBUTING.md section explaining how to test a local build as a real installed extension (rather than via the Extension Development Host) by packaging a `.vsix` and installing it into the user's main VS Code with `--force`. Include the reload-window step and the uninstall command to revert to the Marketplace version.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CONTRIBUTING.md contains a clearly titled section for installing a local build into the user's main VS Code.
- [ ] #2 The section documents the `bun run build` + `bun run package` flow and the `code --install-extension ... --force` command, deriving the `.vsix` filename from `package.json` version.
- [ ] #3 The section calls out that `Developer: Reload Window` is required for open VS Code windows to pick up the new extension.
- [ ] #4 The section documents the `code --uninstall-extension ysamlan.vscode-backlog-md` command to revert to the Marketplace version.
<!-- AC:END -->
