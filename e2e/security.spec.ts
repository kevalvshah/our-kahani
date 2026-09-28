import { createRoom, expect, guard, test } from './helpers';

test.describe('security', { tag: '@security' }, () => {
  test('served with strict security headers', async ({ request }) => {
    for (const path of ['/', '/join/some-room']) {
      const res = await request.get(path);
      const h = res.headers();
      const csp = h['content-security-policy'] ?? '';
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("connect-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).not.toContain('unsafe-inline');
      expect(csp).not.toContain('unsafe-eval');
      expect(h['referrer-policy']).toBe('no-referrer');
      expect(h['x-content-type-options']).toBe('nosniff');
      expect(h['x-frame-options']).toBe('DENY');
    }
  });

  test('no CSP violations, errors or third-party requests across the whole flow', async ({ page }) => {
    const check = await guard(page);
    const { invite } = await createRoom(page);
    await page.goto(invite);
    await expect(page.getByRole('heading', { name: "You're in" })).toBeVisible();
    await page.goto('/join/some-room');
    check();
  });

  test('raw key material is never written to storage, cookies or the title', async ({ page }) => {
    const { invite } = await createRoom(page);
    const key = invite.split('#k1.')[1]!;
    await page.goto(invite);
    await expect(page.getByRole('heading', { name: "You're in" })).toBeVisible();
    const found = await page.evaluate((k) => {
      const dump = [
        document.title,
        document.cookie,
        document.referrer,
        location.href,
        ...Object.keys(localStorage).map((n) => n + localStorage.getItem(n)),
        ...Object.keys(sessionStorage).map((n) => n + sessionStorage.getItem(n)),
      ].join('\n');
      return dump.includes(k);
    }, key);
    expect(found).toBe(false);
  });

  test('the key never appears in the console', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (m) => logs.push(m.text()));
    const { invite } = await createRoom(page);
    await page.goto(invite);
    await expect(page.getByRole('heading', { name: "You're in" })).toBeVisible();
    const key = invite.split('#k1.')[1]!;
    expect(logs.join('\n')).not.toContain(key);
  });

  test('the page cannot be framed', async ({ page }) => {
    await page.goto('/');
    const blocked = await page.evaluate(async () => {
      const frame = document.createElement('iframe');
      frame.src = '/';
      document.body.append(frame);
      await new Promise((r) => setTimeout(r, 1000));
      try {
        return !frame.contentDocument?.querySelector('#app');
      } catch {
        return true;
      }
    });
    expect(blocked).toBe(true);
  });
});
