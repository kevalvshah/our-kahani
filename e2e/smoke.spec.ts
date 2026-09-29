import { expect, guard, INSTAGRAM_UA, isViteDevServer, test } from './helpers';

// Safe to run against production: loads the public screens and checks the trust rules, but
// never creates a room, so no test data is left in the real database.

/** Screens that open without a room, with the heading each one shows. */
const PUBLIC_PAGES: Record<string, string | RegExp> = {
  '/': /From pehli baat/,
  '/privacy': "Even the developer can't read it",
  '/look': 'Make it ours',
  '/recover': 'Enter your room',
  '/invite': 'Invite & safety code',
  '/join/some-room': 'This invite link is incomplete',
};

test.describe('smoke', { tag: '@smoke' }, () => {
  test('the public screens load with no errors, CSP violations or third-party requests', async ({ page }) => {
    test.setTimeout(90_000);
    const check = await guard(page);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Create a room' })).toBeVisible({ timeout: 20_000 });
    for (const [path, heading] of Object.entries(PUBLIC_PAGES)) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading }), path).toBeVisible({ timeout: 20_000 });
    }
    // Deep links into a room fall back to the welcome screen on a device without one.
    await page.goto('/card/day/1');
    await expect(page.getByRole('button', { name: 'Create a room' })).toBeVisible({ timeout: 20_000 });
    check();
  });

  test('served with strict security headers, and only the one backend allowed', async ({ request }) => {
    test.skip(await isViteDevServer(request), 'The Vite dev server serves no security headers');
    const res = await request.get('/');
    expect(res.ok()).toBe(true);
    const csp = res.headers()['content-security-policy'] ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toMatch(/connect-src 'self' https:\/\/[a-z0-9]+\.supabase\.co;/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
    expect(res.headers()['referrer-policy']).toBe('no-referrer');
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
  });

  test('the app manifest and service worker are served from this origin', async ({ request, baseURL }) => {
    const manifest = await request.get('/manifest.webmanifest');
    expect(manifest.ok()).toBe(true);
    const m = (await manifest.json()) as { name: string; start_url: string; display: string; icons: { src: string }[] };
    expect(m.name).toBe('Our Kahani');
    expect(m.start_url).toBe('/');
    expect(m.display).toBe('standalone');
    for (const icon of m.icons) {
      expect(icon.src, 'icons are same-origin').toMatch(/^\/(?!\/)/);
      expect((await request.get(icon.src)).ok(), icon.src).toBe(true);
    }

    const sw = await request.get('/sw.js');
    expect(sw.ok()).toBe(true);
    expect(sw.headers()['content-type']).toContain('javascript');
    const code = await sw.text();
    expect(code).toContain('addEventListener');
    expect(code, 'the service worker loads nothing from other hosts').not.toMatch(/https?:\/\//);
    // Cloudflare Pages serves the service worker uncached so updates land (public/_headers).
    if (baseURL?.startsWith('https:')) expect(sw.headers()['cache-control']).toContain('no-cache');
  });

  test('the photo store purge endpoint answers (200 with R2, 503 before it is switched on)', async ({ request, baseURL }) => {
    const host = new URL(baseURL!).hostname;
    test.skip(host === 'localhost' || host === '127.0.0.1', 'Pages Functions (functions/media) only run on Cloudflare');
    const res = await request.post('/media/purge');
    expect([200, 503]).toContain(res.status());
    if (res.status() === 200) {
      const body = (await res.json()) as { rooms: number; removed: number };
      expect(typeof body.rooms).toBe('number');
      expect(typeof body.removed).toBe('number');
    }
  });

  test('the Instagram in-app browser gate shows', async ({ newDevice }) => {
    const ig = await newDevice({ userAgent: INSTAGRAM_UA });
    await ig.goto('/');
    await expect(ig.getByRole('heading', { name: 'Open this in Safari or Chrome' })).toBeVisible();
  });
});
