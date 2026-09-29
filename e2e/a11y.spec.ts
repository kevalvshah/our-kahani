import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { expect, SCREEN_NAMES, test, type Screen } from './helpers';

/** Tests that visit every screen in one go need longer than the default 30 s. */
const LOOP_TIMEOUT = 240_000;
/** The first screen in a worker also builds its rooms (slow on WebKit). */
const SCREEN_TIMEOUT = 120_000;

/** Presses Tab until the target has focus (at most `max` presses). */
async function tabTo(page: Page, target: Locator, max = 40) {
  for (let i = 0; i < max && !(await target.evaluate((el) => el === document.activeElement).catch(() => false)); i++) {
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
  return target;
}

test.describe('accessibility', { tag: '@a11y' }, () => {
  for (const screen of SCREEN_NAMES) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${screen} (${scheme}) has no WCAG 2.2 AA violations`, async ({ stage }) => {
        test.setTimeout(SCREEN_TIMEOUT);
        const shown = await stage.open(screen, { colorScheme: scheme });
        const results = await new AxeBuilder({ page: shown })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`)).toEqual([]);
      });
    }
  }

  test('create a room and get through first-run setup with the keyboard alone', async ({ page, browserName }) => {
    // WebKit only tabs to buttons when the "Press Tab to highlight" setting is on.
    test.skip(browserName === 'webkit', 'WebKit does not tab to buttons by default');
    test.setTimeout(90_000);
    await page.goto('/');
    await tabTo(page, page.getByRole('button', { name: 'Create a room' }));
    await page.keyboard.press('Enter');

    // First name, typed and sent with the keyboard.
    const name = page.getByLabel('Your first name');
    await expect(name).toBeVisible({ timeout: 20_000 });
    await tabTo(page, name);
    await page.keyboard.type('Asha');
    await tabTo(page, page.getByRole('button', { name: 'Start Pehli Baat' }));
    await page.keyboard.press('Enter');

    // The invite screen: focus moves to its heading, and the next Tab reaches "Copy link".
    const heading = page.getByRole('heading', { name: 'Send this to your person' });
    await expect(heading).toBeFocused({ timeout: 20_000 });
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Copy link' })).toBeFocused();
  });

  test('focus is visible on buttons', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit does not tab to buttons by default');
    await page.goto('/');
    const create = await tabTo(page, page.getByRole('button', { name: 'Create a room' }));
    expect(await create.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
  });

  test('a skip link jumps to the content', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit does not tab to links by default');
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await expect(skip).toHaveAttribute('href', '#main');
    await expect(page.locator('#main')).toBeAttached();
  });

  test('every screen has a language and exactly one h1', async ({ stage }) => {
    test.setTimeout(LOOP_TIMEOUT);
    for (const screen of SCREEN_NAMES) {
      const shown = await stage.open(screen);
      await expect(shown.locator('html'), screen).toHaveAttribute('lang', 'en');
      await expect(shown.locator('h1:visible'), screen).toHaveCount(1);
    }
  });
});

test.describe('responsive layout', { tag: '@responsive' }, () => {
  const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

  for (const width of [320, 375, 768, 1280]) {
    test(`no sideways scrolling at ${width}px`, async ({ stage }) => {
      test.setTimeout(LOOP_TIMEOUT);
      for (const screen of SCREEN_NAMES) {
        const shown = await stage.open(screen, { width });
        expect.soft(await overflow(shown), `${screen} at ${width}px`).toBeLessThanOrEqual(0);
      }
    });
  }

  test('touch targets are at least 44px tall on every screen', async ({ stage }) => {
    test.setTimeout(LOOP_TIMEOUT);
    for (const screen of SCREEN_NAMES) {
      const shown = await stage.open(screen);
      // Measure every visible target on the screen in one pass.
      const small = await shown.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('button, .tab, .side-link, .back, .row-link, .btn, input.field, select')]
          .filter((el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden')
          .map((el) => ({ name: (el.textContent || el.getAttribute('aria-label') || el.id).trim(), height: Math.round(el.getBoundingClientRect().height) }))
          .filter((t) => t.height < 44),
      );
      expect(small, screen).toEqual([]);
    }
  });

  test('phones get bottom tabs; laptops get the sidebar instead', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/look');
    const tabs = page.getByRole('navigation', { name: 'Main' });
    const sidebar = page.getByRole('navigation', { name: 'All screens' });
    await expect(tabs).toBeVisible();
    await expect(sidebar).toBeHidden();
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(sidebar).toBeVisible();
    await expect(tabs).toBeHidden();
  });
});
