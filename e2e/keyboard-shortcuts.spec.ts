/**
 * Keyboard Shortcuts E2E Tests
 *
 * Tests keyboard shortcut behavior in the Tasks webview including
 * the shortcuts popup, view switching, and input guard logic.
 */
import { test, expect } from '@playwright/test';
import {
  installVsCodeMock,
  postMessageToWebview,
  getPostedMessages,
  clearPostedMessages,
} from './fixtures/vscode-mock';
import type { Task } from '../src/webview/lib/types';

const sampleTasks: Task[] = [
  {
    id: 'TASK-1',
    title: 'Sample task one',
    status: 'To Do',
    labels: [],
    assignee: [],
    dependencies: [],
    acceptanceCriteria: [],
    definitionOfDone: [],
    filePath: '/test/tasks/task-1.md',
    ordinal: 1000,
  },
  {
    id: 'TASK-2',
    title: 'Sample task two',
    status: 'In Progress',
    labels: [],
    assignee: [],
    dependencies: [],
    acceptanceCriteria: [],
    definitionOfDone: [],
    filePath: '/test/tasks/task-2.md',
    ordinal: undefined,
  },
];

async function setupTasksView(page: ReturnType<typeof test.info>['page']) {
  await installVsCodeMock(page);
  await page.goto('/tasks.html');
  await page.waitForTimeout(100);

  await postMessageToWebview(page, {
    type: 'statusesUpdated',
    statuses: ['To Do', 'In Progress', 'Done'],
  });
  await postMessageToWebview(page, { type: 'milestonesUpdated', milestones: [] });
  await postMessageToWebview(page, { type: 'tasksUpdated', tasks: sampleTasks });
  await page.waitForTimeout(100);
}

