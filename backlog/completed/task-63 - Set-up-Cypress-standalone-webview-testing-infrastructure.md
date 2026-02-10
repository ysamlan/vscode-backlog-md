---
id: TASK-63
title: Set up Cypress standalone webview testing infrastructure
status: Done
assignee: []
created_date: '2026-02-03 18:12'
updated_date: '2026-02-03 18:27'
labels:
  - testing
  - dx
  - webview
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the infrastructure to test webview UIs in isolation using Cypress, following the Nx Console pattern.

This involves:
1. Vite dev server to serve webview HTML
2. Cypress configuration
3. VS Code messaging API mock
4. Documentation of reference repos

Reference implementations to study:
- **Nx Console**: https://github.com/nrwl/nx-console/tree/master/apps/generate-ui-v2-e2e
- **wdio-vscode-service**: https://github.com/webdriverio-community/wdio-vscode-service (for webview patterns)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Vite dev server serves webview HTML at localhost
- [x] #2 Cypress is configured and runs
- [x] #3 VS Code messaging API mock works
- [x] #4 At least one webview has a passing Cypress test
- [x] #5 Reference repos documented in implementation notes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
# Implementation Complete

## What Was Built

### 1. VS Code API Mock (`cypress/support/vscode-mock.ts`)
A mock implementation of `acquireVsCodeApi()` that:
- Captures all `postMessage()` calls from the webview
- Allows tests to inspect messages sent to the extension
- Supports simulating extension → webview messages

### 2. Cypress Support File (`cypress/support/e2e.ts`)
Custom Cypress commands:
- `cy.visitWebview(path)` - Visit a webview page with mock installed
- `cy.getPostedMessages()` - Get all messages posted by webview
- `cy.getLastPostedMessage()` - Get the last posted message
- `cy.postMessageToWebview(msg)` - Simulate extension sending message

### 3. Vite Dev Server (`vite.config.ts`)
Serves webview test fixtures from `cypress/webview-fixtures/` at http://localhost:5173

### 4. Theme Mock (`cypress/fixtures/vscode-theme.css`)
CSS variables matching VS Code dark theme for standalone rendering

### 5. Test Fixture (`cypress/webview-fixtures/task-detail.html`)
A static HTML file that mirrors the TaskDetailProvider webview, with:
- All interactive elements (title, status, priority, labels, description, checklists)
- Same JavaScript event handlers as the real webview
- `data-cy` attributes for reliable test selectors

### 6. Cypress Tests (`cypress/e2e/task-detail.cy.ts`)
25 passing tests covering:
- Header (title editing, keyboard handling)
- Status/Priority dropdowns
- Labels (add/remove)
- Description (view/edit toggle, debounced save)
- Acceptance Criteria checklist toggling
- Definition of Done checklist toggling
- Actions (open file button)
- Dependencies (navigation links)

## NPM Scripts Added

- `npm run test:webview` - Run Cypress tests headlessly
- `npm run test:webview:open` - Open Cypress interactive mode
- `npm run webview:serve` - Start Vite dev server for manual testing

---

# Reference Implementations

## Nx Console (Primary Reference)
**Repository**: https://github.com/nrwl/nx-console

**Relevant Files**:
- `apps/generate-ui-v2-e2e/cypress.config.ts` - Cypress configuration
- `apps/generate-ui-v2-e2e/src/support/visit-generate-ui.ts` - VS Code API mocking pattern
- `apps/generate-ui-v2-e2e/src/e2e/*.cy.ts` - Test examples

**Key Pattern**: They mock the messaging API in `onBeforeLoad`:
```typescript
cy.visit('/', {
  onBeforeLoad: (win) => {
    win.intellijApi = {
      postToWebview(message) { /* mock implementation */ },
      postToIde(message) { /* capture/respond */ },
    };
  },
});
```

## wdio-vscode-service
**Repository**: https://github.com/webdriverio-community/wdio-vscode-service

**Relevant Files**:
- `src/pageobjects/workbench/WebView.ts` - WebView page object with frame switching
- `test/specs/webview.e2e.ts` - Webview e2e test examples

**Key Pattern**: Frame switching for webview access:
```typescript
await webview.open();  // Switch into webview iframe
await expect($('h1')).toHaveText('Hello World!');
await webview.close(); // Switch back to VS Code context
```

## Marquee
**Repository**: https://github.com/stateful/marquee

**Relevant Files**:
- `packages/extension/tests/__mocks__/vscode.ts` - Comprehensive vscode mock
- `packages/extension/tests/gui.view.test.ts` - Webview unit tests

**Key Pattern**: Mock webview panel for unit testing:
```typescript
vscode.window.createWebviewPanel = jest.fn().mockReturnValue({
  webview: {
    onDidReceiveMessage: jest.fn(),
    postMessage: jest.fn(),
  }
});
```

---

# When to Use Each Approach

| Approach | Use Case |
|----------|----------|
| **Cypress Standalone** | UI rendering, user interactions, form validation |
| **Jest + vscode mock** | Message handlers, state logic, unit behavior |
| **vscode-extension-tester** | Extension activation, command registration |
| **wdio-vscode-service** | Full integration with VS Code (when needed) |
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Cypress Standalone Webview Testing Infrastructure

Successfully implemented a complete testing infrastructure for webview UIs following the Nx Console pattern.

### Components Created:
1. **VS Code API Mock** (`cypress/support/vscode-mock.ts`) - Captures postMessage calls
2. **Custom Cypress Commands** (`cypress/support/e2e.ts`) - visitWebview, getPostedMessages, etc.
3. **Vite Dev Server** (`vite.config.ts`) - Serves fixtures at localhost:5173
4. **Theme Mock** (`cypress/fixtures/vscode-theme.css`) - VS Code dark theme variables
5. **Test Fixture** (`cypress/webview-fixtures/task-detail.html`) - Task detail webview
6. **Cypress Tests** (`cypress/e2e/task-detail.cy.ts`) - 25 passing tests

### NPM Scripts:
- `npm run test:webview` - Run tests headlessly
- `npm run test:webview:open` - Interactive Cypress mode
- `npm run webview:serve` - Dev server for manual testing

### Reference Repos Documented:
- **Nx Console** - Primary pattern for messaging mock
- **wdio-vscode-service** - Frame switching for full e2e
- **Marquee** - vscode API mocking for unit tests

All 25 tests pass, covering title editing, dropdowns, labels, description, and checklist interactions.
<!-- SECTION:FINAL_SUMMARY:END -->
