---
id: TASK-97
title: GitHub Actions release workflow (.vsix archive)
status: Done
assignee: []
created_date: '2026-02-06 16:00'
updated_date: '2026-02-09 13:59'
labels:
  - 'epic:polish'
  - 'phase:9'
milestone: MVP Release
dependencies:
  - TASK-66
references:
  - 'https://github.com/marketplace/actions/publish-vs-code-extension'
  - >-
    https://onlyutkarsh.medium.com/shipping-vs-code-extensions-with-confidence-automating-releases-with-github-actions-a3c87b866355
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub Actions workflow that builds a `.vsix` archive when a GitHub release is created and attaches it as a release asset. Does NOT publish to VS Code Marketplace (deferred to a follow-up task due to PAT issues).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 GitHub Actions workflow file created (.github/workflows/release.yml)
- [x] #2 Workflow triggers on GitHub release creation
- [x] #3 Pipeline runs lint, typecheck, and tests before packaging
- [x] #4 Extension is built and packaged as .vsix
- [x] #5 .vsix is uploaded as a GitHub release asset via gh CLI
- [x] #6 Same validation steps as CI (lint, typecheck, test, build, license check)
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Created `.github/workflows/release.yml` that triggers on GitHub release creation. The workflow:\n\n1. Uses the same runner/mise pattern as CI (`ubuntu-24.04`, `jdx/mise-action@v2`)\n2. Runs full validation: lint, typecheck, unit tests, build, license verification\n3. Packages the extension with `vsce package`\n4. Uploads the `.vsix` to the GitHub release using `gh release upload`\n\nKey details:\n- `permissions: contents: write` enables `gh release upload`\n- Uses `gh` CLI (pre-installed on runners) instead of third-party actions\n- Globs `*.vsix` to pick up the file regardless of version in filename\n\nMarketplace publishing deferred to TASK-98.
<!-- SECTION:FINAL_SUMMARY:END -->
