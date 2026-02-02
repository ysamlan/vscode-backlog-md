---
id: TASK-12
title: Implement BaseViewProvider abstract class
status: Done
assignee: []
created_date: '2026-02-02 23:21'
labels:
  - 'epic:task-list-view'
  - 'phase:4'
milestone: MVP Release
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create abstract base class for webview providers with common functionality: message passing, CSP, resource URIs, refresh logic.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Abstract getHtmlContent method
- [ ] #2 Abstract handleMessage method
- [ ] #3 Common CSP and nonce generation
- [ ] #4 Resource URI helper
- [ ] #5 Refresh method that loads tasks
<!-- AC:END -->
