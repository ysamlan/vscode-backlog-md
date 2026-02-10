/**
 * Task Preview Panel Webview E2E Tests
 *
 * Tests the TaskPreviewView / CompactTaskDetails Svelte component in isolation
 * using the VS Code mock, following the pattern from task-detail.spec.ts.
 */
import { test, expect } from '@playwright/test';
import {
  installVsCodeMock,
  postMessageToWebview,
  getLastPostedMessage,
  getPostedMessages,
  clearPostedMessages,
} from './fixtures/vscode-mock';
import type { Task } from '../src/webview/lib/types';

const sampleTask: Task & { blocksTaskIds?: string[] } = {
  id: 'TASK-10',
  title: 'Implement preview panel',
  status: 'In Progress',
  priority: 'high',
  description: 'A detailed description of the task.',
  labels: ['ui', 'feature'],
  assignee: ['@alice', '@bob'],
  dependencies: ['TASK-5'],
  parentTaskId: 'TASK-3',
  acceptanceCriteria: [],
  definitionOfDone: [],
  filePath: '/test/backlog/tasks/task-10.md',
  updatedAt: '2026-01-15',
  blocksTaskIds: ['TASK-20'],
};

const samplePreviewData = {
  type: 'taskPreviewData' as const,
  task: sampleTask,
  statuses: ['To Do', 'In Progress', 'Done'],
  isReadOnly: false,
  subtaskSummaries: [
    {
      id: 'TASK-10.1',
      title: 'Design mockup',
      status: 'Done',
      filePath: '/test/backlog/tasks/task-10.1.md',
    },
    {
      id: 'TASK-10.2',
      title: 'Write tests',
      status: 'To Do',
      filePath: '/test/backlog/tasks/task-10.2.md',
    },
  ],
};

const readOnlyPreviewData = {
  type: 'taskPreviewData' as const,
  task: {
    ...sampleTask,
    id: 'TASK-REMOTE-5',
    title: 'Cross Branch Preview Task',
    source: 'local-branch' as const,
    branch: 'feature/other-work',
    filePath: '/workspace/.backlog/branches/feature/backlog/tasks/task-remote-5.md',
  },
  statuses: ['To Do', 'In Progress', 'Done'],
  isReadOnly: true,
  readOnlyReason: 'Task is from feature/other-work and is read-only.',
  subtaskSummaries: [],
};

