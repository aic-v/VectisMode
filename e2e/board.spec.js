import { test, expect } from '@playwright/test';
import { cardIn, closeDetails, metaField, openCard, panel } from './helpers.js';

test.use({ viewport: { width: 1440, height: 900 } });

test.describe('board rendering', () => {
  test('shows the six panels and seeded cards', async ({ page }) => {
    await page.goto('/');

    for (const title of ['Partner A', 'Partner B', 'Associate 1', 'Associate 2', 'Available', 'Waiting Response']) {
      await expect(panel(page, title)).toBeVisible();
    }

    await expect(cardIn(page, 'Partner A', 'Review MSA for Acme Corp')).toBeVisible();
    await expect(cardIn(page, 'Waiting Response', 'Response from Opposing Counsel')).toBeVisible();
  });
});

test.describe('details overlay', () => {
  test('opens on click, edits propagate to the card front, closes on Escape', async ({ page }) => {
    await page.goto('/');
    await openCard(page, 'Draft Employee Handbook');

    const title = page.locator('.details-title-input');
    await expect(title).toHaveValue('Draft Employee Handbook');
    await title.fill('Draft Employee Handbook v2');

    await metaField(page, 'Owner').fill('Partner B');

    // First Escape blurs the field, second closes the overlay.
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(page.locator('.focused-card-panel')).toBeHidden();

    await expect(cardIn(page, 'Partner A', 'Draft Employee Handbook v2')).toBeVisible();
  });

  test('footer links point at the card URLs', async ({ page }) => {
    await page.goto('/');
    await openCard(page, 'Review MSA for Acme Corp');

    const timeEntries = page.locator('.details-footer-link', { hasText: 'Time entries' });
    await expect(timeEntries).toHaveAttribute('href', 'https://time.vectis.law/matters/c1');
    await expect(timeEntries).toHaveAttribute('target', '_blank');
  });
});

test.describe('status ↔ column coupling', () => {
  test('setting status to Waiting moves the card into Waiting Response', async ({ page }) => {
    await page.goto('/');
    await openCard(page, 'Review MSA for Acme Corp');

    await metaField(page, 'Status').selectOption('Waiting');
    await closeDetails(page);

    await expect(cardIn(page, 'Waiting Response', 'Review MSA for Acme Corp')).toBeVisible();
    await expect(cardIn(page, 'Partner A', 'Review MSA for Acme Corp')).toHaveCount(0);
  });

  test('archive restore prompts for a destination column', async ({ page }) => {
    await page.goto('/');

    await openCard(page, 'Data Privacy Addendum');
    await metaField(page, 'Status').selectOption('Done');
    await closeDetails(page);
    await expect(cardIn(page, 'Partner B', 'Data Privacy Addendum')).toHaveCount(0);

    await page.locator('.archive-button').click();
    await page.locator('.archive-list-item', { hasText: 'Data Privacy Addendum' }).click();
    await expect(page.locator('.focused-card-panel')).toBeVisible();

    await metaField(page, 'Status').selectOption('Drafting');
    const picker = page.locator('.restore-picker');
    await expect(picker).toBeVisible();

    await picker.locator('.restore-picker-option', { hasText: 'Associate 1' }).click();
    await closeDetails(page);

    await expect(cardIn(page, 'Associate 1', 'Data Privacy Addendum')).toBeVisible();
  });

  test('cancelling a pending restore keeps the card archived', async ({ page }) => {
    await page.goto('/');

    await openCard(page, 'Data Privacy Addendum');
    await metaField(page, 'Status').selectOption('Done');
    await closeDetails(page);

    await page.locator('.archive-button').click();
    await page.locator('.archive-list-item', { hasText: 'Data Privacy Addendum' }).click();
    await metaField(page, 'Status').selectOption('Reviewing');
    await page.locator('.restore-picker-cancel').click();
    await expect(page.locator('.restore-picker')).toBeHidden();
    await expect(metaField(page, 'Status')).toHaveValue('Done');
  });
});

test.describe('persistence', () => {
  test('board edits survive a reload', async ({ page }) => {
    await page.goto('/');
    await openCard(page, 'Draft standard Terms of Service');
    await page.locator('.details-title-input').fill('Draft SaaS Terms of Service');
    await closeDetails(page);

    await page.reload();

    await expect(cardIn(page, 'Available', 'Draft SaaS Terms of Service')).toBeVisible();
  });
});
