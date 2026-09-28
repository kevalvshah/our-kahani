import type { Page, Request } from '@playwright/test';
import { BACKEND_HOST, createRoom, expect, test } from './helpers';

/** Every request this page sends to the backend: URL plus body. */
function recordBackendTraffic(page: Page) {
  const sent: string[] = [];
  page.on('request', (r: Request) => {
    if (new URL(r.url()).host === BACKEND_HOST) sent.push(`${r.method()} ${r.url()}\n${r.postData() ?? ''}`);
  });
  return sent;
}

async function answer(page: Page, label: string) {
  await page.goto('/card');
  await page.getByRole('button', { name: label }).click();
  await page.getByRole('button', { name: /Seal my answer|Change my answer/ }).click();
}

test.describe('answers and the reveal', { tag: '@functional' }, () => {
  test('answers stay hidden until both reply, then open on both phones; nothing readable is ever sent', async ({
    page,
    newDevice,
  }) => {
    test.setTimeout(90_000);
    const creatorTraffic = recordBackendTraffic(page);
    const { invite } = await createRoom(page);
    const key = invite.split('#k1.')[1]!;

    const partner = await newDevice();
    const partnerTraffic = recordBackendTraffic(partner);
    await partner.goto(invite);
    await expect(partner.getByRole('heading', { name: "You're in" })).toBeVisible({ timeout: 15_000 });

    // Creator answers first and waits.
    await answer(page, 'Kind words');
    await expect(page.getByRole('status')).toContainText('Sealed. Waiting for your person', { timeout: 15_000 });

    // The partner sees that the creator answered, but not what.
    await partner.goto('/card');
    await expect(partner.getByRole('status')).toContainText('Your person has answered', { timeout: 15_000 });
    await expect(partner.getByText('Kind words 💬')).toHaveCount(0);

    // Partner answers differently; both can now open both answers.
    await partner.getByRole('button', { name: 'Hugs' }).click();
    await partner.getByRole('button', { name: 'Seal my answer' }).click();
    await partner.getByRole('button', { name: /open both/ }).click({ timeout: 15_000 });
    await expect(partner.getByText('Two different picks. Good to know 😄')).toBeVisible();
    await expect(partner.locator('.reveal-theirs')).toContainText('Kind words');
    await expect(partner.locator('.reveal-mine')).toContainText('Hugs');

    await page.reload();
    await page.getByRole('button', { name: /open both/ }).click({ timeout: 15_000 });
    await expect(page.locator('.reveal-theirs')).toContainText('Hugs');
    // Once both have answered, answers are locked.
    await expect(page.getByRole('button', { name: 'Kind words' })).toBeDisabled();

    // Plaintext canary: no answer, label or key ever went over the wire, in any request.
    const everything = [...creatorTraffic, ...partnerTraffic].join('\n');
    expect(everything.length).toBeGreaterThan(0);
    for (const canary of ['Kind words', 'Hugs', '"words"', '"hugs"', 'choice', key]) {
      expect(everything, `"${canary}" was sent to the server`).not.toContain(canary);
    }
  });

  test('an answer can be changed until the partner answers', async ({ page }) => {
    await createRoom(page);
    await answer(page, 'Time together');
    await expect(page.getByRole('status')).toContainText('Sealed', { timeout: 15_000 });
    await page.getByRole('button', { name: 'Small help' }).click();
    await page.getByRole('button', { name: 'Change my answer' }).click();
    await expect(page.getByRole('status')).toContainText('Sealed', { timeout: 15_000 });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Small help' })).toHaveAttribute('aria-pressed', 'true', {
      timeout: 15_000,
    });
  });

  test('erasing the room removes it for the partner too', async ({ page, newDevice }) => {
    const { invite } = await createRoom(page);
    const partner = await newDevice();
    await partner.goto(invite);
    await expect(partner.getByRole('heading', { name: "You're in" })).toBeVisible({ timeout: 15_000 });

    await page.goto('/room');
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Erase the room' }).click();
    await expect(page.getByRole('button', { name: 'Create a room' })).toBeVisible({ timeout: 15_000 });

    await partner.goto('/');
    await expect(partner.getByRole('button', { name: 'Create a room' })).toBeVisible({ timeout: 15_000 });
  });
});
