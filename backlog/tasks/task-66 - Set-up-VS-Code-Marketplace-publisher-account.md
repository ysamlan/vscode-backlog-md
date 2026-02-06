---
id: TASK-66
title: Set up VS Code Marketplace publisher account
status: To Do
assignee: []
created_date: '2026-02-04 01:40'
updated_date: '2026-02-06 16:00'
labels:
  - 'epic:polish'
  - 'phase:9'
milestone: MVP Release
dependencies: []
references:
  - 'https://github.com/marketplace/actions/publish-vs-code-extension'
  - >-
    https://onlyutkarsh.medium.com/shipping-vs-code-extensions-with-confidence-automating-releases-with-github-actions-a3c87b866355
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a publisher account on the VS Code Marketplace to publish the extension.

This requires:
1. Create an Azure DevOps organization (if not already have one)
2. Create a Personal Access Token with Marketplace scope
3. Create a publisher ID via `vsce create-publisher`
4. Update package.json publisher field if needed

Reference: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Publisher account created
- [ ] #2 Personal Access Token generated
- [ ] #3 vsce login succeeds
- [ ] #4 vsce publish succeeds
<!-- AC:END -->
