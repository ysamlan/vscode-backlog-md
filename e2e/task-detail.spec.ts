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
  getPostedMessages,
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
  linkableTasks: [
    { id: 'TASK-2', title: 'Existing dependency', status: 'To Do' },
    { id: 'TASK-3', title: 'Task blocked by current', status: 'In Progress' },
    { id: 'TASK-4', title: 'Unrelated task', status: 'To Do' },
  ],
  descriptionHtml:
    '<p>This is a sample task description with <strong>markdown</strong> formatting.</p>',
};

const sampleTaskDataWithSubtasks = {
  ...sampleTaskData,
  subtaskSummaries: [
    { id: 'TASK-1.1', title: 'Create auth schema', status: 'Done' },
    { id: 'TASK-1.2', title: 'Implement login endpoint', status: 'In Progress' },
  ],
};

const sampleTaskDataWithMissingDependency = {
  ...sampleTaskData,
  missingDependencyIds: ['TASK-2'],
};

const sampleTaskDataWithEmptyRelationships = {
  ...sampleTaskData,
  task: {
    ...sampleTask,
    dependencies: [],
  },
  blocksTaskIds: [],
};

const sampleTaskDataWithManyLinkableTasks = {
  ...sampleTaskDataWithEmptyRelationships,
  linkableTasks: Array.from({ length: 20 }, (_, i) => {
    const id = `TASK-${i + 10}`;
    return { id, title: `Candidate ${i + 10}`, status: 'To Do' };
  }),
};

// A second task for testing task-switch behavior
const secondTask: Task = {
  id: 'TASK-99',
  title: 'Second Task Title',
  status: 'To Do',
  priority: 'high',
  description: 'Completely different description for the second task.',
  labels: ['feature'],
  assignee: ['@bob'],
  milestone: 'v2.0',
  dependencies: [],
  acceptanceCriteria: [],
  definitionOfDone: [],
  filePath: '/test/backlog/tasks/task-99.md',
};

const secondTaskData = {
  ...sampleTaskData,
  task: secondTask,
  descriptionHtml: '<p>Completely different description for the second task.</p>',
};

