/**
 * Tasks (Kanban/List) Webview E2E Tests
 *
 * Tests the Tasks Svelte component including Kanban board, List view,
 * and drag-drop functionality.
 */
import { test, expect } from '@playwright/test';
import {
  installVsCodeMock,
  postMessageToWebview,
  getLastPostedMessage,
  clearPostedMessages,
} from './fixtures/vscode-mock';
import type { Task } from '../src/webview/lib/types';

// Sample task data with mixed ordinal/no-ordinal scenarios
const sampleTasks: (Task & { blocksTaskIds?: string[] })[] = [
  // To Do column
  {
    id: 'TASK-1',
    title: 'Task 1 (ordinal: 1000)',
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
    title: 'Task 2 (no ordinal)',
    status: 'To Do',
    labels: [],
    assignee: [],
    dependencies: [],
    acceptanceCriteria: [],
    definitionOfDone: [],
    filePath: '/test/tasks/task-2.md',
    ordinal: undefined,
  },
  {
    id: 'TASK-3',
    title: 'Task 3 (no ordinal)',
    status: 'To Do',
    labels: [],
    assignee: [],
    dependencies: [],
    acceptanceCriteria: [],
    definitionOfDone: [],
    filePath: '/test/tasks/task-3.md',
    ordinal: undefined,
  },
  // In Progress column
  {
    id: 'TASK-4',
    title: 'Task 4 (ordinal: 500)',
    status: 'In Progress',
    labels: [],
    assignee: [],
    dependencies: [],
    acceptanceCriteria: [],
    definitionOfDone: [],
    filePath: '/test/tasks/task-4.md',
    ordinal: 500,
  },
  {
    id: 'TASK-5',
    title: 'Task 5 (ordinal: 1500)',
    status: 'In Progress',
    labels: [],
    assignee: [],
    dependencies: [],
    acceptanceCriteria: [],
    definitionOfDone: [],
    filePath: '/test/tasks/task-5.md',
    ordinal: 1500,
  },
  // Done column
  {
    id: 'TASK-6',
    title: 'Task 6 (no ordinal)',
    status: 'Done',
    labels: [],
    assignee: [],
    dependencies: [],
    acceptanceCriteria: [],
    definitionOfDone: [],
    filePath: '/test/tasks/task-6.md',
    ordinal: undefined,
  },
  {
    id: 'TASK-7',
    title: 'Task 7 (no ordinal)',
    status: 'Done',
    labels: [],
    assignee: [],
    dependencies: [],
    acceptanceCriteria: [],
    definitionOfDone: [],
    filePath: '/test/tasks/task-7.md',
    ordinal: undefined,
  },
];

async function setupTasksView(page: ReturnType<typeof test.info>['page']) {
  await installVsCodeMock(page);
  await page.goto('/tasks.html');
  await page.waitForTimeout(100);

  // Send initial state
  await postMessageToWebview(page, { type: 'viewModeChanged', viewMode: 'kanban' });
  await postMessageToWebview(page, {
    type: 'statusesUpdated',
    statuses: ['To Do', 'In Progress', 'Done'],
  });
  await postMessageToWebview(page, { type: 'milestonesUpdated', milestones: [] });
  await postMessageToWebview(page, { type: 'tasksUpdated', tasks: sampleTasks });
  await page.waitForTimeout(100);
}

