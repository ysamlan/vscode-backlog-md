---
id: TASK-62
title: Research webview e2e testing approaches from other extensions
status: Done
assignee: []
created_date: '2026-02-03 17:53'
updated_date: '2026-02-03 18:07'
labels:
  - testing
  - research
  - dx
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Research how other VS Code extensions successfully test webviews with wdio-vscode-service or similar tools.

Reference: https://github.com/webdriverio-community/wdio-vscode-service

Extensions to investigate:
- **Marquee** - https://github.com/stateful/marquee
- **Live Server** - https://github.com/ritwickdey/vscode-live-server  
- **Nx Console** - https://github.com/nrwl/nx-console

Research questions:
1. How do they structure their e2e tests?
2. How do they access/interact with webview content?
3. What testing patterns work well for webviews?
4. Do they use any mocking strategies for the vscode API?
5. How do they handle the asynchronous nature of webview loading?

Goal: Determine if we should revisit wdio-vscode-service or continue with vscode-extension-tester, and learn patterns for better webview testing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review Marquee extension test setup
- [x] #2 Review Live Server extension test setup
- [x] #3 Review Nx Console extension test setup
- [x] #4 Document findings and recommended approach
- [x] #5 Decide: stick with vscode-extension-tester or revisit wdio-vscode-service
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Recommendation

## Decision: Adopt a Hybrid Approach

Based on the research, I recommend a **three-tier testing strategy**:

### Tier 1: Unit Tests with vscode Mocking (Current - Keep)
Continue using Vitest with vscode API mocking for:
- Core business logic (parser, writer, file watcher)
- Message handler functions
- State management

### Tier 2: Cypress Standalone for Webview UI (New - Add)
Adopt the Nx Console pattern for webview testing:
- Create a Vite dev server that serves webview HTML/JS
- Mock the VS Code messaging API in Cypress
- Test UI components, form interactions, and rendering
- **This addresses our gap in webview testing**

### Tier 3: Basic E2E with vscode-extension-tester (Current - Keep Limited)
Continue using vscode-extension-tester for:
- Extension activation
- Command registration
- Basic integration tests

### Why Not Switch to wdio-vscode-service?

While wdio-vscode-service has better webview support, the switch has these trade-offs:

**Pros**:
- Built-in `WebView` page object with frame switching
- `getAllWebviews()` and `getWebviewByTitle()` helpers
- Active development and better docs

**Cons**:
- Migration effort from existing vscode-extension-tester setup
- Still requires complex frame switching for webview access
- Slower than Cypress standalone approach

**Verdict**: The Cypress standalone approach (Tier 2) gives us better webview testing coverage with less complexity. Keep vscode-extension-tester for basic e2e unless we hit blocking issues.

## Next Steps
1. Create task to set up Vite dev server for webview testing
2. Add Cypress configuration for webview component tests
3. Create mock for VS Code ↔ webview messaging API
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
# Research Findings: Webview E2E Testing Approaches

## 1. Marquee (https://github.com/stateful/marquee)

**Approach**: Unit testing with Jest + comprehensive vscode API mocking

**Key Patterns**:
- Mock `vscode.window.createWebviewPanel()` with full webview API
- Test message handlers in isolation
- Use snapshot testing for rendered HTML content
- Mock the webview messaging channel (`tangle/webviews.ts`)

**Example from `gui.view.test.ts`**:
```typescript
// Mock webview panel
vscode.window.createWebviewPanel = jest.fn().mockReturnValue({
  onDidChangeViewState: jest.fn(),
  onDidDispose: jest.fn(),
  webview: {
    onDidReceiveMessage: jest.fn(),
    asWebviewUri: jest.fn().mockReturnValue('some url'),
    html: '<html></html>'
  }
})
```

**Pros**: Fast, isolated, easy CI integration
**Cons**: Doesn't test actual webview rendering in browser

---

## 2. Nx Console (https://github.com/nrwl/nx-console)

**Approach**: Cypress e2e tests for webview UI served standalone

**Key Innovation**: They serve the webview UI separately (not inside VS Code) and test with Cypress, mocking the VS Code ↔ webview messaging API.

**Example from `visit-generate-ui.ts`**:
```typescript
export const visitGenerateUi = (schema: GeneratorSchema) =>
  cy.visit('/', {
    onBeforeLoad: (win: any) => {
      // Mock the messaging API
      win.intellijApi = {
        postToWebview(message: string) {
          console.log('posting message to webview', message);
        },
        postToIde(message: string) {
          const messageParsed = JSON.parse(message);
          if (messageParsed.payloadType === 'output-init') {
            win.intellijApi?.postToWebview({
              payloadType: 'generator',
              payload: schema,
            });
          }
        },
      };
    },
  });
```

**Configuration**: Uses Nx's Vite-based dev server to serve webview UI
```typescript
// cypress.config.ts
export default defineConfig({
  e2e: {
    webServerCommands: {
      default: 'nx run generate-ui-v2-e2e:serve',
    },
    baseUrl: 'http://localhost:4200',
  },
});
```

