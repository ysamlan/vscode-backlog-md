---
id: TASK-47
title: Set up automated UI testing for webviews
status: In Progress
assignee: []
created_date: '2026-02-02 23:58'
updated_date: '2026-02-03 00:11'
labels:
  - 'epic:foundation'
  - dx
  - testing
milestone: MVP Release
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Investigate and implement automated UI testing for the extension's webviews (Kanban, TaskList, TaskDetail). Options to explore:

1. **@vscode/test-electron** - Official VS Code extension testing framework
2. **Playwright** - Can potentially test webview content via the Extension Development Host
3. **Unit testing webview HTML generation** - Test the HTML/JS output of providers

Goals:
- Enable Claude to run exploratory UI tests using webapp-testing skill or similar
- Catch UI regressions before they're committed
- Verify drag-and-drop, filtering, and other interactions work

Research needed:
- How to access webview content from Playwright/Puppeteer
- Whether VS Code Extension Host exposes webviews for automation
- What other VS Code extensions do for UI testing
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Research VS Code webview testing approaches
- [ ] #2 Choose and document testing strategy
- [ ] #3 Set up basic test that opens extension and verifies webview renders
- [ ] #4 Document how Claude can run exploratory UI tests
- [ ] #5 Add npm script for UI tests
<!-- AC:END -->
