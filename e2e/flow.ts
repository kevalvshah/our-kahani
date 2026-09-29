import { expect, type Page } from '@playwright/test';

// Shared steps for driving a real room end to end: first-run setup, joining, naming the room
// together and each person's room phrase.

/** Fills the first-run screen (first name), as a person would. Returns [] (kept for callers). */
export async function finishSetup(page: Page, name: string): Promise<string[]> {
  await expect(page.getByLabel('Your first name')).toBeVisible({ timeout: 20_000 });
  await page.getByLabel('Your first name').fill(name);
  await page.getByRole('button', { name: 'Start Pehli Baat' }).click();
  await expect(page.getByLabel('Your first name')).toBeHidden({ timeout: 45_000 });
  return [];
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

/** One person suggests the first offered hashtag, the other agrees; returns it (e.g. "#ChaiAurCoffee"). */
export async function lockHashtag(suggester: Page, agreer: Page): Promise<string> {
  await suggester.goto('/');
  await expect(suggester.getByText('Name your room together')).toBeVisible({ timeout: 20_000 });
  await suggester.getByRole('button', { name: 'Suggest this one' }).click();
  await expect(suggester.getByText(/You suggested #/)).toBeVisible({ timeout: 20_000 });
  await agreer.goto('/');
  await agreer.getByRole('button', { name: 'Agree and lock it 🔒' }).click({ timeout: 45_000 });
  await expect(agreer.getByRole('heading', { name: /Your room phrase/ })).toBeVisible({ timeout: 45_000 });
  return ((await agreer.locator('.panel b').first().textContent()) ?? '').trim();
}

/**
 * A phrase no earlier test run used: the test rooms share names, so they share suggested
 * hashtags, and the same hashtag + phrase twice is refused (it would find the other room).
 */
export function uniquePhrase(base: string): string {
  return `${base} ${Math.random().toString(36).slice(2, 9).replace(/\d/g, 'q')}`;
}

/** The mandatory room-phrase step that follows the locked hashtag. */
export async function setPhrase(page: Page, phrase: string) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Your room phrase/ })).toBeVisible({ timeout: 20_000 });
  await page.getByLabel('Your phrase (four or more words)').fill(phrase);
  await page.getByLabel('Type it again').fill(phrase);
  await page.getByRole('button', { name: 'Save my phrase' }).click();
  await expect(page.getByRole('heading', { name: /Your room phrase/ })).toBeHidden({ timeout: 30_000 });
}
