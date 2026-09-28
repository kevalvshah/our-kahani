import { expect, guard, INSTAGRAM_UA, PAGES, test } from './helpers';

// Safe to run against production: loads every screen and checks the trust rules, but never
// creates a room, so no test data is left in the real database.
test.describe('smoke', { tag: '@smoke' }, () => {
  test('every screen loads with no errors, CSP violations or third-party requests', async ({ page }) => {
    test.setTimeout(120_000);
    const check = await guard(page);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Create a room' })).toBeVisible();
    for (const [path, heading] of Object.entries(PAGES)) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    }
    check();
  });

  test('served with strict security headers, and only the one backend allowed', async ({ request }) => {
    const res = await request.get('/');
    const csp = res.headers()['content-security-policy'] ?? '';
    expect(csp).toContain("script-src 'self'");
    expect(csp).toMatch(/connect-src 'self' https:\/\/[a-z0-9]+\.supabase\.co;/);
    expect(csp).not.toContain('unsafe-inline');
    expect(res.headers()['referrer-policy']).toBe('no-referrer');
  });

  test('the Instagram in-app browser gate shows', async ({ newDevice }) => {
    const ig = await newDevice({ userAgent: INSTAGRAM_UA });
    await ig.goto('/');
    await expect(ig.getByRole('heading', { name: 'Open this in Safari or Chrome' })).toBeVisible();
  });
});
