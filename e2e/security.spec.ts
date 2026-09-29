import type { Page } from '@playwright/test';
import { BACKEND_HOST, createRoom, expect, guard, isViteDevServer, keyOf, recordBackendTraffic, test } from './helpers';
import { finishSetup } from './flow';

/** Everything this page keeps in plain browser storage, plus what the address bar and title show. */
function storageDump(page: Page) {
  return page.evaluate(() =>
    [
      document.title,
      document.cookie,
      document.referrer,
      location.href,
      ...Object.keys(localStorage).map((n) => n + localStorage.getItem(n)),
      ...Object.keys(sessionStorage).map((n) => n + sessionStorage.getItem(n)),
    ].join('\n'),
  );
}

test.describe('security', { tag: '@security' }, () => {
  test('served with strict security headers, and only the one backend allowed', async ({ request, baseURL }) => {
    // Only `vite preview` (the CI run) and Cloudflare Pages serve public/_headers; the dev server does not.
    test.skip(await isViteDevServer(request), 'The Vite dev server serves no security headers');
    for (const path of ['/', '/join/some-room', '/card/day/1', '/sw.js']) {
      const res = await request.get(path);
      expect(res.ok(), path).toBe(true);
      const h = res.headers();
      const csp = h['content-security-policy'] ?? '';
      const directives = Object.fromEntries(
        csp
          .split(';')
          .map((d) => d.trim().split(/\s+/))
          .filter((d) => d[0])
          .map(([name, ...values]) => [name!, values]),
      );
      expect(directives['default-src'], path).toEqual(["'self'"]);
      expect(directives['script-src'], path).toEqual(["'self'"]);
      expect(directives['style-src'], path).toEqual(["'self'"]);
      expect(directives['connect-src'], path).toEqual(["'self'", `https://${BACKEND_HOST}`]);
      expect(directives['object-src'], path).toEqual(["'none'"]);
      expect(directives['base-uri'], path).toEqual(["'none'"]);
      expect(directives['frame-ancestors'], path).toEqual(["'none'"]);
      // No other host anywhere in the policy: only 'self', blob:, data: and the one backend.
      for (const [name, values] of Object.entries(directives)) {
        for (const v of values) expect([`'self'`, `'none'`, 'blob:', 'data:', `https://${BACKEND_HOST}`], `${path} ${name}`).toContain(v);
      }
      expect(csp).not.toContain('unsafe-inline');
      expect(csp).not.toContain('unsafe-eval');
      expect(h['referrer-policy']).toBe('no-referrer');
      expect(h['x-content-type-options']).toBe('nosniff');
      expect(h['x-frame-options']).toBe('DENY');
      expect(h['cross-origin-opener-policy']).toBe('same-origin');
      expect(h['permissions-policy']).toContain('camera=()');
      expect(h['permissions-policy']).toContain('geolocation=()');
      expect(h['permissions-policy']).toContain('microphone=(self)');
      // HTTPS-only headers are dropped for plain-http local preview (vite.config.ts).
      if (baseURL?.startsWith('https:')) {
        expect(h['strict-transport-security']).toContain('max-age=');
        expect(csp).toContain('upgrade-insecure-requests');
      }
    }
  });

  test('the page has no inline scripts and loads scripts only from its own origin', async ({ page, request }) => {
    const html = await (await request.get('/')).text();
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    expect(scripts.length).toBeGreaterThan(0);
    for (const [, attrs, body] of scripts) {
      expect(attrs, 'every script has a src').toMatch(/\bsrc=/);
      expect(body!.trim(), 'no inline script body').toBe('');
      const src = /\bsrc="([^"]+)"/.exec(attrs!)?.[1] ?? '';
      expect(src, 'same-origin script').toMatch(/^\/(?!\/)/);
    }
    expect(html).not.toMatch(/\son[a-z]+=/i); // no inline event handlers

    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Create a room' })).toBeVisible({ timeout: 20_000 });
    const origin = new URL(page.url()).origin;
    const live = await page.evaluate(() =>
      [...document.scripts].map((s) => ({ src: s.src, inline: !s.src && s.textContent!.trim().length > 0 })),
    );
    for (const s of live) {
      expect(s.inline).toBe(false);
      expect(new URL(s.src).origin).toBe(origin);
    }
  });

  test('the invite key stays in the fragment: never sent, never stored, never logged, and removed from the address bar', async ({
    page,
    newDevice,
  }) => {
    test.setTimeout(120_000);
    const creatorLogs: string[] = [];
    page.on('console', (m) => creatorLogs.push(m.text()));
    const creatorTraffic: string[] = [];
    page.on('request', (r) => creatorTraffic.push(`${r.url()}\n${JSON.stringify(r.headers())}\n${r.postData() ?? ''}`));
    const { invite } = await createRoom(page);
    const key = keyOf(invite);
    expect(key).toHaveLength(43);

    const partner = await newDevice();
    const logs: string[] = [];
    partner.on('console', (m) => logs.push(m.text()));
    const traffic: string[] = [];
    partner.on('request', (r) => traffic.push(`${r.url()}\n${JSON.stringify(r.headers())}\n${r.postData() ?? ''}`));
    await partner.goto(invite);
    await expect(partner.getByRole('heading', { name: "You're in" })).toBeVisible({ timeout: 20_000 });
    // Imported, then removed from the address bar and from history.
    expect(new URL(partner.url()).hash).toBe('');
    expect(await partner.evaluate(() => location.hash)).toBe('');
    await partner.getByRole('link', { name: 'Continue →' }).click();
    await finishSetup(partner, 'Ravi');
    await expect(partner.getByRole('heading', { name: 'Namaste, Ravi' })).toBeVisible({ timeout: 20_000 });

    // Browsers never send the fragment; make sure the app does not either (URL, headers or body).
    for (const sent of [...traffic, ...creatorTraffic]) expect(sent, 'a request carried the invite key').not.toContain(key);
    expect(traffic.some((t) => t.includes('#k1.'))).toBe(false);
    expect([...logs, ...creatorLogs].join('\n'), 'the key was logged').not.toContain(key);
    expect(await storageDump(partner), 'the key was stored in plain storage').not.toContain(key);
    expect(await storageDump(page), 'the creator stored the key in plain storage').not.toContain(key);
  });

  test('nothing anyone writes reaches the backend in plain text', async ({ page, newDevice }) => {
    test.setTimeout(180_000);
    const aTraffic = recordBackendTraffic(page);
    const { invite } = await createRoom(page, { name: 'Tanvika', country: 'GB' });
    const b = await newDevice();
    const bTraffic = recordBackendTraffic(b);
    await b.goto(invite);
    await expect(b.getByRole('heading', { name: "You're in" })).toBeVisible({ timeout: 20_000 });
    await b.getByRole('link', { name: 'Continue →' }).click();
    await finishSetup(b, 'Omkareshwar');
    await expect(b.getByRole('heading', { name: 'Namaste, Omkareshwar' })).toBeVisible({ timeout: 20_000 });

    // The room hashtag, typed by hand.
    await page.goto('/');
    await page.getByLabel('Or type your own').fill('#CanaryTagQz');
    await page.getByRole('button', { name: 'Suggest this one' }).click();
    await expect(page.getByText('You suggested #CanaryTagQz')).toBeVisible({ timeout: 20_000 });

    // An answer with a why, from the invited person (who goes first).
    await b.goto('/card/day/1');
    await b.getByRole('button', { name: 'Coffee' }).click({ timeout: 20_000 });
    await b.getByLabel(/Why\?/).fill('whyCanary4471');
    await b.getByRole('button', { name: 'Seal my answer' }).click();
    await expect(b.getByText('Sealed.')).toBeVisible({ timeout: 20_000 });

    // A card made for the partner.
    await page.goto('/add-a-card');
    await page.getByLabel('Your question').fill('questionCanary9913?');
    await page.getByLabel('Option 1').fill('optCanaryOne');
    await page.getByLabel('Option 2').fill('optCanaryTwo');
    await page.getByRole('button', { name: 'optCanaryOne' }).click();
    await page.getByRole('button', { name: 'Send it over 💌' }).click();
    await expect(page.getByText('questionCanary9913?')).toBeVisible({ timeout: 20_000 });

    // A Story Relay line.
    await b.goto('/story-relay');
    await b.getByLabel(/Your sentence/).fill('storyCanary5520 went to the moon.');
    await b.getByRole('button', { name: 'Add ✍️' }).click();
    await expect(b.getByText('storyCanary5520 went to the moon.')).toBeVisible({ timeout: 20_000 });

    const everything = [...aTraffic, ...bTraffic].join('\n');
    expect(everything.length).toBeGreaterThan(0);
    for (const canary of [
      'Tanvika',
      'Omkareshwar',
      'CanaryTagQz',
      'whyCanary4471',
      'questionCanary9913',
      'optCanary',
      'storyCanary5520',
      '"coffee"',
      '"GB"',
      'Namaste',
      keyOf(invite),
    ]) {
      expect(everything, `"${canary}" was sent to the server`).not.toContain(canary);
    }
  });

  test('no CSP violations, errors or third-party requests across create, join and play', async ({ page, newDevice }) => {
    test.setTimeout(120_000);
    const check = await guard(page);
    const { invite } = await createRoom(page);
    const b = await newDevice();
    const bCheck = await guard(b);
    await b.goto(invite);
    await expect(b.getByRole('heading', { name: "You're in" })).toBeVisible({ timeout: 20_000 });
    await b.getByRole('link', { name: 'Continue →' }).click();
    await finishSetup(b, 'Ravi');
    for (const path of ['/', '/card/day/1', '/packs', '/movie', '/gentle', '/saved', '/room', '/privacy']) {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible({ timeout: 20_000 });
    }
    await b.goto('/join/some-room');
    await b.goto('/');
    await expect(b.getByRole('heading', { name: 'Namaste, Ravi' })).toBeVisible({ timeout: 20_000 });
    check();
    bCheck();
  });

  test('the page cannot be framed', async ({ page, request }) => {
    test.skip(await isViteDevServer(request), 'Framing is blocked by headers the Vite dev server does not serve');
    await page.goto('/');
    const blocked = await page.evaluate(async () => {
      const frame = document.createElement('iframe');
      frame.src = '/';
      document.body.append(frame);
      await new Promise((r) => setTimeout(r, 1500));
      try {
        return !frame.contentDocument?.querySelector('#app');
      } catch {
        return true;
      }
    });
    expect(blocked).toBe(true);
  });
});
