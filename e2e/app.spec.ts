import { createRoom, expect, guard, setTakeTurns, test } from './helpers';
import { joinAndSetUp } from './flow';

/** Screens that open without a room on this device, with the heading each one shows. */
const PUBLIC_PAGES: Record<string, string> = {
  '/look': 'Make it ours',
  '/privacy': "Even the developer can't read it",
  '/recover': 'Enter your room',
  '/invite': 'Invite & safety code',
  '/join/some-room': 'This invite link is incomplete',
};

/** Screens inside a room, as the creator sees them before the partner joins. */
const ROOM_PAGES: Record<string, string | RegExp> = {
  '/': 'Namaste, Asha',
  '/card/day/1': 'Chai or coffee to start the day?',
  '/card/pack/warm/1': /./,
  '/packs': 'Card packs',
  '/packs/warm': 'Warm Words',
  '/add-a-card': 'Make a card for Your person',
  '/micro-dates': /Spin for a 15-minute date/,
  '/antakshari': 'Last letter, next song',
  '/story-relay': 'One sentence each',
  '/time-capsule': 'A note to future us',
  '/movie': /Movie night, your way/,
  '/right-now': 'What are you up to?',
  '/gentle': 'Only if you both want it',
  '/saved': 'About Your person',
  '/room': /days? left|Ends today/,
  '/invite': 'Send this to your person',
  '/look': 'Make it ours',
  '/privacy': "Even the developer can't read it",
};

const h1 = (page: import('@playwright/test').Page, name: string | RegExp) => page.getByRole('heading', { level: 1, name });

