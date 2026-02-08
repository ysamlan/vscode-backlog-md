/**
 * Task Detail Webview E2E Tests
 *
 * Tests the TaskDetail Svelte component in isolation using the VS Code mock.
 */
import { test, expect } from '@playwright/test';
import {
  installVsCodeMock,
  postMessageToWebview,
  getLastPostedMessage,
  clearPostedMessages,
} from './fixtures/vscode-mock';
import type { Task } from '../src/webview/lib/types';

// Sample task data for testing
const sampleTask: Task = {
  id: 'TASK-1',
  title: 'Sample Task Title',
  status: 'In Progress',
  priority: 'medium',
  description: 'This is a sample task description with **markdown** formatting.',
  labels: ['bug', 'urgent'],
  assignee: ['@alice'],
  milestone: 'v1.0',
  dependencies: ['TASK-2'],
  acceptanceCriteria: [
    { id: 1, text: 'First acceptance criterion', checked: true },
    { id: 2, text: 'Second acceptance criterion', checked: false },
  ],
  definitionOfDone: [{ id: 1, text: 'Tests pass', checked: false }],
  filePath: '/test/backlog/tasks/task-1.md',
};

const sampleTaskData = {
  task: sampleTask,
  statuses: ['To Do', 'In Progress', 'Done'],
  priorities: ['high', 'medium', 'low'],
  uniqueLabels: ['bug', 'feature', 'urgent'],
  uniqueAssignees: ['@alice', '@bob'],
  milestones: ['v1.0', 'v2.0'],
  blocksTaskIds: ['TASK-3'],
  isBlocked: true,
  descriptionHtml:
    '<p>This is a sample task description with <strong>markdown</strong> formatting.</p>',
};