const readOnlyTaskData = {
  ...sampleTaskData,
  task: {
    ...sampleTask,
    id: 'TASK-REMOTE-1',
    title: 'Cross Branch Task',
    source: 'local-branch',
    branch: 'feature/filter-fix',
    filePath: '/workspace/.backlog/branches/feature/backlog/tasks/task-remote-1.md',
  },
  isReadOnly: true,
  readOnlyReason: 'Task is from branch feature/filter-fix and is read-only.',
  subtaskSummaries: [{ id: 'TASK-REMOTE-1.1', title: 'Child', status: 'To Do' }],
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

    test('shows priority icon next to select', async ({ page }) => {
      const icon = page.locator('[data-testid="priority-icon-medium"]');
      await expect(icon).toBeVisible();
      await expect(icon).toHaveAttribute('title', 'Medium');
    });

    test('priority icon updates when priority changes', async ({ page }) => {
      // Initially medium
      await expect(page.locator('[data-testid="priority-icon-medium"]')).toBeVisible();

      // Simulate priority change to high by re-sending task data
      await postMessageToWebview(page, {
        type: 'taskData',
        data: {
          ...sampleTaskData,
          task: { ...sampleTask, priority: 'high' },
        },
      });
      await page.waitForTimeout(50);

      await expect(page.locator('[data-testid="priority-icon-high"]')).toBeVisible();
      await expect(page.locator('[data-testid="priority-icon-medium"]')).toHaveCount(0);
    });

    test('priority icon disappears when priority is cleared', async ({ page }) => {
      // Initially has a priority icon
      await expect(page.locator('[data-testid="priority-icon-medium"]')).toBeVisible();

      // Simulate priority cleared
      await postMessageToWebview(page, {
        type: 'taskData',
        data: {
          ...sampleTaskData,
          task: { ...sampleTask, priority: undefined },
        },
      });
      await page.waitForTimeout(50);

      await expect(page.locator('.priority-icon')).toHaveCount(0);
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

    test('label text is clickable and sends filterByLabel message', async ({ page }) => {
      await clearPostedMessages(page);

      await page.locator('[data-testid="label-link-bug"]').click();

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'filterByLabel',
        label: 'bug',
      });
    });

    test('clicking different labels sends different filterByLabel messages', async ({ page }) => {
      await clearPostedMessages(page);

      await page.locator('[data-testid="label-link-urgent"]').click();

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'filterByLabel',
        label: 'urgent',
      });
    });

    test('label link has filter tooltip', async ({ page }) => {
      await expect(page.locator('[data-testid="label-link-bug"]')).toHaveAttribute(
        'title',
        'Filter by bug'
      );
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
      await expect(page.locator('[data-testid="markdown-editor"]')).toBeVisible();
      await expect(page.locator('[data-testid="edit-description-btn"]')).toHaveText('Done');
    });

    test('toggles to edit mode when clicking description', async ({ page }) => {
      await page.locator('[data-testid="description-view"]').click();

      await expect(page.locator('[data-testid="markdown-editor"]')).toBeVisible();
    });

    test('returns to view mode on Escape', async ({ page }) => {
      await page.locator('[data-testid="edit-description-btn"]').click();
      await expect(page.locator('.TinyMDE')).toBeVisible();
      await page.keyboard.press('Escape');

      await expect(page.locator('[data-testid="description-view"]')).toBeVisible();
      await expect(page.locator('[data-testid="markdown-editor"]')).not.toBeVisible();
    });

    test('exits edit mode when clicking outside the editor', async ({ page }) => {
      await page.locator('[data-testid="edit-description-btn"]').click();
      await expect(page.locator('[data-testid="markdown-editor"]')).toBeVisible();

      // Click outside the editor (on the task ID in the header)
      await page.locator('[data-testid="task-id"]').click();

      await expect(page.locator('[data-testid="description-view"]')).toBeVisible();
      await expect(page.locator('[data-testid="markdown-editor"]')).not.toBeVisible();
    });

    test('sends message when clicking Done', async ({ page }) => {
      await page.locator('[data-testid="edit-description-btn"]').click();
      // Wait for TinyMDE to initialize and type into it
      const tinyMDE = page.locator('.TinyMDE');
      await expect(tinyMDE).toBeVisible();
      await tinyMDE.click();
      await page.keyboard.press('Control+A');
      await page.keyboard.type('New description');
      await clearPostedMessages(page);
      await page.locator('[data-testid="edit-description-btn"]').click();

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'updateField',
        field: 'description',
        value: 'New description',
      });
    });

    test('exits edit mode and shows new description when switching tasks', async ({ page }) => {
      // Enter edit mode on TASK-1
      await page.locator('[data-testid="edit-description-btn"]').click();
      await expect(page.locator('[data-testid="markdown-editor"]')).toBeVisible();

      // Switch to a different task
      await postMessageToWebview(page, { type: 'taskData', data: secondTaskData });
      await page.waitForTimeout(50);

      // Should exit edit mode and show the new task's description
      await expect(page.locator('[data-testid="description-view"]')).toBeVisible();
      await expect(page.locator('[data-testid="markdown-editor"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="description-view"]')).toContainText(
        'Completely different description'
      );
      // Button should say "Edit" not "Done"
      await expect(page.locator('[data-testid="edit-description-btn"]')).toHaveText('Edit');
    });

    test('stays in edit mode when description is echoed back after save', async ({ page }) => {
      // Enter edit mode
      await page.locator('[data-testid="edit-description-btn"]').click();
      const editorContainer = page.locator('[data-testid="markdown-editor"]');
      await expect(editorContainer).toBeVisible();

      // Type something new in TinyMDE
      const tinyMDE = page.locator('.TinyMDE');
      await tinyMDE.click();
      await page.keyboard.press('Control+A');
      await page.keyboard.type('Updated description text');

      // Simulate the extension echoing back the saved description (same task ID)
      await postMessageToWebview(page, {
        type: 'taskData',
        data: {
          ...sampleTaskData,
          task: { ...sampleTask, description: 'Updated description text' },
          descriptionHtml: '<p>Updated description text</p>',
        },
      });
      await page.waitForTimeout(50);

      // Should still be in edit mode with the editor visible
      await expect(editorContainer).toBeVisible();
      await expect(page.locator('[data-testid="description-view"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="edit-description-btn"]')).toHaveText('Done');
    });

    test('editor content is NOT reset when extension echoes back saved content', async ({
      page,
    }) => {
      // This reproduces a cursor-jump / content-reset bug:
      // 1. User types in editor
      // 2. Debounce fires (1000ms), sends updateField to extension
      // 3. Extension writes file, re-parses, sends taskData back
      // 4. content prop changes → $effect.pre fires → editor.setContent() resets cursor

      // Enter edit mode
      await page.locator('[data-testid="edit-description-btn"]').click();
      const tinyMDE = page.locator('.TinyMDE');
      await expect(tinyMDE).toBeVisible();

      // Type appended text at the end (don't replace all)
      await tinyMDE.click();
      await page.keyboard.press('End');
      await page.keyboard.type(' APPENDED_TEXT');

      // Read the editor content BEFORE echo-back
      const contentBefore = await tinyMDE.textContent();
      expect(contentBefore).toContain('APPENDED_TEXT');

      // Wait for debounce to fire (1000ms + buffer)
      await page.waitForTimeout(1200);

      // Verify debounce fired by checking for updateField message
      const messages = await getPostedMessages(page);
      const updateMsg = messages.find((m) => m.type === 'updateField' && m.field === 'description');
      expect(updateMsg).toBeTruthy();

      // NOW simulate extension echoing back the saved content
      const echoedDescription = updateMsg!.value as string;
      await postMessageToWebview(page, {
        type: 'taskData',
        data: {
          ...sampleTaskData,
          task: { ...sampleTask, description: echoedDescription },
          descriptionHtml: `<p>${echoedDescription}</p>`,
        },
      });
      await page.waitForTimeout(100);

      // CRITICAL: The editor content must still contain APPENDED_TEXT
      const contentAfter = await tinyMDE.textContent();
      expect(contentAfter).toContain('APPENDED_TEXT');

      // Now type MORE text — it should append where the cursor was, not at the top
      await page.keyboard.type(' AND_MORE');
      const contentFinal = await tinyMDE.textContent();

      // If cursor was reset to top, "AND_MORE" would appear before the original text
      // If cursor stayed at end, it appears after APPENDED_TEXT
      expect(contentFinal).toContain('APPENDED_TEXT AND_MORE');
    });

    test('toolbar button click does not reset cursor position', async ({ page }) => {
      // Toolbar buttons apply formatting then fire a change event.
      // Verifies that clicking a toolbar button doesn't cause cursor to jump
      // after the debounce fires and the extension echoes back content.

      // Enter edit mode
      await page.locator('[data-testid="edit-description-btn"]').click();
      const tinyMDE = page.locator('.TinyMDE');
      await expect(tinyMDE).toBeVisible();

      // Type text at the end
      await tinyMDE.click();
      await page.keyboard.press('End');
      await page.keyboard.type(' MARKER');
      await page.waitForTimeout(50);

      // Click a toolbar button (bold). This applies formatting at cursor.
      const boldButton = page.locator('.TMCommandButton').first();
      await boldButton.click();
      await page.waitForTimeout(50);

      // IMPORTANT: Click back into the editor to restore focus (toolbar took it),
      // but do NOT press End — just click at the end of the text.
      // Actually, after clicking bold, type directly to see where cursor lands.
      // First, re-focus the editor content area:
      await tinyMDE.click();
      // Don't press End — we want to see where the cursor naturally is

      // Wait for debounce to fire
      await page.waitForTimeout(1200);

      // Simulate extension echo-back
      const messages = await getPostedMessages(page);
      const updateMsg = messages.find((m) => m.type === 'updateField' && m.field === 'description');
      if (updateMsg) {
        await postMessageToWebview(page, {
          type: 'taskData',
          data: {
            ...sampleTaskData,
            task: { ...sampleTask, description: updateMsg.value as string },
            descriptionHtml: `<p>${updateMsg.value}</p>`,
          },
        });
        await page.waitForTimeout(100);
      }

      // Type more without re-establishing cursor — just type directly
      await page.keyboard.type('PROBE');
      const contentFinal = await tinyMDE.textContent();

      // The PROBE text should NOT appear at the very start (cursor jumped to top)
      expect(contentFinal).not.toMatch(/^PROBE/);
      // Content should still have our original text
      expect(contentFinal).toContain('MARKER');
      expect(contentFinal).toContain('PROBE');
    });

    test('debounce firing does not reset cursor position', async ({ page }) => {
      // Verifies that when the debounce callback fires (updating lastSetContent
      // and calling onUpdate), it does NOT trigger $effect.pre or reset the cursor.

      // Enter edit mode
      await page.locator('[data-testid="edit-description-btn"]').click();
      const tinyMDE = page.locator('.TinyMDE');
      await expect(tinyMDE).toBeVisible();

      // Type text at the end
      await tinyMDE.click();
      await page.keyboard.press('End');
      await page.keyboard.type(' TYPED');

      // Wait for debounce to fire
      await page.waitForTimeout(1200);

      // Type more text — should appear right after " TYPED", not at the top
      await page.keyboard.type('_AFTER');
      const content = await tinyMDE.textContent();
      expect(content).toContain('TYPED_AFTER');
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

    test('Edit button shows markdown editor for editing', async ({ page }) => {
      await page.locator('[data-testid="acceptanceCriteria-edit-btn"]').click();

      await expect(page.locator('[data-testid="markdown-editor"]')).toBeVisible();
      await expect(page.locator('[data-testid="acceptanceCriteria-edit-btn"]')).toHaveText('Done');
      // Checklist items should be hidden in edit mode
      await expect(page.locator('[data-testid="acceptanceCriteria-item-1"]')).not.toBeVisible();
    });

    test('sends updateField message when editing and clicking Done', async ({ page }) => {
      await page.locator('[data-testid="acceptanceCriteria-edit-btn"]').click();
      const tinyMDE = page.locator('.TinyMDE');
      await expect(tinyMDE).toBeVisible();
      await tinyMDE.click();
      await page.keyboard.press('Control+A');
      await page.keyboard.type('- [ ] #1 New criterion');
      await clearPostedMessages(page);
      await page.locator('[data-testid="acceptanceCriteria-edit-btn"]').click();

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'updateField',
        field: 'acceptanceCriteria',
        value: '- [ ] #1 New criterion',
      });
    });

    test('Escape in edit mode exits without saving changes', async ({ page }) => {
      await page.locator('[data-testid="acceptanceCriteria-edit-btn"]').click();
      await expect(page.locator('.TinyMDE')).toBeVisible();
      await page.keyboard.press('Escape');

      // Should exit edit mode and show checklist items
      await expect(page.locator('[data-testid="markdown-editor"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="acceptanceCriteria-item-1"]')).toBeVisible();
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

    test('Edit button shows markdown editor for editing', async ({ page }) => {
      await page.locator('[data-testid="definitionOfDone-edit-btn"]').click();

      await expect(page.locator('[data-testid="markdown-editor"]')).toBeVisible();
      await expect(page.locator('[data-testid="definitionOfDone-edit-btn"]')).toHaveText('Done');
    });

    test('sends updateField message when editing and clicking Done', async ({ page }) => {
      await page.locator('[data-testid="definitionOfDone-edit-btn"]').click();
      const tinyMDE = page.locator('.TinyMDE');
      await expect(tinyMDE).toBeVisible();
      await tinyMDE.click();
      await page.keyboard.press('Control+A');
      await page.keyboard.type('- [x] #1 Tests pass');
      await clearPostedMessages(page);
      await page.locator('[data-testid="definitionOfDone-edit-btn"]').click();

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'updateField',
        field: 'definitionOfDone',
        value: '- [x] #1 Tests pass',
      });
    });
  });

  test.describe('Actions', () => {
    test('sends openFile message when clicking Open Markdown', async ({ page }) => {
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
    test('does not show "None" placeholders for empty blocked-by/blocks in editable mode', async ({
      page,
    }) => {
      await postMessageToWebview(page, {
        type: 'taskData',
        data: sampleTaskDataWithEmptyRelationships,
      });
      await page.waitForTimeout(50);

      await expect(page.locator('[data-testid="blocked-by"] .empty-value')).toHaveCount(0);
      await expect(page.locator('[data-testid="blocks"] .empty-value')).toHaveCount(0);
    });

    test('limits visible dependency suggestions to 10 items', async ({ page }) => {
      await postMessageToWebview(page, {
        type: 'taskData',
        data: sampleTaskDataWithManyLinkableTasks,
      });
      await page.waitForTimeout(50);

      await page.locator('[data-testid="add-blocked-by-input"]').focus();
      await expect(page.locator('[data-testid="blocked-by-suggestions"]')).toBeVisible();
      await expect(page.locator('[data-testid^="blocked-by-suggestion-"]')).toHaveCount(10);
    });

    test('adds blocked-by link from picker and posts addBlockedByLink', async ({ page }) => {
      await clearPostedMessages(page);

      const addBlockedByInput = page.locator('[data-testid="add-blocked-by-input"]');
      await addBlockedByInput.fill('TASK-4');
      await addBlockedByInput.press('Enter');

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'addBlockedByLink',
        taskId: 'TASK-4',
      });
    });

    test('adds blocks link from picker and posts addBlocksLink', async ({ page }) => {
      await clearPostedMessages(page);

      const addBlocksInput = page.locator('[data-testid="add-blocks-input"]');
      await addBlocksInput.fill('TASK-4');
      await page.locator('[data-testid="add-blocks-btn"]').click();

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'addBlocksLink',
        taskId: 'TASK-4',
      });
    });

    test('prevents duplicate blocked-by link submissions', async ({ page }) => {
      await clearPostedMessages(page);

      const addBlockedByInput = page.locator('[data-testid="add-blocked-by-input"]');
      await addBlockedByInput.fill('TASK-2');
      await addBlockedByInput.press('Enter');

      const messages = await getPostedMessages(page);
      expect(messages).toHaveLength(0);
    });

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

    test('sends openTask message when clicking anywhere on a subtask row', async ({ page }) => {
      await postMessageToWebview(page, { type: 'taskData', data: sampleTaskDataWithSubtasks });
      await page.waitForTimeout(50);
      await clearPostedMessages(page);

      await page.locator('[data-testid="subtask-item-TASK-1.2"]').click();

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'openTask',
        taskId: 'TASK-1.2',
      });
    });

    test('shows warning indicator for missing dependency links', async ({ page }) => {
      await postMessageToWebview(page, {
        type: 'taskData',
        data: sampleTaskDataWithMissingDependency,
      });
      await page.waitForTimeout(50);

      await expect(page.locator('[data-testid="missing-dependency-warning-TASK-2"]')).toBeVisible();
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

  test.describe('Read-only cross-branch mode', () => {
    test.beforeEach(async ({ page }) => {
      await installVsCodeMock(page);
      await page.goto('/task-detail.html');
      await page.waitForTimeout(100);
      await postMessageToWebview(page, { type: 'taskData', data: readOnlyTaskData });
      await page.waitForTimeout(50);
    });

    test('shows read-only banner with branch context', async ({ page }) => {
      await expect(page.locator('[data-testid="readonly-banner"]')).toContainText(
        'feature/filter-fix'
      );
    });

    test('disables mutating controls', async ({ page }) => {
      await expect(page.locator('[data-testid="title-input"]')).toBeDisabled();
      await expect(page.locator('[data-testid="status-select"]')).toBeDisabled();
      await expect(page.locator('[data-testid="priority-select"]')).toBeDisabled();
      await expect(page.locator('[data-testid="add-label-input"]')).toBeDisabled();
      await expect(page.locator('[data-testid="add-blocked-by-input"]')).toBeDisabled();
      await expect(page.locator('[data-testid="add-blocks-input"]')).toBeDisabled();
      await expect(page.locator('[data-testid="archive-btn"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="add-subtask-btn"]')).toBeDisabled();
    });
  });

  test.describe('Mermaid diagram rendering', () => {
    test('renders mermaid code blocks as SVG diagrams', async ({ page }) => {
      await installVsCodeMock(page);
      await page.goto('/task-detail.html');
      await page.waitForTimeout(100);

      await postMessageToWebview(page, {
        type: 'taskData',
        data: {
          ...sampleTaskData,
          descriptionHtml: '<pre><code class="language-mermaid">graph TD\n  A-->B</code></pre>',
        },
      });

      // Wait for mermaid to render (async + requestAnimationFrame)
      await expect(page.locator('.mermaid svg')).toBeVisible({ timeout: 10000 });
    });

    test('shows error container for invalid mermaid syntax', async ({ page }) => {
      await installVsCodeMock(page);
      await page.goto('/task-detail.html');
      await page.waitForTimeout(100);

      await postMessageToWebview(page, {
        type: 'taskData',
        data: {
          ...sampleTaskData,
          descriptionHtml:
            '<pre><code class="language-mermaid">this is not valid mermaid at all %%% {{{}}}}</code></pre>',
        },
      });

      // Wait for mermaid error to appear
      await expect(page.locator('.mermaid-error')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.mermaid-error-title')).toHaveText('Diagram Error');
    });

    test('does not create mermaid div for non-mermaid code blocks', async ({ page }) => {
      await installVsCodeMock(page);
      await page.goto('/task-detail.html');
      await page.waitForTimeout(100);

      await postMessageToWebview(page, {
        type: 'taskData',
        data: {
          ...sampleTaskData,
          descriptionHtml:
            '<pre><code class="language-javascript">console.log("hello")</code></pre>',
        },
      });
      await page.waitForTimeout(500);

      await expect(page.locator('.mermaid')).toHaveCount(0);
      await expect(page.locator('pre code.language-javascript')).toBeVisible();
    });

    test('edit mode shows raw source, not rendered diagram', async ({ page }) => {
      await installVsCodeMock(page);
      await page.goto('/task-detail.html');
      await page.waitForTimeout(100);

      await postMessageToWebview(page, {
        type: 'taskData',
        data: {
          ...sampleTaskData,
          task: {
            ...sampleTask,
            description: '```mermaid\ngraph TD\n  A-->B\n```',
          },
          descriptionHtml: '<pre><code class="language-mermaid">graph TD\n  A-->B</code></pre>',
        },
      });

      // Wait for mermaid to render in view mode
      await expect(page.locator('.mermaid svg')).toBeVisible({ timeout: 10000 });

      // Switch to edit mode
      await page.locator('[data-testid="edit-description-btn"]').click();

      // TinyMDE editor should contain raw markdown, not SVG
      const editor = page.locator('.TinyMDE');
      await expect(editor).toBeVisible();
      await expect(editor).toContainText('mermaid');
      await expect(editor).toContainText('A-->B');

      // SVG should no longer be visible (view mode is hidden)
      await expect(page.locator('.mermaid svg')).not.toBeVisible();
    });
  });

  test.describe('Angle-bracket markdown safety', () => {
    test('renders angle-bracket type strings as visible text', async ({ page }) => {
      await installVsCodeMock(page);
      await page.goto('/task-detail.html');
      await page.waitForTimeout(100);

      await postMessageToWebview(page, {
        type: 'taskData',
        data: {
          ...sampleTaskData,
          task: {
            ...sampleTask,
            description: 'Returns Result<List<MenuItem>> from the API.',
          },
          descriptionHtml: '<p>Returns Result&lt;List&lt;MenuItem&gt;&gt; from the API.</p>',
        },
      });
      await page.waitForTimeout(50);

      const descriptionView = page.locator('[data-testid="description-view"]');
      await expect(descriptionView).toContainText('Result<List<MenuItem>>');
      await expect(descriptionView).toContainText('from the API');
    });
  });
});
