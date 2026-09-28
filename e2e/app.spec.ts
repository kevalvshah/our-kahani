import { createRoom, expect, guard, PAGES, test } from './helpers';

test.describe('app shell and screens', { tag: '@functional' }, () => {
  test('every screen loads straight from its URL, and survives a reload', async ({ page }) => {
    test.setTimeout(120_000);
    const check = await guard(page);
    for (const [path, heading] of Object.entries(PAGES)) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await page.reload();
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    }
    check();
  });

  test('phones get bottom tabs; laptops get the sidebar instead', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const tabs = page.getByRole('navigation', { name: 'Main' });
    const sidebar = page.getByRole('navigation', { name: 'All screens' });
    await expect(tabs).toBeVisible();
    await expect(sidebar).toBeHidden();
    await tabs.getByRole('link', { name: 'Packs' }).click();
    await expect(page).toHaveURL(/\/packs$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Card packs' })).toBeFocused();
    await expect(tabs.getByRole('link', { name: 'Packs' })).toHaveAttribute('aria-current', 'page');

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(sidebar).toBeVisible();
    await expect(tabs).toBeHidden();
    await sidebar.getByRole('link', { name: 'Make it ours' }).click();
    await expect(page).toHaveURL(/\/look$/);
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: 'Card packs' })).toBeVisible();
  });

  test('Today changes once a room exists, and the room survives a reload', async ({ page }) => {
    await createRoom(page);
    await expect(page.getByText('Day 1 of 14 · room ends in 28 days').first()).toBeAttached();
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Open today's card/ })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Waiting for your person to join.')).toBeVisible();
    await page.goto('/invite');
    await expect(page.locator('.invite')).toBeVisible(); // the creator can show the link again
  });

  test('the card: pick, change your mind, and nothing is sent', async ({ page }) => {
    const check = await guard(page);
    await page.goto('/card');
    const hugs = page.getByRole('button', { name: 'Hugs' });
    const words = page.getByRole('button', { name: 'Kind words' });
    await hugs.click();
    await expect(hugs).toHaveAttribute('aria-pressed', 'true');
    await words.click();
    await expect(words).toHaveAttribute('aria-pressed', 'true');
    await expect(hugs).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('status')).toContainText('Nothing is sent yet');
    check();
  });

  test('"Make it ours" applies at once, persists on this device, and never leaves it', async ({ page }) => {
    const check = await guard(page);
    await page.goto('/look');
    await page.getByRole('button', { name: 'Dark', exact: true }).click();
    await page.getByRole('button', { name: 'Neel' }).click();
    await page.getByRole('button', { name: 'Large' }).click();
    await page.getByRole('button', { name: 'Calm' }).click();
    await page.getByRole('button', { name: 'Plain' }).click();
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-k-theme', 'dark');
    await expect(html).toHaveAttribute('data-k-accent', 'neel');
    await expect(html).toHaveAttribute('data-k-text', 'large');
    await expect(html).toHaveAttribute('data-k-motion', 'calm');
    await expect(html).toHaveAttribute('data-k-texture', 'plain');

    await page.reload();
    await expect(html).toHaveAttribute('data-k-theme', 'dark');
    await expect(html).toHaveAttribute('data-k-accent', 'neel');
    await expect(page.getByRole('button', { name: 'Neel' })).toHaveAttribute('aria-pressed', 'true');

    // Back to following the phone.
    await page.getByRole('button', { name: 'Phone' }).click();
    await expect(html).not.toHaveAttribute('data-k-theme');
    check();
  });

  test('emoji icons off hides the tiles but never the words', async ({ page }) => {
    await page.goto('/look');
    await page.getByRole('button', { name: 'Off', exact: true }).click();
    await page.goto('/');
    await expect(page.locator('main [data-k-em]').first()).toBeHidden();
    await expect(page.locator('main').getByText('Movie Night')).toBeVisible();
  });

  test('Gentle Corner shows verified numbers for the UK, and only the generic line elsewhere', async ({ newDevice }) => {
    const uk = await newDevice({ locale: 'en-GB' });
    await uk.goto('/gentle');
    await expect(uk.getByRole('note')).toContainText('United Kingdom: 999 for emergencies, Samaritans 116 123');
    await expect(uk.getByRole('link', { name: 'findahelpline.com' })).toHaveAttribute('href', 'https://findahelpline.com');

    const india = await newDevice({ locale: 'en-IN' });
    await india.goto('/gentle');
    const note = india.getByRole('note');
    await expect(note).toContainText('Wherever you are: call your local emergency number');
    await expect(note).not.toContainText(/\d{3}/);
  });

  test('erasing the room discards it after confirming', async ({ page }) => {
    await createRoom(page);
    await page.locator('.tab, .side-link').filter({ hasText: /^.*Room( data)?$/ }).locator('visible=true').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Room data' })).toBeVisible();
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Erase the room' }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Create a room' })).toBeVisible();
  });

  test('features that need the server are marked "Soon", not faked', async ({ page }) => {
    for (const path of ['/movie', '/right-now', '/saved', '/room']) {
      await page.goto(path);
      await expect(page.getByText('Soon').first()).toBeVisible();
    }
    await page.goto('/card');
    await expect(page.getByText(/has answered/)).toHaveCount(0);
  });
});
