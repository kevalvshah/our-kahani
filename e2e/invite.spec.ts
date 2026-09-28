import { createRoom, expect, guard, INSTAGRAM_UA, test } from './helpers';

test.describe('invite flow', { tag: '@functional' }, () => {
  test('creator and partner see the same safety code; the key leaves the address bar', async ({ page, newDevice }) => {
    const check = await guard(page);
    const { invite, code } = await createRoom(page);
    expect(invite).toMatch(/\/join\/[A-Za-z0-9-]+#k1\.[A-Za-z0-9_-]{43}$/);
    expect(Array.from(code.replace(/ /g, ''))).toHaveLength(6);

    // The partner is on another device: a fresh context with no shared storage.
    const partner = await newDevice();
    const partnerCheck = await guard(partner);
    await partner.goto(invite);
    await expect(partner.getByRole('heading', { name: "You're in" })).toBeVisible();
    await expect(partner.locator('.emoji')).toHaveText(code);
    expect(new URL(partner.url()).hash).toBe('');

    // Reloading does not bring the fragment back either.
    await partner.reload();
    expect(new URL(partner.url()).hash).toBe('');

    check();
    partnerCheck();
  });

  test('each new room gets a different key and safety code', async ({ page }) => {
    const a = await createRoom(page);
    const b = await createRoom(page);
    expect(a.invite).not.toBe(b.invite);
    expect(a.code).not.toBe(b.code);
  });

  test('a link without the key says it is incomplete', async ({ page }) => {
    const check = await guard(page);
    await page.goto('/join/some-room');
    await expect(page.getByRole('heading', { name: 'This invite link is incomplete' })).toBeVisible();
    check();
  });

  test('a link with a damaged key says it is incomplete', async ({ page }) => {
    const { invite } = await createRoom(page);
    await page.goto(invite.slice(0, -5));
    await expect(page.getByRole('heading', { name: 'This invite link is incomplete' })).toBeVisible();
    expect(new URL(page.url()).hash).toBe('');
  });

  test('a swapped key gives a different safety code', async ({ page, newDevice }) => {
    const { invite, code } = await createRoom(page);
    // Change the second-to-last character: it carries key bits (the last one is part padding).
    const swapped = invite.slice(0, -2) + (invite.slice(-2, -1) === 'A' ? 'B' : 'A') + invite.slice(-1);
    const other = await newDevice();
    await other.goto(swapped);
    await expect(other.locator('.emoji')).toBeVisible();
    expect(await other.locator('.emoji').textContent()).not.toBe(code);
  });

  test('Instagram in-app browser is asked to open Safari or Chrome and the key is left alone', async ({ page, newDevice }) => {
    const { invite } = await createRoom(page);
    const ig = await newDevice({ userAgent: INSTAGRAM_UA });
    await ig.goto(invite);
    await expect(ig.getByRole('heading', { name: 'Open this in Safari or Chrome' })).toBeVisible();
    // Not consumed: "Open in browser" must carry the full link across.
    expect(new URL(ig.url()).hash).toMatch(/^#k1\./);
    await expect(ig.locator('.emoji')).toHaveCount(0);
  });
});
