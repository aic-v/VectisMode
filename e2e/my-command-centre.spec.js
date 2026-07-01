import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

async function openMyCommandCentre(page) {
  await page.goto('/');
  await page.locator('.command-mode-toggle button', { hasText: 'My Command Centre' }).click();
  await expect(page.locator('.my-centre')).toBeVisible();
}

test.describe('my command centre', () => {
  test('shows the day planner with agenda, status checks, and calendar', async ({ page }) => {
    await openMyCommandCentre(page);

    const planner = page.locator('.my-planner');
    await expect(planner).toBeVisible();

    // Partner A owns the flagged waiting card, so it appears under alerts.
    await expect(planner.locator('.planner-alerts .agenda-item', { hasText: 'Response from Opposing Counsel' })).toBeVisible();

    // Sample due dates are in the past relative to today, so they group as overdue.
    await expect(planner.locator('.agenda-item', { hasText: 'Review MSA for Acme Corp' })).toBeVisible();

    await expect(planner.locator('.calendar-grid')).toBeVisible();
    await expect(planner.locator('.calendar-day--today')).toHaveCount(1);
  });

  test('agenda items open the matter view', async ({ page }) => {
    await openMyCommandCentre(page);

    await page.locator('.agenda-item', { hasText: 'Review MSA for Acme Corp' }).click();
    await expect(page.locator('.focused-card-panel')).toBeVisible();
    await expect(page.locator('.details-title-input')).toHaveValue('Review MSA for Acme Corp');
  });

  test('switching identity changes the planner and persists across reload', async ({ page }) => {
    await openMyCommandCentre(page);

    await page.locator('.identity-select').selectOption('user-2');
    await expect(page.locator('.agenda-item', { hasText: 'Data Privacy Addendum' })).toBeVisible();
    await expect(page.locator('.agenda-item', { hasText: 'Draft Employee Handbook' })).toHaveCount(0);

    await page.reload();
    await page.locator('.command-mode-toggle button', { hasText: 'My Command Centre' }).click();
    await expect(page.locator('.identity-select')).toHaveValue('user-2');
  });

  test('the assistant chat answers and persists history', async ({ page }) => {
    await openMyCommandCentre(page);

    const input = page.locator('[aria-label="Message the assistant"]');
    await input.fill('any status checks?');
    await input.press('Enter');

    await expect(page.locator('.chat-bubble--user')).toContainText('any status checks?');
    const reply = page.locator('.chat-bubble--assistant').last();
    await expect(reply).toContainText('Response from Opposing Counsel', { timeout: 5000 });

    await page.reload();
    await page.locator('.command-mode-toggle button', { hasText: 'My Command Centre' }).click();
    await expect(page.locator('.chat-bubble--user')).toContainText('any status checks?');
  });

  test('team toggle returns to the board', async ({ page }) => {
    await openMyCommandCentre(page);
    await page.locator('.command-mode-toggle button', { hasText: 'Team' }).click();
    await expect(page.locator('.board-grid')).toBeVisible();
    await expect(page.locator('.my-centre')).toHaveCount(0);
  });
});
