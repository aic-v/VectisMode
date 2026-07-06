import { test, expect } from '@playwright/test';
import { openCard } from './helpers.js';

test.use({ viewport: { width: 1440, height: 900 } });

async function openMyCommandCentre(page) {
  await page.locator('.command-mode-toggle button', { hasText: 'My Command Centre' }).click();
  await expect(page.locator('.my-centre')).toBeVisible();
}

test.describe('time ledger', () => {
  test('quick-add in the Matter view logs time and shows the running total', async ({ page }) => {
    await page.goto('/');
    await openCard(page, 'Review MSA for Acme Corp');

    await page.locator('.matter-time-hours').fill('1.5');
    await page.locator('.matter-time-narrative').fill('Reviewed liability cap markups');
    await page.locator('.matter-time-add').click();

    await expect(page.locator('.matter-time-total')).toHaveText('1.5h logged →');
    await expect(page.locator('.matter-time-item', { hasText: 'Reviewed liability cap markups' })).toBeVisible();

    // It shows up on the My time strip too, attributed to the current member.
    await page.keyboard.press('Escape');
    await expect(page.locator('.focused-card-panel')).toBeHidden();
    await openMyCommandCentre(page);
    await expect(page.locator('.my-time-figures strong')).toHaveText('1.5h');
    await expect(page.locator('.my-time-figures span')).toHaveText('100% billable');
  });

  test('saving the drag work-log form with hours feeds the ledger', async ({ page }) => {
    await page.goto('/');
    await openCard(page, 'Draft Employee Handbook');
    await page.keyboard.press('Escape');
    await expect(page.locator('.focused-card-panel')).toBeHidden();

    // Drag to another column to open the work-log editor.
    const card = page.locator('.card-scene', { hasText: 'Draft Employee Handbook' }).first();
    const target = page.locator('.cutout-panel', {
      has: page.locator('.panel-title', { hasText: 'Associate 1' }),
    });
    const cardBox = await card.boundingBox();
    const targetBox = await target.boundingBox();
    await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + 20);
    await page.mouse.down();
    await page.mouse.move(cardBox.x + cardBox.width / 2 + 12, cardBox.y + 32, { steps: 4 });
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 16 });
    await page.mouse.up();

    const form = page.locator('.work-log-form');
    await expect(form).toBeVisible();
    await form.locator('textarea').first().fill('Drafted the remote-work section');
    await form.locator('input[type="number"]').fill('2');
    await form.locator('select').nth(1).selectOption('research');
    await form.locator('button', { hasText: 'Save & Complete' }).click();
    await expect(form).toBeHidden();

    await openMyCommandCentre(page);
    await expect(page.locator('.my-time-figures strong')).toHaveText('2h');
    await expect(page.locator('.my-time-legend')).toContainText('Research & Writing');
  });

  test('the assistant logs time from a chat command', async ({ page }) => {
    await page.goto('/');
    await openMyCommandCentre(page);

    const input = page.locator('[aria-label="Message the assistant"]');
    await input.fill('log 45m of business development yesterday for pitch prep');
    await input.press('Enter');

    await expect(page.locator('.chat-bubble--assistant').last()).toContainText('Logged 0.75h of Business Development', { timeout: 5000 });
    await expect(page.locator('.my-time-figures strong')).toHaveText('0.75h');
  });

  test('the timesheet overlay filters, groups, and respects sharing levels', async ({ page }) => {
    await page.goto('/');

    // Log time as Partner A on a matter.
    await openCard(page, 'Review MSA for Acme Corp');
    await page.locator('.matter-time-hours').fill('2');
    await page.locator('.matter-time-add').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.focused-card-panel')).toBeHidden();

    // Open the timesheet from the header.
    await page.locator('.archive-button', { hasText: 'Timesheet' }).click();
    const overlay = page.locator('.focused-card-panel');
    await expect(overlay).toBeVisible();

    await expect(overlay.locator('.time-entry-row')).toHaveCount(1);
    await expect(overlay.locator('.timesheet-total')).toContainText('2h total');
    await expect(overlay.locator('.timesheet-export', { hasText: 'Export CSV' })).toBeEnabled();

    // Firm scope shows the same entry while Partner A shares full detail.
    await overlay.locator('.timesheet-scope button', { hasText: 'Firm' }).click();
    await expect(overlay.locator('.time-entry-row')).toHaveCount(1);

    // Drop Partner A to totals-only and the firm view aggregates instead.
    await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden();
    await openMyCommandCentre(page);
    await page.locator('[aria-label="Time sharing level"]').selectOption('totals');
    await page.locator('.my-time-open').click();
    const overlay2 = page.locator('.focused-card-panel');
    await overlay2.locator('.timesheet-scope button', { hasText: 'Firm' }).click();
    await expect(overlay2.locator('.time-entry-row--totals')).toContainText('Partner A');
    await expect(overlay2.locator('.time-entry-row--totals')).toContainText('2h');

    // Me scope always shows my own detail regardless of sharing.
    await overlay2.locator('.timesheet-scope button', { hasText: 'Me' }).click();
    await expect(overlay2.locator('.time-entry-row:not(.time-entry-row--totals)')).toHaveCount(1);
  });

  test('the Matter view footer opens the timesheet scoped to that matter', async ({ page }) => {
    await page.goto('/');
    await openCard(page, 'Review MSA for Acme Corp');
    await page.locator('.matter-time-hours').fill('1');
    await page.locator('.matter-time-add').click();
    await page.locator('.details-footer-button', { hasText: 'Time entries' }).click();

    const overlay = page.locator('.focused-card-panel');
    await expect(overlay).toBeVisible();
    await expect(overlay.locator('.timesheet-matter-filter')).toContainText('Review MSA for Acme Corp');
    await expect(overlay.locator('.time-entry-row')).toHaveCount(1);
  });

  test('rates value the timesheet and mark-as-billed locks entries', async ({ page }) => {
    await page.goto('/');
    await openCard(page, 'Review MSA for Acme Corp');
    await page.locator('.matter-time-hours').fill('2');
    await page.locator('.matter-time-narrative').fill('Cap review');
    await page.locator('.matter-time-add').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.focused-card-panel')).toBeHidden();

    await page.locator('.archive-button', { hasText: 'Timesheet' }).click();
    const overlay = page.locator('.focused-card-panel');
    await expect(overlay).toBeVisible();

    // Set a member rate; the footer prices the billable hours.
    await overlay.locator('.timesheet-rates-toggle').click();
    await overlay
      .locator('.rates-editor-row', { hasText: 'Partner A' })
      .locator('input')
      .fill('250');
    await expect(overlay.locator('.timesheet-value')).toContainText('£500.00');

    // A client override wins over the member rate.
    await overlay
      .locator('.rates-editor-row', { hasText: 'Acme Corp' })
      .locator('input')
      .fill('300');
    await expect(overlay.locator('.timesheet-value')).toContainText('£600.00');

    // Mark the shown entries as billed: row locks, chip appears, delete goes away.
    await overlay.locator('button', { hasText: 'Mark shown as billed (1)' }).click();
    const row = overlay.locator('.time-entry-row');
    await expect(row).toHaveClass(/time-entry-row--billed/);
    await expect(row.locator('.time-entry-billed-chip')).toBeVisible();
    await expect(row.locator('[aria-label="Narrative"]')).toBeDisabled();
    await expect(overlay.locator('button', { hasText: 'Mark shown as billed (0)' })).toBeDisabled();

    // Hide billed removes it from view; unmark restores editability.
    await overlay.locator('.timesheet-hide-billed input').check();
    await expect(overlay.locator('.time-entry-row')).toHaveCount(0);
    await overlay.locator('.timesheet-hide-billed input').uncheck();
    await row.locator('.time-entry-billed-chip').click();
    await expect(row.locator('[aria-label="Narrative"]')).toBeEnabled();

    // Rates persist across a reload.
    await page.keyboard.press('Escape');
    await page.reload();
    await page.locator('.archive-button', { hasText: 'Timesheet' }).click();
    await expect(page.locator('.focused-card-panel .timesheet-value')).toContainText('£600.00');
  });

  test('time entries persist across a reload', async ({ page }) => {
    await page.goto('/');
    await openCard(page, 'Data Privacy Addendum');
    await page.locator('.matter-time-hours').fill('3');
    await page.locator('.matter-time-narrative').fill('Sub-processor review');
    await page.locator('.matter-time-add').click();
    await page.keyboard.press('Escape');

    await page.reload();
    await openCard(page, 'Data Privacy Addendum');
    await expect(page.locator('.matter-time-item', { hasText: 'Sub-processor review' })).toBeVisible();
  });
});
