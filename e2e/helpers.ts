import {
  expect,
  test as base,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Locator,
  type Page,
} from '@playwright/test';
import { DEFAULT_SUPABASE_URL } from '../src/net/defaults';
import { finishSetup, joinAndSetUp, lockHashtag } from './flow';

/** The one backend the app may talk to (the same origin the build puts in CSP connect-src). */
export const BACKEND_HOST = new URL(process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).host;

export const INSTAGRAM_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0 (iPhone14,5; iOS 17_5; en_GB)';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type Fixtures = {
  /** Opens a page on another "device": a fresh browser context, closed after the test. */
  newDevice: (options?: BrowserContextOptions) => Promise<Page>;
};

type WorkerFixtures = {
  /**
   * Real rooms shared by the screen-by-screen tests (accessibility, responsive, visual) in one
   * worker, so every screen is checked without creating a room per screen. Read-only use only.
   */
  stage: Stage;
};

export const test = base.extend<Fixtures, WorkerFixtures>({
  newDevice: async ({ browser }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async (options) => {
      const context = await browser.newContext(options);
      contexts.push(context);
      return context.newPage();
    });
    await Promise.all(contexts.map((c) => c.close()));
  },
  stage: [
    async ({ browser }, use, workerInfo) => {
      const u = workerInfo.project.use;
      const stage = new Stage(browser, {
        baseURL: u.baseURL,
        viewport: u.viewport,
        userAgent: u.userAgent,
        deviceScaleFactor: u.deviceScaleFactor,
        isMobile: u.isMobile,
        hasTouch: u.hasTouch,
        locale: u.locale,
        extraHTTPHeaders: u.extraHTTPHeaders,
      });
      await use(stage);
      await stage.close();
    },
    { scope: 'worker', timeout: 60_000 },
  ],
});
export { expect };

// ---------------------------------------------------------------------------
// Trust checks
// ---------------------------------------------------------------------------

/**
 * Watches a page for anything that breaks the trust rules: script errors, console errors,
 * CSP violations, and requests to any host other than the app and its one backend. Call the
 * returned function at the end of the test to assert none happened.
 */
