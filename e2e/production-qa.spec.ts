import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import type { BrowserContextOptions, Page, Route } from '@playwright/test';
import { BACKEND_HOST, expect, keyOf, recordBackendTraffic, setTakeTurns, test } from './helpers';
import { createAndSetUp, finishSetup, joinAndSetUp, lockHashtag, setPhrase, uniquePhrase } from './flow';

// Production QA: the whole product, as three real couples, once, on request.
//
// It creates EXACTLY three rooms (one `createAndSetUp` per test; joining, recovery, rescue codes
// and extra devices never create a room). Room 3 is erased at the end; rooms 1 and 2 stay.
//
//   PRODQA=1 npx playwright test e2e/production-qa.spec.ts --project=chromium --workers=1
//
// Without BASE_URL it runs against a local production build and the CI Supabase project (the
// photo store is faked in the test there, because Pages Functions only run on Cloudflare). With
// BASE_URL set to the live site it uses the real backend and the real photo store.

test.skip(!process.env.PRODQA, 'Production QA runs only on request (PRODQA=1)');
// Voice notes: Chromium's fake microphone, allowed without a prompt.
test.use({
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  permissions: ['microphone'],
});

const PHONE: BrowserContextOptions = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ['microphone'] };
const LAPTOP: BrowserContextOptions = { viewport: { width: 1280, height: 800 }, permissions: ['microphone'] };
const T = { timeout: 30_000 };

// ---------------------------------------------------------------------------
// Devices, traffic and trust checks
// ---------------------------------------------------------------------------

/** A stand-in for the Cloudflare photo store on local runs only: it keeps whatever bytes it is given. */
const mediaStore = new Map<string, Buffer>();
async function fakeMedia(route: Route) {
  const req = route.request();
  const url = new URL(req.url());
  if (url.pathname === '/media/purge') return route.fulfill({ status: 200, body: '{}' });
  if (!url.pathname.startsWith('/media/o/')) return route.fallback();
  const method = req.method();
  if (method === 'PUT') {
    mediaStore.set(url.pathname, req.postDataBuffer() ?? Buffer.alloc(0));
    return route.fulfill({ status: 200, body: '' });
  }
  if (method === 'GET') {
    const body = mediaStore.get(url.pathname);
    return body ? route.fulfill({ status: 200, body, contentType: 'application/octet-stream' }) : route.fulfill({ status: 404, body: '' });
  }
  if (method === 'DELETE') {
    mediaStore.delete(url.pathname);
    return route.fulfill({ status: 204, body: '' });
  }
  return route.fulfill({ status: 405, body: '' });
}

interface Watched {
  name: string;
  page: Page;
  traffic: string[];
  strays: string[];
  errors: string[];
  uploads: Buffer[];
}

/** Opens every device of one test, and checks at the end that nothing readable or off-site was sent. */
function watcher(newDevice: (o?: BrowserContextOptions) => Promise<Page>, baseURL: string) {
  const base = new URL(baseURL);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  const devices: Watched[] = [];
  return {
    local,
    async open(name: string, kind: 'phone' | 'laptop'): Promise<Page> {
      const page = await newDevice(kind === 'phone' ? PHONE : LAPTOP);
      if (local) await page.context().route('**/media/**', fakeMedia);
      const w: Watched = { name, page, traffic: recordBackendTraffic(page), strays: [], errors: [], uploads: [] };
      page.on('request', (r) => {
        const url = new URL(r.url());
        if (url.protocol.startsWith('http') && url.host !== base.host && url.host !== BACKEND_HOST) w.strays.push(`${r.method()} ${url.origin}`);
        if (url.host === base.host && url.pathname.startsWith('/media/o/') && r.method() === 'PUT') w.uploads.push(r.postDataBuffer() ?? Buffer.alloc(0));
      });
      page.on('pageerror', (e) => w.errors.push(e.message));
      devices.push(w);
      return page;
    },
    /** Every device: only the site and its backend; no plain text canary in any backend request. */
    check(canaries: string[]) {
      for (const d of devices) {
        expect(d.strays, `${d.name} sent requests to another host`).toEqual([]);
        expect.soft(d.errors, `${d.name} had script errors`).toEqual([]);
        for (const body of d.uploads) {
          expect(body.length, `${d.name} uploaded an empty file`).toBeGreaterThan(0);
          // Photos and voice notes are sealed before upload: never a JPEG, PNG, WebM or MP4.
          expect(body.subarray(0, 2).equals(Buffer.from([0xff, 0xd8])), `${d.name} uploaded a plain JPEG`).toBe(false);
          expect(body.subarray(1, 4).toString('latin1'), `${d.name} uploaded a plain PNG`).not.toBe('PNG');
          expect(body.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])), `${d.name} uploaded plain WebM audio`).toBe(false);
          expect(body.subarray(4, 8).toString('latin1'), `${d.name} uploaded plain MP4 audio`).not.toBe('ftyp');
        }
      }
      const everything = devices.flatMap((d) => d.traffic).join('\n');
      expect(everything.length).toBeGreaterThan(0);
      for (const canary of canaries.filter(Boolean)) {
        expect(everything, `"${canary}" was sent to the server`).not.toContain(canary);
      }
    },
  };
}

async function shot(page: Page, name: string) {
  await test.info().attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}