**Pros**: Real browser testing, fast, leverages Cypress ecosystem
**Cons**: Doesn't test integration with actual VS Code extension host

---

## 3. Live Server (https://github.com/ritwickdey/vscode-live-server)

**Approach**: wdio-vscode-service for true e2e tests

**Configuration in `wdio.conf.ts`**:
```typescript
capabilities: [{
  browserName: 'vscode',
  'wdio:vscodeOptions': {
    extensionPath: path.join(__dirname, '..'),
    workspacePath: path.join(__dirname, '..'),
    userSettings: {
      'liveServer.settings.NoBrowser': true
    }
  }
}],
services: ['vscode'],
```

**Test Pattern**: Tests commands and notifications, but limited webview interaction
```typescript
it('should click on Go Live', async () => {
  const workbench = await driver.getWorkbench();
  await workbench.elem.$('div[id="ritwickdey.LiveServer"]').click();
  // Wait for notification...
});
```

**Pros**: Tests actual VS Code behavior
**Cons**: Limited webview testing, more complex setup

---

## 4. wdio-vscode-service WebView Support (Reference Implementation)

**Built-in WebView Page Object** with frame switching:

```typescript
// src/pageobjects/workbench/WebView.ts
export class WebView extends BasePage<typeof WebViewLocators> {
  public async open() {
    await browser.switchToFrame(this.elem);
    await (await this.activeFrame).waitForExist();
    await browser.switchToFrame(await this.activeFrame);
  }

  public async close() {
    await browser.switchToFrame(null);
    await browser.switchToFrame(null);
  }
}
```

**E2E Test Example**:
```typescript
it('should be able to open webview', async () => {
  const workbench = await browser.getWorkbench();
  await workbench.executeCommand('Test Extension: Open WebView');
  
  await browser.waitUntil(async () => 
    (await workbench.getAllWebviews()).length > 0
  );
  
  const webviews = await workbench.getAllWebviews();
  await webviews[0].open();
  
  // Now in webview context - can access DOM elements
  expect(await browser.getPageSource()).toContain('My WebView');
  await expect($('h1')).toHaveText('Hello World!');
  
  await webviews[0].close(); // Return to VS Code context
});

it('should find webview by title', async () => {
  const webview = await workbench.getWebviewByTitle('My WebView');
  await webview.open();
  await expect($('h1')).toHaveText('Hello World!');
  await webview.close();
});
```

**Key APIs**:
- `workbench.getAllWebviews()` - Get all webview instances
- `workbench.getWebviewByTitle(title)` - Find webview by title
- `webview.open()` - Switch to webview context (double frame switch)
- `webview.close()` - Switch back to VS Code context

---

## Summary: Three Strategies

| Strategy | Testing Level | Speed | Coverage | Complexity |
|----------|--------------|-------|----------|------------|
| **Jest + Mocks** (Marquee) | Unit | Fast | Logic only | Low |
| **Cypress Standalone** (Nx) | Component | Fast | UI rendering | Medium |
| **wdio-vscode-service** | Full E2E | Slow | Complete | High |

## Key Takeaways

1. **No single approach tests everything** - Most extensions use a combination
2. **Frame switching is crucial** for webview DOM access in full e2e tests
3. **Cypress standalone** is elegant for webview UI testing without VS Code overhead
4. **wdio-vscode-service has better webview support** than vscode-extension-tester
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Research Complete

Analyzed webview testing approaches from three VS Code extensions:

### Key Findings

1. **Marquee**: Unit tests with Jest + comprehensive vscode API mocking. Tests message handlers in isolation but doesn't test actual rendering.

2. **Nx Console**: Serves webview UI standalone and tests with Cypress. Mocks VS Code messaging API in `onBeforeLoad`. Elegant approach for UI testing.

3. **Live Server**: Uses wdio-vscode-service for true e2e. Good for command/notification testing but limited webview interaction in their tests.

4. **wdio-vscode-service**: Has built-in `WebView` page object with frame switching (`webview.open()`/`webview.close()`), `getAllWebviews()`, and `getWebviewByTitle()` helpers.

### Recommendation: Hybrid Approach

- **Tier 1 (Keep)**: Vitest with vscode mocking for core logic
- **Tier 2 (Add)**: Cypress standalone for webview UI (Nx Console pattern)
- **Tier 3 (Keep)**: vscode-extension-tester for basic e2e

### Decision

**Stick with vscode-extension-tester** for basic e2e. Add **Cypress standalone testing** for webview UI coverage rather than switching to wdio-vscode-service. The Cypress approach gives better webview testing with less complexity.

### Next Steps (Future Tasks)

1. Set up Vite dev server for webview testing
2. Add Cypress configuration for webview component tests
3. Create mock for VS Code ↔ webview messaging API
<!-- SECTION:FINAL_SUMMARY:END -->
