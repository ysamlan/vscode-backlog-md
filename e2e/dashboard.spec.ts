/**
 * Dashboard Tab E2E Tests
 *
 * Tests the Dashboard tab within the unified Tasks webview.
 * Dashboard is now embedded inside the Tasks component as a 5th tab.
 */
import { test, expect } from '@playwright/test';
import {
  installVsCodeMock,
  postMessageToWebview,
  getLastPostedMessage,
  clearPostedMessages,
} from './fixtures/vscode-mock';
import type { DashboardStats } from '../src/webview/lib/types';

// Sample stats for testing
const sampleStats: DashboardStats = {
  totalTasks: 10,
  completedCount: 0,
  byStatus: {
    'To Do': 3,
    'In Progress': 4,
    Done: 3,
  },
  byPriority: {
    high: 2,
    medium: 5,
    low: 2,
    none: 1,
  },
  milestones: [
    { name: 'v1.0', total: 5, done: 2 },
    { name: 'v2.0', total: 3, done: 0 },
  ],
};

const emptyStats: DashboardStats = {
  totalTasks: 0,
  completedCount: 0,
  byStatus: {
    'To Do': 0,
    'In Progress': 0,
    Done: 0,
  },
  byPriority: {
    high: 0,
    medium: 0,
    low: 0,
    none: 0,
  },
  milestones: [],
};

async function switchToDashboard(page: ReturnType<typeof test.info>['page']) {
  await page.click('[data-testid="tab-dashboard"]');
  await page.waitForTimeout(50);
}

test.describe('Dashboard Tab', () => {
  test.beforeEach(async ({ page }) => {
    await installVsCodeMock(page);
    await page.goto('/tasks.html');
    await page.waitForTimeout(100);

    // Send initial task data so view is populated
    await postMessageToWebview(page, {
      type: 'statusesUpdated',
      statuses: ['To Do', 'In Progress', 'Done'],
    });
    await postMessageToWebview(page, { type: 'tasksUpdated', tasks: [] });
    await page.waitForTimeout(50);
  });

  test('shows loading state when switching to dashboard tab', async ({ page }) => {
    await switchToDashboard(page);

    // Dashboard shows loading until stats are received
    await expect(page.locator('.empty-state')).toContainText('Loading');
  });

  test('displays stats when statsUpdated message is received', async ({ page }) => {
    await switchToDashboard(page);
    await postMessageToWebview(page, { type: 'statsUpdated', stats: sampleStats });

    // Verify stats grid shows correct values
    await expect(page.locator('.stat-to-do .stat-value')).toHaveText('3');
    await expect(page.locator('.stat-in-progress .stat-value')).toHaveText('4');
    await expect(page.locator('.stat-done .stat-value')).toHaveText('3');

    // Verify total and completion percentage (30% = 3/10)
    await expect(page.locator('.stat-card:not(.clickable) .stat-value')).toHaveText('10');
    await expect(page.locator('.stat-card:not(.clickable) .stat-sublabel')).toContainText('30%');
  });

  test('displays status breakdown bars', async ({ page }) => {
    await switchToDashboard(page);
    await postMessageToWebview(page, { type: 'statsUpdated', stats: sampleStats });

    // Verify status breakdown section exists
    await expect(page.locator('.section-title').first()).toHaveText('Status Breakdown');

    // Verify status rows are present
    await expect(page.locator('.status-row')).toHaveCount(3);
  });

  test('displays priority distribution', async ({ page }) => {
    await switchToDashboard(page);
    await postMessageToWebview(page, { type: 'statsUpdated', stats: sampleStats });

    // Verify priority section
    await expect(page.locator('.priority-breakdown')).toBeVisible();
    await expect(page.locator('.priority-high .priority-count')).toHaveText('2');
    await expect(page.locator('.priority-medium .priority-count')).toHaveText('5');
    await expect(page.locator('.priority-low .priority-count')).toHaveText('2');
    await expect(page.locator('.priority-none .priority-count')).toHaveText('1');
  });

  test('displays milestone progress when milestones exist', async ({ page }) => {
    await switchToDashboard(page);
    await postMessageToWebview(page, { type: 'statsUpdated', stats: sampleStats });

    // Verify milestone section exists
    await expect(page.locator('.milestone-list')).toBeVisible();
    await expect(page.locator('.milestone-item')).toHaveCount(2);

    // Check milestone details
    await expect(page.locator('.milestone-name').first()).toHaveText('v1.0');
    await expect(page.locator('.milestone-stats').first()).toContainText('2/5');
  });

  test('hides milestone section when no milestones', async ({ page }) => {
    const statsNoMilestones = { ...sampleStats, milestones: [] };
    await switchToDashboard(page);
    await postMessageToWebview(page, { type: 'statsUpdated', stats: statsNoMilestones });

    // Milestone section should not exist
    await expect(page.locator('.milestone-list')).not.toBeVisible();
  });

  test('shows empty state when no tasks', async ({ page }) => {
    await switchToDashboard(page);
    await postMessageToWebview(page, { type: 'statsUpdated', stats: emptyStats });

    // Should show "No Tasks Yet" empty state
    await expect(page.locator('.empty-state h3')).toHaveText('No Tasks Yet');
  });

  test('clicking stat card sends filterByStatus message', async ({ page }) => {
    await switchToDashboard(page);
    await postMessageToWebview(page, { type: 'statsUpdated', stats: sampleStats });
    await clearPostedMessages(page);

    // Click the "To Do" stat card
    await page.click('.stat-to-do');

    // Verify the correct message was sent
    const message = await getLastPostedMessage(page);
    expect(message).toEqual({ type: 'filterByStatus', status: 'To Do' });
  });

  test('clicking In Progress card sends filterByStatus message', async ({ page }) => {
    await switchToDashboard(page);
    await postMessageToWebview(page, { type: 'statsUpdated', stats: sampleStats });
    await clearPostedMessages(page);

    await page.click('.stat-in-progress');

    const message = await getLastPostedMessage(page);
    expect(message).toEqual({ type: 'filterByStatus', status: 'In Progress' });
  });

  test('clicking Done card sends filterByStatus message', async ({ page }) => {
    await switchToDashboard(page);
    await postMessageToWebview(page, { type: 'statsUpdated', stats: sampleStats });
    await clearPostedMessages(page);

    await page.click('.stat-done');

    const message = await getLastPostedMessage(page);
    expect(message).toEqual({ type: 'filterByStatus', status: 'Done' });
  });

  test('dashboard tab is present and clickable', async ({ page }) => {
    const dashboardTab = page.locator('[data-testid="tab-dashboard"]');
    await expect(dashboardTab).toBeVisible();

    await dashboardTab.click();
    await expect(dashboardTab).toHaveAttribute('aria-selected', 'true');
  });
});