test.describe('Keyboard Shortcuts', () => {
  test.describe('Shortcuts Popup', () => {
    test.beforeEach(async ({ page }) => {
      await setupTasksView(page);
    });

    test('? key opens and closes shortcuts popup', async ({ page }) => {
      // Popup should not be visible initially
      await expect(page.locator('[data-testid="shortcuts-popup"]')).not.toBeVisible();

      // Press ? to open
      await page.keyboard.type('?');
      await expect(page.locator('[data-testid="shortcuts-popup"]')).toBeVisible();

      // Press ? again to close
      await page.keyboard.type('?');
      await expect(page.locator('[data-testid="shortcuts-popup"]')).not.toBeVisible();
    });

    test('Escape closes shortcuts popup', async ({ page }) => {
      // Open popup
      await page.keyboard.type('?');
      await expect(page.locator('[data-testid="shortcuts-popup"]')).toBeVisible();

      // Press Escape to close
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-testid="shortcuts-popup"]')).not.toBeVisible();
    });

    test('close button closes popup', async ({ page }) => {
      // Open popup
      await page.keyboard.type('?');
      const popup = page.locator('[data-testid="shortcuts-popup"]');
      await expect(popup).toBeVisible();

      // Click the close button
      await page.locator('[data-testid="shortcuts-close-btn"]').click();
      await expect(popup).not.toBeVisible();
    });

    test('? button click opens popup', async ({ page }) => {
      await expect(page.locator('[data-testid="shortcuts-popup"]')).not.toBeVisible();

      await page.locator('[data-testid="shortcuts-help-btn"]').click();
      await expect(page.locator('[data-testid="shortcuts-popup"]')).toBeVisible();
    });
  });

  test.describe('View Switching', () => {
    test.beforeEach(async ({ page }) => {
      await setupTasksView(page);
    });

    test('z/x/c/v keys switch views', async ({ page }) => {
      // Start in kanban view (default)
      await expect(page.locator('#kanban-view')).toBeVisible();

      // Press x - switch to list view
      await clearPostedMessages(page);
      await page.keyboard.press('x');
      await expect(page.locator('#list-view')).toBeVisible();
      const listMsg = await getLastSetViewModeMessage(page);
      expect(listMsg).toMatchObject({ type: 'setViewMode', mode: 'list' });

      // Press z - switch to kanban view
      await clearPostedMessages(page);
      await page.keyboard.press('z');
      await expect(page.locator('#kanban-view')).toBeVisible();
      const kanbanMsg = await getLastSetViewModeMessage(page);
      expect(kanbanMsg).toMatchObject({ type: 'setViewMode', mode: 'kanban' });

      // Press c - switch to drafts view
      await clearPostedMessages(page);
      await page.keyboard.press('c');
      await expect(page.locator('#list-view')).toBeVisible();
      const draftsMsg = await getLastSetViewModeMessage(page);
      expect(draftsMsg).toMatchObject({ type: 'setViewMode', mode: 'drafts' });

      // Press v - switch to archived view
      await clearPostedMessages(page);
      await page.keyboard.press('v');
      await expect(page.locator('#archived-view')).toBeVisible();
      const archivedMsg = await getLastSetViewModeMessage(page);
      expect(archivedMsg).toMatchObject({ type: 'setViewMode', mode: 'archived' });
    });
  });

  test.describe('Input Guard', () => {
    test.beforeEach(async ({ page }) => {
      await setupTasksView(page);
      // Switch to list view to access search input
      await page.keyboard.press('x');
      await page.waitForTimeout(50);
    });

    test('shortcuts do not fire when typing in search input', async ({ page }) => {
      // Focus the search input
      await page.locator('[data-testid="search-input"]').focus();

      // Clear messages and type 'z' (which would switch to kanban if not guarded)
      await clearPostedMessages(page);
      await page.keyboard.press('z');
      await page.waitForTimeout(50);

      // Should still be in list view
      await expect(page.locator('#list-view')).toBeVisible();

      // No setViewMode message should have been sent
      const messages = await getPostedMessages(page);
      const viewModeMessages = messages.filter((m) => m.type === 'setViewMode');
      expect(viewModeMessages).toHaveLength(0);
    });
  });

  test.describe('Action Shortcuts', () => {
    test.beforeEach(async ({ page }) => {
      await setupTasksView(page);
    });

    test('n key sends requestCreateTask message', async ({ page }) => {
      await clearPostedMessages(page);
      await page.keyboard.press('n');
      await page.waitForTimeout(50);

      const messages = await getPostedMessages(page);
      expect(messages).toContainEqual({ type: 'requestCreateTask' });
    });

    test('r key sends refresh message', async ({ page }) => {
      // Note: one refresh fires on mount, so clear and check for a new one
      await clearPostedMessages(page);
      await page.keyboard.press('r');
      await page.waitForTimeout(50);

      const messages = await getPostedMessages(page);
      expect(messages).toContainEqual({ type: 'refresh' });
    });
  });

  test.describe('/ key focuses search input', () => {
    test.beforeEach(async ({ page }) => {
      await setupTasksView(page);
    });

    test('/ focuses search input in list view', async ({ page }) => {
      // Switch to list view
      await page.keyboard.press('x');
      await page.waitForTimeout(50);

      // Press / to focus search
      await page.keyboard.press('/');
      await page.waitForTimeout(50);

      // Search input should be focused
      const searchInput = page.locator('[data-testid="search-input"]');
      await expect(searchInput).toBeFocused();
    });

    test('/ does nothing in kanban view (no search input)', async ({ page }) => {
      // We're in kanban view by default - pressing / should not throw
      await page.keyboard.press('/');
      await page.waitForTimeout(50);

      // Should still be in kanban view
      await expect(page.locator('#kanban-view')).toBeVisible();
    });
  });

  test.describe('Shortcuts blocked when popup is open', () => {
    test.beforeEach(async ({ page }) => {
      await setupTasksView(page);
    });

    test('view switching shortcuts do not fire when popup is open', async ({ page }) => {
      // Start in kanban view
      await expect(page.locator('#kanban-view')).toBeVisible();

      // Open popup
      await page.keyboard.type('?');
      await expect(page.locator('[data-testid="shortcuts-popup"]')).toBeVisible();

      // Press x (list view shortcut) while popup is open
      await clearPostedMessages(page);
      await page.keyboard.press('x');
      await page.waitForTimeout(50);

      // Close popup to check view
      await page.keyboard.press('Escape');
      await page.waitForTimeout(50);

      // Should still be in kanban view
      await expect(page.locator('#kanban-view')).toBeVisible();

      // No setViewMode message should have been sent
      const messages = await getPostedMessages(page);
      const viewModeMessages = messages.filter((m) => m.type === 'setViewMode');
      expect(viewModeMessages).toHaveLength(0);
    });

    test('action shortcuts do not fire when popup is open', async ({ page }) => {
      // Open popup
      await page.keyboard.type('?');
      await expect(page.locator('[data-testid="shortcuts-popup"]')).toBeVisible();

      // Press n (create task shortcut) while popup is open
      await clearPostedMessages(page);
      await page.keyboard.press('n');
      await page.waitForTimeout(50);

      // No requestCreateTask message should have been sent
      const messages = await getPostedMessages(page);
      const createMessages = messages.filter((m) => m.type === 'requestCreateTask');
      expect(createMessages).toHaveLength(0);
    });
  });
});

/** Helper to find the last setViewMode message from posted messages */
async function getLastSetViewModeMessage(page: ReturnType<typeof test.info>['page']) {
  const messages = await getPostedMessages(page);
  return messages.filter((m) => m.type === 'setViewMode').pop();
}
