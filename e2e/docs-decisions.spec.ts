/**
 * Documents & Decisions List Views E2E Tests
 *
 * Tests the docs and decisions tab switching, list rendering,
 * search filtering, click-to-open messages, and keyboard shortcuts.
 */
import { test, expect } from '@playwright/test';
import {
  installVsCodeMock,
  postMessageToWebview,
  getPostedMessages,
  getLastPostedMessage,
  clearPostedMessages,
} from './fixtures/vscode-mock';
import type { BacklogDocument, BacklogDecision } from '../src/webview/lib/types';

const sampleDocuments: BacklogDocument[] = [
  {
    id: 'doc-1',
    title: 'API Reference',
    type: 'specification',
    tags: ['api', 'reference'],
    createdAt: '2024-01-15',
    updatedAt: '2024-02-01',
    content: '# API Reference\nSome content here.',
    filePath: '/test/docs/doc-1 - API-Reference.md',
  },
  {
    id: 'doc-2',
    title: 'Getting Started Guide',
    type: 'guide',
    tags: ['onboarding'],
    content: '# Getting Started\nWelcome!',
    filePath: '/test/docs/doc-2 - Getting-Started-Guide.md',
  },
  {
    id: 'doc-3',
    title: 'README',
    type: 'readme',
    tags: [],
    content: '# README',
    filePath: '/test/docs/doc-3 - README.md',
  },
];

const sampleDecisions: BacklogDecision[] = [
  {
    id: 'decision-1',
    title: 'Use Svelte for UI',
    date: '2024-01-10',
    status: 'accepted',
    context: 'We need a UI framework.',
    decision: 'Use Svelte 5 with runes.',
    consequences: 'Fast rendering, smaller bundle.',
    filePath: '/test/decisions/decision-1 - Use-Svelte-for-UI.md',
  },
  {
    id: 'decision-2',
    title: 'REST vs GraphQL',
    date: '2024-01-20',
    status: 'proposed',
    context: 'API design choice.',
    decision: 'Use REST.',
    filePath: '/test/decisions/decision-2 - REST-vs-GraphQL.md',
  },
  {
    id: 'decision-3',
    title: 'Dropped idea',
    date: '2024-02-01',
    status: 'rejected',
    context: 'Explored alternative.',
    filePath: '/test/decisions/decision-3 - Dropped-idea.md',
  },
];

async function setupTasksView(page: ReturnType<typeof test.info>['page']) {
  await installVsCodeMock(page);
  await page.goto('/tasks.html');
  await page.waitForTimeout(100);

  await postMessageToWebview(page, {
    type: 'statusesUpdated',
    statuses: ['To Do', 'In Progress', 'Done'],
  });
  await postMessageToWebview(page, { type: 'milestonesUpdated', milestones: [] });
  await postMessageToWebview(page, { type: 'tasksUpdated', tasks: [] });
  await page.waitForTimeout(100);
}

