import type { Page } from '@playwright/test';
import { expect, test } from './helpers';
import { createAndSetUp, joinAndSetUp } from './flow';

// The installed app on a laptop, emulated in Chromium through the DevTools protocol: Chrome's own
// install check, the app running as an installed window, offline start, and notifications
// (a subscription stored for the room, the partner's action nudging it, and the service worker
// showing only "Your room needs attention"). Needs the production build (the service worker is
// only registered there), which is what the test web server serves.

// This file is about the service worker, so it is allowed here (blocked everywhere else).
test.use({ serviceWorkers: 'allow' });

test.describe('installed app (PWA) and notifications', { tag: ['@pwa', '@functional'] }, () => {
  test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || !!isMobile, 'Chromium desktop: the DevTools protocol drives install and push');

  async function readyWorker(page: Page) {
    await page.goto('/');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    // Reload once so the page is controlled by the worker (as it is on every later visit).
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  }

  test('Chrome reports the app as installable, with our manifest', async ({ page }) => {
    await readyWorker(page);
    const cdp = await page.context().newCDPSession(page);
    const { installabilityErrors } = (await cdp.send('Page.getInstallabilityErrors')) as { installabilityErrors: { errorId: string }[] };
    expect(installabilityErrors.map((e) => e.errorId)).toEqual([]);
    const manifest = (await cdp.send('Page.getAppManifest')) as { url: string; errors: unknown[]; data?: string };
    expect(manifest.errors).toEqual([]);
    const data = JSON.parse(manifest.data ?? '{}');
    expect(data).toMatchObject({ name: 'Our Kahani', display: 'standalone', start_url: '/' });
    expect(data.icons.some((i: { sizes: string }) => i.sizes === '512x512')).toBe(true);
  });

  test('runs as an installed window and opens offline', async ({ page, context }) => {
    // Chromium cannot emulate display-mode, so the installed window's media query is answered
    // as an installed app would answer it.
    await page.addInitScript(() => {
      const real = window.matchMedia.bind(window);
      window.matchMedia = (q: string) =>
        q.includes('display-mode: standalone') ? ({ ...real(q), matches: true, media: q } as MediaQueryList) : real(q);
    });
    await readyWorker(page);
    await createAndSetUp(page, 'Mira');
    await page.goto('/');
    await expect(page.getByText('Added to your Home Screen, so it opens like an app')).toBeVisible({ timeout: 20_000 });

    // Offline: the app shell still starts from the worker's cache, and says it is offline.
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByText('Offline: showing what is on this phone.')).toBeVisible({ timeout: 20_000 });
    await context.setOffline(false);
  });

  test('notifications: stored per room, nudged by the partner, and content-free on screen', async ({ page, newDevice }) => {
    test.setTimeout(180_000);
    // Headless Chromium has no connection to Google's push service and no permission prompt, so
    // the browser's subscription and the "Allow" tap are stood in for with a push address in the same format. Everything after it
    // (storing it, the partner's nudge reaching it, the worker showing the notice) is real.
    const endpoint = `https://fcm.googleapis.com/fcm/send/e2e-${Date.now()}`;
    await page.context().grantPermissions(['notifications'], { origin: new URL(test.info().project.use.baseURL!).origin });
    await page.addInitScript((ep) => {
      let sub: PushSubscription | null = null;
      const fake = { endpoint: ep, unsubscribe: async () => ((sub = null), true), toJSON: () => ({ endpoint: ep }) } as unknown as PushSubscription;
      PushManager.prototype.subscribe = async function () {
        return (sub = fake);
      };
      PushManager.prototype.getSubscription = async function () {
        return sub;
      };
      // Headless Chromium answers "denied" to every notification prompt, so the person's "Allow"
      // tap is given here.
      Object.defineProperty(Notification, 'permission', { get: () => 'granted' });
      Notification.requestPermission = async () => 'granted';
    }, endpoint);

    const { invite } = await createAndSetUp(page, 'Asha');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    const b = await newDevice();
    await joinAndSetUp(b, invite, 'Ravi');

    // Asha switches notifications on for this device.
    await page.goto('/room');
    const toggle = page.getByRole('switch', { name: 'Notifications' });
    await expect(toggle).toHaveAttribute('aria-checked', 'false', { timeout: 20_000 });
    const keyCall = page.waitForResponse((r) => r.url().endsWith('/functions/v1/push'));
    const stored = page.waitForResponse((r) => r.url().endsWith('/rpc/push_subscribe'));
    await toggle.click();
    expect((await keyCall).status()).toBe(200);
    expect((await stored).status()).toBeLessThan(300);
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('Notifications on on this device')).toBeVisible();

    // Ravi sends something: his phone nudges Asha's device, and the request says only which room.
    const nudges: { body: Record<string, unknown>; reply: Record<string, unknown> }[] = [];
    await b.route('**/functions/v1/push', async (route) => {
      const res = await route.fetch();
      const body = JSON.parse(route.request().postData() ?? '{}');
      const text = await res.text();
      if (body.action === 'notify') nudges.push({ body, reply: JSON.parse(text) });
      await route.fulfill({ response: res, body: text });
    });
    await b.goto('/card/day/1');
    await b.getByRole('button', { name: 'Coffee' }).click();
    await b.getByRole('button', { name: 'Seal my answer' }).click();
    await expect.poll(() => nudges.length, { timeout: 20_000 }).toBeGreaterThan(0);
    expect(Object.keys(nudges[0]!.body).sort()).toEqual(['action', 'room']);
    expect(nudges[0]!.reply).toMatchObject({ targets: 1 });

    // The worker receives a push carrying data, and still shows only the one fixed line.
    // (Headless Chromium cannot draw notifications, so the worker's call is recorded instead.)
    const worker = page.context().serviceWorkers()[0] ?? (await page.context().waitForEvent('serviceworker'));
    const shown = await worker.evaluate(async () => {
      const calls: [string, NotificationOptions | undefined][] = [];
      const sw = self as unknown as { registration: ServiceWorkerRegistration; dispatchEvent(e: Event): boolean };
      sw.registration.showNotification = async (title: string, options?: NotificationOptions) => void calls.push([title, options]);
      const done: Promise<unknown>[] = [];
      const event = new Event('push') as Event & { waitUntil(p: Promise<unknown>): void; data: unknown };
      event.waitUntil = (p) => void done.push(p);
      event.data = { text: () => 'Asha answered Chai', json: () => ({ secret: 'Chai' }) };
      sw.dispatchEvent(event);
      await Promise.all(done);
      return calls.map(([t, o]) => ({ title: t, body: o?.body, tag: o?.tag }));
    });
    expect(shown).toEqual([{ title: 'Our Kahani', body: 'Your room needs attention', tag: 'room' }]);

    // Switching off removes it.
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
  });
});
