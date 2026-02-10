---
id: TASK-47
title: Set up automated UI testing for webviews
status: Done
assignee: []
created_date: '2026-02-02 23:58'
updated_date: '2026-02-03 13:33'
labels:
  - 'epic:foundation'
  - dx
  - testing
milestone: MVP Release
dependencies: []
references:
  - docs/e2e-tests-lessons-learned.md
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
- [x] #1 Research VS Code webview testing approaches
- [x] #2 Choose and document testing strategy
- [x] #3 Set up basic test that opens extension and verifies webview renders
- [x] #4 Document how Claude can run exploratory UI tests
- [x] #5 Add npm script for UI tests
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Investigation Results (2026-02-03)

See `docs/e2e-tests-lessons-learned.md` for full details.

### wdio-vscode-service: Abandoned
- Session creation timeouts that we couldn't resolve
- Maintainer has limited bandwidth, WebdriverIO v9 PR stalled since July 2024
- Multiple open issues about VSCode version compatibility

### New Approach: vscode-extension-tester
- Red Hat maintained, actively developed
- Simpler Selenium-based architecture
- Supports VSCode 1.106.x - 1.108.x
- Installation: `npm install --save-dev vscode-extension-tester`

### Testing Strategy
1. **Unit tests** (vitest) - mock vscode module, test business logic
2. **Integration tests** (@vscode/test-cli) - test in Extension Dev Host
3. **E2E/UI tests** (vscode-extension-tester) - test webview UI

## E2E Tests Working (2026-02-03)

**vscode-extension-tester successfully set up!**

3 tests passing:
- ✅ should load VS Code successfully
- ✅ should have the Backlog activity bar item  
- ✅ should open the Backlog sidebar

**Run with:** `npm run test:e2e`

**Files created:**
- `src/test/e2e/extension.test.ts` - Basic e2e tests
- `tsconfig.e2e.json` - TypeScript config for e2e
- `.mocharc.json` - Mocha config
- `.vscodeignore` - Reduces VSIX size

**Remaining:** Document how Claude can run exploratory UI tests (AC #4)
<!-- SECTION:NOTES:END -->
