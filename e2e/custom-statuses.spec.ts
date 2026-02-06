/**
 * Custom Statuses E2E Tests
 *
 * Tests that the kanban and list views render correctly with
 * arbitrary custom statuses (not just the default To Do / In Progress / Done).
 */
import { test, expect } from '@playwright/test';
import { installVsCodeMock, postMessageToWebview } from './fixtures/vscode-mock';
import type { Task } from '../src/webview/lib/types';

const customStatuses = ['Backlog', 'In Dev', 'Review', 'QA', 'Deployed'];

const sampleTasks: (Task & { blocksTaskIds?: string[] })[] = [
  {
    id: 'TASK-1',
    title: 'Setup project',
    status: 'Backlog',
    labels: [],
    assignee: [],
    dependencies: [],
    acceptanceCriteria: [],
    definitionOfDone: [],
    filePath: '/test/tasks/task-1.md',
  },
  {
    id: 'TASK-2',
    title: 'Build feature',
    status: 'In Dev',
    labels: [],
    assignee: [],
    dependencies: [],
    acceptanceCriteria: [],
    definitionOfDone: [],
    filePath: '/test/tasks/task-2.md',
  },
  {
    id: 'TASK-3',
    title: 'Code review',
    status: 'Review',
    labels: ['feature'],
    assignee: [],
    dependencies: [],
    acceptanceCriteria: [],
    definitionOfDone: [],
    filePath: '/test/tasks/task-3.md',
  },
  {
    id: 'TASK-4',
    title: 'QA testing',
    status: 'QA',
    labels: [],
    assignee: [],
    dependencies: [],
    acceptanceCriteria: [],
    definitionOfDone: [],
    filePath: '/test/tasks/task-4.md',
  },
  {
    id: 'TASK-5',
    title: 'Released feature',
    status: 'Deployed',
    labels: [],
    assignee: [],
    dependencies: [],
    acceptanceCriteria: [],
    definitionOfDone: [],
    filePath: '/test/tasks/task-5.md',
  },
];

async function setupWithCustomStatuses(page: ReturnType<typeof test.info>['page']) {
  await installVsCodeMock(page);
  await page.goto('/tasks.html');
  await page.waitForTimeout(100);

  await postMessageToWebview(page, { type: 'viewModeChanged', viewMode: 'kanban' });
  await postMessageToWebview(page, {
    type: 'statusesUpdated',
    statuses: customStatuses,
  });
  await postMessageToWebview(page, { type: 'milestonesUpdated', milestones: [] });
  await postMessageToWebview(page, { type: 'tasksUpdated', tasks: sampleTasks });
  await page.waitForTimeout(100);
}

test.describe('Custom Statuses - Kanban View', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithCustomStatuses(page);
  });

  test('renders all custom status columns', async ({ page }) => {
    for (const status of customStatuses) {
      const column = page.locator(`[data-testid="column-${status}"]`);
      await expect(column).toBeVisible();
    }
  });

  test('renders correct number of columns', async ({ page }) => {
    const columns = page.locator('.kanban-column');
    await expect(columns).toHaveCount(customStatuses.length);
  });

  test('places cards in correct custom columns', async ({ page }) => {
    // Backlog column has 1 card
    const backlogCards = page.locator('[data-testid="column-Backlog"] .task-card');
    await expect(backlogCards).toHaveCount(1);
    await expect(backlogCards.first()).toContainText('Setup project');

    // In Dev column has 1 card
    const devCards = page.locator('[data-testid="column-In Dev"] .task-card');
    await expect(devCards).toHaveCount(1);

    // Review column has 1 card
    const reviewCards = page.locator('[data-testid="column-Review"] .task-card');
    await expect(reviewCards).toHaveCount(1);

    // QA column has 1 card
    const qaCards = page.locator('[data-testid="column-QA"] .task-card');
    await expect(qaCards).toHaveCount(1);

    // Deployed column has 1 card
    const deployedCards = page.locator('[data-testid="column-Deployed"] .task-card');
    await expect(deployedCards).toHaveCount(1);
  });

  test('column headers display custom status names', async ({ page }) => {
    for (const status of customStatuses) {
      const header = page.locator(`[data-testid="column-${status}"] .column-title`);
      await expect(header).toHaveText(status);
    }
  });
});

test.describe('Custom Statuses - List View', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithCustomStatuses(page);
    await postMessageToWebview(page, { type: 'viewModeChanged', viewMode: 'list' });
    await page.waitForTimeout(50);
  });

  test('displays all tasks with custom status badges', async ({ page }) => {
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(sampleTasks.length);
  });

  test('status badges show custom status text', async ({ page }) => {
    // Check that each task's status badge displays the correct custom status
    for (const task of sampleTasks) {
      const row = page.locator(`[data-testid="task-row-${task.id}"]`);
      const badge = row.locator('.status-badge');
      await expect(badge).toHaveText(task.status);
    }
  });

  test('custom status badges have inline styling', async ({ page }) => {
    // Custom statuses should have inline style for color (not rely on CSS class alone)
    const reviewBadge = page.locator('[data-testid="task-row-TASK-3"] .status-badge');
    const style = await reviewBadge.getAttribute('style');
    expect(style).toContain('background-color');
    expect(style).toContain('color');
  });

  test('shows Complete button for tasks with the last status (Deployed)', async ({ page }) => {
    // Deployed is the last status, so TASK-5 should show a Complete button
    const completeBtn = page.locator('[data-testid="complete-btn-TASK-5"]');
    await expect(completeBtn).toBeVisible();
  });

  test('does not show Complete button for non-final custom statuses', async ({ page }) => {
    // TASK-3 (Review) is not the last status, should not have Complete button
    await expect(page.locator('[data-testid="complete-btn-TASK-3"]')).toHaveCount(0);
  });
});
