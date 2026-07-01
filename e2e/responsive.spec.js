import { test, expect } from '@playwright/test';

const BREAKPOINTS = [
  { name: 'desktop', width: 1440, height: 900, teamColumns: 4 },
  { name: 'tablet', width: 1000, height: 800, teamColumns: 2 },
  { name: 'mobile', width: 600, height: 850, teamColumns: 1 },
];

async function columnCount(page, selector) {
  return page.locator(selector).evaluate(
    (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
  );
}

async function horizontalOverflow(page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

for (const { name, width, height, teamColumns } of BREAKPOINTS) {
  test.describe(`${name} (${width}px)`, () => {
    test.use({ viewport: { width, height } });

    test('team board collapses without horizontal overflow', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.board-grid')).toBeVisible();

      expect(await columnCount(page, '.board-grid')).toBe(teamColumns);
      expect(await horizontalOverflow(page)).toBe(0);
    });

    test('my command centre fits without horizontal overflow', async ({ page }) => {
      await page.goto('/');
      await page.locator('.command-mode-toggle button', { hasText: 'My Command Centre' }).click();
      await expect(page.locator('.my-centre')).toBeVisible();

      const expectedMyColumns = width <= 720 ? 1 : 2;
      expect(await columnCount(page, '.my-centre-grid')).toBe(expectedMyColumns);
      expect(await horizontalOverflow(page)).toBe(0);

      // The planner must be tall enough to be useful — a regression here
      // usually means the panel-height override lost its specificity battle.
      const plannerBox = await page.locator('.my-planner').boundingBox();
      expect(plannerBox.height).toBeGreaterThanOrEqual(480);
    });
  });
}
