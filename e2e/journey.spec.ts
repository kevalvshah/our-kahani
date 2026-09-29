import type { Page, Request } from '@playwright/test';
import { BACKEND_HOST, expect, test } from './helpers';
import { createAndSetUp, joinAndSetUp, lockHashtag, setPhrase, uniquePhrase } from './flow';

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
    await setPhrase(b, uniquePhrase('monsoon evenings with adrak chai'));
    await setPhrase(page, uniquePhrase('mango lassi on sunday mornings'));
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
    await setPhrase(b, uniquePhrase('kite festival on the terrace'));
    const miraPhrase = uniquePhrase('filter coffee and rainy mornings');
    await setPhrase(page, miraPhrase);

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
    await fresh.getByLabel('Your phrase').fill(miraPhrase.replace('rainy', 'sunny'));
    await fresh.getByRole('button', { name: 'Enter the room' }).click();
    await expect(fresh.getByRole('alert')).toContainText('do not match', { timeout: 30_000 });

    // Case and extra spaces do not matter.
    await fresh.getByLabel('Your phrase').fill(`  ${miraPhrase.replace('filter coffee', 'Filter Coffee').replace(' and ', ' and   ')} `);
    await fresh.getByRole('button', { name: 'Enter the room' }).click();
    await expect(fresh.getByRole('heading', { name: /Namaste, Mira/ })).toBeVisible({ timeout: 30_000 });
    await expect(fresh.locator('.header-mark, .sidebar-mark').filter({ hasText: hashtag }).first()).toBeAttached();
    await fresh.goto('/card/day/1');
    await fresh.getByRole('button', { name: /open both/ }).click({ timeout: 20_000 });
    await expect(fresh.locator('.reveal-theirs')).toContainText('Coffee');
  });

  test('partner rescue: a one-time code from the partner’s phone brings a lost person back, once', async ({ page, newDevice }) => {
    test.setTimeout(240_000);
    const { invite } = await createAndSetUp(page, 'Mira');
    const lostPhone = await newDevice();
    await joinAndSetUp(lostPhone, invite, 'Kabir');
    const hashtag = await lockHashtag(page, lostPhone);
    await setPhrase(lostPhone, uniquePhrase('kite festival on the terrace'));
    const miraPhrase = uniquePhrase('filter coffee and rainy mornings');
    await setPhrase(page, miraPhrase);
    await lostPhone.goto('/card/day/1');
    await lostPhone.getByRole('button', { name: 'Coffee' }).click();
    await lostPhone.getByRole('button', { name: 'Seal my answer' }).click();
    await expect(lostPhone.getByText('Sealed.')).toBeVisible({ timeout: 20_000 });

    // Kabir loses his phone and his phrase. Mira makes a rescue code; her own phrase is checked.
    await page.goto('/room');
    await page.getByRole('button', { name: 'Help Kabir back in' }).click({ timeout: 20_000 });
    await page.getByLabel(/Your own phrase/).fill('not my phrase at all today');
    await page.getByRole('button', { name: 'Make the rescue code' }).click();
    await expect(page.getByRole('alert')).toContainText('not your phrase', { timeout: 30_000 });
    await page.getByLabel(/Your own phrase/).fill(miraPhrase);
    await page.getByRole('button', { name: 'Make the rescue code' }).click();
    const code = ((await page.locator('.rescue-code').textContent({ timeout: 30_000 })) ?? '').trim();
    expect(code).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/);

    // On a new device: hashtag + rescue code, then a new phrase. His answer is still his.
    const newPhone = await newDevice();
    await newPhone.goto('/recover');
    await newPhone.getByRole('button', { name: 'I have a rescue code from my person' }).click();
    await newPhone.getByLabel("Your room's hashtag").fill(hashtag);
    await newPhone.getByLabel('Rescue code from your person').fill(code.toLowerCase().replace(/-/g, ' '));
    await newPhone.getByRole('button', { name: 'Use the rescue code' }).click();
    await expect(newPhone.getByRole('heading', { name: /Your room phrase/ })).toBeVisible({ timeout: 30_000 });
    await setPhrase(newPhone, uniquePhrase('a brand new phrase for kabir'));
    await expect(newPhone.getByRole('heading', { name: /Namaste, Kabir/ })).toBeVisible({ timeout: 20_000 });
    await newPhone.goto('/card/day/1');
    await expect(newPhone.getByRole('button', { name: 'Coffee' })).toHaveAttribute('aria-pressed', 'true', { timeout: 20_000 });

    // The lost phone no longer opens the room, and the code does not work a second time.
    await lostPhone.goto('/');
    await expect(lostPhone.getByRole('button', { name: 'Create a room' })).toBeVisible({ timeout: 20_000 });
    const another = await newDevice();
    await another.goto('/recover');
    await another.getByRole('button', { name: 'I have a rescue code from my person' }).click();
    await another.getByLabel("Your room's hashtag").fill(hashtag);
    await another.getByLabel('Rescue code from your person').fill(code);
    await another.getByRole('button', { name: 'Use the rescue code' }).click();
    await expect(another.getByRole('alert')).toContainText('does not work', { timeout: 30_000 });
  });

  test('multi-device: the same person on phone and laptop at once; signing the other out', async ({ page, newDevice }) => {
    test.setTimeout(240_000);
    const { invite } = await createAndSetUp(page, 'Asha');
    const ravi = await newDevice();
    await joinAndSetUp(ravi, invite, 'Ravi');
    const hashtag = await lockHashtag(page, ravi);
    await setPhrase(ravi, uniquePhrase('monsoon evenings with adrak chai'));
    const ashaPhrase = uniquePhrase('mango lassi on sunday mornings');
    await setPhrase(page, ashaPhrase);

    // Asha adds her laptop with hashtag + phrase. Her phone keeps working.
    const laptop = await newDevice({ viewport: { width: 1280, height: 800 } });
    await laptop.goto('/recover');
    await laptop.getByLabel("Your room's hashtag").fill(hashtag);
    await laptop.getByLabel('Your phrase').fill(ashaPhrase);
    await laptop.getByRole('button', { name: 'Enter the room' }).click();
    await expect(laptop.getByRole('heading', { name: /Namaste, Asha/ })).toBeVisible({ timeout: 30_000 });

    // Ravi answers first; Asha answers on the laptop; her phone sees it as hers and opens the reveal.
    await ravi.goto('/card/day/1');
    await ravi.getByRole('button', { name: 'Coffee' }).click();
    await ravi.getByRole('button', { name: 'Seal my answer' }).click();
    await expect(ravi.getByText('Sealed.')).toBeVisible({ timeout: 20_000 });
    await laptop.goto('/card/day/1');
    await laptop.getByRole('button', { name: 'Chai' }).click({ timeout: 20_000 });
    await laptop.getByRole('button', { name: 'Seal my answer' }).click();
    await expect(laptop.getByRole('button', { name: /open both/ })).toBeVisible({ timeout: 20_000 });
    await page.goto('/card/day/1');
    await expect(page.getByRole('button', { name: /open both/ })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /open both/ }).click();
    await expect(page.locator('.reveal-mine')).toContainText('Chai');

    // Room data lists two devices; the laptop signs the phone out.
    await laptop.goto('/room');
    await expect(laptop.getByText('Your devices · 2')).toBeVisible({ timeout: 20_000 });
    await laptop.getByRole('button', { name: 'Lost one? Sign out my other devices' }).click();
    await laptop.getByRole('button', { name: 'Sign them out' }).click();
    await expect(laptop.getByText('Signed out 1 other device.')).toBeVisible({ timeout: 20_000 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Create a room' })).toBeVisible({ timeout: 20_000 });
  });
});
