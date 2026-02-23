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
  getPostedMessages,
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
    blockingDependencyIds: ['TASK-99'],
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

const crossBranchLikeTasks: (Task & { blocksTaskIds?: string[] })[] = [
  {
    id: 'BACK-239',
    title: 'Feature task from current branch',
    status: 'To Do',
    labels: [],
    assignee: [],
    dependencies: [],
    acceptanceCriteria: [],
    definitionOfDone: [],
    filePath: '/workspace/backlog/tasks/back-239-current.md',
    source: 'local',
  },
  {
    id: 'BACK-239',
    title: 'Feature task from other branch',
    status: 'Done',
    labels: [],
    assignee: [],
    dependencies: [],
    acceptanceCriteria: [],
    definitionOfDone: [],
    filePath: '/workspace/.backlog/branches/feature/backlog/tasks/back-239-feature.md',
    source: 'local-branch',
    branch: 'feature/filter-fix',
  },
  {
    id: 'BACK-240',
    title: 'Search target task',
    status: 'To Do',
    description: 'Contains unique searchable text',
    labels: [],
    assignee: [],
    dependencies: [],
    acceptanceCriteria: [],
    definitionOfDone: [],
    filePath: '/workspace/backlog/tasks/back-240.md',
    source: 'local',
  },
  {
    id: 'BACK-241',
    title: 'In progress task',
    status: 'In Progress',
    labels: [],
    assignee: [],
    dependencies: [],
    acceptanceCriteria: [],
    definitionOfDone: [],
    filePath: '/workspace/backlog/tasks/back-241.md',
    source: 'local',
  },
];

