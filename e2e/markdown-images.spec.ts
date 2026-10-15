import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { parseMarkdown } from '../src/core/parseMarkdown';
import { installVsCodeMock, postMessageToWebview } from './fixtures/vscode-mock';

for (const view of ['task-detail', 'task-preview']) {
  test(`${view} displays a loaded Markdown image`, async ({ page }) => {
    await installVsCodeMock(page);
    await page.route(`**/${view}.html`, async (route) => {
      const response = await route.fetch();
      const html = await response.text();
      await route.fulfill({
        response,
        body: html.replace(
          '<head>',
          `<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self';">`
        ),
      });
    });
    await page.route('**/backlog/assets/mockup.png', (route) =>
      route.fulfill({ path: resolve('images/icon.png'), contentType: 'image/png' })
    );
    await page.goto(`/${view}.html`);
    await expect(page.locator('#app > *')).toBeVisible();

    const markdown = '![Assistant mockup](../assets/mockup.png "Preview")';
    const descriptionHtml = await parseMarkdown(markdown, (source) =>
      new URL(source, 'http://localhost:5173/backlog/tasks/task-9.md').toString()
    );
    const data = {
      task: {
        id: 'TASK-9',
        title: 'Image regression',
        status: 'To Do',
        labels: [],
        assignee: [],
        dependencies: [],
        acceptanceCriteria: [],
        definitionOfDone: [],
        filePath: '/repo/backlog/tasks/task-9.md',
        description: markdown,
      },
      statuses: ['To Do', 'Done'],
      priorities: ['high', 'medium', 'low'],
      uniqueLabels: [],
      uniqueAssignees: [],
      milestones: [],
      blocksTaskIds: [],
      linkableTasks: [],
      isBlocked: false,
      descriptionHtml,
      planHtml: '',
      notesHtml: '',
      finalSummaryHtml: '',
    };
    await postMessageToWebview(
      page,
      view === 'task-detail' ? { type: 'taskData', data } : { type: 'taskPreviewData', ...data }
    );

    const image = page.getByRole('img', { name: 'Assistant mockup' });
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute('title', 'Preview');
    await expect
      .poll(() =>
        image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)
      )
      .toBe(true);
  });
}
