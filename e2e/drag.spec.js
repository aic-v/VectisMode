import { test, expect } from '@playwright/test';
import { cardIn, dragCardToPanel, openCard, waitForWorkLogEditor } from './helpers.js';

test.use({ viewport: { width: 1440, height: 900 } });

test.describe('drag and drop', () => {
  test('dragging to another column opens the work-log editor; saving records the entry', async ({ page }) => {
    await page.goto('/');

    await dragCardToPanel(page, 'Review MSA for Acme Corp', 'Partner B');
    const form = await waitForWorkLogEditor(page);

    await form.locator('textarea').first().fill('Handed over to Partner B after conflict check.');
    await form.locator('button', { hasText: 'Save & Complete' }).click();
    await expect(form).toBeHidden();

    await expect(cardIn(page, 'Partner B', 'Review MSA for Acme Corp')).toBeVisible();

    await openCard(page, 'Review MSA for Acme Corp');
    await expect(page.locator('.work-log-entry', { hasText: 'Handed over to Partner B' })).toBeVisible();
    await expect(page.locator('.history-entry', { hasText: 'Partner A → Partner B' })).toBeVisible();
  });

  test('cancelling the work-log editor returns the card to its origin column', async ({ page }) => {
    await page.goto('/');

    await dragCardToPanel(page, 'Draft Employee Handbook', 'Associate 2');
    const form = await waitForWorkLogEditor(page);

    await form.locator('[aria-label="Discard and return card to its origin column"]').click();
    await expect(form).toBeHidden();

    await expect(cardIn(page, 'Partner A', 'Draft Employee Handbook')).toBeVisible();
    await expect(cardIn(page, 'Associate 2', 'Draft Employee Handbook')).toHaveCount(0);
  });

  test('dragging into Waiting Response forces Waiting status; dragging out restores it', async ({ page }) => {
    await page.goto('/');

    await dragCardToPanel(page, 'Draft Employee Handbook', 'Waiting Response');
    const form = await waitForWorkLogEditor(page);
    await form.locator('button', { hasText: 'Save & Complete' }).click();
    await expect(form).toBeHidden();

    const waitingCard = cardIn(page, 'Waiting Response', 'Draft Employee Handbook');
    await expect(waitingCard).toBeVisible();
    await expect(waitingCard.locator('.card-widget strong').first()).toHaveText('Waiting');

    await dragCardToPanel(page, 'Draft Employee Handbook', 'Partner A');
    const form2 = await waitForWorkLogEditor(page);
    await form2.locator('button', { hasText: 'Save & Complete' }).click();
    await expect(form2).toBeHidden();

    const restored = cardIn(page, 'Partner A', 'Draft Employee Handbook');
    await expect(restored).toBeVisible();
    await expect(restored.locator('.card-widget strong').first()).toHaveText('Drafting');
  });
});
