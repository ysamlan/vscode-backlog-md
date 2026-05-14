import { test, expect } from '@playwright/test';
import {
  installVsCodeMock,
  postMessageToWebview,
  getPostedMessages,
  clearPostedMessages,
} from './fixtures/vscode-mock';

test.describe('WorkspaceTabs — workspace tab strip', () => {
  test.beforeEach(async ({ page }) => {
    await installVsCodeMock(page);
    await page.goto('/tasks.html');
    await page.waitForTimeout(100);
  });

  test('tab strip is hidden with a single root', async ({ page }) => {
    await postMessageToWebview(page, {
      type: 'rootsUpdated',
      roots: [{ label: 'my-project', backlogPath: '/x/backlog' }],
      activeBacklogPath: '/x/backlog',
    });
    await page.waitForTimeout(150);
    await expect(page.locator('[data-testid="workspace-tabs"]')).not.toBeVisible();
  });

  test('tab strip renders when two roots are present', async ({ page }) => {
    await postMessageToWebview(page, {
      type: 'rootsUpdated',
      roots: [
        { label: 'jobbu', backlogPath: '/ws/jobbu/backlog' },
        { label: 'Backlog.md-jobbu', backlogPath: '/ws/other/backlog' },
      ],
      activeBacklogPath: '/ws/jobbu/backlog',
    });
    await page.waitForTimeout(150);
    await expect(page.locator('[data-testid="workspace-tabs"]')).toBeVisible();
    await expect(page.locator('[data-testid="workspace-tab-jobbu"]')).toBeVisible();
    await expect(page.locator('[data-testid="workspace-tab-Backlog.md-jobbu"]')).toBeVisible();
  });

  test('active tab has active class, inactive tab does not', async ({ page }) => {
    await postMessageToWebview(page, {
      type: 'rootsUpdated',
      roots: [
        { label: 'jobbu', backlogPath: '/ws/jobbu/backlog' },
        { label: 'other', backlogPath: '/ws/other/backlog' },
      ],
      activeBacklogPath: '/ws/jobbu/backlog',
    });
    await page.waitForTimeout(150);
    await expect(page.locator('[data-testid="workspace-tab-jobbu"]')).toHaveClass(/active/);
    await expect(page.locator('[data-testid="workspace-tab-other"]')).not.toHaveClass(/active/);
  });

  test('clicking inactive tab posts selectRoot with correct backlogPath', async ({ page }) => {
    await postMessageToWebview(page, {
      type: 'rootsUpdated',
      roots: [
        { label: 'jobbu', backlogPath: '/ws/jobbu/backlog' },
        { label: 'other', backlogPath: '/ws/other/backlog' },
      ],
      activeBacklogPath: '/ws/jobbu/backlog',
    });
    await page.waitForTimeout(150);
    await clearPostedMessages(page);

    await page.locator('[data-testid="workspace-tab-other"]').click();
    await page.waitForTimeout(150);

    const messages = await getPostedMessages(page);
    const msg = messages.find((m) => m.type === 'selectRoot');
    expect(msg).toBeDefined();
    expect(msg!.backlogPath).toBe('/ws/other/backlog');
  });
});
