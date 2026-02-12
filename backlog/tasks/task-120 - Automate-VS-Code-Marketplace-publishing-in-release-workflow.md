---
id: TASK-120
title: Automate VS Code Marketplace publishing in release workflow
status: Done
assignee: []
created_date: '2026-02-09 13:59'
updated_date: '2026-02-12 14:32'
labels:
  - 'epic:polish'
  - 'phase:9'
milestone: MVP Release
dependencies:
  - TASK-97
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add VS Code Marketplace publishing step to the existing GitHub Actions release workflow (`.github/workflows/release.yml`). This was deferred from TASK-97 due to MS Personal Access Token issues.\n\nOnce PAT issues are resolved:\n1. Add `VSCE_PAT` secret to the GitHub repository\n2. Add a `vsce publish` step after the .vsix upload step\n3. Optionally add Open VSX Registry publishing\n4. Document required secrets in README or CONTRIBUTING
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 VSCE_PAT secret configured in GitHub repository
- [x] #2 Release workflow publishes to VS Code Marketplace via vsce
- [x] #3 Secrets documented in README or CONTRIBUTING
- [x] #4 Workflow tested with a dry-run or pre-release publish
- [x] #5 Optionally: publish to Open VSX Registry
<!-- AC:END -->