test.describe('Tasks View', () => {
  test.describe('Initial State', () => {
    test.beforeEach(async ({ page }) => {
      await setupTasksView(page);
    });

    test('displays cards in correct columns', async ({ page }) => {
      // To Do column should have 3 cards
      const todoCards = page.locator('[data-testid="column-To Do"] .task-card');
      await expect(todoCards).toHaveCount(3);

      // In Progress column should have 2 cards
      const progressCards = page.locator('[data-testid="column-In Progress"] .task-card');
      await expect(progressCards).toHaveCount(2);

      // Done column should have 2 cards
      const doneCards = page.locator('[data-testid="column-Done"] .task-card');
      await expect(doneCards).toHaveCount(2);
    });

    test('displays correct ordinal data attributes', async ({ page }) => {
      await expect(page.locator('[data-testid="task-TASK-1"]')).toHaveAttribute(
        'data-ordinal',
        '1000'
      );
      await expect(page.locator('[data-testid="task-TASK-2"]')).toHaveAttribute('data-ordinal', '');
      await expect(page.locator('[data-testid="task-TASK-3"]')).toHaveAttribute('data-ordinal', '');
      await expect(page.locator('[data-testid="task-TASK-4"]')).toHaveAttribute(
        'data-ordinal',
        '500'
      );
      await expect(page.locator('[data-testid="task-TASK-5"]')).toHaveAttribute(
        'data-ordinal',
        '1500'
      );
      await expect(page.locator('[data-testid="task-TASK-6"]')).toHaveAttribute('data-ordinal', '');
      await expect(page.locator('[data-testid="task-TASK-7"]')).toHaveAttribute('data-ordinal', '');
    });

    test('displays task titles', async ({ page }) => {
      await expect(page.locator('[data-testid="task-TASK-1"]')).toContainText(
        'Task 1 (ordinal: 1000)'
      );
      await expect(page.locator('[data-testid="task-TASK-4"]')).toContainText(
        'Task 4 (ordinal: 500)'
      );
    });
  });

  test.describe('Card Click', () => {
    test.beforeEach(async ({ page }) => {
      await setupTasksView(page);
    });

    test('sends openTask message when clicking a card', async ({ page }) => {
      await clearPostedMessages(page);
      await page.locator('[data-testid="task-TASK-1"]').click();

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'openTask',
        taskId: 'TASK-1',
      });
    });
  });

  test.describe('View Mode Toggle', () => {
    test.beforeEach(async ({ page }) => {
      await setupTasksView(page);
    });

    test('shows kanban view by default', async ({ page }) => {
      const kanbanView = page.locator('#kanban-view');
      await expect(kanbanView).not.toHaveClass(/hidden/);

      const listView = page.locator('#list-view');
      await expect(listView).toHaveClass(/hidden/);
    });

    test('switches to list view when viewModeChanged message received', async ({ page }) => {
      await postMessageToWebview(page, { type: 'viewModeChanged', viewMode: 'list' });
      await page.waitForTimeout(50);

      const kanbanView = page.locator('#kanban-view');
      await expect(kanbanView).toHaveClass(/hidden/);

      const listView = page.locator('#list-view');
      await expect(listView).not.toHaveClass(/hidden/);
    });
  });

  test.describe('Milestone Grouping', () => {
    test.beforeEach(async ({ page }) => {
      await setupTasksView(page);
    });

    test('shows All Tasks button as active by default', async ({ page }) => {
      const allTasksBtn = page.locator('button.grouping-btn[data-grouping="none"]');
      await expect(allTasksBtn).toHaveClass(/active/);
    });

    test('sends toggleMilestoneGrouping message when clicking By Milestone', async ({ page }) => {
      await clearPostedMessages(page);

      await page.locator('button.grouping-btn[data-grouping="milestone"]').click();

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'toggleMilestoneGrouping',
        enabled: true,
      });
    });
  });

  test.describe('List View', () => {
    test.beforeEach(async ({ page }) => {
      await setupTasksView(page);
      await postMessageToWebview(page, { type: 'viewModeChanged', viewMode: 'list' });
      await page.waitForTimeout(50);
    });

    test('displays task table', async ({ page }) => {
      const table = page.locator('.task-table');
      await expect(table).toBeVisible();
    });

    test('displays all tasks in list view', async ({ page }) => {
      const rows = page.locator('tbody tr');
      await expect(rows).toHaveCount(7);
    });

    test('filter by status works', async ({ page }) => {
      await page.locator('button[data-filter="todo"]').click();
      const rows = page.locator('tbody tr');
      await expect(rows).toHaveCount(3);
    });

    test('filter by In Progress status works', async ({ page }) => {
      await page.locator('button[data-filter="in-progress"]').click();
      const rows = page.locator('tbody tr');
      await expect(rows).toHaveCount(2);
    });

    test('search filters tasks', async ({ page }) => {
      await page.locator('[data-testid="search-input"]').fill('Task 1');
      await page.waitForTimeout(50);
      const rows = page.locator('tbody tr');
      await expect(rows).toHaveCount(1);
    });

    test('clicking a row sends openTask message', async ({ page }) => {
      await clearPostedMessages(page);
      await page.locator('[data-testid="task-row-TASK-1"]').click();

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'openTask',
        taskId: 'TASK-1',
      });
    });
  });

  test.describe('No Backlog State', () => {
    test('shows no backlog message', async ({ page }) => {
      await installVsCodeMock(page);
      await page.goto('/tasks.html');
      await page.waitForTimeout(100);

      await postMessageToWebview(page, { type: 'noBacklogFolder' });
      await page.waitForTimeout(50);

      // Should show in kanban view (which is visible by default)
      await expect(page.locator('#kanban-view').getByText('No Backlog Found')).toBeVisible();
    });
  });

  test('sends refresh message on mount', async ({ page }) => {
    await installVsCodeMock(page);
    await page.goto('/tasks.html');
    await page.waitForTimeout(200);

    const message = await getLastPostedMessage(page);
    expect(message).toEqual({ type: 'refresh' });
  });
});
