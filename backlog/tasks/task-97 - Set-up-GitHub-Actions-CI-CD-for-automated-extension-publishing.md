---
id: TASK-97
title: Set up GitHub Actions CI/CD for automated extension publishing
status: To Do
assignee: []
created_date: '2026-02-06 16:00'
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
Automate the VS Code extension publishing pipeline using GitHub Actions. When a release tag is pushed (or a release is created), the workflow should:

1. Run tests, lint, and typecheck
2. Build the extension (.vsix)
3. Publish to VS Code Marketplace via `vsce`
4. Optionally publish to Open VSX Registry

This removes the manual `vsce publish` step and ensures every release goes through CI validation first.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 GitHub Actions workflow file created (.github/workflows/publish.yml)
- [ ] #2 Workflow triggers on release tag push or GitHub release creation
- [ ] #3 Pipeline runs tests, lint, and typecheck before publishing
- [ ] #4 Extension is built and published to VS Code Marketplace
- [ ] #5 Secrets (PAT) documented in README or CONTRIBUTING
- [ ] #6 Workflow tested with a dry-run or pre-release publish
<!-- AC:END -->
