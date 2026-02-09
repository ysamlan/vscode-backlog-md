/**
 * Content Detail (Documents & Decisions) E2E Tests
 *
 * Tests the content-detail webview panel for rendering documents
 * and decisions with correct data, badges, and "Open Markdown File" button.
 */
import { test, expect } from '@playwright/test';
import {
  installVsCodeMock,
  postMessageToWebview,
  getLastPostedMessage,
  clearPostedMessages,
} from './fixtures/vscode-mock';
import type { BacklogDocument, BacklogDecision } from '../src/webview/lib/types';

const sampleDocument: BacklogDocument = {
  id: 'doc-1',
  title: 'API Reference',
  type: 'specification',
  tags: ['api', 'reference'],
  createdAt: '2024-01-15',
  updatedAt: '2024-02-01',
  content: '# API Reference\nSome content here.',
  filePath: '/test/docs/doc-1 - API-Reference.md',
};

const sampleDecision: BacklogDecision = {
  id: 'decision-1',
  title: 'Use Svelte for UI',
  date: '2024-01-10',
  status: 'accepted',
  context: 'We need a lightweight framework.',
  decision: 'Use Svelte 5 with runes.',
  consequences: 'Faster rendering, smaller bundle size.',
  alternatives: 'React, Vue, Angular were considered.',
  filePath: '/test/decisions/decision-1 - Use-Svelte-for-UI.md',
};

async function setupContentDetail(page: ReturnType<typeof test.info>['page']) {
  await installVsCodeMock(page);
  await page.goto('/content-detail.html');
  await page.waitForTimeout(100);
}

test.describe('Document Detail', () => {
  test.beforeEach(async ({ page }) => {
    await setupContentDetail(page);
  });

  test('shows loading state initially', async ({ page }) => {
    await expect(page.locator('[data-testid="content-detail"]')).toBeVisible();
    await expect(page.locator('.loading-state')).toBeVisible();
  });

  test('renders document data after message injection', async ({ page }) => {
    await postMessageToWebview(page, {
      type: 'documentData',
      document: sampleDocument,
      contentHtml: '<p>API Reference content goes here.</p>',
    });
    await page.waitForTimeout(100);

    // Header should be visible
    await expect(page.locator('[data-testid="document-header"]')).toBeVisible();

    // Title
    await expect(page.locator('.detail-title')).toContainText('API Reference');

    // Entity ID
    await expect(page.locator('.entity-id')).toContainText('doc-1');
  });

  test('shows type badge for document', async ({ page }) => {
    await postMessageToWebview(page, {
      type: 'documentData',
      document: sampleDocument,
      contentHtml: '<p>Content</p>',
    });
    await page.waitForTimeout(100);

    const typeBadge = page.locator('.type-badge');
    await expect(typeBadge).toContainText('specification');
    await expect(typeBadge).toHaveClass(/badge-spec/);
  });

  test('shows tag badges for document', async ({ page }) => {
    await postMessageToWebview(page, {
      type: 'documentData',
      document: sampleDocument,
      contentHtml: '<p>Content</p>',
    });
    await page.waitForTimeout(100);

    const tagBadges = page.locator('.tag-badge');
    await expect(tagBadges).toHaveCount(2);
    await expect(tagBadges.first()).toContainText('api');
    await expect(tagBadges.last()).toContainText('reference');
  });

  test('shows dates for document', async ({ page }) => {
    await postMessageToWebview(page, {
      type: 'documentData',
      document: sampleDocument,
      contentHtml: '<p>Content</p>',
    });
    await page.waitForTimeout(100);

    await expect(page.locator('.detail-dates')).toContainText('Created: 2024-01-15');
    await expect(page.locator('.detail-dates')).toContainText('Updated: 2024-02-01');
  });

  test('renders HTML content in document body', async ({ page }) => {
    await postMessageToWebview(page, {
      type: 'documentData',
      document: sampleDocument,
      contentHtml: '<p>This is <strong>rendered</strong> markdown.</p>',
    });
    await page.waitForTimeout(100);

    const body = page.locator('[data-testid="document-body"]');
    await expect(body).toBeVisible();
    await expect(body.locator('p')).toContainText('This is rendered markdown.');
    await expect(body.locator('strong')).toContainText('rendered');
  });

  test('open markdown file button sends openFile message', async ({ page }) => {
    await postMessageToWebview(page, {
      type: 'documentData',
      document: sampleDocument,
      contentHtml: '<p>Content</p>',
    });
    await page.waitForTimeout(100);

    await clearPostedMessages(page);
    await page.locator('[data-testid="open-file-btn"]').click();

    const message = await getLastPostedMessage(page);
    expect(message).toEqual({
      type: 'openFile',
      filePath: '/test/docs/doc-1 - API-Reference.md',
    });
  });

  test('renders tables with proper styling in document body', async ({ page }) => {
    await postMessageToWebview(page, {
      type: 'documentData',
      document: sampleDocument,
      contentHtml:
        '<table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>A</td><td>1</td></tr></tbody></table>',
    });
    await page.waitForTimeout(100);

    const table = page.locator('[data-testid="document-body"] table');
    await expect(table).toBeVisible();
    const th = table.locator('th').first();
    const borderStyle = await th.evaluate((el) => getComputedStyle(el).borderBottomStyle);
    expect(borderStyle).not.toBe('none');
  });
});

