/**
 * Simple smoke test to verify the Svelte 5 build pipeline works.
 * This test will be removed after Phase 1 verification.
 */
import { test, expect } from '@playwright/test';

test.describe('Svelte 5 Infrastructure', () => {
  test('HelloWorld component renders and is interactive', async ({ page }) => {
    // Navigate to the test page
    await page.goto('/svelte-test.html');

    // Wait for Svelte to mount and render
    await expect(page.locator('h1')).toHaveText('Hello from Svelte 5!');

    // Verify initial count is 0
    await expect(page.locator('p')).toContainText('Count: 0');

    // Click the increment button
    await page.click('button');

    // Verify count increased
    await expect(page.locator('p')).toContainText('Count: 1');

    // Click again
    await page.click('button');
    await expect(page.locator('p')).toContainText('Count: 2');
  });
});
