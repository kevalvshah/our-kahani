import { expect, test as base, type BrowserContextOptions, type Page } from '@playwright/test';

type Fixtures = {
  /** Opens a page on another "device": a fresh browser context, closed after the test. */
  newDevice: (options?: BrowserContextOptions) => Promise<Page>;
};

export const test = base.extend<Fixtures>({
  newDevice: async ({ browser }, use) => {
    const contexts: Awaited<ReturnType<typeof browser.newContext>>[] = [];
    await use(async (options) => {
      const context = await browser.newContext(options);
      contexts.push(context);
      return context.newPage();
    });
    await Promise.all(contexts.map((c) => c.close()));
  },
});
export { expect };

export const INSTAGRAM_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0 (iPhone14,5; iOS 17_5; en_GB)';

/**
 * Watches a page for anything that breaks the trust rules: script errors, console errors,
 * CSP violations, and requests to any host other than the app. Call the returned function
 * at the end of the test to assert none happened.
 */
export async function guard(page: Page) {
  const problems: string[] = [];
  const appHost = new URL(test.info().project.use.baseURL!).host;
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`);
  });
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (url.protocol.startsWith('http') && url.host !== appHost) {
      problems.push(`third-party request: ${url.origin}`);
    }
  });
  return () => expect(problems).toEqual([]);
}

export async function createRoom(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create a room' }).click();
  await expect(page.locator('.invite')).toBeVisible();
  const invite = (await page.locator('.invite').textContent()) ?? '';
  const code = (await page.locator('.emoji').textContent()) ?? '';
  return { invite, code };
}

/** Every screen the app has today. Add new screens here and a11y + visual pick them up. */
export const SCREENS = ['home', 'invite', 'joined', 'incomplete', 'in-app-browser'] as const;
export type Screen = (typeof SCREENS)[number];

/** Opens a screen and returns the page showing it (a new page for the in-app browser). */
export async function openScreen(
  screen: Screen,
  page: Page,
  newDevice: Fixtures['newDevice'],
): Promise<Page> {
  switch (screen) {
    case 'home':
      await page.goto('/');
      await expect(page.getByRole('button', { name: 'Create a room' })).toBeVisible();
      return page;
    case 'invite':
      await createRoom(page);
      return page;
    case 'joined': {
      const { invite } = await createRoom(page);
      await page.goto(invite);
      await expect(page.getByRole('heading', { name: "You're in" })).toBeVisible();
      return page;
    }
    case 'incomplete':
      await page.goto('/join/some-room');
      await expect(page.getByRole('heading', { name: 'This invite link is incomplete' })).toBeVisible();
      return page;
    case 'in-app-browser': {
      const ig = await newDevice({ userAgent: INSTAGRAM_UA, viewport: page.viewportSize() });
      await ig.goto('/');
      await expect(ig.getByRole('heading', { name: 'Open this in Safari or Chrome' })).toBeVisible();
      return ig;
    }
  }
}