test.describe('app shell and screens', { tag: '@functional' }, () => {
  test('with no room, public screens open from their URL and everything else shows the welcome', async ({ page }) => {
    test.setTimeout(90_000);
    const check = await guard(page);
    for (const [path, heading] of Object.entries(PUBLIC_PAGES)) {
      await page.goto(path);
      await expect(h1(page, heading), path).toBeVisible({ timeout: 20_000 });
      await page.reload();
      await expect(h1(page, heading), `${path} after reload`).toBeVisible({ timeout: 20_000 });
    }
    for (const path of ['/', '/packs', '/card/day/1', '/room', '/saved', '/gentle', '/right-now', '/no-such-page']) {
      await page.goto(path);
      await expect(page.getByRole('button', { name: 'Create a room' }), path).toBeVisible({ timeout: 20_000 });
      await expect(h1(page, /From pehli baat/), path).toBeVisible();
    }
    check();
  });

  test('in a room: every screen opens from its URL and survives a reload, and the link can be shown again', async ({ page }) => {
    test.setTimeout(150_000);
    const check = await guard(page);
    const { invite } = await createRoom(page);
    // Setup took us to the invite; Today now says we are waiting for the partner.
    await page.goto('/');
    await expect(h1(page, 'Namaste, Asha')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Day 1 of 14 · room ends in 28 days').first()).toBeAttached();
    await expect(page.getByText('Waiting for your person to join')).toBeVisible();
    await expect(page.getByRole('link', { name: /Open today's card/ })).toBeVisible();
    await page.getByRole('link', { name: 'Show link' }).click();
    await expect(h1(page, 'Send this to your person')).toBeVisible();
    await expect(page.locator('.invite')).toHaveText(invite);

    for (const [path, heading] of Object.entries(ROOM_PAGES)) {
      await page.goto(path);
      await expect(h1(page, heading), path).toBeVisible({ timeout: 20_000 });
      await page.reload();
      await expect(h1(page, heading), `${path} after reload`).toBeVisible({ timeout: 20_000 });
    }
    // An unknown card or pack says so instead of breaking.
    await page.goto('/card/day/99');
    await expect(h1(page, 'This card is not here')).toBeVisible({ timeout: 20_000 });
    await page.goto('/packs/nope');
    await expect(h1(page, 'This pack is not here')).toBeVisible({ timeout: 20_000 });
    check();
  });

  test('phones get bottom tabs; laptops get the sidebar; focus moves to each new heading', async ({ page }) => {
    await createRoom(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(h1(page, 'Namaste, Asha')).toBeVisible({ timeout: 20_000 });
    const tabs = page.getByRole('navigation', { name: 'Main' });
    const sidebar = page.getByRole('navigation', { name: 'All screens' });
    await expect(tabs).toBeVisible();
    await expect(sidebar).toBeHidden();
    await tabs.getByRole('link', { name: 'Packs' }).click();
    await expect(page).toHaveURL(/\/packs$/);
    await expect(h1(page, 'Card packs')).toBeFocused();
    await expect(tabs.getByRole('link', { name: 'Packs' })).toHaveAttribute('aria-current', 'page');
    await tabs.getByRole('link', { name: 'Today' }).click();
    await expect(h1(page, 'Namaste, Asha')).toBeFocused();

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(sidebar).toBeVisible();
    await expect(tabs).toBeHidden();
    await sidebar.getByRole('link', { name: 'Invite' }).click();
    await expect(page).toHaveURL(/\/invite$/);
    await expect(h1(page, 'Send this to your person')).toBeFocused();
    await expect(sidebar.getByRole('link', { name: 'Invite' })).toHaveAttribute('aria-current', 'page');
    await page.goBack();
    await expect(h1(page, 'Namaste, Asha')).toBeVisible();
  });

  // Screens loaded on demand show "Loading…" first; focus must still land on their heading.
  test('focus moves to the heading of a screen that loads on demand', async ({ page }) => {
    await createRoom(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(h1(page, 'Namaste, Asha')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Room' }).click();
    await expect(h1(page, /days? left/)).toBeFocused({ timeout: 20_000 });
  });

  test('"Make it ours" applies at once, persists on this device, and never leaves it', async ({ page }) => {
    const check = await guard(page);
    const sent: string[] = [];
    page.on('request', (r) => {
      if (r.method() !== 'GET') sent.push(r.url());
    });
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
    expect(sent).toEqual([]);
    check();
  });

  test('emoji icons off hides the tiles but never the words', async ({ page }) => {
    await page.goto('/look');
    await page.getByRole('button', { name: 'Off', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-k-emoji', 'off');
    await page.goto('/');
    await expect(page.locator('main [data-k-em]').first()).toBeHidden();
    await expect(page.locator('main').getByText('Make it ours')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create a room' })).toBeVisible();
  });

  test('erasing asks first in the page, then removes the room for both people', async ({ page, newDevice }) => {
    test.setTimeout(90_000);
    const { invite } = await createRoom(page);
    const partner = await newDevice();
    await joinAndSetUp(partner, invite, 'Ravi');
    await expect(h1(partner, 'Namaste, Ravi')).toBeVisible({ timeout: 20_000 });

    await page.goto('/room');
    await expect(page.getByText('Ravi joined')).toBeVisible({ timeout: 20_000 });
    // Asking first; cancelling keeps everything.
    await page.getByRole('button', { name: '🧹 Erase this room now' }).click();
    await expect(page.getByText('Erase this room now?')).toBeVisible();
    await expect(page.getByRole('button', { name: '📥 Download first' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Erase this room now?')).toBeHidden();

    await page.getByRole('button', { name: '🧹 Erase this room now' }).click();
    await page.getByRole('button', { name: 'Erase for good' }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Create a room' })).toBeVisible({ timeout: 20_000 });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Create a room' })).toBeVisible({ timeout: 20_000 });

    // The partner's phone finds the room gone and forgets it.
    await partner.goto('/');
    await expect(partner.getByRole('button', { name: 'Create a room' })).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('Right Now photos', { tag: '@functional' }, () => {
  // The offline service worker sits in front of every fetch, and Playwright cannot route
  // requests that a service worker handles (WebKit), so it is kept out of this test.
  test.use({ serviceWorkers: 'block' });

  test('Right Now shrinks a photo on the phone and only ever uploads ciphertext', async ({ page }) => {
    test.setTimeout(90_000);
    await createRoom(page);
    await page.goto('/right-now');
    await expect(h1(page, 'What are you up to?')).toBeVisible({ timeout: 20_000 });
    const share = page.locator('label.file-label');
    const off = page.getByText('Photos switch on once the private photo store is set up.');
    await expect(share.or(off)).toBeVisible();
    // The dev server has no photo store (VITE_MEDIA_URL unset), and says so instead of faking it.
    test.skip(await off.isVisible(), 'No photo store in this build');

    // A big PNG made on the spot: 2400 x 1200, well over the 1280 px limit.
    const png = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 2400;
      c.height = 1200;
      const g = c.getContext('2d')!;
      for (let i = 0; i < 60; i++) {
        g.fillStyle = `hsl(${i * 6}, 70%, 50%)`;
        g.fillRect(i * 40, 0, 40, 1200);
      }
      return c.toDataURL('image/png').split(',')[1]!;
    });
    const uploads: Buffer[] = [];
    await page.route('**/media/o/**', async (route) => {
      if (route.request().method() === 'PUT') uploads.push(route.request().postDataBuffer() ?? Buffer.alloc(0));
      await route.fulfill({ status: 503, body: 'Photos are not switched on yet.' });
    });
    await page.locator('input[type="file"]').setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    const preview = page.getByRole('img', { name: 'Preview of your photo' });
    await expect(preview).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Location and camera details are removed.')).toBeVisible();
    expect(await preview.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([1280, 640]);

    await page.getByRole('button', { name: 'Send 📷' }).click();
    await expect(page.getByRole('alert')).toHaveText('Photos are not switched on yet.', { timeout: 20_000 });
    expect(uploads).toHaveLength(1);
    const body = uploads[0]!;
    expect(body.length).toBeGreaterThan(0);
    expect(body.length).toBeLessThanOrEqual(1_000_000);
    // Neither a JPEG nor a PNG: the photo store only ever sees sealed bytes.
    expect(body.subarray(0, 2).equals(Buffer.from([0xff, 0xd8]))).toBe(false);
    expect(body.subarray(1, 4).toString('latin1')).not.toBe('PNG');
  });
});

test.describe('Gentle Corner safety footer', { tag: '@functional' }, () => {
  test('shows verified UK numbers from the browser language when no country is chosen', async ({ newDevice }) => {
    const uk = await newDevice({ locale: 'en-GB' });
    await createRoom(uk);
    await uk.goto('/gentle');
    const note = uk.getByRole('note');
    await expect(note).toContainText('United Kingdom: 999 for emergencies, Samaritans 116 123, any time.', { timeout: 20_000 });
    await expect(note).toContainText('Elsewhere: call your local emergency number');
    const link = note.getByRole('link', { name: 'findahelpline.com' });
    await expect(link).toHaveAttribute('href', 'https://findahelpline.com');
    await expect(link).toHaveAttribute('rel', /noopener/);
  });

  test('the country chosen in the profile wins over the browser language', async ({ newDevice }) => {
    const page = await newDevice({ locale: 'en-GB' });
    await createRoom(page, { country: 'US' });
    await page.goto('/gentle');
    const note = page.getByRole('note');
    await expect(note).toContainText('United States: 911 for emergencies, 988 Suicide & Crisis Lifeline, call or text.', { timeout: 20_000 });
    await expect(note).not.toContainText('Samaritans');
  });

  test('anywhere without verified numbers gets only the generic line, never a guessed number', async ({ newDevice }) => {
    // India is chosen in the profile: no verified numbers, and the UK browser language must not leak in.
    const page = await newDevice({ locale: 'en-GB' });
    await createRoom(page, { country: 'IN' });
    await page.goto('/gentle');
    const note = page.getByRole('note');
    await expect(note).toContainText('Wherever you are: call your local emergency number or find a line at findahelpline.com', { timeout: 20_000 });
    await expect(note).not.toContainText(/\d{3}/);
  });

  test('a browser language from a country without verified numbers gets the generic line', async ({ newDevice }) => {
    const page = await newDevice({ locale: 'en-IN' });
    await createRoom(page);
    await page.goto('/gentle');
    const note = page.getByRole('note');
    await expect(note).toContainText('Wherever you are: call your local emergency number', { timeout: 20_000 });
    await expect(note).not.toContainText(/\d{3}/);
  });
});

test.describe('room settings', { tag: '@functional' }, () => {
  test('"Take turns answering" is on by default and either setting sticks', async ({ page }) => {
    await createRoom(page);
    await page.goto('/room');
    const toggle = page.getByRole('switch', { name: 'Take turns answering' });
    await expect(toggle).toHaveAttribute('aria-checked', 'true', { timeout: 20_000 });
    await expect(page.getByText('Your person answers first')).toBeVisible();
    await setTakeTurns(page, false);
    await expect(page.getByText('Off: either of you can go first.')).toBeVisible();
    await page.reload();
    await expect(toggle).toHaveAttribute('aria-checked', 'false', { timeout: 20_000 });
  });
});