test.describe('Decision Detail', () => {
  test.beforeEach(async ({ page }) => {
    await setupContentDetail(page);
  });

  test('renders decision data after message injection', async ({ page }) => {
    await postMessageToWebview(page, {
      type: 'decisionData',
      decision: sampleDecision,
      sections: {
        context: '<p>We need a lightweight framework.</p>',
        decision: '<p>Use Svelte 5 with runes.</p>',
        consequences: '<p>Faster rendering, smaller bundle size.</p>',
        alternatives: '<p>React, Vue, Angular were considered.</p>',
      },
    });
    await page.waitForTimeout(100);

    // Header should be visible
    await expect(page.locator('[data-testid="decision-header"]')).toBeVisible();

    // Title
    await expect(page.locator('.detail-title')).toContainText('Use Svelte for UI');

    // Entity ID
    await expect(page.locator('.entity-id')).toContainText('decision-1');
  });

  test('shows status badge for decision', async ({ page }) => {
    await postMessageToWebview(page, {
      type: 'decisionData',
      decision: sampleDecision,
      sections: {},
    });
    await page.waitForTimeout(100);

    const statusBadge = page.locator('.status-badge');
    await expect(statusBadge).toContainText('accepted');
    await expect(statusBadge).toHaveClass(/status-accepted/);
  });

  test('shows date for decision', async ({ page }) => {
    await postMessageToWebview(page, {
      type: 'decisionData',
      decision: sampleDecision,
      sections: {},
    });
    await page.waitForTimeout(100);

    await expect(page.locator('.date-label')).toContainText('2024-01-10');
  });

  test('renders all decision sections', async ({ page }) => {
    await postMessageToWebview(page, {
      type: 'decisionData',
      decision: sampleDecision,
      sections: {
        context: '<p>We need a lightweight framework.</p>',
        decision: '<p>Use Svelte 5 with runes.</p>',
        consequences: '<p>Faster rendering, smaller bundle size.</p>',
        alternatives: '<p>React, Vue, Angular were considered.</p>',
      },
    });
    await page.waitForTimeout(100);

    const body = page.locator('[data-testid="decision-body"]');
    await expect(body).toBeVisible();

    // Should have 4 sections
    const sections = body.locator('.decision-section');
    await expect(sections).toHaveCount(4);

    // Check section headings
    await expect(sections.nth(0).locator('h2')).toContainText('Context');
    await expect(sections.nth(1).locator('h2')).toContainText('Decision');
    await expect(sections.nth(2).locator('h2')).toContainText('Consequences');
    await expect(sections.nth(3).locator('h2')).toContainText('Alternatives');

    // Check section content
    await expect(sections.nth(0).locator('.section-content')).toContainText(
      'We need a lightweight framework.'
    );
    await expect(sections.nth(1).locator('.section-content')).toContainText(
      'Use Svelte 5 with runes.'
    );
  });

  test('renders partial decision sections', async ({ page }) => {
    await postMessageToWebview(page, {
      type: 'decisionData',
      decision: { ...sampleDecision, alternatives: undefined },
      sections: {
        context: '<p>Context only.</p>',
        decision: '<p>Decision only.</p>',
      },
    });
    await page.waitForTimeout(100);

    const body = page.locator('[data-testid="decision-body"]');
    const sections = body.locator('.decision-section');
    // Only 2 sections (context, decision) since consequences and alternatives are empty
    await expect(sections).toHaveCount(2);
  });

  test('open raw file button sends openFile message for decision', async ({ page }) => {
    await postMessageToWebview(page, {
      type: 'decisionData',
      decision: sampleDecision,
      sections: {},
    });
    await page.waitForTimeout(100);

    await clearPostedMessages(page);
    await page.locator('[data-testid="open-file-btn"]').click();

    const message = await getLastPostedMessage(page);
    expect(message).toEqual({
      type: 'openFile',
      filePath: '/test/decisions/decision-1 - Use-Svelte-for-UI.md',
    });
  });

  test('renders different decision statuses with correct classes', async ({ page }) => {
    // Test proposed status
    await postMessageToWebview(page, {
      type: 'decisionData',
      decision: { ...sampleDecision, status: 'proposed' },
      sections: {},
    });
    await page.waitForTimeout(100);

    let statusBadge = page.locator('.status-badge');
    await expect(statusBadge).toContainText('proposed');
    await expect(statusBadge).toHaveClass(/status-proposed/);

    // Test rejected status
    await postMessageToWebview(page, {
      type: 'decisionData',
      decision: { ...sampleDecision, status: 'rejected' },
      sections: {},
    });
    await page.waitForTimeout(100);

    statusBadge = page.locator('.status-badge');
    await expect(statusBadge).toContainText('rejected');
    await expect(statusBadge).toHaveClass(/status-rejected/);

    // Test superseded status
    await postMessageToWebview(page, {
      type: 'decisionData',
      decision: { ...sampleDecision, status: 'superseded' },
      sections: {},
    });
    await page.waitForTimeout(100);

    statusBadge = page.locator('.status-badge');
    await expect(statusBadge).toContainText('superseded');
    await expect(statusBadge).toHaveClass(/status-superseded/);
  });
});
