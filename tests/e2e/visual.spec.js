import { expect, test } from '@playwright/test';

test('layout header visual baseline', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('header')).toHaveScreenshot('layout-header.png', {
    animations: 'disabled',
    caret: 'hide',
  });
});
