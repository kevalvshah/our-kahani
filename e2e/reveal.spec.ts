import { createRoom, expect, keyOf, recordBackendTraffic, setTakeTurns, test } from './helpers';
import { joinAndSetUp } from './flow';

test.describe('answers and the reveal', { tag: '@functional' }, () => {
  test('the invited person answers first; answers stay hidden until both reply, then open on both phones; nothing readable is sent', async ({
    page,
    newDevice,
  }) => {
    test.setTimeout(150_000);
    const creatorTraffic = recordBackendTraffic(page);
    const { invite } = await createRoom(page, { name: 'Asha' });
    const partner = await newDevice();
    const partnerTraffic = recordBackendTraffic(partner);
    await joinAndSetUp(partner, invite, 'Ravi');
    await expect(partner.getByRole('heading', { name: 'Namaste, Ravi' })).toBeVisible({ timeout: 20_000 });

    // By default the invited person goes first: the creator cannot answer yet.
    await page.goto('/card/day/1');
    await expect(page.getByText('Ravi goes first on this one 💭', { exact: false })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Chai' })).toHaveCount(0);

    // Ravi answers, with a one-line why, and waits.
    await partner.goto('/card/day/1');
    await partner.getByRole('button', { name: 'Coffee' }).click();
    await partner.getByLabel(/Why\?/).fill('Filter kaapi forever');
    await partner.getByRole('button', { name: 'Seal my answer' }).click();
    await expect(partner.getByRole('status').filter({ hasText: 'Sealed.' })).toContainText('Waiting for Asha', { timeout: 20_000 });

    // Asha's turn opens. She sees that Ravi answered, but not what.
    await page.reload();
    await expect(page.getByText('Ravi is in 💭 Your turn.', { exact: false })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Filter kaapi')).toHaveCount(0);
    await expect(page.locator('.reveal-theirs')).toHaveCount(0);

    // Asha answers differently; now both can open both answers.
    await page.getByRole('button', { name: 'Chai' }).click();
    await page.getByLabel(/Why\?/).fill('Adrak wali');
    await page.getByRole('button', { name: 'Seal my answer' }).click();
    await page.getByRole('button', { name: 'Ravi has answered · open both →' }).click({ timeout: 20_000 });
    await expect(page.getByText('Two different picks. Good to know 😄')).toBeVisible();
    await expect(page.locator('.reveal-theirs')).toContainText('Coffee');
    await expect(page.locator('.reveal-theirs')).toContainText('Filter kaapi forever');
    await expect(page.locator('.reveal-mine')).toContainText('Chai');
    // Once both have answered there is nothing left to change.
    await expect(page.getByRole('button', { name: /Seal my answer|Change my answer/ })).toHaveCount(0);

    await partner.reload();
    await partner.getByRole('button', { name: 'Asha has answered · open both →' }).click({ timeout: 20_000 });
    await expect(partner.locator('.reveal-theirs')).toContainText('Chai');
    await expect(partner.locator('.reveal-theirs')).toContainText('Adrak wali');

    // Plaintext canary: no name, answer, why or key ever went over the wire, in any request.
    const everything = [...creatorTraffic, ...partnerTraffic].join('\n');
    expect(everything.length).toBeGreaterThan(0);
    for (const canary of ['Asha', 'Ravi', 'Filter kaapi', 'Adrak', 'Coffee', '"chai"', '"coffee"', '"pick"', keyOf(invite)]) {
      expect(everything, `"${canary}" was sent to the server`).not.toContain(canary);
    }
  });

  test('with turns off, the creator can go first and change the answer until the partner answers', async ({ page }) => {
    test.setTimeout(90_000);
    await createRoom(page);
    await setTakeTurns(page, false);
    await page.goto('/card/day/1');
    await expect(page.getByText('goes first on this one')).toHaveCount(0);
    await page.getByRole('button', { name: 'Chai' }).click({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Seal my answer' }).click();
    await expect(page.getByText('Sealed.')).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'Coffee' }).click();
    await page.getByRole('button', { name: 'Change my answer' }).click();
    await expect(page.getByText('Sealed.')).toBeVisible({ timeout: 20_000 });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Coffee' })).toHaveAttribute('aria-pressed', 'true', { timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Chai' })).toHaveAttribute('aria-pressed', 'false');

    // Today counts it as answered, with no streak or score.
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Day 1, answered' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('1 of 14 answered · No streaks. Skip any day, no guilt.')).toBeVisible();
  });
});
