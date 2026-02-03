# E2E Testing for VS Code Extensions - Lessons Learned

## Summary

This document captures our investigation into e2e testing approaches for the vscode-backlog-md extension, what we tried with wdio-vscode-service, and the decision to switch to vscode-extension-tester.

## What We Tried: wdio-vscode-service

### Setup
- WebdriverIO v8.46.0 with wdio-vscode-service v6.1.4
- TypeScript test files with Mocha framework
- Test workspace with sample backlog tasks

### Issues Encountered

#### 1. TypeScript/ESM Module Compilation Error
**Symptom:** `error TS1479: The current file is a CommonJS module whose imports will produce 'require' calls; however, the referenced file is an ECMAScript module`

**Root Cause:** `@wdio/globals` is ESM-only, but ts-node was treating `.ts` files as CommonJS because `package.json` lacks `"type": "module"`.

**Solution:** Renamed test files to `.mts` extension and used `"module": "NodeNext"` in tsconfig.e2e.json. This resolved the compilation error.

#### 2. Session Creation Timeout
**Symptom:** `TimeoutError: Timeout awaiting 'response' for 30000ms` when creating WebDriver session. VSCode launches (DevTools listening message appears) but chromedriver session never connects.

**What we observed:**
- Proxy server starts on a port (e.g., 62764)
- ChromeDriver starts successfully
- VSCode binary launches multiple times at 30-second intervals
- Session creation POST request times out

