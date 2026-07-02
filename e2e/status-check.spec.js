import { test, expect } from '@playwright/test';
import { cardIn, metaField, openCard, panel } from './helpers.js';

test.use({ viewport: { width: 1440, height: 900 } });

// The seeded waiting card has waitingSince 9 days ago, so the on-load sweep
// flags it immediately.
test.describe('waiting-response status check', () => {
  test('flags the overdue waiting card on load', async ({ page }) => {
    await page.goto('/');

    const banner = page.locator('.status-check-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('1 matter needs a status check');

    const flagged = cardIn(page, 'Waiting Response', 'Response from Opposing Counsel');
    await expect(flagged.locator('.card-front')).toHaveClass(/card-front--alert/);
    await expect(flagged.locator('.card-widget strong').first()).toHaveText('Status Check');
  });

  test('assigning from the status-check panel moves the card and clears the banner', async ({ page }) => {
    await page.goto('/');

    await page.locator('.status-check-banner-item', { hasText: 'Response from Opposing Counsel' }).click();
    await expect(page.locator('.focused-card-panel')).toBeVisible();

    const checkPanel = page.locator('.status-check-panel');
    await expect(checkPanel).toBeVisible();
    await expect(checkPanel).toContainText('Waiting Response');

    await checkPanel.locator('.restore-picker-option', { hasText: 'Assign to Partner B' }).click();
    await expect(checkPanel).toBeHidden();
    await expect(metaField(page, 'Status')).toHaveValue('Reviewing');

    await page.locator('.icon-button[aria-label="Close card details"]').click();
    await expect(cardIn(page, 'Partner B', 'Response from Opposing Counsel')).toBeVisible();
    await expect(page.locator('.status-check-banner')).toHaveCount(0);
  });

  test('keep waiting restarts the clock and unflags the card', async ({ page }) => {
    await page.goto('/');

    await openCard(page, 'Response from Opposing Counsel');
    await page.locator('.status-check-panel .restore-picker-option', { hasText: 'Keep waiting' }).click();

    await expect(page.locator('.status-check-panel')).toBeHidden();
    await expect(metaField(page, 'Status')).toHaveValue('Waiting');

    await page.locator('.icon-button[aria-label="Close card details"]').click();
    await expect(page.locator('.status-check-banner')).toHaveCount(0);
    await expect(cardIn(page, 'Waiting Response', 'Response from Opposing Counsel')).toBeVisible();
  });

  test('archiving from the status-check panel moves the card to the archive', async ({ page }) => {
    await page.goto('/');

    await openCard(page, 'Response from Opposing Counsel');
    await page.locator('.status-check-panel .restore-picker-option', { hasText: 'Archive matter' }).click();
    await expect(metaField(page, 'Status')).toHaveValue('Done');
    await page.locator('.icon-button[aria-label="Close card details"]').click();

    await expect(panel(page, 'Waiting Response').locator('.card-scene')).toHaveCount(0);

    await page.locator('.archive-button', { hasText: 'Archive' }).click();
    await expect(page.locator('.archive-list-item', { hasText: 'Response from Opposing Counsel' })).toBeVisible();
  });
});