test.describe('Documents List View', () => {
  test.beforeEach(async ({ page }) => {
    await setupTasksView(page);
  });

  test('b key switches to docs view and shows empty state', async ({ page }) => {
    await clearPostedMessages(page);
    await page.keyboard.press('b');
    await page.waitForTimeout(100);

    await expect(page.locator('#docs-view')).toBeVisible();

    const messages = await getPostedMessages(page);
    const viewModeMsg = messages.find((m) => m.type === 'setViewMode');
    expect(viewModeMsg).toMatchObject({ type: 'setViewMode', mode: 'docs' });
  });

  test('renders document list after data injection', async ({ page }) => {
    // Switch to docs view
    await page.keyboard.press('b');
    await page.waitForTimeout(50);

    // Inject documents data
    await postMessageToWebview(page, {
      type: 'documentsUpdated',
      documents: sampleDocuments,
    });
    await page.waitForTimeout(100);

    // Should show 3 document items
    await expect(page.locator('[data-testid="docs-list-items"]')).toBeVisible();
    await expect(page.locator('[data-testid="docs-list-items"] .list-item')).toHaveCount(3);

    // Check first doc has correct title
    await expect(page.locator('[data-testid="doc-item-doc-1"]')).toContainText('API Reference');
    await expect(page.locator('[data-testid="doc-item-doc-2"]')).toContainText(
      'Getting Started Guide'
    );
  });

  test('shows type badges on documents', async ({ page }) => {
    await page.keyboard.press('b');
    await page.waitForTimeout(50);

    await postMessageToWebview(page, {
      type: 'documentsUpdated',
      documents: sampleDocuments,
    });
    await page.waitForTimeout(100);

    // Check type badges exist
    await expect(page.locator('[data-testid="doc-item-doc-1"] .type-badge')).toContainText(
      'specification'
    );
    await expect(page.locator('[data-testid="doc-item-doc-2"] .type-badge')).toContainText('guide');
    await expect(page.locator('[data-testid="doc-item-doc-3"] .type-badge')).toContainText(
      'readme'
    );
  });

  test('shows tag badges on documents', async ({ page }) => {
    await page.keyboard.press('b');
    await page.waitForTimeout(50);

    await postMessageToWebview(page, {
      type: 'documentsUpdated',
      documents: sampleDocuments,
    });
    await page.waitForTimeout(100);

    // doc-1 has tags [api, reference]
    const doc1Tags = page.locator('[data-testid="doc-item-doc-1"] .tag-badge');
    await expect(doc1Tags).toHaveCount(2);
    await expect(doc1Tags.first()).toContainText('api');
    await expect(doc1Tags.last()).toContainText('reference');
  });

  test('clicking a document sends openDocument message', async ({ page }) => {
    await page.keyboard.press('b');
    await page.waitForTimeout(50);

    await postMessageToWebview(page, {
      type: 'documentsUpdated',
      documents: sampleDocuments,
    });
    await page.waitForTimeout(100);

    await clearPostedMessages(page);
    await page.locator('[data-testid="doc-item-doc-1"]').click();

    const message = await getLastPostedMessage(page);
    expect(message).toEqual({
      type: 'openDocument',
      documentId: 'doc-1',
    });
  });

  test('search filters documents by title', async ({ page }) => {
    await page.keyboard.press('b');
    await page.waitForTimeout(50);

    await postMessageToWebview(page, {
      type: 'documentsUpdated',
      documents: sampleDocuments,
    });
    await page.waitForTimeout(100);

    // Type in search
    await page.locator('[data-testid="docs-search-input"]').fill('API');
    await page.waitForTimeout(50);

    // Should only show 1 matching document
    await expect(page.locator('[data-testid="docs-list-items"] .list-item')).toHaveCount(1);
    await expect(page.locator('[data-testid="doc-item-doc-1"]')).toBeVisible();
  });

  test('search filters documents by tag', async ({ page }) => {
    await page.keyboard.press('b');
    await page.waitForTimeout(50);

    await postMessageToWebview(page, {
      type: 'documentsUpdated',
      documents: sampleDocuments,
    });
    await page.waitForTimeout(100);

    // Search by tag
    await page.locator('[data-testid="docs-search-input"]').fill('onboarding');
    await page.waitForTimeout(50);

    await expect(page.locator('[data-testid="docs-list-items"] .list-item')).toHaveCount(1);
    await expect(page.locator('[data-testid="doc-item-doc-2"]')).toBeVisible();
  });

  test('shows empty state when no documents match search', async ({ page }) => {
    await page.keyboard.press('b');
    await page.waitForTimeout(50);

    await postMessageToWebview(page, {
      type: 'documentsUpdated',
      documents: sampleDocuments,
    });
    await page.waitForTimeout(100);

    await page.locator('[data-testid="docs-search-input"]').fill('nonexistent');
    await page.waitForTimeout(50);

    await expect(page.locator('.empty-state')).toBeVisible();
    await expect(page.locator('.empty-state')).toContainText('No documents match your search');
  });
});

