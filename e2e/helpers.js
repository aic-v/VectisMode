import { expect } from '@playwright/test';

export function panel(page, title) {
  return page.locator('.cutout-panel', {
    has: page.locator('.panel-title', { hasText: title }),
  });
}

export function cardIn(page, panelTitle, cardTitle) {
  return panel(page, panelTitle).locator('.card-scene', { hasText: cardTitle });
}

export async function openCard(page, cardTitle) {
  await page.locator('.card-front', { hasText: cardTitle }).first().click();
  await expect(page.locator('.focused-card-panel')).toBeVisible();
}

export function metaField(page, label) {
  return page
    .locator('.details-meta-item', { has: page.locator(`span:text-is("${label}")`) })
    .locator('input, select');
}

export async function closeDetails(page) {
  await page.locator('.icon-button[aria-label="Close card details"]').click();
  await expect(page.locator('.focused-card-panel')).toBeHidden();
}

// dnd-kit PointerSensor needs a >5px movement before a drag activates, so a
// plain dragTo is not enough — walk the pointer over in steps.
export async function dragCardToPanel(page, cardTitle, panelTitle) {
  const card = page.locator('.card-scene', { hasText: cardTitle }).first();
  const target = panel(page, panelTitle);

  const cardBox = await card.boundingBox();
  const targetBox = await target.boundingBox();

  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + 20);
  await page.mouse.down();
  await page.mouse.move(cardBox.x + cardBox.width / 2 + 12, cardBox.y + 32, { steps: 4 });
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 16 },
  );
  await page.mouse.up();
}

export async function waitForWorkLogEditor(page) {
  const form = page.locator('.work-log-form');
  await expect(form).toBeVisible();
  return form;
}
