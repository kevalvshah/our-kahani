import { expect, type Page } from '@playwright/test';

// Shared steps for driving a real room end to end: first-run setup, the twelve words, joining.

/** Fills the first-run screen (name) and the twelve-words check, as a person would. */
export async function finishSetup(page: Page, name: string) {
  await expect(page.getByLabel('Your first name')).toBeVisible({ timeout: 20_000 });
  await page.getByLabel('Your first name').fill(name);
  await page.getByRole('button', { name: 'Start Pehli Baat' }).click();
  await expect(page.getByRole('heading', { name: /Your twelve words/ })).toBeVisible({ timeout: 20_000 });
  const words = (await page.locator('.words li').allTextContents()).map((t) => t.replace(/^\d+\s*/, '').trim());
  expect(words).toHaveLength(12);
  await page.getByRole('button', { name: 'I have written them down' }).click();
  for (const input of await page.locator('input[id^="w"]').all()) {
    const n = Number((await input.getAttribute('id'))!.slice(1));
    await input.fill(words[n]!);
  }
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  return words;
}

/** Creates a room on this device and finishes setup; returns the invite link. */
export async function createAndSetUp(page: Page, name = 'Asha') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create a room' }).click();
  const words = await finishSetup(page, name);
  await expect(page.locator('.invite')).toBeVisible({ timeout: 20_000 });
  const invite = (await page.locator('.invite').textContent()) ?? '';
  const code = (await page.locator('.emoji').first().textContent()) ?? '';
  return { invite, code, words };
}

/** Joins with an invite on this device and finishes setup. */
export async function joinAndSetUp(page: Page, invite: string, name = 'Ravi') {
  await page.goto(invite);
  await expect(page.getByRole('heading', { name: "You're in" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('link', { name: 'Continue →' }).click();
  return finishSetup(page, name);
}
