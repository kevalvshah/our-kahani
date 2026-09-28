import type { Page, Request } from '@playwright/test';
import { BACKEND_HOST, expect, test } from './helpers';
import { createAndSetUp, joinAndSetUp, lockHashtag, setPhrase } from './flow';

// The whole product, end to end, as two people on two phones.

function recordBackendTraffic(page: Page) {
  const sent: string[] = [];
  page.on('request', (r: Request) => {
    if (new URL(r.url()).host === BACKEND_HOST) sent.push(`${r.method()} ${r.url()}\n${r.postData() ?? ''}`);
  });
  return sent;
}

test.describe('the full journey', { tag: '@journey' }, () => {
  test('two people: setup, hashtag and phrases, cards, reveal, packs, games, saved notes; nothing readable leaves either phone', async ({ page, newDevice }) => {
    test.setTimeout(240_000);
    const aTraffic = recordBackendTraffic(page);
    const { invite, code } = await createAndSetUp(page, 'Asha');
    const key = invite.split('#k1.')[1]!;

    const b = await newDevice();
    const bTraffic = recordBackendTraffic(b);
    await joinAndSetUp(b, invite, 'Ravi');
    await expect(b.getByRole('heading', { name: /Namaste, Ravi/ })).toBeVisible({ timeout: 20_000 });

    // Safety codes match.
    await b.goto('/invite');
    await expect(b.locator('.emoji').first()).toHaveText(code);

    // Hashtag: Asha suggests, Ravi agrees, it locks and becomes the room's name. Then each picks
    // their own room phrase (a weak one is refused).
    const hashtag = await lockHashtag(page, b);
    expect(hashtag).toMatch(/^#\w+/);
    await b.getByLabel('Your phrase (four or more words)').fill('ravi ravi');
    await b.getByLabel('Type it again').fill('ravi ravi');
    await b.getByRole('button', { name: 'Save my phrase' }).click();
    await expect(b.getByRole('alert')).toContainText('at least 4 words');
    await setPhrase(b, 'monsoon evenings with adrak chai');
    await setPhrase(page, 'mango lassi on sunday mornings');
    await expect(b.locator('.hashtag-pill')).toBeVisible({ timeout: 20_000 });
    await expect(b.locator('.header-mark, .sidebar-mark').filter({ hasText: hashtag }).first()).toBeAttached();

    // Day 1: the invited person answers first; hidden until both; then the reveal with names.
    await page.goto('/card/day/1');
    await expect(page.getByText('Ravi goes first on this one 💭', { exact: false })).toBeVisible({ timeout: 20_000 });
    await b.goto('/card/day/1');
    await b.getByRole('button', { name: 'Coffee' }).click();
    await b.getByRole('button', { name: 'Seal my answer' }).click();
    await expect(b.getByText('Sealed.')).toBeVisible({ timeout: 20_000 });
    await page.reload();
    await expect(page.getByText('Ravi is in')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Chai' }).click();
    await page.getByLabel(/Why\?/).fill('Adrak wali');
    await page.getByRole('button', { name: 'Seal my answer' }).click();
    await page.getByRole('button', { name: /open both/ }).click({ timeout: 20_000 });
    await expect(page.getByText('Two different picks. Good to know 😄')).toBeVisible();

    await b.reload();
    await b.getByRole('button', { name: /open both/ }).click({ timeout: 20_000 });
    await expect(b.locator('.reveal-theirs')).toContainText('Chai');
    await expect(b.locator('.reveal-theirs')).toContainText('Adrak wali');
    // Ravi sends love and saves Asha's answer (privately).
    await b.getByRole('button', { name: 'Send 💛' }).click();
    await b.getByRole('button', { name: "🔖 Save Asha's answer" }).click();
    await expect(b.getByText('Saved to your notes about Asha')).toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: /open both/ }).click({ timeout: 20_000 });
    await expect(page.getByText('Ravi sent you 💛')).toBeVisible({ timeout: 20_000 });

    // Either person can switch the answer order off; then a pack card (tick any), with a custom option.
    await page.goto('/room');
    await page.getByRole('switch', { name: 'Take turns answering' }).click();
    await expect(page.getByRole('switch', { name: 'Take turns answering' })).toHaveAttribute('aria-checked', 'false', { timeout: 20_000 });
    await page.goto('/card/pack/warm/1');
    await page.getByRole('button', { name: /Kind words/ }).click();
    await page.getByRole('button', { name: 'Something else…' }).click();
    await page.getByLabel(/Type your own option/).fill('Chai on the balcony');
    await page.getByRole('button', { name: 'Add my option' }).click();
    await page.getByRole('button', { name: 'Seal my answer' }).click();
    await expect(page.getByText('Sealed.')).toBeVisible({ timeout: 20_000 });
    await b.goto('/card/pack/warm/1');
    await b.getByRole('button', { name: /Kind words/ }).click();
    await b.getByRole('button', { name: 'Seal my answer' }).click();
    await b.getByRole('button', { name: /open both/ }).click({ timeout: 20_000 });
    await expect(b.getByText('1 in common 🎉')).toBeVisible();
    await expect(b.getByText('added by Asha')).toBeVisible();

    // Add a card for each other.
    await page.goto('/add-a-card');
    await page.getByLabel('Your question').fill('Rooftop dinner or picnic?');
    await page.getByLabel('Option 1').fill('Rooftop');
    await page.getByLabel('Option 2').fill('Picnic');
    await page.getByRole('button', { name: 'Rooftop' }).click();
    await page.getByRole('button', { name: 'Send it over 💌' }).click();
    await b.goto('/');
    await expect(b.getByText('Rooftop dinner or picnic?')).toBeVisible({ timeout: 20_000 });

    // Antakshari turn-taking.
    await page.goto('/antakshari');
    await page.getByLabel(/Your song starts with/).fill('O Saathi Re');
    await page.getByRole('button', { name: 'Add song 🎵' }).click();
    await expect(page.getByText(/Waiting for Ravi 🎵/)).toBeVisible({ timeout: 20_000 });

    // Ravi's saved note is private: Asha never sees it.
    await b.goto('/saved');
    await expect(b.getByText(/Asha: Chai/)).toBeVisible({ timeout: 20_000 });
    await page.goto('/saved');
    await expect(page.getByText('Nothing saved yet.')).toBeVisible({ timeout: 20_000 });

    // Plaintext canary: no name, answer, why, custom option, note or key ever went over the wire.
    const everything = [...aTraffic, ...bTraffic].join('\n');
    expect(everything.length).toBeGreaterThan(0);
    for (const canary of ['Asha', 'Ravi', 'Adrak', 'Chai on the balcony', 'Rooftop', 'Saathi', '"chai"', '"pick"', 'Namaste', 'mango', 'monsoon', hashtag.slice(1), key]) {
      expect(everything, `"${canary}" was sent to the server`).not.toContain(canary);
    }
  });

  test('recovery: hashtag + phrase bring the room back on a fresh browser; a wrong phrase does not', async ({ page, newDevice }) => {
    test.setTimeout(180_000);
    const { invite } = await createAndSetUp(page, 'Mira');
    const b = await newDevice();
    await joinAndSetUp(b, invite, 'Kabir');
    const hashtag = await lockHashtag(page, b);
    await setPhrase(b, 'kite festival on the terrace');
    await setPhrase(page, 'filter coffee and rainy mornings');

    // Kabir answers first (the default), then Mira.
    await b.goto('/card/day/1');
    await b.getByRole('button', { name: 'Coffee' }).click();
    await b.getByRole('button', { name: 'Seal my answer' }).click();
    await expect(b.getByText('Sealed.')).toBeVisible({ timeout: 20_000 });
    await page.goto('/card/day/1');
    await page.getByRole('button', { name: 'Chai' }).click({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Seal my answer' }).click();
    await expect(page.getByRole('button', { name: /open both/ })).toBeVisible({ timeout: 20_000 });

    const fresh = await newDevice();
    await fresh.goto('/recover');
    await fresh.getByLabel("Your room's hashtag").fill(hashtag.toLowerCase());
    await fresh.getByLabel('Your phrase').fill('filter coffee and sunny mornings');
    await fresh.getByRole('button', { name: 'Enter the room' }).click();
    await expect(fresh.getByRole('alert')).toContainText('do not match', { timeout: 30_000 });

    // Case and extra spaces do not matter.
    await fresh.getByLabel('Your phrase').fill('  Filter Coffee and   rainy mornings ');
    await fresh.getByRole('button', { name: 'Enter the room' }).click();
    await expect(fresh.getByRole('heading', { name: /Namaste, Mira/ })).toBeVisible({ timeout: 30_000 });
    await expect(fresh.locator('.header-mark, .sidebar-mark').filter({ hasText: hashtag }).first()).toBeAttached();
    await fresh.goto('/card/day/1');
    await fresh.getByRole('button', { name: /open both/ }).click({ timeout: 20_000 });
    await expect(fresh.locator('.reveal-theirs')).toContainText('Coffee');
  });
});