**What we tried:**
- Using Node.js 20.18.0 via fnm (based on [reported Node 20.19+ ESM issues](https://github.com/zowe/zowe-explorer-vscode/issues/3529)) - **Did not help**
- Increasing connection timeout - Not recommended, masked underlying issue
- Clearing cached VSCode download - Did not help

**Possible root causes we didn't fully investigate:**
- The wdio-vscode-service proxy communication between VSCode extension host and test harness may be failing silently
- VSCode 1.108.2 may have compatibility issues with wdio-vscode-service v6
- The `--disable-extensions` flag combined with `--extension-development-path` may have interaction issues

### wdio-vscode-service Status (as of Feb 2026)
- Latest version: 6.1.4 (requires WebdriverIO ^8.32.2)
- [PR #130 for WebdriverIO v9 support](https://github.com/webdriverio-community/wdio-vscode-service/pull/130) has been open since July 2024, maintainer lacks bandwidth
- Several open issues about session timeouts and VSCode version compatibility (#152, #153)

## Decision: Switch to vscode-extension-tester

### Reasons
1. **Active maintenance**: Red Hat maintains it for their extensions
2. **Simpler architecture**: Uses Selenium WebDriver directly, fewer abstraction layers
3. **Better documentation**: Comprehensive wiki with examples
4. **Proven track record**: Used by major extensions

### vscode-extension-tester Overview
- **Repository**: https://github.com/redhat-developer/vscode-extension-tester
- **Installation**: `npm install --save-dev vscode-extension-tester`
- **Node.js**: 20, 22 LTS supported
- **VSCode**: 1.106.x - 1.108.x supported

### Key Features
- Automated VSCode and ChromeDriver downloads
- Extension packaging and installation
- Selenium WebDriver-based UI automation
- Page Objects API for common VS Code elements

## Best Practices for VS Code Extension Testing

### Testing Pyramid

1. **Unit Tests (Foundation)**
   - Use vitest/jest with manual mocks for `vscode` module
   - Create `__mocks__/vscode.ts` with mock implementations
   - Test business logic in isolation (parsers, transformers, etc.)
   - Fast, no VS Code instance required

2. **Integration Tests (Middle)**
   - Use `@vscode/test-cli` and `@vscode/test-electron`
   - Run in Extension Development Host
   - Test extension activation, command registration
   - Access real VS Code API

3. **E2E/UI Tests (Top)**
   - Use vscode-extension-tester for UI automation
   - Test webview interactions, drag-and-drop
   - Slower, but catches UI regressions

### Unit Testing with Mocks

From [Microsoft ISE blog](https://devblogs.microsoft.com/ise/testing-vscode-extensions-with-typescript/):

```typescript
// __mocks__/vscode.ts
export const window = {
  showInformationMessage: jest.fn(),
  showErrorMessage: jest.fn(),
};

export const workspace = {
  getConfiguration: jest.fn(() => ({
    get: jest.fn(),
  })),
};
```

### Official VS Code Testing

From [VS Code docs](https://code.visualstudio.com/api/working-with-extensions/testing-extension):

```bash
npm install --save-dev @vscode/test-cli @vscode/test-electron
```

```javascript
// .vscode-test.js
const { defineConfig } = require('@vscode/test-cli');
module.exports = defineConfig({ files: 'out/test/**/*.test.js' });
```

## Successful Setup: vscode-extension-tester

### What We Did (2026-02-03)

1. **Removed wdio dependencies**: Cleaned up `@wdio/*`, `wdio-vscode-service`, `expect-webdriverio`, `ts-node`, `tsx`
2. **Installed vscode-extension-tester**: `npm install --save-dev vscode-extension-tester chai @types/chai`
3. **Created test file**: `src/test/e2e/extension.test.ts` with 3 basic tests
4. **Created tsconfig.e2e.json**: Compiles e2e tests to `out/test/e2e/`
5. **Created .mocharc.json**: Mocha configuration with 30s timeout
6. **Created .vscodeignore**: Reduces VSIX package size
7. **Updated npm script**: `npm run test:e2e` now uses extest CLI

### Test Results

All 3 tests passing:
- ✅ should load VS Code successfully
- ✅ should have the Backlog activity bar item
- ✅ should open the Backlog sidebar

### Running E2E Tests

```bash
npm run test:e2e
```

This will:
1. Build the extension
2. Compile e2e tests with TypeScript
3. Download VS Code and ChromeDriver (cached after first run)
4. Package and install the extension
5. Run tests in a real VS Code instance

### Node.js Version

The `test:e2e` script uses `fnm exec --using=22` to run with Node 22.x (the latest supported version). This avoids compatibility warnings from vscode-extension-tester.

## How Claude Can Run Exploratory UI Tests

### Running E2E Tests

Claude can run the existing e2e test suite:

```bash
npm run test:e2e
```

This validates that the extension loads and basic UI elements are present.

### Writing New E2E Tests

To add exploratory tests, Claude can create/modify `src/test/e2e/extension.test.ts`:

```typescript
import { expect } from 'chai';
import { ActivityBar, SideBarView, Workbench } from 'vscode-extension-tester';

describe('Exploratory Tests', function () {
  this.timeout(30000);

  it('should display tasks in Kanban view', async function () {
    // Open Backlog sidebar
    const activityBar = new ActivityBar();
    const backlogControl = await activityBar.getViewControl('Backlog');
    await backlogControl?.openView();

    // Interact with sidebar content
    const sidebar = new SideBarView();
    const content = await sidebar.getContent();
    // ... assertions
  });
});
```

### Available Page Objects

vscode-extension-tester provides page objects for common VS Code elements:

- `Workbench` - Main VS Code window
- `ActivityBar` - Left sidebar icons
- `SideBarView` - Sidebar content area
- `EditorView` - Editor tabs and content
- `BottomBarPanel` - Terminal, Problems, Output panels
- `InputBox` - Command palette, quick picks
- `Notification` - Toast notifications

See: https://github.com/redhat-developer/vscode-extension-tester/wiki

### Limitations for Webview Testing

**Important**: vscode-extension-tester can interact with VS Code's native UI, but **webview content runs in an iframe** and requires special handling:

1. **WebView class**: Use `new WebView()` to switch context into the webview iframe
2. **Limited access**: Can find elements but complex interactions may be difficult
3. **Alternative**: For deep webview testing, consider unit testing the HTML generation in providers

### Example: Accessing Webview Content

```typescript
import { WebView } from 'vscode-extension-tester';

it('should render Kanban webview', async function () {
  // Open the Kanban view first...

  const webview = new WebView();
  await webview.switchToFrame();

  // Now you can find elements inside the webview
  const kanbanBoard = await webview.findWebElement(By.css('.kanban-board'));
  expect(kanbanBoard).to.not.be.undefined;

  // Switch back to VS Code context
  await webview.switchBack();
});
```

### Quick Exploratory Workflow

1. Run `npm run test:e2e` to verify baseline
2. Add a new `it()` block in `extension.test.ts`
3. Use page objects to interact with UI
4. Run tests again to see results
5. Remove exploratory tests or keep as regression tests

## Next Steps

1. **Add more e2e tests**: Test Kanban webview rendering, task interactions
2. **Improve unit test coverage**: Add vscode mocks for business logic
3. **Consider @vscode/test-electron**: For integration tests that need real VS Code API

## References

- [wdio-vscode-service docs](https://webdriver.io/docs/wdio-vscode-service/)
- [wdio-vscode-service GitHub](https://github.com/webdriverio-community/wdio-vscode-service)
- [vscode-extension-tester GitHub](https://github.com/redhat-developer/vscode-extension-tester)
- [VS Code Testing Extensions](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [Testing VS Code Extensions with TypeScript (Microsoft ISE)](https://devblogs.microsoft.com/ise/testing-vscode-extensions-with-typescript/)