const readOnlyIndicatorTasks: (Task & { blocksTaskIds?: string[] })[] = [
  {
    id: 'TASK-LOCAL-1',
    title: 'Local editable task',
    status: 'To Do',
    labels: [],
    assignee: [],
    dependencies: [],
    acceptanceCriteria: [],
    definitionOfDone: [],
    filePath: '/workspace/backlog/tasks/task-local-1.md',
    source: 'local',
    branch: 'feature/current-work',
  },
  {
    id: 'TASK-REMOTE-1',
    title: 'Cross-branch read-only task',
    status: 'In Progress',
    labels: [],
    assignee: [],
    dependencies: [],
    acceptanceCriteria: [],
    definitionOfDone: [],
    filePath: '/workspace/.backlog/branches/feature/backlog/tasks/task-remote-1.md',
    source: 'local-branch',
    branch: 'feature/filter-fix',
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

async function setupListViewWithTasks(
  page: ReturnType<typeof test.info>['page'],
  tasks: (Task & { blocksTaskIds?: string[] })[]
) {
  await installVsCodeMock(page);
  await page.goto('/tasks.html');
  await page.waitForTimeout(100);

  await postMessageToWebview(page, { type: 'viewModeChanged', viewMode: 'list' });
  await postMessageToWebview(page, {
    type: 'statusesUpdated',
    statuses: ['To Do', 'In Progress', 'Done'],
  });
  await postMessageToWebview(page, { type: 'milestonesUpdated', milestones: [] });
  await postMessageToWebview(page, { type: 'tasksUpdated', tasks });
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

    test('kanban columns have a minimum width and scroll at narrow sidebar', async ({ page }) => {
      // Set viewport to typical narrow sidebar width
      await page.setViewportSize({ width: 350, height: 600 });

      const board = page.locator('.kanban-board');
      const scrollWidth = await board.evaluate((el) => el.scrollWidth);
      const clientWidth = await board.evaluate((el) => el.clientWidth);

      // Board should scroll horizontally rather than crushing columns
      expect(scrollWidth).toBeGreaterThan(clientWidth);

      // Each column should maintain a readable minimum width
      const columns = page.locator('.kanban-column');
      const count = await columns.count();
      for (let i = 0; i < count; i++) {
        const width = await columns.nth(i).evaluate((el) => el.getBoundingClientRect().width);
        expect(width).toBeGreaterThanOrEqual(140);
      }
    });

    test('kanban card title wraps long words and clamps to 3 lines at narrow width', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 350, height: 600 });

      const longTitleTask: (Task & { blocksTaskIds?: string[] })[] = [
        {
          id: 'TASK-LONG',
          title:
            'SuperLongUnbrokenWordThatWouldNormallyOverflowInANarrowKanbanColumnAndNeedsBreaking plus additional text to force more than three lines in the card title area',
          status: 'To Do',
          labels: [],
          assignee: [],
          dependencies: [],
          acceptanceCriteria: [],
          definitionOfDone: [],
          filePath: '/test/tasks/task-long.md',
        },
      ];

      await postMessageToWebview(page, { type: 'tasksUpdated', tasks: longTitleTask });
      await page.waitForTimeout(50);

      const title = page.locator('[data-testid="task-TASK-LONG"] .task-card-title');
      await expect(title).toBeVisible();

      const metrics = await title.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          clientHeight: el.clientHeight,
          lineHeight: parseFloat(style.lineHeight),
          webkitLineClamp: style.webkitLineClamp,
        };
      });

      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
      expect(metrics.webkitLineClamp).toBe('3');
      expect(metrics.clientHeight).toBeLessThanOrEqual(metrics.lineHeight * 3 + 2);
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

    test('clicking a card sends selectTask message for native details view', async ({ page }) => {
      await clearPostedMessages(page);
      await page.locator('[data-testid="task-TASK-1"]').click();

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'selectTask',
        taskId: 'TASK-1',
        filePath: '/test/tasks/task-1.md',
      });
    });

    test('focusing a card sends selectTask message for preview navigation', async ({ page }) => {
      await clearPostedMessages(page);
      const card = page.locator('[data-testid="task-TASK-1"]');
      await card.focus();

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'selectTask',
        taskId: 'TASK-1',
        filePath: '/test/tasks/task-1.md',
      });
    });

    test('keyboard Enter on focused card sends focusTaskPreview message', async ({ page }) => {
      await clearPostedMessages(page);
      const card = page.locator('[data-testid="task-TASK-1"]');
      await card.focus();
      await page.keyboard.press('Enter');

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({ type: 'focusTaskPreview' });
    });

    test('shows blocked icon on card when task has active blockers', async ({ page }) => {
      const indicator = page.locator('[data-testid="blocked-indicator-TASK-1"]').first();
      await expect(indicator).toBeVisible();
      await expect(indicator).toHaveAttribute('title', 'Blocked by: TASK-99');
    });
  });

  test.describe('View Mode Toggle', () => {
    test.beforeEach(async ({ page }) => {
      await setupTasksView(page);
    });

    test('shows kanban view by default', async ({ page }) => {
      await expect(page.locator('#kanban-view')).toBeVisible();
      await expect(page.locator('#list-view')).not.toBeVisible();
    });

    test('switches to list view when viewModeChanged message received', async ({ page }) => {
      await postMessageToWebview(page, { type: 'viewModeChanged', viewMode: 'list' });
      await page.waitForTimeout(50);

      await expect(page.locator('#kanban-view')).not.toBeVisible();
      await expect(page.locator('#list-view')).toBeVisible();
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

    test('displays not-done tasks by default in list view', async ({ page }) => {
      // Default filter is "not-done" which hides the last status (Done)
      const rows = page.locator('tbody tr');
      await expect(rows).toHaveCount(5);
    });

    test('displays all tasks when "All" filter is selected', async ({ page }) => {
      await page.locator('[data-testid="status-filter"]').selectOption('all');
      await page.waitForTimeout(50);
      const rows = page.locator('tbody tr');
      await expect(rows).toHaveCount(7);
    });

    test('renders full task id in list view when task id display mode is full', async ({
      page,
    }) => {
      await postMessageToWebview(page, {
        type: 'settingsUpdated',
        settings: { taskIdDisplay: 'full' },
      });
      await page.waitForTimeout(50);

      await expect(page.locator('[data-testid="task-row-id-TASK-1"]')).toHaveText('TASK-1');
    });

    test('renders numeric portion in list view when task id display mode is number', async ({
      page,
    }) => {
      await postMessageToWebview(page, {
        type: 'settingsUpdated',
        settings: { taskIdDisplay: 'number' },
      });
      await page.waitForTimeout(50);

      await expect(page.locator('[data-testid="task-row-id-TASK-1"]')).toHaveText('1');
    });

    test('hides task id in list view when task id display mode is hidden', async ({ page }) => {
      await postMessageToWebview(page, {
        type: 'settingsUpdated',
        settings: { taskIdDisplay: 'hidden' },
      });
      await page.waitForTimeout(50);

      await expect(page.locator('[data-testid="task-row-id-TASK-1"]')).toHaveCount(0);
    });

    test('filter by status works via dropdown', async ({ page }) => {
      await page.locator('[data-testid="status-filter"]').selectOption('status:To Do');
      await page.waitForTimeout(50);
      const rows = page.locator('tbody tr');
      await expect(rows).toHaveCount(3);
    });

    test('filter by In Progress status works via dropdown', async ({ page }) => {
      await page.locator('[data-testid="status-filter"]').selectOption('status:In Progress');
      await page.waitForTimeout(50);
      const rows = page.locator('tbody tr');
      await expect(rows).toHaveCount(2);
    });

    test('search filters tasks', async ({ page }) => {
      await page.locator('[data-testid="search-input"]').fill('Task 1');
      await page.waitForTimeout(50);
      const rows = page.locator('tbody tr');
      await expect(rows).toHaveCount(1);
    });

    test('search by task ID filters tasks', async ({ page }) => {
      await page.locator('[data-testid="search-input"]').fill('TASK-2');
      await page.waitForTimeout(50);
      const rows = page.locator('tbody tr');
      await expect(rows).toHaveCount(1);
      await expect(rows).toContainText('Task 2');
    });

    test('search and status filters work with cross-branch style duplicate IDs', async ({
      page,
    }) => {
      await setupListViewWithTasks(page, crossBranchLikeTasks);

      // Default "not-done" filter hides the Done task, so 3 visible
      await expect(page.locator('tbody tr')).toHaveCount(3);

      await page.locator('[data-testid="search-input"]').fill('unique searchable text');
      await expect(page.locator('tbody tr')).toHaveCount(1);
      await expect(page.locator('tbody tr')).toContainText('Search target task');

      await page.locator('[data-testid="search-input"]').fill('');
      await page.locator('[data-testid="status-filter"]').selectOption('status:Done');
      await page.waitForTimeout(50);
      await expect(page.locator('tbody tr')).toHaveCount(1);
      await expect(page.locator('tbody tr')).toContainText('Feature task from other branch');
    });

    test('clicking a row sends selectTask message', async ({ page }) => {
      await clearPostedMessages(page);
      await page.locator('[data-testid="task-row-TASK-1"]').click();

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'selectTask',
        taskId: 'TASK-1',
        filePath: '/test/tasks/task-1.md',
      });
    });

    test('focusing a row sends selectTask message', async ({ page }) => {
      await clearPostedMessages(page);
      const row = page.locator('[data-testid="task-row-TASK-1"]');
      await row.focus();

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'selectTask',
        taskId: 'TASK-1',
        filePath: '/test/tasks/task-1.md',
      });
    });

    test('keyboard Enter on focused row sends focusTaskPreview message', async ({ page }) => {
      await clearPostedMessages(page);
      const row = page.locator('[data-testid="task-row-TASK-1"]');
      await row.focus();
      await page.keyboard.press('Enter');

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({ type: 'focusTaskPreview' });
    });

    test('shows blocked icon in list row when task has active blockers', async ({ page }) => {
      const indicator = page.locator('[data-testid="blocked-indicator-TASK-1"]').first();
      await expect(indicator).toBeVisible();
      await expect(indicator).toHaveAttribute('title', 'Blocked by: TASK-99');
    });

    test('list view does not overflow at sidebar width', async ({ page }) => {
      await page.setViewportSize({ width: 350, height: 600 });
      const container = page.locator('.task-list-container');
      const scrollWidth = await container.evaluate((el) => el.scrollWidth);
      const clientWidth = await container.evaluate((el) => el.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });

    test('list view renders without actions column and row action buttons', async ({ page }) => {
      await expect(page.locator('th.actions-header')).toHaveCount(0);
      await expect(page.locator('[data-testid^="complete-btn-"]')).toHaveCount(0);
      await expect(page.locator('[data-testid^="promote-btn-"]')).toHaveCount(0);
      await expect(page.locator('[data-testid^="restore-btn-"]')).toHaveCount(0);
      await expect(page.locator('[data-testid^="delete-btn-"]')).toHaveCount(0);
    });

    test('shows read-only branch indicator and keeps drag handle visible for soft-block feedback', async ({
      page,
    }) => {
      await setupListViewWithTasks(page, readOnlyIndicatorTasks);

      await expect(page.locator('[data-testid="readonly-indicator-TASK-REMOTE-1"]')).toContainText(
        'feature/filter-fix'
      );
      await expect(page.locator('[data-testid="drag-handle-TASK-REMOTE-1"]')).toBeVisible();
      await expect(page.locator('[data-testid="drag-handle-TASK-LOCAL-1"]')).toBeVisible();
    });

    test('shows toast when dragging a read-only task in list view', async ({ page }) => {
      await setupListViewWithTasks(page, readOnlyIndicatorTasks);
      await clearPostedMessages(page);

      const source = page.locator('[data-testid="drag-handle-TASK-REMOTE-1"]');
      const target = page.locator('[data-testid="task-row-TASK-LOCAL-1"]');
      await source.dragTo(target);

      await expect(page.locator('.toast')).toContainText('Cannot reorder task: TASK-REMOTE-1');

      const messages = await getPostedMessages(page);
      expect(messages.some((message) => message.type === 'reorderTasks')).toBe(false);
      expect(messages.some((message) => message.type === 'updateTaskStatus')).toBe(false);
    });
  });

  test.describe('List View - Ordinal Ordering', () => {
    test.beforeEach(async ({ page }) => {
      await setupTasksView(page);
      await postMessageToWebview(page, { type: 'viewModeChanged', viewMode: 'list' });
      await page.waitForTimeout(50);
    });

    test('tasks within same status group are ordered by ordinal', async ({ page }) => {
      // Select "all" so Done tasks are visible too
      await page.locator('[data-testid="status-filter"]').selectOption('all');
      await page.waitForTimeout(50);

      // Default sort is by status ascending
      // "To Do" group: TASK-1 (ordinal: 1000) should come before TASK-2 and TASK-3 (no ordinal)
      const rows = page.locator('tbody tr');
      const taskIds: string[] = [];
      const count = await rows.count();
      for (let i = 0; i < count; i++) {
        const id = await rows.nth(i).getAttribute('data-task-id');
        taskIds.push(id!);
      }

      // To Do group: TASK-1 (ordinal 1000), then TASK-2 and TASK-3 (no ordinal, by ID)
      const todoTasks = taskIds.filter((id) => ['TASK-1', 'TASK-2', 'TASK-3'].includes(id));
      expect(todoTasks).toEqual(['TASK-1', 'TASK-2', 'TASK-3']);

      // In Progress group: TASK-4 (ordinal 500), TASK-5 (ordinal 1500)
      const inProgressTasks = taskIds.filter((id) => ['TASK-4', 'TASK-5'].includes(id));
      expect(inProgressTasks).toEqual(['TASK-4', 'TASK-5']);

      // Done group: TASK-6, TASK-7 (no ordinal, by ID)
      const doneTasks = taskIds.filter((id) => ['TASK-6', 'TASK-7'].includes(id));
      expect(doneTasks).toEqual(['TASK-6', 'TASK-7']);
    });
  });

  test.describe('Kanban task id display', () => {
    test.beforeEach(async ({ page }) => {
      await setupTasksView(page);
    });

    test('renders full task id in card view when task id display mode is full', async ({
      page,
    }) => {
      await postMessageToWebview(page, {
        type: 'settingsUpdated',
        settings: { taskIdDisplay: 'full' },
      });
      await page.waitForTimeout(50);

      await expect(page.locator('[data-testid="task-id-TASK-1"]')).toHaveText('TASK-1');
    });

    test('renders numeric portion in card view when task id display mode is number', async ({
      page,
    }) => {
      await postMessageToWebview(page, {
        type: 'settingsUpdated',
        settings: { taskIdDisplay: 'number' },
      });
      await page.waitForTimeout(50);

      await expect(page.locator('[data-testid="task-id-TASK-1"]')).toHaveText('1');
    });

    test('hides task id in card view when task id display mode is hidden', async ({ page }) => {
      await postMessageToWebview(page, {
        type: 'settingsUpdated',
        settings: { taskIdDisplay: 'hidden' },
      });
      await page.waitForTimeout(50);

      await expect(page.locator('[data-testid="task-id-TASK-1"]')).toHaveCount(0);
    });
  });

  test.describe('List View - Drag and Drop', () => {
    test.beforeEach(async ({ page }) => {
      await setupTasksView(page);
      await postMessageToWebview(page, { type: 'viewModeChanged', viewMode: 'list' });
      await page.waitForTimeout(50);
    });

    test('shows drag handles when sorted by status', async ({ page }) => {
      // Default sort is status - drag handles should be visible
      await expect(page.locator('[data-testid="drag-handle-TASK-1"]')).toBeVisible();
      await expect(page.locator('[data-testid="drag-handle-TASK-4"]')).toBeVisible();
    });

    test('hides drag handles when sorted by title', async ({ page }) => {
      // Click title header to sort by title
      await page.locator('th[data-sort="title"]').click();
      await page.waitForTimeout(50);

      // Drag handles should not be visible
      await expect(page.locator('[data-testid="drag-handle-TASK-1"]')).toHaveCount(0);
    });

    test('hides drag handles when sorted by priority', async ({ page }) => {
      await page.locator('th[data-sort="priority"]').click();
      await page.waitForTimeout(50);

      await expect(page.locator('[data-testid="drag-handle-TASK-1"]')).toHaveCount(0);
    });

    test('drag handles reappear when switching back to status sort', async ({ page }) => {
      // Switch to title sort
      await page.locator('th[data-sort="title"]').click();
      await page.waitForTimeout(50);
      await expect(page.locator('.drag-handle')).toHaveCount(0);

      // Switch back to status sort
      await page.locator('th[data-sort="status"]').click();
      await page.waitForTimeout(50);
      await expect(page.locator('[data-testid="drag-handle-TASK-1"]')).toBeVisible();
    });

    test('reorder within same status sends reorderTasks message', async ({ page }) => {
      await clearPostedMessages(page);

      // Drag TASK-1 after TASK-2 (both are "To Do")
      const source = page.locator('[data-testid="drag-handle-TASK-1"]');
      const target = page.locator('[data-testid="task-row-TASK-2"]');

      // Perform drag operation
      const targetBox = await target.boundingBox();
      if (!targetBox) throw new Error('Target not found');

      await source.dragTo(target, {
        targetPosition: { x: targetBox.width / 2, y: targetBox.height * 0.75 },
      });

      await page.waitForTimeout(100);

      const message = await getLastPostedMessage(page);
      expect(message).toBeDefined();
      expect(message!.type).toBe('reorderTasks');
      expect(message!.updates).toBeDefined();
      expect(Array.isArray(message!.updates)).toBe(true);

      // Verify the updates contain ordinal assignments
      const updates = message!.updates as Array<{ taskId: string; ordinal: number }>;
      expect(updates.length).toBeGreaterThan(0);

      // TASK-1 should be in the updates (it was the dragged card)
      const task1Update = updates.find((u) => u.taskId === 'TASK-1');
      expect(task1Update).toBeDefined();
    });
  });

  test.describe('Kanban Read-Only Cards', () => {
    test('marks cross-branch card as read-only and keeps local+branch tasks editable', async ({
      page,
    }) => {
      await installVsCodeMock(page);
      await page.goto('/tasks.html');
      await page.waitForTimeout(100);

      await postMessageToWebview(page, { type: 'viewModeChanged', viewMode: 'kanban' });
      await postMessageToWebview(page, {
        type: 'statusesUpdated',
        statuses: ['To Do', 'In Progress', 'Done'],
      });
      await postMessageToWebview(page, { type: 'milestonesUpdated', milestones: [] });
      await postMessageToWebview(page, { type: 'tasksUpdated', tasks: readOnlyIndicatorTasks });
      await page.waitForTimeout(100);

      await expect(page.locator('[data-testid="readonly-indicator-TASK-REMOTE-1"]')).toContainText(
        'feature/filter-fix'
      );
      await expect(page.locator('[data-testid="task-TASK-REMOTE-1"]')).toHaveAttribute(
        'draggable',
        'true'
      );
      await expect(page.locator('[data-testid="task-TASK-LOCAL-1"]')).toHaveAttribute(
        'draggable',
        'true'
      );
    });

    test('shows toast when attempting to drag read-only kanban card', async ({ page }) => {
      await installVsCodeMock(page);
      await page.goto('/tasks.html');
      await page.waitForTimeout(100);

      await postMessageToWebview(page, { type: 'viewModeChanged', viewMode: 'kanban' });
      await postMessageToWebview(page, {
        type: 'statusesUpdated',
        statuses: ['To Do', 'In Progress', 'Done'],
      });
      await postMessageToWebview(page, { type: 'milestonesUpdated', milestones: [] });
      await postMessageToWebview(page, { type: 'tasksUpdated', tasks: readOnlyIndicatorTasks });
      await page.waitForTimeout(100);
      await clearPostedMessages(page);

      const source = page.locator('[data-testid="task-TASK-REMOTE-1"]');
      const target = page.locator('[data-testid="task-list-To Do"]');
      await source.dragTo(target);

      await expect(page.locator('.toast')).toContainText('Cannot reorder task: TASK-REMOTE-1');

      const messages = await getPostedMessages(page);
      expect(messages.some((message) => message.type === 'reorderTasks')).toBe(false);
      expect(messages.some((message) => message.type === 'updateTaskStatus')).toBe(false);
    });
  });

  test.describe('Draft Count Badge', () => {
    test.beforeEach(async ({ page }) => {
      await setupTasksView(page);
    });

    test('shows draft count badge on overflow trigger when count > 0', async ({ page }) => {
      await postMessageToWebview(page, { type: 'draftCountUpdated', count: 3 });
      await page.waitForTimeout(50);

      const badge = page.locator('[data-testid="overflow-draft-badge"]');
      await expect(badge).toBeVisible();
      await expect(badge).toHaveText('3');
    });

    test('hides badge on overflow trigger when count is 0', async ({ page }) => {
      await postMessageToWebview(page, { type: 'draftCountUpdated', count: 0 });
      await page.waitForTimeout(50);

      await expect(page.locator('[data-testid="overflow-draft-badge"]')).toHaveCount(0);
    });

    test('shows draft count in overflow menu item', async ({ page }) => {
      await postMessageToWebview(page, { type: 'draftCountUpdated', count: 5 });
      await page.waitForTimeout(50);

      // Open overflow menu
      await page.locator('[data-testid="overflow-menu-btn"]').click();
      await page.waitForTimeout(50);

      const draftsItem = page.locator('[data-testid="tab-drafts"]');
      await expect(draftsItem).toContainText('(5)');
    });

    test('updates badge when count changes', async ({ page }) => {
      // First set count to 5
      await postMessageToWebview(page, { type: 'draftCountUpdated', count: 5 });
      await page.waitForTimeout(50);

      const badge = page.locator('[data-testid="overflow-draft-badge"]');
      await expect(badge).toHaveText('5');

      // Now update to 2
      await postMessageToWebview(page, { type: 'draftCountUpdated', count: 2 });
      await page.waitForTimeout(50);

      await expect(badge).toHaveText('2');
    });

    test('removes badge when count drops to 0', async ({ page }) => {
      // Start with a count
      await postMessageToWebview(page, { type: 'draftCountUpdated', count: 4 });
      await page.waitForTimeout(50);

      await expect(page.locator('[data-testid="overflow-draft-badge"]')).toBeVisible();

      // Drop to zero
      await postMessageToWebview(page, { type: 'draftCountUpdated', count: 0 });
      await page.waitForTimeout(50);

      await expect(page.locator('[data-testid="overflow-draft-badge"]')).toHaveCount(0);
    });
  });

  test.describe('Overflow Menu', () => {
    test.beforeEach(async ({ page }) => {
      await setupTasksView(page);
    });

    test('only 3 primary tabs visible plus overflow trigger', async ({ page }) => {
      await expect(page.locator('[data-testid="tab-kanban"]')).toBeVisible();
      await expect(page.locator('[data-testid="tab-list"]')).toBeVisible();
      await expect(page.locator('[data-testid="tab-dashboard"]')).toBeVisible();
      await expect(page.locator('[data-testid="overflow-menu-btn"]')).toBeVisible();

      // Overflow tabs should NOT be visible before opening menu
      await expect(page.locator('[data-testid="tab-drafts"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="tab-archived"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="tab-docs"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="tab-decisions"]')).not.toBeVisible();
    });

    test('opens and closes on click', async ({ page }) => {
      // Click to open
      await page.locator('[data-testid="overflow-menu-btn"]').click();
      await page.waitForTimeout(50);
      await expect(page.locator('[data-testid="tab-drafts"]')).toBeVisible();
      await expect(page.locator('[data-testid="tab-archived"]')).toBeVisible();
      await expect(page.locator('[data-testid="tab-docs"]')).toBeVisible();
      await expect(page.locator('[data-testid="tab-decisions"]')).toBeVisible();

      // Click again to close
      await page.locator('[data-testid="overflow-menu-btn"]').click();
      await page.waitForTimeout(50);
      await expect(page.locator('[data-testid="tab-drafts"]')).not.toBeVisible();
    });

    test('closes on click outside', async ({ page }) => {
      await page.locator('[data-testid="overflow-menu-btn"]').click();
      await page.waitForTimeout(50);
      await expect(page.locator('[data-testid="tab-drafts"]')).toBeVisible();

      // Click outside
      await page.locator('.tab-bar').click({ position: { x: 5, y: 5 } });
      await page.waitForTimeout(50);
      await expect(page.locator('[data-testid="tab-drafts"]')).not.toBeVisible();
    });

    test('closes on Escape', async ({ page }) => {
      await page.locator('[data-testid="overflow-menu-btn"]').click();
      await page.waitForTimeout(50);
      await expect(page.locator('[data-testid="tab-drafts"]')).toBeVisible();

      await page.keyboard.press('Escape');
      await page.waitForTimeout(50);
      await expect(page.locator('[data-testid="tab-drafts"]')).not.toBeVisible();
    });

    test('overflow trigger shows active state when overflow tab is selected', async ({ page }) => {
      // Select an overflow tab
      await page.locator('[data-testid="overflow-menu-btn"]').click();
      await page.waitForTimeout(50);
      await page.locator('[data-testid="tab-drafts"]').click();
      await page.waitForTimeout(50);

      // Overflow trigger should have active class
      await expect(page.locator('[data-testid="overflow-menu-btn"]')).toHaveClass(/active/);
    });
  });

  test.describe('List View - Label Filtering', () => {
    const labeledTasks: (Task & { blocksTaskIds?: string[] })[] = [
      {
        id: 'TASK-L1',
        title: 'Setup CI pipeline',
        status: 'To Do',
        labels: ['devops', 'infra'],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: '/test/tasks/task-l1.md',
        ordinal: 1000,
      },
      {
        id: 'TASK-L2',
        title: 'Fix login bug',
        status: 'In Progress',
        labels: ['bug', 'ui'],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: '/test/tasks/task-l2.md',
        ordinal: 2000,
      },
      {
        id: 'TASK-L3',
        title: 'Add dark mode',
        status: 'To Do',
        labels: ['ui', 'feature'],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: '/test/tasks/task-l3.md',
        ordinal: 3000,
      },
      {
        id: 'TASK-L4',
        title: 'Write tests',
        status: 'Done',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: '/test/tasks/task-l4.md',
        ordinal: 4000,
      },
    ];

    async function setupLabelView(page: ReturnType<typeof test.info>['page']) {
      await installVsCodeMock(page);
      await page.goto('/tasks.html');
      await page.waitForTimeout(100);

      await postMessageToWebview(page, { type: 'viewModeChanged', viewMode: 'list' });
      await postMessageToWebview(page, {
        type: 'statusesUpdated',
        statuses: ['To Do', 'In Progress', 'Done'],
      });
      await postMessageToWebview(page, { type: 'milestonesUpdated', milestones: [] });
      await postMessageToWebview(page, { type: 'tasksUpdated', tasks: labeledTasks });
      await page.waitForTimeout(100);
    }

    test('label filter dropdown populates with unique sorted labels', async ({ page }) => {
      await setupLabelView(page);

      const labelFilter = page.locator('[data-testid="label-filter"]');
      await expect(labelFilter).toBeVisible();

      // Should have "All Labels" + 5 unique labels (bug, devops, feature, infra, ui)
      const options = labelFilter.locator('option');
      await expect(options).toHaveCount(6);
      await expect(options.nth(0)).toHaveText('All Labels');
      await expect(options.nth(1)).toHaveText('bug');
      await expect(options.nth(2)).toHaveText('devops');
      await expect(options.nth(3)).toHaveText('feature');
      await expect(options.nth(4)).toHaveText('infra');
      await expect(options.nth(5)).toHaveText('ui');
    });

    test('selecting a label filters tasks correctly', async ({ page }) => {
      await setupLabelView(page);

      // Default "not-done" filter hides Done tasks, so 3 visible initially
      await expect(page.locator('tbody tr')).toHaveCount(3);

      // Filter by "ui" label - should show TASK-L2 and TASK-L3
      await page.locator('[data-testid="label-filter"]').selectOption('ui');
      await page.waitForTimeout(50);

      const rows = page.locator('tbody tr');
      await expect(rows).toHaveCount(2);
      await expect(page.locator('[data-testid="task-row-TASK-L2"]')).toBeVisible();
      await expect(page.locator('[data-testid="task-row-TASK-L3"]')).toBeVisible();
    });

    test('selecting "All Labels" resets the filter', async ({ page }) => {
      await setupLabelView(page);

      // Filter by "bug"
      await page.locator('[data-testid="label-filter"]').selectOption('bug');
      await page.waitForTimeout(50);
      await expect(page.locator('tbody tr')).toHaveCount(1);

      // Reset to all labels (still under "not-done" status filter, so 3 tasks)
      await page.locator('[data-testid="label-filter"]').selectOption('');
      await page.waitForTimeout(50);
      await expect(page.locator('tbody tr')).toHaveCount(3);
    });

    test('label pills are visible on rows with labels', async ({ page }) => {
      await setupLabelView(page);

      // TASK-L1 should show devops and infra labels
      const l1Labels = page.locator('[data-testid="row-labels-TASK-L1"] .task-label');
      await expect(l1Labels).toHaveCount(2);
      await expect(l1Labels.nth(0)).toHaveText('devops');
      await expect(l1Labels.nth(1)).toHaveText('infra');

      // TASK-L2 should show bug and ui labels
      const l2Labels = page.locator('[data-testid="row-labels-TASK-L2"] .task-label');
      await expect(l2Labels).toHaveCount(2);
      await expect(l2Labels.nth(0)).toHaveText('bug');
      await expect(l2Labels.nth(1)).toHaveText('ui');

      // TASK-L4 has no labels, so row-labels should not exist
      await expect(page.locator('[data-testid="row-labels-TASK-L4"]')).toHaveCount(0);
    });

    test('setLabelFilter message sets the label dropdown value', async ({ page }) => {
      await setupLabelView(page);

      // Send setLabelFilter message (as if from task detail clickable label)
      await postMessageToWebview(page, { type: 'setLabelFilter', label: 'bug' });
      await page.waitForTimeout(50);

      // Label dropdown should be set to "bug"
      const labelFilter = page.locator('[data-testid="label-filter"]');
      await expect(labelFilter).toHaveValue('bug');

      // Only TASK-L2 has "bug" label
      const rows = page.locator('tbody tr');
      await expect(rows).toHaveCount(1);
      await expect(page.locator('[data-testid="task-row-TASK-L2"]')).toBeVisible();
    });

    test('setLabelFilter message switches to list view and filters', async ({ page }) => {
      await setupLabelView(page);

      // Start in kanban view
      await postMessageToWebview(page, { type: 'viewModeChanged', viewMode: 'kanban' });
      await page.waitForTimeout(50);
      await expect(page.locator('#kanban-view')).toBeVisible();

      // Simulate extension switching to list + setting label filter
      await postMessageToWebview(page, { type: 'activeTabChanged', tab: 'list' });
      await postMessageToWebview(page, { type: 'setLabelFilter', label: 'ui' });
      await page.waitForTimeout(50);

      // Should now show list view filtered by "ui" (TASK-L2 and TASK-L3)
      const rows = page.locator('tbody tr');
      await expect(rows).toHaveCount(2);
    });

    test('label filter dropdown is hidden when no tasks have labels', async ({ page }) => {
      await installVsCodeMock(page);
      await page.goto('/tasks.html');
      await page.waitForTimeout(100);

      await postMessageToWebview(page, { type: 'viewModeChanged', viewMode: 'list' });
      await postMessageToWebview(page, {
        type: 'statusesUpdated',
        statuses: ['To Do', 'In Progress', 'Done'],
      });
      await postMessageToWebview(page, { type: 'milestonesUpdated', milestones: [] });
      // Use sampleTasks which have no labels
      await postMessageToWebview(page, { type: 'tasksUpdated', tasks: sampleTasks });
      await page.waitForTimeout(100);

      await expect(page.locator('[data-testid="label-filter"]')).toHaveCount(0);
    });
  });

  test.describe('Priority Icons', () => {
    const priorityTasks: (Task & { blocksTaskIds?: string[] })[] = [
      {
        id: 'TASK-P1',
        title: 'High priority task',
        status: 'To Do',
        priority: 'high',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: '/test/tasks/task-p1.md',
      },
      {
        id: 'TASK-P2',
        title: 'Medium priority task',
        status: 'To Do',
        priority: 'medium',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: '/test/tasks/task-p2.md',
      },
      {
        id: 'TASK-P3',
        title: 'Low priority task',
        status: 'In Progress',
        priority: 'low',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: '/test/tasks/task-p3.md',
      },
      {
        id: 'TASK-P4',
        title: 'No priority task',
        status: 'In Progress',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: '/test/tasks/task-p4.md',
      },
    ];

    async function setupPriorityView(page: ReturnType<typeof test.info>['page']) {
      await installVsCodeMock(page);
      await page.goto('/tasks.html');
      await page.waitForTimeout(100);

      await postMessageToWebview(page, { type: 'viewModeChanged', viewMode: 'kanban' });
      await postMessageToWebview(page, {
        type: 'statusesUpdated',
        statuses: ['To Do', 'In Progress', 'Done'],
      });
      await postMessageToWebview(page, { type: 'milestonesUpdated', milestones: [] });
      await postMessageToWebview(page, { type: 'tasksUpdated', tasks: priorityTasks });
      await page.waitForTimeout(100);
    }

    test('kanban cards show priority icons with correct SVGs', async ({ page }) => {
      await setupPriorityView(page);

      // High priority icon should be present with title tooltip
      const highIcon = page.locator('[data-testid="priority-icon-high"]');
      await expect(highIcon).toBeVisible();
      await expect(highIcon).toHaveAttribute('title', 'High');
      await expect(highIcon.locator('svg')).toBeVisible();

      // Medium priority icon
      const mediumIcon = page.locator('[data-testid="priority-icon-medium"]');
      await expect(mediumIcon).toBeVisible();
      await expect(mediumIcon).toHaveAttribute('title', 'Medium');

      // Low priority icon
      const lowIcon = page.locator('[data-testid="priority-icon-low"]');
      await expect(lowIcon).toBeVisible();
      await expect(lowIcon).toHaveAttribute('title', 'Low');
    });

    test('kanban shows priority icon on same row as task id when task id display is visible', async ({
      page,
    }) => {
      await setupPriorityView(page);
      await postMessageToWebview(page, {
        type: 'settingsUpdated',
        settings: { taskIdDisplay: 'full' },
      });
      await page.waitForTimeout(50);

      const card = page.locator('[data-testid="task-TASK-P1"]');
      const idRow = card.locator('.task-card-id-row');
      await expect(idRow).toBeVisible();
      await expect(idRow.locator('[data-testid="task-id-TASK-P1"]')).toHaveText('TASK-P1');
      await expect(idRow.locator('[data-testid="priority-icon-high"]')).toBeVisible();
    });

    test('kanban keeps priority icon in meta area when task id display is hidden', async ({
      page,
    }) => {
      await setupPriorityView(page);
      await postMessageToWebview(page, {
        type: 'settingsUpdated',
        settings: { taskIdDisplay: 'hidden' },
      });
      await page.waitForTimeout(50);

      const card = page.locator('[data-testid="task-TASK-P1"]');
      await expect(card.locator('.task-card-id-row')).toHaveCount(0);
      await expect(card.locator('[data-testid="task-id-TASK-P1"]')).toHaveCount(0);
      await expect(
        card.locator('.task-card-meta [data-testid="priority-icon-high"]')
      ).toBeVisible();
    });

    test('no priority icon for tasks without priority', async ({ page }) => {
      await setupPriorityView(page);

      // TASK-P4 has no priority - should not have any priority icon
      const card = page.locator('[data-testid="task-TASK-P4"]');
      await expect(card).toBeVisible();
      await expect(card.locator('.priority-icon')).toHaveCount(0);
    });

    test('list view shows priority icons instead of text badges', async ({ page }) => {
      await setupPriorityView(page);
      await postMessageToWebview(page, { type: 'viewModeChanged', viewMode: 'list' });
      await page.waitForTimeout(50);

      // High priority row shows icon
      const highIcon = page.locator(
        '[data-testid="task-row-TASK-P1"] [data-testid="priority-icon-high"]'
      );
      await expect(highIcon).toBeVisible();
      await expect(highIcon).toHaveAttribute('title', 'High');

      // No text content like "HIGH" or "high" in the icon
      await expect(highIcon).not.toContainText('high');

      // No priority task shows dash (4th td due to drag-handle column when sorted by status)
      const noPriorityCell = page.locator('[data-testid="task-row-TASK-P4"] td:nth-child(4)');
      await expect(noPriorityCell).toHaveText('-');
    });
  });

  test.describe('No Backlog State', () => {
    test('shows no backlog message', async ({ page }) => {
      await installVsCodeMock(page);
      await page.goto('/tasks.html');
      await page.waitForTimeout(100);

      await postMessageToWebview(page, { type: 'noBacklogFolder' });
      await page.waitForTimeout(50);

      // Should show "No Backlog Found" empty state
      await expect(page.getByText('No Backlog Found')).toBeVisible();
    });
  });

  test.describe('List View Sorting', () => {
    const sortTestTasks: (Task & { blocksTaskIds?: string[] })[] = [
      {
        id: 'TASK-A',
        title: 'banana Task',
        status: 'To Do',
        priority: 'medium',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: '/test/tasks/task-a.md',
      },
      {
        id: 'TASK-B',
        title: 'Apple Task',
        status: 'In Progress',
        priority: 'high',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: '/test/tasks/task-b.md',
      },
      {
        id: 'TASK-C',
        title: 'cherry Task',
        status: 'To Do',
        priority: 'high',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: '/test/tasks/task-c.md',
      },
      {
        id: 'TASK-D',
        title: 'Apple Task',
        status: 'In Progress',
        priority: 'medium',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: '/test/tasks/task-d.md',
      },
    ];

    async function getRowIds(page: ReturnType<typeof test.info>['page']): Promise<string[]> {
      const rows = page.locator('tbody tr');
      const count = await rows.count();
      const ids: string[] = [];
      for (let i = 0; i < count; i++) {
        const id = await rows.nth(i).getAttribute('data-task-id');
        ids.push(id!);
      }
      return ids;
    }

    test('title sort is case-insensitive', async ({ page }) => {
      await setupListViewWithTasks(page, sortTestTasks);
      // Select all tasks (default is not-done)
      await page.locator('[data-testid="status-filter"]').selectOption('all');
      await page.waitForTimeout(50);

      // Click title header to sort by title ascending
      await page.locator('th[data-sort="title"]').click();
      await page.waitForTimeout(50);

      const ids = await getRowIds(page);
      // Expected: Apple Task (TASK-B), Apple Task (TASK-D), banana Task (TASK-A), cherry Task (TASK-C)
      expect(ids).toEqual(['TASK-B', 'TASK-D', 'TASK-A', 'TASK-C']);
    });

    test('priority sort uses title then ID as tiebreaker', async ({ page }) => {
      await setupListViewWithTasks(page, sortTestTasks);
      await page.locator('[data-testid="status-filter"]').selectOption('all');
      await page.waitForTimeout(50);

      // Click priority header to sort by priority ascending (high first)
      await page.locator('th[data-sort="priority"]').click();
      await page.waitForTimeout(50);

      const ids = await getRowIds(page);
      // high: TASK-B (Apple Task) then TASK-C (cherry Task)
      // medium: TASK-D (Apple Task) then TASK-A (banana Task)
      expect(ids).toEqual(['TASK-B', 'TASK-C', 'TASK-D', 'TASK-A']);
    });

    test('title sort uses ID as tiebreaker for same titles', async ({ page }) => {
      await setupListViewWithTasks(page, sortTestTasks);
      await page.locator('[data-testid="status-filter"]').selectOption('all');
      await page.waitForTimeout(50);

      await page.locator('th[data-sort="title"]').click();
      await page.waitForTimeout(50);

      const ids = await getRowIds(page);
      // Two "Apple Task" entries should be ordered by ID: TASK-B before TASK-D
      const appleIds = ids.filter((id) => id === 'TASK-B' || id === 'TASK-D');
      expect(appleIds).toEqual(['TASK-B', 'TASK-D']);
    });
  });

  test('sends refresh message on mount', async ({ page }) => {
    await installVsCodeMock(page);
    await page.goto('/tasks.html');
    await page.waitForTimeout(200);

    const message = await getLastPostedMessage(page);
    expect(message).toEqual({ type: 'refresh' });
  });

  test.describe('Animations and Reduced Motion', () => {
    test('reduced-motion media query disables animations and transitions', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await setupTasksView(page);

      const card = page.locator('[data-testid="task-TASK-1"]');
      const duration = await card.evaluate((el) => {
        const style = window.getComputedStyle(el);
        // Parse the first transition-duration value (may be comma-separated)
        return parseFloat(style.transitionDuration);
      });
      // With reduced-motion, duration should be effectively zero (0.01ms = 0.00001s)
      expect(duration).toBeLessThanOrEqual(0.01);
    });

    test('view-content has viewFadeIn animation on mount', async ({ page }) => {
      await setupTasksView(page);

      const animationName = await page
        .locator('#kanban-view')
        .evaluate((el) => window.getComputedStyle(el).animationName);
      expect(animationName).toBe('viewFadeIn');
    });

    test('drop-target CSS rule exists for column highlight', async ({ page }) => {
      await setupTasksView(page);

      // Verify the .task-list.drop-target CSS rule exists in the stylesheet
      const hasDropTargetStyle = await page.evaluate(() => {
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules) {
              if (rule instanceof CSSStyleRule && rule.selectorText === '.task-list.drop-target') {
                return true;
              }
            }
          } catch {
            /* cross-origin */
          }
        }
        return false;
      });
      expect(hasDropTargetStyle).toBe(true);
    });

    test('drop-indicator uses dropGlow animation', async ({ page }) => {
      await setupTasksView(page);

      // Verify the dropGlow keyframes exist in the stylesheet
      const hasDropGlow = await page.evaluate(() => {
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules) {
              if (rule instanceof CSSKeyframesRule && rule.name === 'dropGlow') {
                return true;
              }
            }
          } catch {
            /* cross-origin */
          }
        }
        return false;
      });
      expect(hasDropGlow).toBe(true);
    });

    test('cardSettle keyframes are defined for just-dropped animation', async ({ page }) => {
      await setupTasksView(page);

      const hasCardSettle = await page.evaluate(() => {
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules) {
              if (rule instanceof CSSKeyframesRule && rule.name === 'cardSettle') {
                return true;
              }
            }
          } catch {
            /* cross-origin */
          }
        }
        return false;
      });
      expect(hasCardSettle).toBe(true);
    });

    test('empty state has fade-in animation', async ({ page }) => {
      await installVsCodeMock(page);
      await page.goto('/tasks.html');
      await page.waitForTimeout(100);

      await postMessageToWebview(page, { type: 'noBacklogFolder' });
      await page.waitForTimeout(50);

      const animationName = await page
        .locator('.empty-state')
        .evaluate((el) => window.getComputedStyle(el).animationName);
      expect(animationName).toBe('viewFadeIn');
    });
  });

  test.describe('Active Edited Task Highlight', () => {
    test('kanban view highlights the matching task card with active-edited class', async ({
      page,
    }) => {
      await setupTasksView(page);

      // Send activeEditedTaskChanged message with TASK-1
      await postMessageToWebview(page, {
        type: 'activeEditedTaskChanged',
        taskId: 'TASK-1',
      });
      await page.waitForTimeout(50);

      // The matching task card should have the active-edited class
      const highlightedCard = page.locator('.task-card.active-edited');
      await expect(highlightedCard).toHaveCount(1);
      await expect(highlightedCard).toHaveAttribute('data-task-id', 'TASK-1');
    });

    test('list view highlights the matching row with active-edited class', async ({ page }) => {
      await setupTasksView(page);

      // Switch to list view
      await postMessageToWebview(page, { type: 'viewModeChanged', viewMode: 'list' });
      await page.waitForTimeout(50);

      // Send activeEditedTaskChanged message with TASK-1
      await postMessageToWebview(page, {
        type: 'activeEditedTaskChanged',
        taskId: 'TASK-1',
      });
      await page.waitForTimeout(50);

      // The matching row should have the active-edited class
      const highlightedRow = page.locator('tr.active-edited');
      await expect(highlightedRow).toHaveCount(1);
      await expect(highlightedRow).toHaveAttribute('data-task-id', 'TASK-1');
    });

    test('clears highlight when taskId is null', async ({ page }) => {
      await setupTasksView(page);

      // First set an active task
      await postMessageToWebview(page, {
        type: 'activeEditedTaskChanged',
        taskId: 'TASK-1',
      });
      await page.waitForTimeout(50);
      await expect(page.locator('.task-card.active-edited')).toHaveCount(1);

      // Clear the highlight by sending null
      await postMessageToWebview(page, {
        type: 'activeEditedTaskChanged',
        taskId: null,
      });
      await page.waitForTimeout(50);

      // No elements should have active-edited class
      await expect(page.locator('.active-edited')).toHaveCount(0);
    });

    test('switching active task moves highlight from task A to task B', async ({ page }) => {
      await setupTasksView(page);

      // Highlight TASK-1
      await postMessageToWebview(page, {
        type: 'activeEditedTaskChanged',
        taskId: 'TASK-1',
      });
      await page.waitForTimeout(50);

      const highlightedA = page.locator('.task-card.active-edited');
      await expect(highlightedA).toHaveCount(1);
      await expect(highlightedA).toHaveAttribute('data-task-id', 'TASK-1');

      // Switch highlight to TASK-4
      await postMessageToWebview(page, {
        type: 'activeEditedTaskChanged',
        taskId: 'TASK-4',
      });
      await page.waitForTimeout(50);

      // Only TASK-4 should have the highlight
      const highlightedCards = page.locator('.task-card.active-edited');
      await expect(highlightedCards).toHaveCount(1);
      await expect(highlightedCards).toHaveAttribute('data-task-id', 'TASK-4');

      // TASK-1 should no longer have the class
      await expect(page.locator('[data-testid="task-TASK-1"]')).not.toHaveClass(/active-edited/);
    });
  });

  test.describe('Double-Click to Open Edit View', () => {
    test('double-clicking a kanban card sends openTask message', async ({ page }) => {
      await setupTasksView(page);
      await clearPostedMessages(page);
      await page.locator('[data-testid="task-TASK-1"]').dblclick();

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'openTask',
        taskId: 'TASK-1',
        filePath: '/test/tasks/task-1.md',
      });
    });

    test('single-click on kanban card still sends selectTask (not openTask)', async ({ page }) => {
      await setupTasksView(page);
      await clearPostedMessages(page);
      await page.locator('[data-testid="task-TASK-1"]').click();

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'selectTask',
        taskId: 'TASK-1',
        filePath: '/test/tasks/task-1.md',
      });
    });

    test('double-clicking a list row sends openTask message', async ({ page }) => {
      await setupListViewWithTasks(page, sampleTasks);
      await clearPostedMessages(page);
      await page.locator('[data-testid="task-row-TASK-1"]').dblclick();

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'openTask',
        taskId: 'TASK-1',
        filePath: '/test/tasks/task-1.md',
      });
    });

    test('single-click on list row still sends selectTask (not openTask)', async ({ page }) => {
      await setupListViewWithTasks(page, sampleTasks);
      await clearPostedMessages(page);
      await page.locator('[data-testid="task-row-TASK-1"]').click();

      const message = await getLastPostedMessage(page);
      expect(message).toEqual({
        type: 'selectTask',
        taskId: 'TASK-1',
        filePath: '/test/tasks/task-1.md',
      });
    });
  });
});
