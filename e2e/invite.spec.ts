import { BACKEND_HOST, createRoom, expect, guard, INSTAGRAM_UA, keyOf, test } from './helpers';
import { finishSetup } from './flow';

/** A well-formed invite for a room that does not exist: enough for tests that never join. */
const FAKE_ROOM = '00000000-0000-4000-8000-000000000000';
const FAKE_INVITE = `/join/${FAKE_ROOM}#k1.${'A'.repeat(43)}`;

test.describe('invite flow', { tag: '@functional' }, () => {
  test('partner joins with the link: same safety code, key gone from the address bar, then their own setup', async ({ page, newDevice }) => {
    test.setTimeout(120_000);
    const check = await guard(page);
    const { invite, code } = await createRoom(page);
    expect(invite).toMatch(/\/join\/[A-Za-z0-9-]+#k1\.[A-Za-z0-9_-]{43}$/);
    expect(new URL(invite).origin).toBe(new URL(page.url()).origin);
    expect(code.trim().split(/\s+/)).toHaveLength(6);

    // The partner is on another device: a fresh context with no shared storage.
    const partner = await newDevice();
    const partnerCheck = await guard(partner);
    await partner.goto(invite);
    await expect(partner.getByRole('heading', { name: "You're in" })).toBeVisible({ timeout: 20_000 });
    await expect(partner.locator('.emoji')).toHaveText(code);
    expect(new URL(partner.url()).hash).toBe('');

    // Reloading does not bring the fragment back, and the partner stays in the room.
    await partner.reload();
    expect(new URL(partner.url()).hash).toBe('');
    await expect(partner.getByRole('heading', { name: "You're in" })).toBeVisible({ timeout: 20_000 });

    // Their own first run: first name, then Today with their own greeting.
    await partner.getByRole('link', { name: 'Continue →' }).click();
    await finishSetup(partner, 'Ravi');
    await expect(partner.getByRole('heading', { name: 'Namaste, Ravi' })).toBeVisible({ timeout: 20_000 });
    await partner.goto('/invite');
    await expect(partner.getByRole('heading', { name: 'You’re both in' })).toBeVisible({ timeout: 20_000 });
    await expect(partner.locator('.emoji')).toHaveText(code);
    await expect(partner.locator('.invite')).toHaveCount(0);

    // The creator's phone notices the partner joined and forgets the invite link.
    await page.goto('/invite');
    await expect(page.getByRole('heading', { name: 'You’re both in' })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.invite')).toHaveCount(0);
    await expect(page.locator('.emoji')).toHaveText(code);

    check();
    partnerCheck();
  });

  test('each new room gets a different key and safety code', async ({ page, newDevice }) => {
    test.setTimeout(90_000);
    const [a, b] = await Promise.all([createRoom(page), newDevice().then((p) => createRoom(p))]);
    expect(a.roomId).not.toBe(b.roomId);
    expect(keyOf(a.invite)).not.toBe(keyOf(b.invite));
    expect(a.code).not.toBe(b.code);
  });

  test('a link without the key says it is incomplete', async ({ page }) => {
    const check = await guard(page);
    await page.goto('/join/some-room');
    await expect(page.getByRole('heading', { name: 'This invite link is incomplete' })).toBeVisible();
    await page.goto(`/join/${FAKE_ROOM}`);
    await expect(page.getByRole('heading', { name: 'This invite link is incomplete' })).toBeVisible();
    check();
  });

  test('a link with a damaged key says it is incomplete, and the damaged key is still removed', async ({ page }) => {
    await page.goto(FAKE_INVITE.slice(0, -5));
    await expect(page.getByRole('heading', { name: 'This invite link is incomplete' })).toBeVisible();
    expect(new URL(page.url()).hash).toBe('');
  });

  test('a swapped key cannot join, and a third person cannot join even with the real link', async ({ page, newDevice }) => {
    test.setTimeout(90_000);
    const { invite } = await createRoom(page);
    // Change the second-to-last character: it carries key bits (the last one is part padding).
    const swapped = invite.slice(0, -2) + (invite.slice(-2, -1) === 'A' ? 'B' : 'A') + invite.slice(-1);
    const other = await newDevice();
    await other.goto(swapped);
    await expect(other.getByRole('heading', { name: 'We could not open this room' })).toBeVisible({ timeout: 20_000 });
    await expect(other.getByText(/not valid/)).toBeVisible();
    expect(new URL(other.url()).hash).toBe('');
    await other.getByRole('link', { name: 'Go to today' }).click();
    await expect(other.getByRole('button', { name: 'Create a room' })).toBeVisible({ timeout: 20_000 });

    const partner = await newDevice();
    await partner.goto(invite);
    await expect(partner.getByRole('heading', { name: "You're in" })).toBeVisible({ timeout: 20_000 });
    const third = await newDevice();
    await third.goto(invite);
    await expect(third.getByRole('heading', { name: 'We could not open this room' })).toBeVisible({ timeout: 20_000 });
    await expect(third.getByText('This room already has two people.')).toBeVisible();
  });

  test('Instagram in-app browser is asked to open Safari or Chrome and the key is left alone', async ({ newDevice }) => {
    const ig = await newDevice({ userAgent: INSTAGRAM_UA });
    const backend: string[] = [];
    ig.on('request', (r) => {
      if (new URL(r.url()).host === BACKEND_HOST) backend.push(r.url());
    });
    await ig.goto(FAKE_INVITE);
    await expect(ig.getByRole('heading', { name: 'Open this in Safari or Chrome' })).toBeVisible();
    // Not consumed: "Open in browser" must carry the full link across.
    expect(new URL(ig.url()).hash).toMatch(/^#k1\./);
    await expect(ig.locator('.emoji')).toHaveCount(0);
    await expect(ig.getByRole('button', { name: 'Copy the link instead' })).toBeVisible();
    // Nothing was looked up: no sign-in, no room, no key handled.
    expect(backend).toEqual([]);
  });
});
