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
    await expect(partner.getByRole('heading', { name: "You're in" })).toBeVisible({ timeout: 15_000 });
    await expect(partner.locator('.emoji')).toHaveText(code);
    expect(new URL(partner.url()).hash).toBe('');

    // Reloading does not bring the fragment back, and the partner stays in the room.
    await partner.reload();
    expect(new URL(partner.url()).hash).toBe('');
    await partner.goto('/');
    await expect(partner.getByRole('link', { name: /Open today's card/ })).toBeVisible({ timeout: 15_000 });

    // The creator's phone notices the partner joined and forgets the invite link.
    await page.goto('/invite');
    await expect(page.getByRole('heading', { name: 'You’re both in' })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.invite')).toHaveCount(0);

    check();
    partnerCheck();
  });

  test('each new room gets a different key and safety code', async ({ page, newDevice }) => {
    const a = await createRoom(page);
    const b = await createRoom(await newDevice());
    expect(a.invite).not.toBe(b.invite);
    expect(a.code).not.toBe(b.code);
  });

  test('a link without the key says it is incomplete', async ({ page }) => {
    const check = await guard(page);
    await page.goto('/join/some-room');
    await expect(page.getByRole('heading', { name: 'This invite link is incomplete' })).toBeVisible();
    check();
  });

  test('a link with a damaged key says it is incomplete', async ({ page, newDevice }) => {
    const { invite } = await createRoom(page);
    const other = await newDevice();
    await other.goto(invite.slice(0, -5));
    await expect(other.getByRole('heading', { name: 'This invite link is incomplete' })).toBeVisible();
    expect(new URL(other.url()).hash).toBe('');
  });

  test('a swapped key cannot join: the server checks a proof of the real key', async ({ page, newDevice }) => {
    const { invite } = await createRoom(page);
    // Change the second-to-last character: it carries key bits (the last one is part padding).
    const swapped = invite.slice(0, -2) + (invite.slice(-2, -1) === 'A' ? 'B' : 'A') + invite.slice(-1);
    const other = await newDevice();
    await other.goto(swapped);
    await expect(other.getByRole('heading', { name: 'We could not open this room' })).toBeVisible({ timeout: 15_000 });
    await expect(other.getByText(/not valid/)).toBeVisible();
  });

  test('a third person cannot join, even with the real link', async ({ page, newDevice }) => {
    const { invite } = await createRoom(page);
    const partner = await newDevice();
    await partner.goto(invite);
    await expect(partner.getByRole('heading', { name: "You're in" })).toBeVisible({ timeout: 15_000 });
    const third = await newDevice();
    await third.goto(invite);
    await expect(third.getByText('This room already has two people.')).toBeVisible({ timeout: 15_000 });
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