test.describe('Task Detail', () => {
  test.beforeEach(async ({ page }) => {
    await installVsCodeMock(page);
    await page.goto('/task-detail.html');
    // Wait for component to mount and request data
    await page.waitForTimeout(100);
    // Send task data to the webview
    await postMessageToWebview(page, { type: 'taskData', data: sampleTaskData });
    // Wait for render
    await page.waitForTimeout(50);
  });

  test.describe('Header', () => {
    test('displays the task ID', async ({ page }) => {
      await expect(page.locator('[data-testid="task-id"]')).toHaveText('TASK-1');
    });

    test('displays the task title in an editable input', async ({ page }) => {
      await expect(page.locator('[data-testid="title-input"]')).toHaveValue('Sample Task Title');
    });

    test('updates title on blur and sends message', async ({ page }) => {
      await clearPostedMessages(page);

      const titleInput = page.locator('[data-testid="title-input"]');
      await titleInput.clear();
      await titleInput.fill('Updated Title');
      await titleInput.blur();

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'updateField',
        field: 'title',
        value: 'Updated Title',
      });
    });

    test('updates title on Enter key', async ({ page }) => {
      await clearPostedMessages(page);

      const titleInput = page.locator('[data-testid="title-input"]');
      await titleInput.clear();
      await titleInput.fill('New Title');
      await titleInput.press('Enter');

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'updateField',
        field: 'title',
        value: 'New Title',
      });
    });

    test('reverts title on Escape key', async ({ page }) => {
      const titleInput = page.locator('[data-testid="title-input"]');
      await titleInput.clear();
      await titleInput.fill('Temporary Title');
      await titleInput.press('Escape');

      await expect(titleInput).toHaveValue('Sample Task Title');
    });

    test('shows blocked badge when task is blocked', async ({ page }) => {
      await expect(page.locator('[data-testid="blocked-badge"]')).toBeVisible();
    });

    test('long title wraps to multiple lines in textarea', async ({ page }) => {
      const longTitle =
        'This is a very long task title that should wrap to multiple lines in the textarea element instead of being truncated';
      await postMessageToWebview(page, {
        type: 'taskData',
        data: {
          ...sampleTaskData,
          task: { ...sampleTask, title: longTitle },
        },
      });
      await page.waitForTimeout(100);

      const titleEl = page.locator('[data-testid="title-input"]');
      await expect(titleEl).toHaveValue(longTitle);

      // Textarea should be taller than a single line (single line ~25px, wrapped should be more)
      const box = await titleEl.boundingBox();
      expect(box).toBeTruthy();
      expect(box!.height).toBeGreaterThan(30);
    });
  });

  test.describe('Status Dropdown', () => {
    test('displays the current status', async ({ page }) => {
      await expect(page.locator('[data-testid="status-select"]')).toHaveValue('In Progress');
    });

    test('sends message when status changes', async ({ page }) => {
      await clearPostedMessages(page);

      await page.locator('[data-testid="status-select"]').selectOption('Done');

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'updateField',
        field: 'status',
        value: 'Done',
      });
    });
  });

  test.describe('Priority Dropdown', () => {
    test('displays the current priority', async ({ page }) => {
      await expect(page.locator('[data-testid="priority-select"]')).toHaveValue('medium');
    });

    test('sends message when priority changes', async ({ page }) => {
      await clearPostedMessages(page);

      await page.locator('[data-testid="priority-select"]').selectOption('high');

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'updateField',
        field: 'priority',
        value: 'high',
      });
    });

    test('sends undefined when priority is cleared', async ({ page }) => {
      await clearPostedMessages(page);

      await page.locator('[data-testid="priority-select"]').selectOption('');

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'updateField',
        field: 'priority',
        value: undefined,
      });
    });
  });

  test.describe('Labels', () => {
    test('displays existing labels', async ({ page }) => {
      await expect(page.locator('.label').filter({ hasText: 'bug' })).toBeVisible();
      await expect(page.locator('.label').filter({ hasText: 'urgent' })).toBeVisible();
    });

    test('adds a new label on Enter', async ({ page }) => {
      await clearPostedMessages(page);

      const labelInput = page.locator('[data-testid="add-label-input"]');
      await labelInput.fill('new-label');
      await labelInput.press('Enter');

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'updateField',
        field: 'labels',
        value: ['bug', 'urgent', 'new-label'],
      });
    });

    test('removes a label when clicking X', async ({ page }) => {
      await clearPostedMessages(page);

      await page.locator('[data-testid="remove-label-bug"]').click();

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'updateField',
        field: 'labels',
        value: ['urgent'],
      });
    });
  });

  test.describe('Description', () => {
    test('displays the description content with markdown', async ({ page }) => {
      const descriptionView = page.locator('[data-testid="description-view"]');
      await expect(descriptionView).toContainText('sample task description');
      await expect(descriptionView.locator('strong')).toHaveText('markdown');
    });

    test('toggles to edit mode when clicking Edit button', async ({ page }) => {
      await page.locator('[data-testid="edit-description-btn"]').click();

      await expect(page.locator('[data-testid="description-view"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="description-textarea"]')).toBeVisible();
      await expect(page.locator('[data-testid="edit-description-btn"]')).toHaveText('Done');
    });

    test('toggles to edit mode when clicking description', async ({ page }) => {
      await page.locator('[data-testid="description-view"]').click();

      await expect(page.locator('[data-testid="description-textarea"]')).toBeVisible();
    });

    test('returns to view mode on Escape', async ({ page }) => {
      await page.locator('[data-testid="edit-description-btn"]').click();
      await page.locator('[data-testid="description-textarea"]').press('Escape');

      await expect(page.locator('[data-testid="description-view"]')).toBeVisible();
      await expect(page.locator('[data-testid="description-textarea"]')).not.toBeVisible();
    });

    test('sends message when clicking Done', async ({ page }) => {
      await page.locator('[data-testid="edit-description-btn"]').click();
      await page.locator('[data-testid="description-textarea"]').fill('New description');
      await clearPostedMessages(page);
      await page.locator('[data-testid="edit-description-btn"]').click();

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'updateField',
        field: 'description',
        value: 'New description',
      });
    });
  });

  test.describe('Acceptance Criteria', () => {
    test('displays progress indicator', async ({ page }) => {
      await expect(page.locator('[data-testid="acceptanceCriteria-progress"]')).toContainText(
        '1 of 2 complete'
      );
    });

    test('displays checklist items with correct state', async ({ page }) => {
      await expect(page.locator('[data-testid="acceptanceCriteria-item-1"]')).toHaveClass(
        /checked/
      );
      await expect(page.locator('[data-testid="acceptanceCriteria-item-2"]')).not.toHaveClass(
        /checked/
      );
    });

    test('sends message when clicking a checklist item', async ({ page }) => {
      await clearPostedMessages(page);

      await page.locator('[data-testid="acceptanceCriteria-item-2"] button').click();

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'toggleChecklistItem',
        listType: 'acceptanceCriteria',
        itemId: 2,
      });
    });
  });

  test.describe('Definition of Done', () => {
    test('displays progress indicator', async ({ page }) => {
      await expect(page.locator('[data-testid="definitionOfDone-progress"]')).toContainText(
        '0 of 1 complete'
      );
    });

    test('sends message when clicking a checklist item', async ({ page }) => {
      await clearPostedMessages(page);

      await page.locator('[data-testid="definitionOfDone-item-1"] button').click();

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'toggleChecklistItem',
        listType: 'definitionOfDone',
        itemId: 1,
      });
    });
  });

  test.describe('Actions', () => {
    test('sends openFile message when clicking Open Raw Markdown', async ({ page }) => {
      await clearPostedMessages(page);

      await page.locator('[data-testid="open-file-btn"]').click();

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({ type: 'openFile' });
    });

    test('sends archiveTask message when clicking Archive', async ({ page }) => {
      await clearPostedMessages(page);

      await page.locator('[data-testid="archive-btn"]').click();

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({ type: 'archiveTask', taskId: 'TASK-1' });
    });
  });

  test.describe('Dependencies', () => {
    test('sends openTask message when clicking a blocked-by link', async ({ page }) => {
      await clearPostedMessages(page);

      await page.locator('[data-testid="dependency-link-TASK-2"]').click();

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'openTask',
        taskId: 'TASK-2',
      });
    });

    test('sends openTask message when clicking a blocks link', async ({ page }) => {
      await clearPostedMessages(page);

      await page.locator('[data-testid="blocks-link-TASK-3"]').click();

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'openTask',
        taskId: 'TASK-3',
      });
    });
  });

  test('sends refresh message on mount', async ({ page }) => {
    // Need a fresh page to capture the initial refresh message
    await installVsCodeMock(page);
    await page.goto('/task-detail.html');
    await page.waitForTimeout(200);

    const message = await getLastPostedMessage(page);
    expect(message).toEqual({ type: 'refresh' });
  });
});