/** WCAG 2.2 AA on the whole screen, settled (reduced motion), as in a11y.spec.ts. */
async function axe(page: Page, label: string) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const size = page.viewportSize()!;
  const tall = await page.evaluate(() => document.documentElement.scrollHeight);
  if (tall > size.height) await page.setViewportSize({ width: size.width, height: tall });
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  await page.setViewportSize(size);
  expect
    .soft(
      results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`),
      `${label}: accessibility violations`,
    )
    .toEqual([]);
}

const h1 = (page: Page, name: string | RegExp) => page.getByRole('heading', { level: 1, name });

/** A JPEG drawn on a canvas in the page (nothing binary is committed). */
async function makeJpeg(page: Page, hue: number): Promise<Buffer> {
  const b64 = await page.evaluate((h) => {
    const c = document.createElement('canvas');
    c.width = 1600;
    c.height = 1200;
    const g = c.getContext('2d')!;
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `hsl(${h + i * 4}, 70%, ${30 + i}%)`;
      g.fillRect(i * 40, 0, 40, 1200);
    }
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(800, 600, 250, 0, Math.PI * 2);
    g.fill();
    return c.toDataURL('image/jpeg', 0.9).split(',')[1]!;
  }, hue);
  return Buffer.from(b64, 'base64');
}

/** File names in a zip, read from its central directory. */
function zipNames(zip: Buffer): string[] {
  let end = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65_557); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  expect(end, 'the download is a zip').toBeGreaterThanOrEqual(0);
  const count = zip.readUInt16LE(end + 10);
  let p = zip.readUInt32LE(end + 16);
  const names: string[] = [];
  for (let n = 0; n < count; n++) {
    expect(zip.readUInt32LE(p)).toBe(0x02014b50);
    const nameLen = zip.readUInt16LE(p + 28);
    const extra = zip.readUInt16LE(p + 30);
    const comment = zip.readUInt16LE(p + 32);
    names.push(zip.toString('utf8', p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extra + comment;
  }
  return names;
}

async function captureZip(page: Page, click: () => Promise<void>): Promise<{ file: string; names: string[] }> {
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), click()]);
  const file = download.suggestedFilename();
  const names = zipNames(readFileSync(await download.path()));
  await test.info().attach(`${file} contents`, { body: names.join('\n'), contentType: 'text/plain' });
  return { file, names };
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

/** Answers whatever card is on screen: first option, one tick, one line, every item rated, or "Not us". */
async function answerCard(page: Page, n: number): Promise<string> {
  const card = page.locator('.question-card');
  const tryList = card.locator('.try-list');
  const noticed = card.locator('#noticed');
  const bug = card.locator('#bug');
  const recall = card.getByRole('button', { name: 'Start the 60-second timer ⏱️' });
  const line = card.locator('#line');
  const checks = card.locator('.checks .check');
  const options = card.locator('.options .option');
  const notUs = card.getByRole('button', { name: 'Not us 🙂' });
  await expect(tryList.or(noticed).or(bug).or(recall).or(line).or(checks).or(options).or(notUs).first()).toBeVisible(T);
  const sealed = () => expect(card.getByText(/Sealed\.|open both/).first()).toBeVisible(T);

  if (await tryList.isVisible()) {
    for (const item of await card.locator('.try-item').all()) await item.getByRole('button', { name: 'Keen 🙌' }).click();
    await card.getByRole('button', { name: /Show us/ }).click();
    await expect(card.getByText(/Your answers are saved|open both|Halfway Date idea/).first()).toBeVisible(T);
    return 'rated every idea';
  }
  if (await noticed.isVisible()) {
    await noticed.fill(`noticedCanary ${n} you hum while you cook`);
    await card.getByRole('button', { name: 'Send it' }).click();
    await expect(card.locator('.sticky').first()).toContainText('noticedCanary', T);
    return 'wrote a note';
  }
  if (await bug.isVisible()) {
    await bug.fill(`bugCanary ${n} steals the blanket`);
    await card.getByRole('button', { name: 'File the bug 🐞' }).click();
    await expect(card.getByText(/Bug filed/)).toBeVisible(T);
    return 'filed a bug';
  }
  if (await recall.isVisible()) {
    await card.getByRole('button', { name: 'Skip this one' }).click();
    await expect(card.getByText(/skipped this one/i).first()).toBeVisible(T);
    return 'skipped';
  }
  if (await line.isVisible()) {
    await line.fill(`lineCanary ${n} a hot samosa in the rain`);
    await card.getByRole('button', { name: 'Seal my answer' }).click();
    await sealed();
    return 'typed a line';
  }
  if (await checks.first().isVisible()) {
    await checks.first().click();
    await card.getByRole('button', { name: 'Seal my answer' }).click();
    await sealed();
    return 'ticked one';
  }
  if (await options.first().isVisible()) {
    await options.first().click();
    await card.getByRole('button', { name: 'Seal my answer' }).click();
    await sealed();
    return 'picked the first option';
  }
  await notUs.click();
  await sealed();
  return 'Not us';
}

// ---------------------------------------------------------------------------
// The three rooms
// ---------------------------------------------------------------------------

test.describe('production QA', { tag: '@prodqa' }, () => {
  // One room per test, never a retry (a retry would make a fourth room). Run with --workers=1.
  test.describe.configure({ mode: 'default', retries: 0 });
  test.skip(({ browserName }) => browserName !== 'chromium', 'Chromium only (fake microphone)');

  test('Room 1 · new couple, phone + phone: invite, name, phrases, cards, keep playing, games, voice and photos', async ({ newDevice, baseURL }) => {
    test.setTimeout(20 * 60_000);
    const w = watcher(newDevice, baseURL!);
    const asha = await w.open('Asha (phone)', 'phone');
    let invite = '';
    let code = '';

    await test.step('Asha creates a room on her phone', async () => {
      ({ invite, code } = await createAndSetUp(asha, 'Asha'));
      expect(invite).toMatch(/\/join\/[A-Za-z0-9-]+#k1\.[A-Za-z0-9_-]{43}$/);
      expect(new URL(invite).origin).toBe(new URL(asha.url()).origin);
      expect(code.trim().split(/\s+/)).toHaveLength(6);
      await shot(asha, 'Room 1 · invite');
      await axe(asha, 'Room 1 invite');
    });
    const key = keyOf(invite);

    await test.step('a broken invite link (key cut short) says it is incomplete', async () => {
      const broken = await w.open('broken link (phone)', 'phone');
      await broken.goto(invite.slice(0, -5));
      await expect(h1(broken, 'This invite link is incomplete')).toBeVisible(T);
      expect(new URL(broken.url()).hash).toBe('');
      await shot(broken, 'Room 1 · broken link');
    });

    const ravi = await w.open('Ravi (phone)', 'phone');
    await test.step('Ravi joins on his phone: the safety codes match', async () => {
      await ravi.goto(invite);
      await expect(h1(ravi, "You're in")).toBeVisible(T);
      await expect(ravi.locator('.emoji')).toHaveText(code);
      expect(new URL(ravi.url()).hash).toBe('');
      await shot(ravi, 'Room 1 · joined');
      await ravi.getByRole('link', { name: 'Continue →' }).click();
      await finishSetup(ravi, 'Ravi');
      await expect(h1(ravi, /Namaste, Ravi/)).toBeVisible(T);
      await ravi.goto('/invite');
      await expect(ravi.getByRole('heading', { name: 'You’re both in' })).toBeVisible(T);
      await expect(ravi.locator('.emoji')).toHaveText(code);
      await asha.goto('/invite');
      await expect(asha.getByRole('heading', { name: 'You’re both in' })).toBeVisible(T);
      await expect(asha.locator('.emoji')).toHaveText(code);
    });

    await test.step('a third device with the real link cannot join', async () => {
      const third = await w.open('third device (phone)', 'phone');
      await third.goto(invite);
      await expect(h1(third, 'We could not open this room')).toBeVisible(T);
      await expect(third.getByText('This room already has two people.')).toBeVisible();
      expect(new URL(third.url()).hash).toBe('');
      await shot(third, 'Room 1 · third device refused');
    });

    let hashtag = '';
    const raviPhrase = uniquePhrase('monsoon evenings with adrak chai');
    const ashaPhrase = uniquePhrase('mango lassi on sunday mornings');
    await test.step('the hashtag: Asha suggests, Ravi agrees; room phrases (a weak one is refused)', async () => {
      hashtag = await lockHashtag(asha, ravi);
      expect(hashtag).toMatch(/^#\w+/);
      await ravi.getByLabel('Your phrase (four or more words)').fill('ravi ravi');
      await ravi.getByLabel('Type it again').fill('ravi ravi');
      await ravi.getByRole('button', { name: 'Save my phrase' }).click();
      await expect(ravi.getByRole('alert')).toContainText('at least 4 words');
      await shot(ravi, 'Room 1 · weak phrase refused');
      await axe(ravi, 'Room 1 room phrase');
      await setPhrase(ravi, raviPhrase);
      await setPhrase(asha, ashaPhrase);
      await expect(asha.locator('.hashtag-pill')).toContainText(hashtag, T);
      await expect(h1(asha, /Namaste, Asha/)).toBeVisible(T);
      await shot(asha, 'Room 1 · today');
      await axe(asha, 'Room 1 today');
    });

    await test.step('Season 1 card 1: the invited person first, hidden until both, then the reveal with a why', async () => {
      await asha.goto('/card/day/1');
      await expect(asha.getByText('Ravi goes first on this one 💭', { exact: false })).toBeVisible(T);
      await expect(asha.getByRole('button', { name: 'Chai' })).toHaveCount(0);
      await ravi.goto('/card/day/1');
      await ravi.getByRole('button', { name: 'Coffee' }).click(T);
      await ravi.getByLabel(/Why\?/).fill('Filter kaapi forever');
      await ravi.getByRole('button', { name: 'Seal my answer' }).click();
      await expect(ravi.getByRole('status').filter({ hasText: 'Sealed.' })).toContainText('Waiting for Asha', T);
      await asha.reload();
      await expect(asha.getByText('Ravi is in 💭 Your turn.', { exact: false })).toBeVisible(T);
      await expect(asha.getByText('Filter kaapi')).toHaveCount(0);
      await asha.getByRole('button', { name: 'Chai' }).click();
      await asha.getByLabel(/Why\?/).fill('Adrak wali always');
      await asha.getByRole('button', { name: 'Seal my answer' }).click();
      await asha.getByRole('button', { name: 'Ravi has answered · open both →' }).click(T);
      await expect(asha.getByText('Two different picks. Good to know 😄')).toBeVisible();
      await expect(asha.locator('.reveal-theirs')).toContainText('Coffee');
      await expect(asha.locator('.reveal-theirs')).toContainText('Filter kaapi forever');
      await shot(asha, 'Room 1 · card 1 reveal');
      await axe(asha, 'Room 1 card reveal');
      await ravi.reload();
      await ravi.getByRole('button', { name: 'Asha has answered · open both →' }).click(T);
      await expect(ravi.locator('.reveal-theirs')).toContainText('Chai');
      await expect(ravi.locator('.reveal-theirs')).toContainText('Adrak wali always');
    });

    await test.step('"Not us 🙂" from both on card 3 → "Neither of you vibed"', async () => {
      await ravi.goto('/card/day/3');
      await ravi.getByRole('button', { name: 'Not us 🙂' }).click(T);
      await expect(ravi.getByText('Sealed.')).toBeVisible(T);
      await asha.goto('/card/day/3');
      await expect(asha.getByText('Ravi is in 💭', { exact: false })).toBeVisible(T);
      await asha.getByRole('button', { name: 'Not us 🙂' }).click();
      await asha.getByRole('button', { name: /open both/ }).click(T);
      await expect(asha.getByText(/Neither of you vibed/)).toBeVisible(T);
      await shot(asha, 'Room 1 · neither of you vibed');
    });

    await test.step('"Ask me again later 🔒" from Asha on card 4 → Ravi sees she is saving it', async () => {
      await asha.goto('/card/day/4');
      await asha.getByRole('button', { name: 'Ask me again later 🔒' }).click(T);
      await expect(asha.getByText('Saved for later 🔒', { exact: false })).toBeVisible(T);
      await ravi.goto('/card/day/4');
      await expect(ravi.getByText('Asha is saving this one for later 🔒')).toBeVisible(T);
      await shot(ravi, 'Room 1 · saving for later');
    });

    await test.step('Asha keeps playing from Today: 21 cards in a row, whatever type comes up', async () => {
      // Asha is the creator: with turns on she would wait for Ravi on every card.
      await setTakeTurns(asha, false);
      const played: { path: string; tag: string; did: string }[] = [];
      for (let i = 0; i < 21; i++) {
        await asha.goto('/');
        await expect(asha.getByRole('link', { name: 'Card 1, answered' })).toBeVisible(T);
        const cta = asha.getByRole('link', { name: /Open the next card|Keep playing|Open the extra card/ });
        await expect(cta).toBeVisible(T);
        const path = (await cta.getAttribute('href')) ?? '';
        expect(played.map((p) => p.path), `Today offered ${path} again`).not.toContain(path);
        await cta.click();
        await expect(asha).toHaveURL(new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), T);
        const tag = ((await asha.locator('.question-card .pack-tag').textContent(T)) ?? '').trim();
        const did = await answerCard(asha, i + 1);
        played.push({ path, tag, did });
        if (i === 0 || i === 20) await shot(asha, `Room 1 · keep playing card ${i + 1}`);
      }
      const tags = played.map((p) => p.tag);
      await test.info().attach('keep-playing sequence', {
        body: played.map((p, i) => `${String(i + 1).padStart(2)}  ${p.tag.padEnd(40)}  ${p.path}  (${p.did})`).join('\n'),
        contentType: 'text/plain',
      });
      for (let i = 2; i < tags.length; i++) {
        expect
          .soft(tags[i] === tags[i - 1] && tags[i] === tags[i - 2], `"${tags[i]}" came up 3 times in a row (cards ${i - 1} to ${i + 1})`)
          .toBe(false);
      }
      expect.soft(new Set(tags).size, 'different card types in the run').toBeGreaterThanOrEqual(4);
    });

    await test.step('Movie Night: both pick five, then the reveal and a pick for tonight', async () => {
      await asha.goto('/movie');
      await expect(h1(asha, /Movie night, your way/)).toBeVisible(T);
      await asha.getByRole('button', { name: '🏠 Together at home' }).click();
      await asha.getByRole('button', { name: '🎬 One movie' }).click();
      await asha.getByRole('button', { name: 'Start swiping' }).click();
      await expect(h1(asha, 'Pick your five')).toBeVisible(T);
      for (let i = 0; i < 5; i++) await asha.locator('.options-stack .option').nth(i).click();
      await asha.getByRole('button', { name: 'Seal my 5 picks 🍿' }).click();
      await expect(asha.getByText(/5 picks are sealed/)).toBeVisible(T);
      await ravi.goto('/movie');
      await expect(h1(ravi, 'Pick your five')).toBeVisible(T);
      for (let i = 0; i < 5; i++) await ravi.locator('.options-stack .option').nth(i).click();
      await ravi.getByRole('button', { name: 'Seal my 5 picks 🍿' }).click();
      await expect(ravi.locator('.reveal-banner')).toHaveText(/in common|Different picks/, T);
      await asha.goto('/movie');
      await expect(asha.locator('.reveal-banner')).toHaveText(/in common|Different picks/, T);
      await asha.locator('.options-stack .option').first().click();
      await asha.getByRole('button', { name: '🗓️ Tonight' }).click(T);
      await expect(asha.getByRole('button', { name: 'We watched it 🎉' })).toBeVisible(T);
      await shot(asha, 'Room 1 · movie night');
      await axe(asha, 'Room 1 movie night');
    });

    await test.step('Micro-Dates: spin, both keen, and a note', async () => {
      await asha.goto('/micro-dates');
      await asha.getByRole('button', { name: 'Spin 🎲' }).click(T);
      await expect(asha.getByText(/Waiting for Ravi/)).toBeVisible(T);
      await asha.locator('#mnote').fill('microCanary bring the masala chai flask');
      await asha.getByRole('button', { name: 'Share it 🔗' }).click();
      await expect(asha.getByText('microCanary bring the masala chai flask')).toBeVisible(T);
      await ravi.goto('/micro-dates');
      await ravi.getByRole('button', { name: 'Keen 🙌' }).click(T);
      await expect(ravi.getByText('Both keen 🎉')).toBeVisible(T);
      await expect(ravi.getByText('microCanary bring the masala chai flask')).toBeVisible(T);
      await shot(ravi, 'Room 1 · micro-date');
    });

    await test.step('Antakshari with a voice note: Asha records, stops and sends; Ravi gets a player', async () => {
      await asha.goto('/antakshari');
      await expect(h1(asha, 'Last letter, next song')).toBeVisible(T);
      const letter = ((await asha.locator('label[for="anta"] b').textContent(T)) ?? '').trim();
      expect(letter).toMatch(/^[A-Z]$/);
      await asha.getByRole('button', { name: /Sing a line or say it/ }).click();
      await expect(asha.getByRole('timer')).toBeVisible(T);
      await asha.waitForTimeout(2_500);
      await asha.getByRole('button', { name: 'Stop and send' }).click();
      // Soft from here on: if the voice note fails, the song still goes and the rest of the room is checked.
      const ready = asha.getByText('Your voice note is ready', { exact: false });
      await expect.soft(ready, 'the voice note was recorded, sealed and sent').toBeVisible(T);
      const sent = await ready.isVisible();
      if (!sent) await shot(asha, 'Room 1 · voice note stuck');
      await asha.locator('#anta').fill(`${letter}qz monsoon tarana`);
      await asha.getByRole('button', { name: 'Add song 🎵' }).click();
      await expect(asha.getByText(/Waiting for Ravi 🎵/)).toBeVisible(T);
      await ravi.goto('/antakshari');
      await expect(ravi.getByText(`${letter}qz monsoon tarana`)).toBeVisible(T);
      if (sent) {
        const audio = ravi.locator('audio.voice');
        await expect.soft(audio, 'Ravi gets an audio player').toBeVisible(T);
        await expect.soft(audio).toHaveAttribute('aria-label', /Voice note from Asha/);
        await expect.soft.poll(() => audio.evaluate((a) => (a as HTMLAudioElement).readyState), { timeout: 20_000 }).toBeGreaterThan(0);
      }
      await shot(ravi, 'Room 1 · antakshari voice note');
      await axe(ravi, 'Room 1 antakshari');
    });

    await test.step('Story Relay: a line each', async () => {
      await asha.goto('/story-relay');
      await asha.locator('#story').fill('A glowing kulfi cart appeared at midnight.');
      await asha.getByRole('button', { name: 'Add ✍️' }).click();
      await expect(asha.getByText('Waiting for Ravi ✍️')).toBeVisible(T);
      await ravi.goto('/story-relay');
      await expect(ravi.getByText('A glowing kulfi cart appeared at midnight.')).toBeVisible(T);
      await ravi.locator('#story').fill('It only sold rose flavour to poets.');
      await ravi.getByRole('button', { name: 'Add ✍️' }).click();
      await expect(ravi.getByText('Waiting for Asha ✍️')).toBeVisible(T);
      await asha.goto('/story-relay');
      await expect(asha.getByText('It only sold rose flavour to poets.')).toBeVisible(T);
    });

    await test.step('Right Now: a photo from each; both see both', async () => {
      for (const [p, hue, caption] of [
        [asha, 20, 'captionCanary sunset chai'],
        [ravi, 200, 'captionCanary rainy window'],
      ] as const) {
        await p.goto('/right-now');
        await expect(h1(p, 'What are you up to?')).toBeVisible(T);
        await expect(p.getByText('Photos switch on once the private photo store is set up.')).toHaveCount(0);
        const jpeg = await makeJpeg(p, hue);
        await p.locator('input[type="file"]').setInputFiles({ name: 'right-now.jpg', mimeType: 'image/jpeg', buffer: jpeg });
        await expect(p.getByRole('img', { name: 'Preview of your photo' })).toBeVisible(T);
        await expect(p.getByText('Location and camera details are removed.', { exact: false })).toBeVisible();
        await p.locator('#pcap').fill(caption);
        await p.getByRole('button', { name: 'Send 📷' }).click();
        await expect(p.getByRole('img', { name: /^Photo from you/ })).toBeVisible(T);
      }
      for (const [p, other] of [
        [asha, 'Ravi'],
        [ravi, 'Asha'],
      ] as const) {
        await p.goto('/right-now');
        for (const name of [/^Photo from you/, new RegExp(`^Photo from ${other}`)]) {
          const img = p.getByRole('img', { name });
          await expect(img).toBeVisible(T);
          await expect.poll(() => img.evaluate((i) => (i as HTMLImageElement).naturalWidth), { timeout: 20_000 }).toBeGreaterThan(0);
        }
      }
      await shot(asha, 'Room 1 · right now photos');
      await axe(asha, 'Room 1 right now');
    });

    await test.step('Time Capsule: both seal; it stays shut', async () => {
      await asha.goto('/time-capsule');
      await asha.locator('#cap').fill('capsuleCanary we still laugh at the kulfi cart');
      await asha.getByRole('button', { name: 'Seal it 🔒' }).click();
      await expect(asha.getByText('🔒 Your line is sealed')).toBeVisible(T);
      await ravi.goto('/time-capsule');
      await expect(ravi.getByText('Asha sealed ✓', { exact: false })).toBeVisible(T);
      await ravi.locator('#cap').fill('capsuleCanary more rainy windows please');
      await ravi.getByRole('button', { name: 'Seal it 🔒' }).click();
      await expect(ravi.getByText('🔒 Your line is sealed')).toBeVisible(T);
      await expect(ravi.getByText('capsuleCanary we still laugh')).toHaveCount(0);
      await shot(ravi, 'Room 1 · time capsule');
    });

    await test.step('Toasts: Ravi sends a "thinking of you" while Asha is away; opening the app shows it', async () => {
      await asha.goto('about:blank');
      await ravi.goto('/');
      await ravi.getByRole('button', { name: /Send a “thinking of you”/ }).click(T);
      await expect(ravi.getByText(/Sent 💛/)).toBeVisible(T);
      await asha.goto('/');
      await expect(asha.locator('.toast').first()).toBeVisible(T);
      await expect(asha.locator('.toasts')).toContainText('Ravi');
      await expect(asha.getByText('Ravi is thinking of you 💛')).toBeVisible(T);
      await shot(asha, 'Room 1 · toast');
    });

    await test.step('nothing readable left either phone; no other hosts', async () => {
      w.check([
        'Asha',
        'Ravi',
        'Namaste',
        'Filter kaapi',
        'Adrak wali',
        'noticedCanary',
        'bugCanary',
        'lineCanary',
        'microCanary',
        'monsoon tarana',
        'kulfi cart',
        'rose flavour',
        'captionCanary',
        'capsuleCanary',
        '"pick"',
        '"coffee"',
        hashtag.slice(1),
        raviPhrase,
        ashaPhrase,
        key,
      ]);
    });
  });

  test('Room 2 · settled couple, laptop + phone: food styles, together tools, Gentle Corner, seasons and the download', async ({ newDevice, baseURL }) => {
    test.setTimeout(15 * 60_000);
    const w = watcher(newDevice, baseURL!);
    const meera = await w.open('Meera (laptop)', 'laptop');
    const kabir = await w.open('Kabir (phone)', 'phone');
    let invite = '';

    await test.step('Meera creates the room on her laptop; Kabir joins on his phone; turns off', async () => {
      ({ invite } = await createAndSetUp(meera, 'Meera'));
      await joinAndSetUp(kabir, invite, 'Kabir');
      await expect(h1(kabir, /Namaste, Kabir/)).toBeVisible(T);
      await setTakeTurns(meera, false);
      await shot(meera, 'Room 2 · room data, turns off');
    });

    await test.step('Season 1 card 1: both answer; Meera saves Kabir’s answer to her notes', async () => {
      await meera.goto('/card/day/1');
      await meera.getByRole('button', { name: 'Chai' }).click(T);
      await meera.getByLabel(/Why\?/).fill('Elaichi every morning');
      await meera.getByRole('button', { name: 'Seal my answer' }).click();
      await expect(meera.getByText('Sealed.')).toBeVisible(T);
      await kabir.goto('/card/day/1');
      await kabir.getByRole('button', { name: 'Coffee' }).click(T);
      await kabir.getByLabel(/Why\?/).fill('Cold brew in summer');
      await kabir.getByRole('button', { name: 'Seal my answer' }).click();
      await kabir.getByRole('button', { name: /open both/ }).click(T);
      await expect(kabir.locator('.reveal-theirs')).toContainText('Elaichi every morning');
      await meera.goto('/card/day/1');
      await meera.getByRole('button', { name: /open both/ }).click(T);
      await expect(meera.locator('.reveal-theirs')).toContainText('Cold brew in summer');
      await meera.getByRole('button', { name: "🔖 Save Kabir's answer" }).click();
      await expect(meera.getByText('Saved to your notes about Kabir')).toBeVisible(T);
    });

    await test.step('Likes and dislikes: Meera non-veg, Kabir pure veg; each sees the other’s list', async () => {
      await meera.goto('/likes-and-dislikes');
      await meera.getByRole('button', { name: /Non-veg/ }).click(T);
      await expect(meera.getByRole('button', { name: /Non-veg/ })).toHaveAttribute('aria-pressed', 'true', T);
      await meera.locator('#like').fill('likeCanary masala chai at midnight');
      await meera.getByRole('button', { name: 'Add to my list' }).click();
      await meera.getByRole('button', { name: '🙅 Not for me' }).click();
      await meera.locator('#like').fill('dislikeCanary crowded sale days');
      await meera.getByRole('button', { name: 'Add to my list' }).click();
      await expect(meera.getByText('dislikeCanary crowded sale days')).toBeVisible(T);

      await kabir.goto('/likes-and-dislikes');
      await kabir.getByRole('button', { name: /Pure veg/ }).click(T);
      await expect(kabir.getByRole('button', { name: /Pure veg/ })).toHaveAttribute('aria-pressed', 'true', T);
      await kabir.locator('#like').fill('likeCanary sunset walks by the river');
      await kabir.getByRole('button', { name: 'Add to my list' }).click();
      await kabir.getByRole('button', { name: '🙅 Not for me' }).click();
      await kabir.locator('#like').fill('dislikeCanary loud restaurants');
      await kabir.getByRole('button', { name: 'Add to my list' }).click();
      await expect(kabir.getByText('likeCanary masala chai at midnight')).toBeVisible(T);
      await expect(kabir.getByText(/right now that is pure veg/)).toBeVisible(T);

      await meera.goto('/likes-and-dislikes');
      await expect(meera.getByText('likeCanary sunset walks by the river')).toBeVisible(T);
      await expect(meera.getByText('dislikeCanary loud restaurants')).toBeVisible(T);
      await expect(meera.getByText(/right now that is pure veg/)).toBeVisible(T);
      await shot(meera, 'Room 2 · likes and dislikes');
      await axe(meera, 'Room 2 likes');
    });

    await test.step('Date Plans food card follows the stricter food style', async () => {
      // "The dish you order every time?" is card 3 of the Date Plans pack (src/content/morePacks.ts).
      const dish = (p: Page, name: string) => p.locator('.question-card .option').filter({ hasText: name });
      await meera.goto('/card/pack/dates/3');
      await expect(h1(meera, 'The dish you order every time?')).toBeVisible(T);
      await expect(dish(meera, 'Plain dosa')).toBeVisible(T);
      for (const hidden of ['Chicken biryani', 'Goan fish curry', 'Paneer butter masala', 'Pasta arrabbiata']) {
        await expect(dish(meera, hidden), `${hidden} shows for a pure veg room`).toHaveCount(0);
      }
      await shot(meera, 'Room 2 · food card, pure veg room');

      await kabir.goto('/likes-and-dislikes');
      await kabir.getByRole('button', { name: /Non-veg/ }).click(T);
      await expect(kabir.getByText(/right now that is non-veg/)).toBeVisible(T);
      await meera.goto('/card/pack/dates/3');
      await expect(dish(meera, 'Plain dosa')).toBeVisible(T);
      await expect(dish(meera, 'Chicken biryani')).toBeVisible(T);
      await expect(dish(meera, 'Paneer butter masala')).toBeVisible();
      await shot(meera, 'Room 2 · food card, both non-veg');
    });

    await test.step('Dil ki Baat: a soft note and a one-tap reply; the pause shows on Kabir’s phone', async () => {
      await meera.goto('/dil-ki-baat');
      await meera.getByRole('button', { name: /Tell Kabir how you feel/ }).click(T);
      await meera.getByRole('group', { name: 'Feelings' }).getByRole('button').first().click();
      await meera.getByRole('group', { name: 'What would help' }).getByRole('button').first().click();
      await meera.locator('#sline').fill('softCanary the long week got to me');
      await meera.getByRole('button', { name: /Send softly/ }).click();
      await expect(meera.getByText(/can reply whenever they are ready/)).toBeVisible(T);
      await kabir.goto('/dil-ki-baat');
      await expect(kabir.getByText('softCanary the long week got to me', { exact: false })).toBeVisible(T);
      await kabir.getByRole('group', { name: 'Reply' }).getByRole('button').first().click(T);
      await expect(kabir.getByText(/You replied:/)).toBeVisible(T);
      await shot(kabir, 'Room 2 · dil ki baat reply');
      await axe(kabir, 'Room 2 dil ki baat');

      await meera.getByRole('button', { name: /I need 20 minutes/ }).click();
      await expect(meera.getByText(/You asked for a pause/)).toBeVisible(T);
      await kabir.goto('/');
      await expect(kabir.locator('.pause-banner')).toContainText('not going anywhere', T);
      await shot(kabir, 'Room 2 · pause banner');
      await meera.getByRole('button', { name: "I'm ready to talk again" }).click();
    });

    await test.step('Shukriya jar stays sealed until both write', async () => {
      await meera.goto('/shukriya');
      await meera.locator('#thanks').fill('thanksCanary the chai when I was tired');
      await meera.getByRole('button', { name: /Drop it in the jar/ }).click();
      await expect(meera.getByText(/It opens when Kabir adds theirs/)).toBeVisible(T);
      await kabir.goto('/shukriya');
      await expect(kabir.getByText('thanksCanary the chai')).toHaveCount(0);
      await kabir.locator('#thanks').fill('thanksCanary the long call on Sunday');
      await kabir.getByRole('button', { name: /Drop it in the jar/ }).click();
      await expect(kabir.getByText("This week's jar is open 💛")).toBeVisible(T);
      await expect(kabir.locator('.reveal')).toContainText('thanksCanary the chai when I was tired');
    });

    await test.step('Weekly huddle: three taps each, then it opens', async () => {
      for (const p of [meera, kabir]) {
        await p.goto('/huddle');
        for (const group of ['Best thing this week', 'A hard thing', "One thing I'd love from you"]) {
          await p.getByRole('group', { name: group }).getByRole('button').first().click(T);
        }
        await p.getByRole('button', { name: 'Done ✓' }).click();
      }
      await expect(kabir.getByText('Your week, together 💛')).toBeVisible(T);
      await meera.goto('/huddle');
      await expect(meera.getByText('Your week, together 💛')).toBeVisible(T);
      await shot(meera, 'Room 2 · weekly huddle');
    });

    await test.step('Dreams board: a date plan, a dine-out and a shopping idea', async () => {
      await meera.goto('/dreams');
      for (const [chip, text] of [
        ['🗓️ Date plan', 'dreamCanary rooftop picnic this Saturday'],
        ['🍽️ Dine out', 'dreamCanary the dosa place near the station'],
        ['🛍️ Shopping', 'dreamCanary the Diwali market, small budget each'],
      ] as const) {
        await meera.getByRole('button', { name: chip }).click(T);
        await meera.locator('#dream').fill(text);
        await meera.getByRole('button', { name: /Add to the board/ }).click();
        await expect(meera.getByText(text)).toBeVisible(T);
      }
      await kabir.goto('/dreams');
      for (const text of ['rooftop picnic this Saturday', 'the dosa place near the station', 'the Diwali market, small budget each']) {
        await expect(kabir.getByText(`dreamCanary ${text}`)).toBeVisible(T);
      }
      await shot(kabir, 'Room 2 · dreams board');
      await axe(meera, 'Room 2 dreams');
    });

    await test.step('Gentle Corner: Meera invites, Kabir joins, different depths, one light heads-up', async () => {
      await meera.goto('/gentle');
      await meera.getByRole('switch', { name: 'Gentle Corner' }).click(T);
      await expect(meera.getByText('Waiting for Kabir to join')).toBeVisible(T);
      await kabir.goto('/gentle');
      await expect(kabir.getByText('Meera invited you in 💛')).toBeVisible(T);
      await kabir.getByRole('button', { name: 'Join 💛' }).click();
      await expect(kabir.getByRole('heading', { name: 'How deep would you like to go?' })).toBeVisible(T);
      await kabir.getByRole('group', { name: 'How deep' }).getByRole('button', { name: /Personal/ }).click();
      await expect(kabir.getByRole('group', { name: 'How deep' }).getByRole('button', { name: /Personal/ })).toHaveAttribute('aria-pressed', 'true', T);
      await meera.goto('/gentle');
      await meera.getByRole('group', { name: 'How deep' }).getByRole('button', { name: /Deep/ }).click(T);
      await expect(meera.getByRole('group', { name: 'How deep' }).getByRole('button', { name: /Deep/ })).toHaveAttribute('aria-pressed', 'true', T);
      await expect(meera.getByText(/Open together:/)).toContainText('Personal', T);

      await kabir.goto('/gentle');
      await expect(kabir.getByText(/Open together:/)).toContainText('Personal', T);
      await kabir.getByRole('button', { name: '＋ Share a heads-up' }).click();
      const checks = kabir.locator('.gentle-compose .checks');
      await checks.nth(0).locator('.check').first().click();
      await checks.nth(1).locator('.check').first().click();
      await kabir.locator('#gline').fill('gentleCanary busy weeks make me quiet');
      await kabir.getByRole('button', { name: 'Share gently 💛' }).click();
      await expect(kabir.getByText(/Shared ✓/)).toBeVisible(T);
      await meera.goto('/gentle');
      await expect(meera.getByRole('heading', { name: 'From Kabir' })).toBeVisible(T);
      await expect(meera.getByText('gentleCanary busy weeks make me quiet', { exact: false })).toBeVisible();
      await expect(meera.getByRole('note')).toContainText('findahelpline.com');
      await shot(meera, 'Room 2 · gentle corner');
      await axe(meera, 'Room 2 gentle corner');
    });

    await test.step('"Is this hard, or is this harmful?" loads', async () => {
      await kabir.goto('/hard-or-harmful');
      await expect(h1(kabir, 'Is this hard, or is this harmful?')).toBeVisible(T);
      await shot(kabir, 'Room 2 · hard or harmful');
    });

    await test.step('Seasons, Then vs Now, What I learned, the Our Kahani book', async () => {
      await meera.goto('/seasons');
      await expect(h1(meera, 'Your seasons')).toBeVisible(T);
      await shot(meera, 'Room 2 · seasons');
      await axe(meera, 'Room 2 seasons');
      await meera.goto('/card/season/s2/1');
      await expect(meera.locator('.then-block')).toContainText('Chai', T);
      await expect(meera.locator('.then-block')).toContainText('Coffee');
      await shot(meera, 'Room 2 · then vs now');
      await meera.goto('/what-i-learned');
      await expect(h1(meera, 'What I learned about Kabir')).toBeVisible(T);
      await expect(meera.getByText(/Cold brew in summer/)).toBeVisible(T);
      await meera.goto('/our-kahani-book');
      await expect(h1(meera, /our kahani/i)).toBeVisible(T);
      await expect(meera.getByText('Chai or coffee to start the day?').first()).toBeVisible(T);
      await shot(meera, 'Room 2 · our kahani book');
    });

    await test.step('Meera downloads everything: answers, her notes and a README', async () => {
      await meera.goto('/room');
      await expect(meera.getByRole('button', { name: /Download everything/ })).toBeEnabled(T);
      await axe(meera, 'Room 2 room data');
      const { file, names } = await captureZip(meera, () => meera.getByRole('button', { name: '📥 Download everything (zip)' }).click());
      expect(file).toMatch(/^room-data-.*\.zip$/);
      expect(names).toContain('README.txt');
      expect(names).toContain('our-answers.xlsx');
      expect(names.some((n) => /^notes-about-.*\.xlsx$/.test(n)), `a notes .xlsx in ${names.join(', ')}`).toBe(true);
      await expect(meera.getByText('Saved to your device 📥')).toBeVisible(T);
    });

    await test.step('nothing readable left either device; no other hosts', async () => {
      w.check([
        'Meera',
        'Kabir',
        'Namaste',
        'Elaichi',
        'Cold brew',
        'likeCanary',
        'dislikeCanary',
        'softCanary',
        'thanksCanary',
        'dreamCanary',
        'gentleCanary',
        '"nonveg"',
        '"pure"',
        keyOf(invite),
      ]);
    });
  });

  test('Room 3 · devices and recovery: a laptop, sign-out, a wrong phrase, partner rescue, then download and erase', async ({ newDevice, baseURL }) => {
    test.setTimeout(15 * 60_000);
    const w = watcher(newDevice, baseURL!);
    const mira = await w.open('Mira (phone)', 'phone');
    const kabir = await w.open('Kabir (phone, later lost)', 'phone');
    let invite = '';
    let hashtag = '';
    const kabirPhrase = uniquePhrase('kite festival on the terrace');
    const miraPhrase = uniquePhrase('filter coffee and rainy mornings');
    const kabirNewPhrase = uniquePhrase('a brand new phrase for kabir');

    await test.step('set up: create, join, name the room, a phrase each', async () => {
      ({ invite } = await createAndSetUp(mira, 'Mira'));
      await joinAndSetUp(kabir, invite, 'Kabir');
      hashtag = await lockHashtag(mira, kabir);
      await setPhrase(kabir, kabirPhrase);
      await setPhrase(mira, miraPhrase);
      await expect(h1(mira, /Namaste, Mira/)).toBeVisible(T);
    });

    await test.step('both answer card 1 (Kabir first)', async () => {
      await kabir.goto('/card/day/1');
      await kabir.getByRole('button', { name: 'Coffee' }).click(T);
      await kabir.getByLabel(/Why\?/).fill('Strong south Indian decoction');
      await kabir.getByRole('button', { name: 'Seal my answer' }).click();
      await expect(kabir.getByText('Sealed.')).toBeVisible(T);
      await mira.goto('/card/day/1');
      await mira.getByRole('button', { name: 'Chai' }).click(T);
      await mira.getByRole('button', { name: 'Seal my answer' }).click();
      await mira.getByRole('button', { name: /open both/ }).click(T);
      await expect(mira.locator('.reveal-theirs')).toContainText('Coffee');
    });

    const laptop = await w.open('Mira (laptop)', 'laptop');
    await test.step('Mira adds her laptop with hashtag + phrase; both devices work', async () => {
      await laptop.goto('/recover');
      await expect(h1(laptop, 'Enter your room')).toBeVisible(T);
      await axe(laptop, 'Room 3 enter your room');
      await laptop.getByLabel("Your room's hashtag").fill(hashtag);
      await laptop.getByLabel('Your phrase').fill(miraPhrase);
      await laptop.getByRole('button', { name: 'Enter the room' }).click();
      await expect(h1(laptop, /Namaste, Mira/)).toBeVisible(T);
      await laptop.goto('/card/day/1');
      await laptop.getByRole('button', { name: /open both/ }).click(T);
      await expect(laptop.locator('.reveal-theirs')).toContainText('Strong south Indian decoction');
      await mira.goto('/');
      await expect(h1(mira, /Namaste, Mira/)).toBeVisible(T);
      await shot(laptop, 'Room 3 · laptop added');
    });

    await test.step('Room data shows two devices; the laptop signs the phone out', async () => {
      await laptop.goto('/room');
      await expect(laptop.getByText('Your devices · 2')).toBeVisible(T);
      await shot(laptop, 'Room 3 · two devices');
      await axe(laptop, 'Room 3 room data');
      await laptop.getByRole('button', { name: 'Lost one? Sign out my other devices' }).click();
      await laptop.getByRole('button', { name: 'Sign them out' }).click();
      await expect(laptop.getByText('Signed out 1 other device.')).toBeVisible(T);
      await mira.goto('/');
      await expect(mira.getByRole('button', { name: 'Create a room' })).toBeVisible(T);
    });

    await test.step('a fresh device: a wrong phrase is refused; the right one (other case, extra spaces) works', async () => {
      const fresh = await w.open('Mira (fresh browser)', 'phone');
      await fresh.goto('/recover');
      await fresh.getByLabel("Your room's hashtag").fill(hashtag.toLowerCase());
      await fresh.getByLabel('Your phrase').fill(miraPhrase.replace('rainy', 'sunny'));
      await fresh.getByRole('button', { name: 'Enter the room' }).click();
      await expect(fresh.getByRole('alert')).toContainText('do not match', T);
      await shot(fresh, 'Room 3 · wrong phrase refused');
      await fresh.getByLabel('Your phrase').fill(`  ${miraPhrase.toUpperCase().split(' ').join('   ')}  `);
      await fresh.getByRole('button', { name: 'Enter the room' }).click();
      await expect(h1(fresh, /Namaste, Mira/)).toBeVisible(T);
    });

    let code = '';
    await test.step('partner rescue: Mira makes a one-time code (her wrong phrase refused first)', async () => {
      await laptop.goto('/room');
      await laptop.getByRole('button', { name: 'Help Kabir back in' }).click(T);
      await laptop.getByLabel(/Your own phrase/).fill('not my phrase at all today');
      await laptop.getByRole('button', { name: 'Make the rescue code' }).click();
      await expect(laptop.getByRole('alert')).toContainText('not your phrase', T);
      await laptop.getByLabel(/Your own phrase/).fill(miraPhrase);
      await laptop.getByRole('button', { name: 'Make the rescue code' }).click();
      code = ((await laptop.locator('.rescue-code').textContent(T)) ?? '').trim();
      expect(code).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/);
      await shot(laptop, 'Room 3 · rescue code');
      await axe(laptop, 'Room 3 rescue code');
    });

    const newPhone = await w.open('Kabir (new phone)', 'phone');
    await test.step('Kabir’s new phone uses the code and picks a new phrase; the old phone is signed out; the code works once', async () => {
      await newPhone.goto('/recover');
      await newPhone.getByRole('button', { name: 'I have a rescue code from my person' }).click(T);
      await newPhone.getByLabel("Your room's hashtag").fill(hashtag);
      await newPhone.getByLabel('Rescue code from your person').fill(code.toLowerCase().replace(/-/g, ' '));
      await newPhone.getByRole('button', { name: 'Use the rescue code' }).click();
      await expect(h1(newPhone, /Your room phrase/)).toBeVisible(T);
      await setPhrase(newPhone, kabirNewPhrase);
      await expect(h1(newPhone, /Namaste, Kabir/)).toBeVisible(T);
      await newPhone.goto('/card/day/1');
      await expect(newPhone.getByRole('button', { name: /open both/ }).or(newPhone.locator('.reveal-mine')).first()).toBeVisible(T);
      await shot(newPhone, 'Room 3 · Kabir back in');

      await kabir.goto('/');
      await expect(kabir.getByRole('button', { name: 'Create a room' })).toBeVisible(T);

      const another = await w.open('someone with the used code (phone)', 'phone');
      await another.goto('/recover');
      await another.getByRole('button', { name: 'I have a rescue code from my person' }).click(T);
      await another.getByLabel("Your room's hashtag").fill(hashtag);
      await another.getByLabel('Rescue code from your person').fill(code);
      await another.getByRole('button', { name: 'Use the rescue code' }).click();
      await expect(another.getByRole('alert')).toContainText('does not work', T);
    });

    await test.step('Mira downloads everything, then erases the room; both return to Welcome', async () => {
      await laptop.goto('/room');
      await expect(laptop.getByRole('button', { name: /Download everything/ })).toBeEnabled(T);
      const first = await captureZip(laptop, () => laptop.getByRole('button', { name: '📥 Download everything (zip)' }).click());
      expect(first.names).toContain('README.txt');
      expect(first.names).toContain('our-answers.xlsx');
      await laptop.getByRole('button', { name: '🧹 Erase this room' }).click();
      await expect(laptop.getByText('Erase this room?')).toBeVisible();
      await shot(laptop, 'Room 3 · erase?');
      const last = await captureZip(laptop, () => laptop.getByRole('button', { name: '📥 Download and erase' }).click());
      expect(last.file).toMatch(/^room-data-.*\.zip$/);
      expect(last.names).toContain('our-answers.xlsx');
      await expect(laptop.getByRole('button', { name: 'Create a room' })).toBeVisible(T);
      await expect(h1(laptop, /From pehli baat/)).toBeVisible();
      await shot(laptop, 'Room 3 · welcome after erase');
      await axe(laptop, 'Room 3 welcome');
      await newPhone.goto('/');
      await expect(newPhone.getByRole('button', { name: 'Create a room' })).toBeVisible(T);
      await shot(newPhone, 'Room 3 · Kabir back at welcome');
    });

    await test.step('nothing readable left any device; no other hosts', async () => {
      w.check([
        'Mira',
        'Kabir',
        'Namaste',
        'Strong south Indian',
        hashtag.slice(1),
        miraPhrase,
        kabirPhrase,
        kabirNewPhrase,
        'not my phrase',
        code,
        code.replace(/-/g, ''),
        keyOf(invite),
      ]);
    });
  });
});
