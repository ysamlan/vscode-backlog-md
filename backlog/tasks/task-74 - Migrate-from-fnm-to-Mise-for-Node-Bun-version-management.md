---
id: TASK-74
title: Migrate from fnm to Mise for Node/Bun version management
status: Done
assignee: []
created_date: '2026-02-04 15:29'
updated_date: '2026-02-04 15:43'
labels:
  - devcontainer
  - tooling
  - investigation
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Investigate and implement replacing fnm with Volta for managing Node.js (and potentially Bun) versions at the project level.

## Background
The project currently uses fnm in scripts (run-e2e.sh) and devcontainer setup. Volta provides project-level version pinning via package.json, which may be a better fit.

## Research Questions
1. Can Volta manage Bun versions, or should Bun be pre-installed in the Docker image?
2. What's the migration path from fnm to Volta in the devcontainer?
3. How does Volta handle Node version pinning in package.json?

## Potential Benefits
- Project-level version enforcement via package.json "volta" field
- Simpler setup - no shell config needed
- Potentially fewer devcontainer dependencies

## Files to Consider
- `.devcontainer/Dockerfile` - Tool installation
- `.devcontainer/devcontainer.json` - postCreateCommand
- `scripts/run-e2e.sh` - Uses `fnm exec --using=22`
- `package.json` - Add volta config section
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Migrated from fnm to Mise for managing Node.js and Bun versions.

## Changes Made

### New Files
- `mise.toml` - Pins Node.js 22 and Bun (latest)

### Modified Files
- `.devcontainer/Dockerfile`:
  - Removed bun installation via COPY from oven/bun image
  - Removed fnm installation
  - Added mise installation via COPY from jdxcode/mise image
  - Added mise shims to PATH
  - Added mise shell activation for zsh and bash
  - Added mise trust command for pre-installation

- `.devcontainer/devcontainer.json`:
  - Updated postCreateCommand to use `mise trust --yes && mise install --yes`

- `scripts/run-e2e.sh`:
  - Removed `fnm exec --using=22` wrapper (mise auto-switches via shell activation)

- `package.json`:
  - Added `"node": ">=22"` to engines field

### Documentation Updates
- `CLAUDE.md` - Added "Version Management" section explaining mise usage
- `README.md` - Added mise installation step to Development section
- `CONTRIBUTING.md` - Updated Prerequisites to mention mise instead of fnm

## Benefits of Mise over fnm
1. Unified management - One tool for Node.js AND Bun
2. Project-level pinning via mise.toml in repo root
3. Automatic activation when entering directory
4. Simpler Dockerfile - Copy single binary from Docker image
5. No manual PATH setup - Shims handle tool resolution
<!-- SECTION:FINAL_SUMMARY:END -->
