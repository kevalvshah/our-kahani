import { expect, test } from './helpers';
import { createAndSetUp, joinAndSetUp } from './flow';
import type { Page } from '@playwright/test';

// Seasons and the together tools, with two people. Answers stay sealed until both reply;
// Dil ki Baat, the pause, the jar and dreams reach the partner, and nothing readable is sent.

async function turnsOff(page: Page) {
  await page.goto('/room');
  await page.getByRole('switch', { name: 'Take turns answering' }).click();
  await expect(page.getByRole('switch', { name: 'Take turns answering' })).toHaveAttribute('aria-checked', 'false', { timeout: 20_000 });
}

test.describe('seasons and together tools', { tag: '@journey' }, () => {
  test('Then vs Now, Dil ki Baat, the pause, the Shukriya jar and dreams', async ({ page, newDevice }) => {
    test.setTimeout(240_000);
    const { invite } = await createAndSetUp(page, 'Asha');
    const b = await newDevice();
    await joinAndSetUp(b, invite, 'Ravi');
    await turnsOff(page);

    // Season 1, card 1, both answer; Season 2 opens with a Then vs Now card that shows them.
    for (const [p, pick] of [[page, 'Chai'], [b, 'Coffee']] as const) {
      await p.goto('/card/day/1');
      await p.getByRole('button', { name: pick }).click({ timeout: 20_000 });
      await p.getByRole('button', { name: 'Seal my answer' }).click();
      await expect(p.getByText(/Sealed\.|open both/)).toBeVisible({ timeout: 20_000 });
    }
    await page.goto('/seasons');
    await expect(page.getByRole('heading', { name: 'Your seasons' })).toBeVisible({ timeout: 20_000 });
    await page.goto('/card/season/s2/1');
    await expect(page.locator('.then-block')).toContainText('Chai', { timeout: 20_000 });
    await expect(page.locator('.then-block')).toContainText('Coffee');

    // Dil ki Baat: a soft note and a one-tap reply.
    await page.goto('/dil-ki-baat');
    await page.getByRole('button', { name: /Tell Ravi how you feel/ }).click();
    await page.locator('.chip-row').first().getByRole('button').first().click();
    await page.getByRole('group', { name: 'What would help' }).getByRole('button').first().click();
    await page.getByRole('button', { name: /Send softly/ }).click();
    await expect(page.getByText(/can reply whenever they are ready/)).toBeVisible({ timeout: 20_000 });
    await b.goto('/dil-ki-baat');
    await b.getByRole('group', { name: 'Reply' }).getByRole('button').first().click({ timeout: 20_000 });
    await expect(b.getByText(/You replied:/)).toBeVisible({ timeout: 20_000 });

    // The pause shows calmly on the partner's screen.
    await page.getByRole('button', { name: /I need 20 minutes/ }).click();
    await b.goto('/');
    await expect(b.locator('.pause-banner')).toContainText('not going anywhere', { timeout: 20_000 });

    // Shukriya jar: sealed until both write, then open.
    await page.goto('/shukriya');
    await page.locator('#thanks').fill('the chai when I was tired');
    await page.getByRole('button', { name: /Drop it in the jar/ }).click();
    await expect(page.getByText(/It opens when Ravi adds theirs/)).toBeVisible({ timeout: 20_000 });
    await b.goto('/shukriya');
    await b.locator('#thanks').fill('the long call on Sunday');
    await b.getByRole('button', { name: /Drop it in the jar/ }).click();
    await expect(b.getByText("This week's jar is open 💛")).toBeVisible({ timeout: 20_000 });
    await expect(b.locator('.reveal')).toContainText('the chai when I was tired');

    // Dreams board.
    await b.goto('/dreams');
    await b.locator('#dream').fill('see the Northern Lights');
    await b.getByRole('button', { name: /Add to the board/ }).click();
    await page.goto('/dreams');
    await expect(page.getByText('see the Northern Lights')).toBeVisible({ timeout: 20_000 });

    // The "hard or harmful" page is reachable and sends nothing.
    await page.goto('/hard-or-harmful');
    await expect(page.getByRole('heading', { name: 'Is this hard, or is this harmful?' })).toBeVisible();
    await expect(page.getByText(/leaving is not failing/)).toBeVisible();
  });
});