test.describe('Task Preview Panel', () => {
  test.describe('Rendering', () => {
    test.beforeEach(async ({ page }) => {
      await installVsCodeMock(page);
      await page.goto('/task-preview.html');
      await page.waitForTimeout(100);
      await postMessageToWebview(page, samplePreviewData);
      await page.waitForTimeout(50);
    });

    test('displays task ID', async ({ page }) => {
      await expect(page.locator('[data-testid="compact-details-task-id"]')).toHaveText('TASK-10');
    });

    test('displays task title', async ({ page }) => {
      await expect(page.locator('[data-testid="compact-details-title"]')).toHaveText(
        'Implement preview panel'
      );
    });

    test('displays status badge', async ({ page }) => {
      await expect(page.locator('.compact-status-chip')).toHaveText('In Progress');
    });

    test('displays priority chip', async ({ page }) => {
      const priorityChip = page.locator('.compact-priority-chip');
      await expect(priorityChip).toBeVisible();
      await expect(priorityChip).toHaveText('P1');
      await expect(priorityChip).toHaveAttribute('title', 'High');
    });

    test('displays labels', async ({ page }) => {
      await expect(page.locator('.compact-meta-lines')).toContainText('ui, feature');
    });

    test('displays assignees', async ({ page }) => {
      await expect(page.locator('.compact-meta-lines')).toContainText('@alice, @bob');
    });

    test('displays dependencies (blocked by)', async ({ page }) => {
      const depLink = page.locator('.compact-related-link').filter({ hasText: 'TASK-5' });
      await expect(depLink).toBeVisible();
    });

    test('displays blocks relationships', async ({ page }) => {
      const blocksLink = page.locator('.compact-related-link').filter({ hasText: 'TASK-20' });
      await expect(blocksLink).toBeVisible();
    });

    test('displays parent task link', async ({ page }) => {
      const parentLink = page.locator('.compact-related-link').filter({ hasText: 'TASK-3' });
      await expect(parentLink).toBeVisible();
    });

    test('displays subtask summaries', async ({ page }) => {
      const subtasksList = page.locator('[data-testid="compact-subtasks-list"]');
      await expect(subtasksList).toBeVisible();

      await expect(page.locator('[data-testid="compact-subtask-item-TASK-10.1"]')).toContainText(
        'Design mockup'
      );
      await expect(page.locator('[data-testid="compact-subtask-item-TASK-10.2"]')).toContainText(
        'Write tests'
      );
    });

    test('displays description text', async ({ page }) => {
      await expect(page.locator('.compact-description')).toContainText(
        'A detailed description of the task.'
      );
    });

    test('displays updated date chip', async ({ page }) => {
      // Date is locale-formatted by formatStoredUtcDateForDisplay, so check for "Updated" prefix and year
      await expect(page.locator('.compact-updated-chip')).toContainText('Updated');
      await expect(page.locator('.compact-updated-chip')).toContainText('2026');
    });
  });

  test.describe('Empty and loading state', () => {
    test('shows placeholder when no task data is sent', async ({ page }) => {
      await installVsCodeMock(page);
      await page.goto('/task-preview.html');
      await page.waitForTimeout(100);

      await expect(page.locator('.compact-empty')).toHaveText('Select a task to view details.');
    });
  });

  test.describe('Clear state', () => {
    test('returns to empty state when taskPreviewCleared is sent', async ({ page }) => {
      await installVsCodeMock(page);
      await page.goto('/task-preview.html');
      await page.waitForTimeout(100);

      // First inject data
      await postMessageToWebview(page, samplePreviewData);
      await page.waitForTimeout(50);
      await expect(page.locator('[data-testid="compact-details-task-id"]')).toHaveText('TASK-10');

      // Then clear
      await postMessageToWebview(page, { type: 'taskPreviewCleared' });
      await page.waitForTimeout(50);

      await expect(page.locator('.compact-empty')).toHaveText('Select a task to view details.');
      await expect(page.locator('[data-testid="compact-details-task-id"]')).toHaveCount(0);
    });
  });

  test.describe('Actions', () => {
    test.beforeEach(async ({ page }) => {
      await installVsCodeMock(page);
      await page.goto('/task-preview.html');
      await page.waitForTimeout(100);
      await postMessageToWebview(page, samplePreviewData);
      await page.waitForTimeout(50);
    });

    test('Edit button sends openTask message', async ({ page }) => {
      await clearPostedMessages(page);

      await page.locator('[data-testid="open-full-detail-btn"]').click();

      const message = await getLastPostedMessage(page);
      expect(message).toMatchObject({
        type: 'openTask',
        taskId: 'TASK-10',
      });
    });

    test('status select change sends updateTask message', async ({ page }) => {
      await clearPostedMessages(page);

      await page.locator('[data-testid="compact-status-select"]').selectOption('Done');

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'updateTask',
        taskId: 'TASK-10',
        updates: { status: 'Done' },
      });
    });

    test('priority select change sends updateTask message', async ({ page }) => {
      await clearPostedMessages(page);

      await page.locator('[data-testid="compact-priority-select"]').selectOption('low');

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'updateTask',
        taskId: 'TASK-10',
        updates: { priority: 'low' },
      });
    });

    test('priority cleared sends updateTask with undefined priority', async ({ page }) => {
      await clearPostedMessages(page);

      await page.locator('[data-testid="compact-priority-select"]').selectOption('');

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'updateTask',
        taskId: 'TASK-10',
        updates: { priority: undefined },
      });
    });

    test('subtask click sends selectTask message', async ({ page }) => {
      await clearPostedMessages(page);

      await page.locator('[data-testid="compact-subtask-item-TASK-10.1"]').click();

      const message = await getLastPostedMessage(page);
      expect(message).toMatchObject({
        type: 'selectTask',
        taskId: 'TASK-10.1',
      });
    });

    test('dependency link click sends selectTask message', async ({ page }) => {
      await clearPostedMessages(page);

      await page.locator('.compact-related-link').filter({ hasText: 'TASK-5' }).click();

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'selectTask',
        taskId: 'TASK-5',
      });
    });

    test('blocks link click sends selectTask message', async ({ page }) => {
      await clearPostedMessages(page);

      await page.locator('.compact-related-link').filter({ hasText: 'TASK-20' }).click();

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'selectTask',
        taskId: 'TASK-20',
      });
    });

    test('parent task link click sends selectTask message', async ({ page }) => {
      await clearPostedMessages(page);

      await page.locator('.compact-related-link').filter({ hasText: 'TASK-3' }).click();

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'selectTask',
        taskId: 'TASK-3',
      });
    });
  });

  test.describe('Read-only behavior', () => {
    test.beforeEach(async ({ page }) => {
      await installVsCodeMock(page);
      await page.goto('/task-preview.html');
      await page.waitForTimeout(100);
      await postMessageToWebview(page, readOnlyPreviewData);
      await page.waitForTimeout(50);
    });

    test('shows read-only banner with branch context', async ({ page }) => {
      await expect(page.locator('[data-testid="compact-readonly-banner"]')).toContainText(
        'feature/other-work'
      );
    });

    test('status select is disabled', async ({ page }) => {
      await expect(page.locator('[data-testid="compact-status-select"]')).toBeDisabled();
    });

    test('priority select is disabled', async ({ page }) => {
      await expect(page.locator('[data-testid="compact-priority-select"]')).toBeDisabled();
    });
  });

  test('sends refresh message on mount', async ({ page }) => {
    await installVsCodeMock(page);
    await page.goto('/task-preview.html');
    await page.waitForTimeout(200);

    const messages = await getPostedMessages(page);
    expect(messages.some((m) => m.type === 'refresh')).toBe(true);
  });
});
