---
id: TASK-142
title: Add CDP-based cross-view e2e tests using Playwright-Electron
status: To Do
assignee: []
created_date: '2026-02-11 00:10'
labels:
  - testing
  - e2e
  - enhancement
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Now that we have a working mechanism for driving VS Code via raw CDP (Chrome DevTools Protocol) over WebSocket — including interacting with webview content inside nested iframes — we should leverage this for e2e tests that verify cross-view interactions.

## Motivation

The screenshot generation script (scripts/screenshots/generate.ts) proved out a robust pattern for:
1. Launching VS Code as an Electron app with `--remote-debugging-port`
2. Connecting via raw CDP WebSocket (not Playwright's `_electron.launch()` which fails because VS Code's Electron build strips `--remote-debugging-pipe`)
3. Navigating the UI via command palette (F1 → type → Enter)
4. Interacting with webview iframe content (task selection in kanban/list views)
5. Verifying side effects across multiple views

This enables testing scenarios that are impossible with our current test tiers:
- Unit tests can't test cross-view coordination
- Playwright webview tests can only test a single webview in isolation
- vscode-extension-tester (ExTester) can't interact with webview content

## Test Scenarios to Cover

- Clicking a task card in kanban view updates both the DETAILS preview panel and (if open) the task editor
- Changing task status in the detail editor updates the kanban board column placement
- Creating a new task via the Create Task panel adds it to the list/kanban views
- Switching between kanban/list/dashboard views preserves the selected task
- Drag-and-drop in kanban updates the detail panel and task file on disk

## Technical Approach (proven in screenshot generation)

### CDP Connection Pattern
```typescript
// Launch VS Code with CDP port
spawn(binary, [workspace, '--extensionDevelopmentPath=.', '--remote-debugging-port=9334', ...]);

// Wait for CDP endpoint
const resp = await fetch('http://127.0.0.1:9334/json/list');
const page = list.find(e => e.type === 'page');

// Connect via WebSocket
const ws = new WebSocket(page.webSocketDebuggerUrl);
```

### Webview Iframe Access
VS Code webviews have a layered architecture:
- Main page → vscode-webview:// outer frame → inner content iframe (Svelte app)

To interact with webview content:
1. `Target.setDiscoverTargets({ discover: true })` — needed to see iframe targets
2. `Target.getTargets()` — find vscode-webview iframe targets
3. `Target.attachToTarget({ targetId, flatten: true })` — get a CDP session
4. `Runtime.evaluate` in the session — access the outer frame
5. `iframe.contentDocument` — access the inner frame (same-origin!)
6. Create events using inner frame's constructors: `new win.MouseEvent('click', ...)` — Svelte handlers only fire with events created in the correct JS context

### Command Palette Interaction
```typescript
await cdpKeyPress(cdp, 'Escape'); // dismiss existing
await cdpKeyPress(cdp, 'F1');     // open command palette
await cdpType(cdp, 'Command Name', 40); // type command
await cdpKeyPress(cdp, 'Enter');  // execute
```

## Implementation Notes

- On headless Linux (CI), use `xvfb-run -a --server-args="-screen 0 3200x2100x24"` for a virtual display
- Use separate `--user-data-dir` per test to avoid state leakage
- Platform-aware binary detection: `.vscode-test/VSCode-linux-x64/code` (Linux) vs `.vscode-test/Visual Studio Code.app/Contents/MacOS/Electron` (macOS)
- Set `ELECTRON_DISABLE_GPU=1` on Linux
- VS Code 1.109+ puts theme class on `.monaco-workbench` (not `document.body`)
<!-- SECTION:DESCRIPTION:END -->