test.describe('Decisions List View', () => {
  test.beforeEach(async ({ page }) => {
    await setupTasksView(page);
  });

  test('m key switches to decisions view and shows empty state', async ({ page }) => {
    await clearPostedMessages(page);
    await page.keyboard.press('m');
    await page.waitForTimeout(100);

    await expect(page.locator('#decisions-view')).toBeVisible();

    const messages = await getPostedMessages(page);
    const viewModeMsg = messages.find((m) => m.type === 'setViewMode');
    expect(viewModeMsg).toMatchObject({ type: 'setViewMode', mode: 'decisions' });
  });

  test('renders decision list after data injection', async ({ page }) => {
    await page.keyboard.press('m');
    await page.waitForTimeout(50);

    await postMessageToWebview(page, {
      type: 'decisionsUpdated',
      decisions: sampleDecisions,
    });
    await page.waitForTimeout(100);

    await expect(page.locator('[data-testid="decisions-list-items"]')).toBeVisible();
    await expect(page.locator('[data-testid="decisions-list-items"] .list-item')).toHaveCount(3);

    await expect(page.locator('[data-testid="decision-item-decision-1"]')).toContainText(
      'Use Svelte for UI'
    );
    await expect(page.locator('[data-testid="decision-item-decision-2"]')).toContainText(
      'REST vs GraphQL'
    );
  });

  test('shows status badges with correct classes', async ({ page }) => {
    await page.keyboard.press('m');
    await page.waitForTimeout(50);

    await postMessageToWebview(page, {
      type: 'decisionsUpdated',
      decisions: sampleDecisions,
    });
    await page.waitForTimeout(100);

    // Check status badges
    const acceptedBadge = page.locator('[data-testid="decision-item-decision-1"] .status-badge');
    await expect(acceptedBadge).toContainText('accepted');
    await expect(acceptedBadge).toHaveClass(/status-accepted/);

    const proposedBadge = page.locator('[data-testid="decision-item-decision-2"] .status-badge');
    await expect(proposedBadge).toContainText('proposed');
    await expect(proposedBadge).toHaveClass(/status-proposed/);

    const rejectedBadge = page.locator('[data-testid="decision-item-decision-3"] .status-badge');
    await expect(rejectedBadge).toContainText('rejected');
    await expect(rejectedBadge).toHaveClass(/status-rejected/);
  });

  test('shows date on decisions', async ({ page }) => {
    await page.keyboard.press('m');
    await page.waitForTimeout(50);

    await postMessageToWebview(page, {
      type: 'decisionsUpdated',
      decisions: sampleDecisions,
    });
    await page.waitForTimeout(100);

    await expect(page.locator('[data-testid="decision-item-decision-1"]')).toContainText(
      '2024-01-10'
    );
  });

  test('clicking a decision sends openDecision message', async ({ page }) => {
    await page.keyboard.press('m');
    await page.waitForTimeout(50);

    await postMessageToWebview(page, {
      type: 'decisionsUpdated',
      decisions: sampleDecisions,
    });
    await page.waitForTimeout(100);

    await clearPostedMessages(page);
    await page.locator('[data-testid="decision-item-decision-2"]').click();

    const message = await getLastPostedMessage(page);
    expect(message).toEqual({
      type: 'openDecision',
      decisionId: 'decision-2',
    });
  });

  test('search filters decisions by title', async ({ page }) => {
    await page.keyboard.press('m');
    await page.waitForTimeout(50);

    await postMessageToWebview(page, {
      type: 'decisionsUpdated',
      decisions: sampleDecisions,
    });
    await page.waitForTimeout(100);

    await page.locator('[data-testid="decisions-search-input"]').fill('Svelte');
    await page.waitForTimeout(50);

    await expect(page.locator('[data-testid="decisions-list-items"] .list-item')).toHaveCount(1);
    await expect(page.locator('[data-testid="decision-item-decision-1"]')).toBeVisible();
  });

  test('search filters decisions by status', async ({ page }) => {
    await page.keyboard.press('m');
    await page.waitForTimeout(50);

    await postMessageToWebview(page, {
      type: 'decisionsUpdated',
      decisions: sampleDecisions,
    });
    await page.waitForTimeout(100);

    await page.locator('[data-testid="decisions-search-input"]').fill('rejected');
    await page.waitForTimeout(50);

    await expect(page.locator('[data-testid="decisions-list-items"] .list-item')).toHaveCount(1);
    await expect(page.locator('[data-testid="decision-item-decision-3"]')).toBeVisible();
  });
});

test.describe('Tab Switching', () => {
  test.beforeEach(async ({ page }) => {
    await setupTasksView(page);
  });

  test('can switch between all views including docs and decisions', async ({ page }) => {
    // Start in kanban view
    await expect(page.locator('#kanban-view')).toBeVisible();

    // Switch to docs
    await page.keyboard.press('b');
    await page.waitForTimeout(50);
    await expect(page.locator('#docs-view')).toBeVisible();
    await expect(page.locator('#kanban-view')).not.toBeVisible();

    // Switch to decisions
    await page.keyboard.press('m');
    await page.waitForTimeout(50);
    await expect(page.locator('#decisions-view')).toBeVisible();
    await expect(page.locator('#docs-view')).not.toBeVisible();

    // Switch back to kanban
    await page.keyboard.press('z');
    await page.waitForTimeout(50);
    await expect(page.locator('#kanban-view')).toBeVisible();
    await expect(page.locator('#decisions-view')).not.toBeVisible();
  });

  test('docs and decisions tabs are in the overflow menu', async ({ page }) => {
    // Tabs should not be visible until overflow menu is opened
    await expect(page.locator('[data-testid="tab-docs"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="tab-decisions"]')).not.toBeVisible();

    // Open overflow menu
    await page.locator('[data-testid="overflow-menu-btn"]').click();
    await page.waitForTimeout(50);

    // Now they should be visible
    await expect(page.locator('[data-testid="tab-docs"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-decisions"]')).toBeVisible();
  });

  test('clicking docs tab in overflow menu switches to docs view', async ({ page }) => {
    await clearPostedMessages(page);

    // Open overflow menu first
    await page.locator('[data-testid="overflow-menu-btn"]').click();
    await page.waitForTimeout(50);
    await page.locator('[data-testid="tab-docs"]').click();
    await page.waitForTimeout(50);

    await expect(page.locator('#docs-view')).toBeVisible();
  });

  test('clicking decisions tab in overflow menu switches to decisions view', async ({ page }) => {
    await clearPostedMessages(page);

    // Open overflow menu first
    await page.locator('[data-testid="overflow-menu-btn"]').click();
    await page.waitForTimeout(50);
    await page.locator('[data-testid="tab-decisions"]').click();
    await page.waitForTimeout(50);

    await expect(page.locator('#decisions-view')).toBeVisible();
  });
});
