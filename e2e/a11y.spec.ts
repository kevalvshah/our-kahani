import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { openScreen, SCREENS } from './helpers';

test.describe('accessibility', { tag: '@a11y' }, () => {
  for (const scheme of ['light', 'dark'] as const) {
    for (const screen of SCREENS) {
      test(`${screen} (${scheme}) has no WCAG 2.2 AA violations`, async ({ page, browser }) => {
        await page.emulateMedia({ colorScheme: scheme });
        const shown = await openScreen(screen, page, browser);
        await shown.emulateMedia({ colorScheme: scheme });
        const results = await new AxeBuilder({ page: shown })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
      });
    }
  }

  test('the main flow works with the keyboard alone', async ({ page, browserName }) => {
    // WebKit only tabs to buttons when the "Press Tab to highlight" setting is on.
    test.skip(browserName === 'webkit', 'WebKit does not tab to buttons by default');
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Create a room' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.invite')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Copy link' })).toBeFocused();
  });

  test('focus is visible on buttons', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit does not tab to buttons by default');
    await page.goto('/');
    await page.keyboard.press('Tab');
    const outline = await page
      .getByRole('button', { name: 'Create a room' })
      .evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');
  });

  test('page has a language and a single h1', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('h1')).toHaveCount(1);
  });
});

test.describe('responsive layout', { tag: '@responsive' }, () => {
  for (const width of [320, 375, 768, 1280]) {
    test(`no sideways scrolling at ${width}px`, async ({ page, browser }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const screen of ['home', 'invite', 'joined'] as const) {
        const shown = await openScreen(screen, page, browser);
        const overflow = await shown.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${screen} at ${width}px`).toBeLessThanOrEqual(0);
      }
    });
  }

  test('touch targets are at least 44px tall', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Create a room' }).click();
    for (const button of await page.getByRole('button').all()) {
      const box = await button.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });
});
