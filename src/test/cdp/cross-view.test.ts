/**
 * CDP-based cross-view E2E tests.
 *
 * These tests launch VS Code with a real extension instance and use CDP
 * to interact with multiple webviews, verifying cross-view coordination:
 *   - Kanban click -> preview update
 *   - Status change in detail -> kanban column move
 *   - View switch preserves selection
 *   - Drag-and-drop updates file on disk
 *   - Active task highlighting
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  sleep,
  cdpScreenshot,
  executeCommand,
  dismissNotifications,
  resetEditorState,
} from './lib/cdp-helpers';
import { launchVsCode, closeVsCode, type VsCodeInstance } from './lib/vscode-launcher';
import {
  clickInWebview,
  clickButtonInWebview,
  getWebviewTextContent,
  queryWebviewElement,
  setSelectValueInWebview,
  dragAndDropInWebview,
  typeInWebviewInput,
  isElementFocusedInWebview,
  getInputValueInWebview,
  elementExistsInWebview,
  clearWebviewSessionCache,
} from './lib/webview-helpers';
import {
  waitForExtensionReady,
  waitForWebviewContent,
  waitForFileContent,
} from './lib/wait-helpers';
import {
  createTestWorkspace,
  resetTestWorkspace,
  cleanupTestWorkspace,
  taskFilePath,
} from './lib/test-workspace';

const SCREENSHOT_DIR = path.resolve(__dirname, '../../../.vscode-test/screenshots');
const CDP_PORT = 9340;

let instance: VsCodeInstance;
let workspacePath: string;

describe('Cross-view CDP tests', () => {
  beforeAll(async () => {
    // Create isolated workspace
    workspacePath = createTestWorkspace();
    console.log(`Test workspace: ${workspacePath}`);

    // Launch VS Code
    instance = await launchVsCode({
      workspacePath,
      cdpPort: CDP_PORT,
    });
    console.log('VS Code launched, waiting for extension...');

    // Wait for workbench and extension to fully activate
    await waitForExtensionReady(instance.cdp);
    await dismissNotifications(instance.cdp);
    console.log('Extension ready.');
  }, 90_000);

  afterAll(async () => {
    if (instance) {
      closeVsCode(instance);
    }
    if (workspacePath) {
      cleanupTestWorkspace(workspacePath);
    }
  }, 15_000);

  beforeEach(async () => {
    // Invalidate cached webview sessions (views may have refreshed)
    clearWebviewSessionCache();
    // Reset task files to original state
    resetTestWorkspace(workspacePath);
    // Close all editors, dismiss dialogs
    await resetEditorState(instance.cdp);
    await dismissNotifications(instance.cdp);
    // Trigger a refresh so the extension re-reads the reset files
    await executeCommand(instance.cdp, 'backlog.refresh');
    // Wait for the tasks webview to have content (signal-based, not blind sleep)
    await waitForWebviewContent(instance.cdp, 'tasks', 'TASK-', { timeoutMs: 10_000 });
  }, 30_000);

  afterEach(async (ctx) => {
    // On failure, capture a diagnostic screenshot
    if (ctx.task.result?.state === 'fail') {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
      const name = ctx.task.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const screenshotPath = path.join(SCREENSHOT_DIR, `${name}.png`);
      try {
        await cdpScreenshot(instance.cdp, screenshotPath);
        console.log(`Failure screenshot: ${screenshotPath}`);
      } catch {
        console.log('Failed to capture diagnostic screenshot');
      }
    }
  });

  it('clicking task in kanban updates preview panel', async () => {
    // 1. Ensure kanban is open
    await executeCommand(instance.cdp, 'backlog.openKanban');
    await waitForWebviewContent(instance.cdp, 'tasks', 'TASK-', { timeoutMs: 10_000 });

    // 2. Click TASK-2 card in the tasks webview
    const clicked = await clickInWebview(instance.cdp, 'tasks', '[data-task-id="TASK-2"]');
    expect(clicked).toBe(true);

    // 3. Wait for preview webview to contain TASK-2 info
    const previewText = await waitForWebviewContent(instance.cdp, 'preview', 'TASK-2', {
      timeoutMs: 10_000,
    });

    // 4. Assert preview shows the correct task
    expect(previewText).toContain('TASK-2');
    expect(previewText).toContain('Implement user authentication');
  }, 30_000);

  it('status change in preview panel updates kanban', async () => {
    // 1. Open kanban view, click TASK-1 to select it
    await executeCommand(instance.cdp, 'backlog.openKanban');
    await waitForWebviewContent(instance.cdp, 'tasks', 'TASK-', { timeoutMs: 10_000 });

    const clicked = await clickInWebview(instance.cdp, 'tasks', '[data-task-id="TASK-1"]');
    expect(clicked).toBe(true);

    // 2. Wait for preview to show TASK-1
    await waitForWebviewContent(instance.cdp, 'preview', 'TASK-1', { timeoutMs: 10_000 });

    // 3. Change status to "In Progress" via the preview panel's compact status select
    const changed = await setSelectValueInWebview(
      instance.cdp,
      'preview',
      '[data-testid="compact-status-select"]',
      'In Progress'
    );
    expect(changed).toBe(true);

    // 4. Wait for the file to be updated on disk
    const taskFile = taskFilePath(workspacePath, 'task-1 - Test-task-for-e2e.md');
    const content = await waitForFileContent(taskFile, 'status: In Progress', {
      timeoutMs: 15_000,
    });
    expect(content).toContain('status: In Progress');

    // 5. Wait for kanban to refresh and verify TASK-1 is in "In Progress" column
    const columnCheck = await waitForWebviewContent(
      instance.cdp,
      'tasks',
      (text) => {
        // The kanban should have refreshed by the time the file is written
        return text.includes('TASK-1');
      },
      { timeoutMs: 10_000 }
    );
    expect(columnCheck).toBeTruthy();

    const column = await queryWebviewElement(
      instance.cdp,
      'tasks',
      `
      const card = doc.querySelector('[data-task-id="TASK-1"]');
      if (!card) return 'card-not-found';
      const column = card.closest('.kanban-column');
      if (!column) return 'column-not-found';
      const header = column.querySelector('.column-header, .kanban-column-header, h3, h2');
      return header?.textContent ?? 'no-header';
      `
    );
    expect(String(column)).toContain('In Progress');
  }, 60_000);

  it('view switch preserves selected task in preview', async () => {
    // 1. Open kanban, select TASK-3
    await executeCommand(instance.cdp, 'backlog.openKanban');
    await waitForWebviewContent(instance.cdp, 'tasks', 'TASK-', { timeoutMs: 10_000 });

    const clicked = await clickInWebview(instance.cdp, 'tasks', '[data-task-id="TASK-3"]');
    expect(clicked).toBe(true);

    // Verify preview shows TASK-3
    const previewBefore = await waitForWebviewContent(instance.cdp, 'preview', 'TASK-3', {
      timeoutMs: 10_000,
    });
    expect(previewBefore).toContain('TASK-3');

    // 2. Switch to list view via keybinding
    clearWebviewSessionCache();
    await executeCommand(instance.cdp, 'backlog.showListView');
    await waitForWebviewContent(instance.cdp, 'tasks', 'TASK-', { timeoutMs: 10_000 });

    // 3. Preview should still show TASK-3
    const previewAfter = await getWebviewTextContent(instance.cdp, 'preview');
    expect(previewAfter).toContain('TASK-3');

    // 4. Switch back to kanban
    clearWebviewSessionCache();
    await executeCommand(instance.cdp, 'backlog.showKanbanView');
    await waitForWebviewContent(instance.cdp, 'tasks', 'TASK-', { timeoutMs: 10_000 });

    // Preview should still show TASK-3
    const previewFinal = await getWebviewTextContent(instance.cdp, 'preview');
    expect(previewFinal).toContain('TASK-3');
  }, 45_000);

  it('drag-and-drop in kanban updates file on disk', async () => {
    // 1. Open kanban view
    await executeCommand(instance.cdp, 'backlog.openKanban');
    await waitForWebviewContent(instance.cdp, 'tasks', 'TASK-', { timeoutMs: 10_000 });

    // 2. Drag TASK-1 (To Do) to the "In Progress" column's task-list
    //    The drop handler is on .task-list[data-status="In Progress"]
    const dropped = await dragAndDropInWebview(
      instance.cdp,
      'tasks',
      '[data-task-id="TASK-1"]',
      '.task-list[data-status="In Progress"]'
    );
    expect(dropped).toBe(true);

    // 3. Wait for the file write propagation
    const taskFile = taskFilePath(workspacePath, 'task-1 - Test-task-for-e2e.md');
    const content = await waitForFileContent(taskFile, 'status: In Progress', {
      timeoutMs: 15_000,
    });
    expect(content).toContain('status: In Progress');
  }, 45_000);

  it('active task highlighting when detail panel opens', async () => {
    // 1. Open kanban, check TASK-1 does NOT have active-edited class
    await executeCommand(instance.cdp, 'backlog.openKanban');
    await waitForWebviewContent(instance.cdp, 'tasks', 'TASK-', { timeoutMs: 10_000 });

    const beforeClass = await queryWebviewElement(
      instance.cdp,
      'tasks',
      `
      const card = doc.querySelector('[data-task-id="TASK-1"]');
      if (!card) return 'card-not-found';
      return card.classList.contains('active-edited') ? 'has-class' : 'no-class';
      `
    );
    expect(beforeClass).toBe('no-class');

    // 2. Select TASK-1 to show it in the preview panel
    const clicked = await clickInWebview(instance.cdp, 'tasks', '[data-task-id="TASK-1"]');
    expect(clicked).toBe(true);

    // Wait for preview to load
    await waitForWebviewContent(instance.cdp, 'preview', 'TASK-1', { timeoutMs: 10_000 });

    // 3. Click the "Edit" button in the preview to open the full detail panel
    const editClicked = await clickButtonInWebview(instance.cdp, 'preview', 'Edit');
    expect(editClicked).toBe(true);

    // 4. Wait for detail panel to load, then verify TASK-1 card has active-edited class
    await waitForWebviewContent(instance.cdp, 'detail', 'TASK-1', { timeoutMs: 10_000 });

    // Give the activeEditedTaskChanged message time to propagate
    const afterClass = await waitForActiveEditedClass(instance.cdp, 'TASK-1');
    expect(afterClass).toBe('has-class');
  }, 45_000);

  it('switching tasks in kanban updates both preview and open detail panel', async () => {
    // 1. Open kanban, select TASK-1, open edit panel
    await executeCommand(instance.cdp, 'backlog.openKanban');
    await waitForWebviewContent(instance.cdp, 'tasks', 'TASK-', { timeoutMs: 10_000 });

    await clickInWebview(instance.cdp, 'tasks', '[data-task-id="TASK-1"]');
    await waitForWebviewContent(instance.cdp, 'preview', 'TASK-1', { timeoutMs: 10_000 });

    // Open the full detail panel via the "Edit" button
    const editClicked = await clickButtonInWebview(instance.cdp, 'preview', 'Edit');
    expect(editClicked).toBe(true);

    // Wait for detail panel to show TASK-1
    await waitForWebviewContent(instance.cdp, 'detail', 'TASK-1', { timeoutMs: 10_000 });
    const detailBefore = await getWebviewTextContent(instance.cdp, 'detail');
    // Title is in an <input> so not in textContent; check the description instead
    expect(detailBefore).toContain('sample task used for e2e testing');

    // 2. Click TASK-3 in the kanban (different task)
    await clickInWebview(instance.cdp, 'tasks', '[data-task-id="TASK-3"]');

    // 3. Preview should update to TASK-3
    const previewAfter = await waitForWebviewContent(instance.cdp, 'preview', 'TASK-3', {
      timeoutMs: 10_000,
    });
    expect(previewAfter).toContain('TASK-3');

    // 4. Detail panel should also update to TASK-3
    //    (because TaskDetailProvider.hasActivePanel() returns true,
    //    so selectTask in TasksViewProvider also sends openTaskDetail)
    const detailAfter = await waitForWebviewContent(instance.cdp, 'detail', 'TASK-3', {
      timeoutMs: 10_000,
    });
    // Title is in an <input> so check description text instead
    expect(detailAfter).toContain('Users are not redirected to the dashboard');
  }, 60_000);

  it('description field resets when switching tasks while editing (regression)', async () => {
    // Regression test for bb2babe / f122d9a:
    // When editing description on TASK-1 and clicking TASK-3, the detail panel
    // should switch to TASK-3's description (not show TASK-1's stale content).

    // 1. Open kanban, select TASK-1, open edit panel
    await executeCommand(instance.cdp, 'backlog.openKanban');
    await waitForWebviewContent(instance.cdp, 'tasks', 'TASK-', { timeoutMs: 10_000 });

    await clickInWebview(instance.cdp, 'tasks', '[data-task-id="TASK-1"]');
    await waitForWebviewContent(instance.cdp, 'preview', 'TASK-1', { timeoutMs: 10_000 });

    const editClicked = await clickButtonInWebview(instance.cdp, 'preview', 'Edit');
    expect(editClicked).toBe(true);
    await waitForWebviewContent(instance.cdp, 'detail', 'TASK-1', { timeoutMs: 10_000 });

    // 2. Click the "Edit" button on the description section to enter edit mode
    const descEditClicked = await clickInWebview(
      instance.cdp,
      'detail',
      '[data-testid="edit-description-btn"]'
    );
    expect(descEditClicked).toBe(true);

    // Wait for textarea to appear
    await waitForElement(instance.cdp, 'detail', '[data-testid="description-textarea"]');

    // 3. Type some extra text into the textarea
    const typed = await typeInWebviewInput(
      instance.cdp,
      'detail',
      '[data-testid="description-textarea"]',
      ' EXTRA TEXT SHOULD NOT PERSIST'
    );
    expect(typed).toBe(true);

    // 4. NOW click TASK-3 in the kanban (switch tasks while editing)
    await clickInWebview(instance.cdp, 'tasks', '[data-task-id="TASK-3"]');

    // 5. Wait for detail panel to switch to TASK-3
    const detailAfter = await waitForWebviewContent(instance.cdp, 'detail', 'TASK-3', {
      timeoutMs: 10_000,
    });

    // 6. The description should be TASK-3's description, NOT TASK-1's stale text
    expect(detailAfter).toContain('Users are not redirected to the dashboard');
    expect(detailAfter).not.toContain('EXTRA TEXT SHOULD NOT PERSIST');

    // 7. The description textarea should NOT be in editing mode
    //    (isEditing is reset on task switch)
    const textareaStillExists = await elementExistsInWebview(
      instance.cdp,
      'detail',
      '[data-testid="description-textarea"]'
    );
    expect(textareaStillExists).toBe(false);

    // The view mode description should be visible instead
    const viewExists = await elementExistsInWebview(
      instance.cdp,
      'detail',
      '[data-testid="description-view"]'
    );
    expect(viewExists).toBe(true);
  }, 60_000);

  it('description textarea retains focus after debounce save (regression)', async () => {
    // Regression test for 5a1c20e:
    // While typing in the description textarea, the debounce auto-save (1000ms)
    // triggers a file write + refresh cycle. The textarea should keep focus and
    // the user should remain in edit mode.

    // 1. Open kanban, select TASK-1, open edit panel
    await executeCommand(instance.cdp, 'backlog.openKanban');
    await waitForWebviewContent(instance.cdp, 'tasks', 'TASK-', { timeoutMs: 10_000 });

    await clickInWebview(instance.cdp, 'tasks', '[data-task-id="TASK-1"]');
    await waitForWebviewContent(instance.cdp, 'preview', 'TASK-1', { timeoutMs: 10_000 });

    const editClicked = await clickButtonInWebview(instance.cdp, 'preview', 'Edit');
    expect(editClicked).toBe(true);
    await waitForWebviewContent(instance.cdp, 'detail', 'TASK-1', { timeoutMs: 10_000 });

    // 2. Enter description edit mode
    const descEditClicked = await clickInWebview(
      instance.cdp,
      'detail',
      '[data-testid="edit-description-btn"]'
    );
    expect(descEditClicked).toBe(true);
    await waitForElement(instance.cdp, 'detail', '[data-testid="description-textarea"]');

    // 3. Type some text into the description textarea
    const typed = await typeInWebviewInput(
      instance.cdp,
      'detail',
      '[data-testid="description-textarea"]',
      'New description content for testing debounce'
    );
    expect(typed).toBe(true);

    // 4. Wait for debounce interval (1000ms) + file write + refresh cycle
    //    This sleep is intentional — we're testing that the debounce save
    //    does NOT disrupt focus, so we must wait for it to fire.
    await sleep(3000);

    // 5. Verify textarea is STILL visible (edit mode was not exited)
    const textareaStillExists = await elementExistsInWebview(
      instance.cdp,
      'detail',
      '[data-testid="description-textarea"]'
    );
    expect(textareaStillExists).toBe(true);

    // 6. Verify the textarea still has focus
    const stillFocused = await isElementFocusedInWebview(
      instance.cdp,
      'detail',
      '[data-testid="description-textarea"]'
    );
    expect(stillFocused).toBe(true);

    // 7. Verify the typed content is preserved (not reverted to original)
    const value = await getInputValueInWebview(
      instance.cdp,
      'detail',
      '[data-testid="description-textarea"]'
    );
    expect(value).toContain('New description content for testing debounce');
  }, 60_000);
});

/**
 * Wait for the active-edited class to appear on a task card in the kanban.
 * Polls because the message propagation from detail -> tasks is async.
 */
async function waitForActiveEditedClass(
  cdp: CdpClient,
  taskId: string,
  timeoutMs = 10_000
): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await queryWebviewElement(
      cdp,
      'tasks',
      `
      const card = doc.querySelector('[data-task-id="${taskId}"]');
      if (!card) return 'card-not-found';
      return card.classList.contains('active-edited') ? 'has-class' : 'no-class';
      `
    );
    if (result === 'has-class') return 'has-class';
    await sleep(200);
  }
  return 'no-class';
}

/**
 * Wait for an element to exist in a webview.
 */
async function waitForElement(
  cdp: CdpClient,
  role: import('./lib/webview-helpers').WebviewRole,
  selector: string,
  timeoutMs = 5_000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const exists = await elementExistsInWebview(cdp, role, selector);
    if (exists) return;
    await sleep(200);
  }
  throw new Error(`Element "${selector}" not found in webview "${role}" within ${timeoutMs}ms`);
}

// Re-export CdpClient type for inline helpers
type CdpClient = import('./lib/CdpClient').CdpClient;
