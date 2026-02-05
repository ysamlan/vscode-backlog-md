/**
 * Dashboard Webview E2E Tests
 *
 * Tests the Dashboard Svelte component in isolation using the VS Code mock.
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

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await installVsCodeMock(page);
    await page.goto('/dashboard.html');
  });

  test('shows loading state initially', async ({ page }) => {
    // The component requests data on mount, so we should briefly see loading
    // We need to be quick to catch this before the mock responds
    await expect(page.locator('.empty-state')).toContainText('Loading');
  });

  test('displays stats when statsUpdated message is received', async ({ page }) => {
    // Wait for component to mount and request refresh
    await page.waitForTimeout(100);

    // Send stats to the webview
    await postMessageToWebview(page, { type: 'statsUpdated', stats: sampleStats });

    // Verify stats grid shows correct values
    await expect(page.locator('.stat-todo .stat-value')).toHaveText('3');
    await expect(page.locator('.stat-in-progress .stat-value')).toHaveText('4');
    await expect(page.locator('.stat-done .stat-value')).toHaveText('3');

    // Verify total and completion percentage (30% = 3/10)
    await expect(page.locator('.stat-card:not(.clickable) .stat-value')).toHaveText('10');
    await expect(page.locator('.stat-card:not(.clickable) .stat-label')).toContainText('30%');
  });

  test('displays status breakdown bars', async ({ page }) => {
    await page.waitForTimeout(100);
    await postMessageToWebview(page, { type: 'statsUpdated', stats: sampleStats });

    // Verify status breakdown section exists
    await expect(page.locator('.section-title').first()).toHaveText('Status Breakdown');

    // Verify status rows are present
    await expect(page.locator('.status-row')).toHaveCount(3);
  });

  test('displays priority distribution', async ({ page }) => {
    await page.waitForTimeout(100);
    await postMessageToWebview(page, { type: 'statsUpdated', stats: sampleStats });

    // Verify priority section
    await expect(page.locator('.priority-breakdown')).toBeVisible();
    await expect(page.locator('.priority-high .priority-count')).toHaveText('2');
    await expect(page.locator('.priority-medium .priority-count')).toHaveText('5');
    await expect(page.locator('.priority-low .priority-count')).toHaveText('2');
    await expect(page.locator('.priority-none .priority-count')).toHaveText('1');
  });

  test('displays milestone progress when milestones exist', async ({ page }) => {
    await page.waitForTimeout(100);
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
    await page.waitForTimeout(100);
    await postMessageToWebview(page, { type: 'statsUpdated', stats: statsNoMilestones });

    // Milestone section should not exist
    await expect(page.locator('.milestone-list')).not.toBeVisible();
  });

  test('shows empty state when no tasks', async ({ page }) => {
    await page.waitForTimeout(100);
    await postMessageToWebview(page, { type: 'statsUpdated', stats: emptyStats });

    // Should show "No Tasks Yet" empty state
    await expect(page.locator('.empty-state h3')).toHaveText('No Tasks Yet');
  });

  test('shows no backlog state', async ({ page }) => {
    await page.waitForTimeout(100);
    await postMessageToWebview(page, { type: 'noBacklogFolder' });

    // Should show "No Backlog Found" empty state
    await expect(page.locator('.empty-state h3')).toHaveText('No Backlog Found');
  });

  test('clicking stat card sends filterByStatus message', async ({ page }) => {
    await page.waitForTimeout(100);
    await postMessageToWebview(page, { type: 'statsUpdated', stats: sampleStats });
    await clearPostedMessages(page);

    // Click the "To Do" stat card
    await page.click('.stat-todo');

    // Verify the correct message was sent
    const message = await getLastPostedMessage(page);
    expect(message).toEqual({ type: 'filterByStatus', status: 'To Do' });
  });

  test('clicking In Progress card sends filterByStatus message', async ({ page }) => {
    await page.waitForTimeout(100);
    await postMessageToWebview(page, { type: 'statsUpdated', stats: sampleStats });
    await clearPostedMessages(page);

    await page.click('.stat-in-progress');

    const message = await getLastPostedMessage(page);
    expect(message).toEqual({ type: 'filterByStatus', status: 'In Progress' });
  });

  test('clicking Done card sends filterByStatus message', async ({ page }) => {
    await page.waitForTimeout(100);
    await postMessageToWebview(page, { type: 'statsUpdated', stats: sampleStats });
    await clearPostedMessages(page);

    await page.click('.stat-done');

    const message = await getLastPostedMessage(page);
    expect(message).toEqual({ type: 'filterByStatus', status: 'Done' });
  });

  test('sends refresh message on mount', async ({ page }) => {
    // Wait for component to mount and send refresh
    await page.waitForTimeout(200);

    const message = await getLastPostedMessage(page);
    expect(message).toEqual({ type: 'refresh' });
  });
});