export async function guard(page: Page) {
  const problems: string[] = [];
  const appHost = new URL(test.info().project.use.baseURL!).host;
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  page.on('pageerror', (e) => {
    // WebKit reports a backend fetch cut short by a reload or navigation as this error. It is
    // the browser abandoning a request, not a blocked host (CSP violations are caught above).
    if (e.message.includes(BACKEND_HOST) && e.message.endsWith('due to access control checks.')) return;
    problems.push(`pageerror: ${e.message}`);
  });
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`);
  });
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (url.protocol.startsWith('http') && url.host !== appHost && url.host !== BACKEND_HOST) {
      problems.push(`third-party request: ${url.origin}`);
    }
  });
  return () => expect(problems).toEqual([]);
}

/**
 * Every request this page sends to the backend: method, URL, headers and body. The sign-in
 * token headers are left out: they are random base64, where a short canary could appear by chance.
 */
export function recordBackendTraffic(page: Page) {
  const sent: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).host === BACKEND_HOST) {
      const { authorization: _token, apikey: _key, ...headers } = r.headers();
      sent.push(`${r.method()} ${r.url()}\n${JSON.stringify(headers)}\n${r.postData() ?? ''}`);
    }
  });
  return sent;
}

/**
 * True when the tests run against the Vite dev server, which serves no security headers (only
 * `vite preview` and Cloudflare Pages serve public/_headers). A deployed site answers this
 * path with index.html, never JavaScript.
 */
export async function isViteDevServer(request: APIRequestContext) {
  const res = await request.get('/@vite/client');
  return res.ok() && (res.headers()['content-type'] ?? '').includes('javascript');
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

/**
 * Creates a real room on this device (anonymous sign-in, create_room on the backend) and
 * finishes first-run setup: first name and optional country. Ends on /invite.
 */
export async function createRoom(page: Page, { name = 'Asha', country }: { name?: string; country?: string } = {}) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create a room' }).click();
  if (country) {
    const where = page.getByLabel(/Where are you based/);
    await expect(where).toBeVisible({ timeout: 20_000 });
    await where.selectOption(country);
  }
  await finishSetup(page, name);
  await expect(page.locator('.invite')).toBeVisible({ timeout: 20_000 });
  const invite = (await page.locator('.invite').textContent()) ?? '';
  const code = (await page.locator('.emoji').first().textContent()) ?? '';
  return { invite, code, roomId: roomIdOf(invite) };
}

export const roomIdOf = (invite: string) => /\/join\/([^#/]+)/.exec(invite)?.[1] ?? '';
export const keyOf = (invite: string) => invite.split('#k1.')[1] ?? '';

/** Switches the "invited person answers first" room setting on or off. */
export async function setTakeTurns(page: Page, on: boolean) {
  await page.goto('/room');
  const toggle = page.getByRole('switch', { name: 'Take turns answering' });
  await expect(toggle).toBeVisible({ timeout: 20_000 });
  if ((await toggle.getAttribute('aria-checked')) !== String(on)) await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', String(on), { timeout: 20_000 });
}

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

/**
 * Who shows a screen:
 * - `fresh`: a new browser with no room; `instagram`: the same inside Instagram's browser.
 * - `newcomer`: a creator on the first-run screen (first name), then alone in the room.
 * - `creator` / `partner`: Asha and Ravi, both set up in one room, nothing answered yet.
 * - `named`: another couple who have just locked their hashtag, on the room-phrase step.
 */
type Who = 'fresh' | 'instagram' | 'newcomer' | 'creator' | 'partner' | 'named';
type Step = 'name' | 'alone';

interface ScreenDef {
  who: Who;
  /** Path to open (for the newcomer, the first-run step to reach instead). */
  path: string;
  heading: string | RegExp;
  step?: Step;
  /** Anything that differs every run, hidden in screenshots. */
  mask?: readonly string[];
  /** Waits for content that loads after the heading. */
  ready?: (page: Page) => Promise<void>;
  /** Screenshot the visible screen only: the page's length depends on what other tests did. */
  viewportOnly?: boolean;
  /** Left out of screenshot comparison: its content is whatever other tests answered (still
   *  covered by the accessibility and responsive checks). */
  noScreenshot?: boolean;
}

const MINE = 'Asha';
const THEIRS = 'Ravi';
const NEWCOMER = 'Mira';

/**
 * Every screen the app has today. Add new screens here and the accessibility, responsive and
 * visual tests pick them up. Order matters a little: the newcomer's first run only goes
 * forwards, so its screens are listed in order.
 */
export const SCREENS = {
  // No room on this device.
  welcome: { who: 'fresh', path: '/', heading: /From pehli baat/ },
  recover: { who: 'fresh', path: '/recover', heading: 'Enter your room' },
  privacy: { who: 'fresh', path: '/privacy', heading: "Even the developer can't read it" },
  look: { who: 'fresh', path: '/look', heading: 'Make it ours' },
  'invite-start': { who: 'fresh', path: '/invite', heading: 'Invite & safety code' },
  incomplete: { who: 'fresh', path: '/join/some-room', heading: 'This invite link is incomplete' },
  'in-app-browser': { who: 'instagram', path: '/', heading: 'Open this in Safari or Chrome' },

  // First run, on the creator's phone.
  // The welcome screen shares this heading while the room is still opening: wait for the name field.
  'profile-setup': {
    who: 'newcomer',
    path: '/',
    step: 'name',
    heading: /From pehli baat/,
    ready: async (page) => {
      await expect(page.getByLabel('Your first name')).toBeVisible({ timeout: 20_000 });
    },
  },
  invite: { who: 'newcomer', path: '/invite', step: 'alone', heading: 'Send this to your person', mask: ['.invite', '.emoji'] },
  'today-waiting': {
    who: 'newcomer',
    path: '/',
    step: 'alone',
    heading: `Namaste, ${NEWCOMER}`,
    ready: (p) => expect(p.getByText('Waiting for your person to join')).toBeVisible({ timeout: 20_000 }),
  },

  // In a room with both people.
  joined: { who: 'partner', path: '/join/{room}', heading: "You're in", mask: ['.emoji'] },
  today: {
    who: 'creator',
    path: '/',
    heading: `Namaste, ${MINE}`,
    ready: (p) => expect(p.getByText('Name your room together')).toBeVisible({ timeout: 20_000 }),
  },
  'card-their-turn': {
    who: 'creator',
    path: '/card/day/1',
    heading: 'Chai or coffee to start the day?',
    ready: (p) => expect(p.getByText(`${THEIRS} goes first on this one`)).toBeVisible({ timeout: 20_000 }),
  },
  card: {
    who: 'partner',
    path: '/card/day/1',
    heading: 'Chai or coffee to start the day?',
    ready: (p) => expect(p.getByRole('button', { name: 'Chai' })).toBeVisible({ timeout: 20_000 }),
  },
  packs: { who: 'creator', path: '/packs', heading: 'Card packs' },
  pack: { who: 'creator', path: '/packs/warm', heading: 'Warm Words' },
  'add-a-card': { who: 'creator', path: '/add-a-card', heading: `Make a card for ${THEIRS}` },
  'micro-dates': { who: 'creator', path: '/micro-dates', heading: /Spin for a 15-minute date/ },
  antakshari: { who: 'creator', path: '/antakshari', heading: 'Last letter, next song' },
  'story-relay': { who: 'creator', path: '/story-relay', heading: 'One sentence each' },
  'time-capsule': { who: 'creator', path: '/time-capsule', heading: 'A note to future us', mask: ['.question-card p.small b'] },
  movie: { who: 'creator', path: '/movie', heading: /Movie night, your way/ },
  'right-now': { who: 'creator', path: '/right-now', heading: 'What are you up to?' },
  gentle: {
    who: 'creator',
    path: '/gentle',
    heading: 'Only if you both want it',
    ready: (p) => expect(p.getByRole('note')).toBeVisible(),
  },
  saved: { who: 'creator', path: '/saved', heading: `About ${THEIRS}` },
  'room-data': {
    who: 'creator',
    path: '/room',
    heading: 'Your room, your pace',
    mask: ['.question-card h1', '.facts dd', '.question-card p.small b'],
    ready: (p) => expect(p.getByRole('button', { name: /Download everything/ })).toBeEnabled({ timeout: 20_000 }),
  },
  'invite-both-in': { who: 'creator', path: '/invite', heading: 'You’re both in', mask: ['.emoji'] },
  seasons: { who: 'creator', path: '/seasons', heading: 'Your seasons' },
  'season-2': { who: 'creator', path: '/seasons/s2', heading: 'Asli Kahani' },
  recap: { who: 'creator', path: '/what-i-learned', heading: `What I learned about ${THEIRS}` },
  'dil-ki-baat': { who: 'creator', path: '/dil-ki-baat', heading: 'Dil ki Baat' },
  shukriya: { who: 'creator', path: '/shukriya', heading: 'Shukriya jar', mask: ['.field-label'] },
  huddle: { who: 'creator', path: '/huddle', heading: 'Weekly huddle' },
  dreams: { who: 'creator', path: '/dreams', heading: 'Dreams board' },
  'hard-or-harmful': { who: 'creator', path: '/hard-or-harmful', heading: 'Is this hard, or is this harmful?' },
  // The book collects whatever the shared test couple has answered so far (test order).
  book: { who: 'creator', path: '/our-kahani-book', heading: /our kahani/i, noScreenshot: true },

  // Hashtag locked: each person's room phrase (mandatory before anything else).
  'room-phrase': { who: 'named', path: '/', heading: /Your room phrase/, mask: ['.panel b', '.lead'] },
} as const satisfies Record<string, ScreenDef>;

export type Screen = keyof typeof SCREENS;
export const SCREEN_NAMES = Object.keys(SCREENS) as Screen[];

/** Things that differ every run on any screen: invite links, safety codes, the install prompt. */
export const SCREENSHOT_NAMES = SCREEN_NAMES.filter((s) => !(SCREENS[s] as ScreenDef).noScreenshot);

export function fullPageFor(screen: Screen): boolean {
  return !(SCREENS[screen] as ScreenDef).viewportOnly;
}

export function masksFor(page: Page, screen: Screen): Locator[] {
  const def: ScreenDef = SCREENS[screen];
  return ['.invite', '.emoji', '.install', ...(def.mask ?? [])].map((s) => page.locator(s));
}

export interface OpenOptions {
  colorScheme?: 'light' | 'dark';
  reducedMotion?: 'reduce' | 'no-preference';
  /** Viewport width; height stays at the project's own. */
  width?: number;
}

/**
 * The devices behind SCREENS. Rooms are made lazily, the first time a screen needs one, and
 * reused for the rest of the worker.
 */
export class Stage {
  private contexts: BrowserContext[] = [];
  private scratch: BrowserContext | null = null;
  private couple: Promise<{ creator: Page; partner: Page; roomId: string }> | null = null;
  private newcomer: { page: Page; step: Step } | null = null;
  private named: Promise<Page> | null = null;

  constructor(
    private readonly browser: Browser,
    private readonly options: BrowserContextOptions,
  ) {}

  private async device(extra: BrowserContextOptions = {}) {
    const context = await this.browser.newContext({ ...this.options, ...extra });
    this.contexts.push(context);
    return context.newPage();
  }

  /** A throwaway browser with no room; the previous one is closed. */
  private async freshDevice(extra: BrowserContextOptions = {}) {
    await this.scratch?.close();
    const page = await this.device(extra);
    this.scratch = page.context();
    return page;
  }

  private getCouple() {
    this.couple ??= (async () => {
      const creator = await this.device();
      const { invite, roomId } = await createRoom(creator, { name: MINE });
      const partner = await this.device();
      await partner.goto(invite);
      await expect(partner.getByRole('heading', { name: "You're in" })).toBeVisible({ timeout: 20_000 });
      await partner.getByRole('link', { name: 'Continue →' }).click();
      await finishSetup(partner, THEIRS);
      await expect(partner.getByRole('heading', { name: `Namaste, ${THEIRS}` })).toBeVisible({ timeout: 20_000 });
      return { creator, partner, roomId };
    })();
    return this.couple;
  }

  private getNamed() {
    this.named ??= (async () => {
      const creator = await this.device();
      const { invite } = await createRoom(creator, { name: 'Kiran' });
      const partner = await this.device();
      await joinAndSetUp(partner, invite, 'Dev');
      await lockHashtag(creator, partner);
      return partner;
    })();
    return this.named;
  }

  /** Moves the newcomer forwards to a first-run step (a new newcomer if it is already past it). */
  private async newcomerAt(step: Step) {
    if (!this.newcomer || (this.newcomer.step === 'alone' && step === 'name')) {
      const page = await this.device();
      await page.goto('/');
      await page.getByRole('button', { name: 'Create a room' }).click();
      await expect(page.getByLabel('Your first name')).toBeVisible({ timeout: 20_000 });
      this.newcomer = { page, step: 'name' };
    }
    const n = this.newcomer;
    if (n.step === 'name' && step === 'alone') {
      await finishSetup(n.page, NEWCOMER);
      await expect(n.page.locator('.invite')).toBeVisible({ timeout: 20_000 });
      n.step = 'alone';
    }
    return n.page;
  }

  /** Opens a screen, ready to check, and returns the page showing it. */
  async open(screen: Screen, opts: OpenOptions = {}): Promise<Page> {
    const def: ScreenDef = SCREENS[screen];
    let page: Page;
    let path = def.path;
    switch (def.who) {
      case 'fresh':
        page = await this.freshDevice();
        break;
      case 'instagram':
        page = await this.freshDevice({ userAgent: INSTAGRAM_UA });
        break;
      case 'newcomer':
        page = await this.newcomerAt(def.step!);
        break;
      case 'named':
        page = await this.getNamed();
        break;
      case 'creator':
      case 'partner': {
        const couple = await this.getCouple();
        page = couple[def.who];
        path = path.replace('{room}', couple.roomId);
        break;
      }
    }
    const size = this.options.viewport ?? { width: 1280, height: 720 };
    await page.setViewportSize({ width: opts.width ?? size.width, height: size.height });
    await page.emulateMedia({ colorScheme: opts.colorScheme ?? 'light', reducedMotion: opts.reducedMotion ?? 'no-preference' });
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: def.heading })).toBeVisible({ timeout: 20_000 });
    await def.ready?.(page);
    return page;
  }

  async close() {
    await Promise.all(this.contexts.map((c) => c.close().catch(() => undefined)));
  }
}
