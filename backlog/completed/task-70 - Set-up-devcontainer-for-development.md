---
id: TASK-70
title: Set up devcontainer for development
status: Done
assignee: []
created_date: '2026-02-04 02:58'
updated_date: '2026-02-04 03:03'
labels:
  - dx
  - infrastructure
dependencies: []
references:
  - 'https://github.com/anthropics/claude-code/tree/main/.devcontainer'
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a devcontainer configuration for development, modeled on https://github.com/anthropics/claude-code/tree/main/.devcontainer

Skip the firewall.sh config and usage - focus on the core devcontainer setup for VS Code extension development.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Changes Made

Created `.devcontainer/` directory with two files:

### `.devcontainer/Dockerfile`
- Base image: `mcr.microsoft.com/devcontainers/javascript-node:22` (matches `.node-version`)
- Installs: `git`, `jq`, and `gh` (GitHub CLI)
- No firewall configuration (as specified in task)

### `.devcontainer/devcontainer.json`
- Uses custom Dockerfile for build
- Sets workspace folder to `/workspaces/${localWorkspaceFolderBasename}`
- Post-create command: `npm install`
- VS Code extensions:
  - `dbaeumer.vscode-eslint` - ESLint integration
  - `esbenp.prettier-vscode` - Prettier formatting
  - `ms-vscode.vscode-typescript-next` - TypeScript support
- Editor settings:
  - Format on save with Prettier
  - ESLint auto-fix on save
  - TypeScript SDK from node_modules

## Verification
To test the devcontainer:
1. Open project in VS Code with Dev Containers extension
2. Use "Reopen in Container" command
3. Verify Node.js 22, npm install, extensions, and F5 extension launch
<!-- SECTION:FINAL_SUMMARY:END -->
