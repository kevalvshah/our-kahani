import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, openScreen, SCREENS, test } from './helpers';

/** Presses Tab (through the skip link and navigation) until the Create button has focus. */
async function tabToCreate(page: Page) {
  const create = page.getByRole('button', { name: 'Create a room' });
  for (let i = 0; i < 20 && !(await create.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab');
  }
  await expect(create).toBeFocused();
  return create;
}

test.describe('accessibility', { tag: '@a11y' }, () => {
  for (const scheme of ['light', 'dark'] as const) {
    for (const screen of SCREENS) {
      test(`${screen} (${scheme}) has no WCAG 2.2 AA violations`, async ({ page, newDevice }) => {
        await page.emulateMedia({ colorScheme: scheme });
        const shown = await openScreen(screen, page, newDevice);
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
    await tabToCreate(page);
    await page.keyboard.press('Enter');
    // The pressed button is gone, so focus moves to the new screen's heading.
    await expect(page.getByRole('heading', { name: 'Send this to your person' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Copy link' })).toBeFocused();
  });

  test('focus is visible on buttons', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit does not tab to buttons by default');
    await page.goto('/');
    const create = await tabToCreate(page);
    expect(await create.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
  });

  test('a skip link jumps to the content', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit does not tab to links by default');
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  });

  test('every screen has a language and exactly one h1', async ({ page, newDevice }) => {
    for (const screen of SCREENS) {
      const shown = await openScreen(screen, page, newDevice);
      await expect(shown.locator('html')).toHaveAttribute('lang', 'en');
      await expect(shown.locator('h1:visible'), screen).toHaveCount(1);
    }
  });
});

test.describe('responsive layout', { tag: '@responsive' }, () => {
  for (const width of [320, 375, 768, 1280]) {
    test(`no sideways scrolling at ${width}px`, async ({ page, newDevice }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const screen of SCREENS) {
        const shown = await openScreen(screen, page, newDevice);
        const overflow = await shown.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${screen} at ${width}px`).toBeLessThanOrEqual(0);
      }
    });
  }

  test('touch targets are at least 44px tall on every screen', async ({ page, newDevice }) => {
    for (const screen of SCREENS) {
      const shown = await openScreen(screen, page, newDevice);
      // Measure every visible target on the screen in one pass.
      const small = await shown.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('button, .tab, .side-link, .back, .row-link')]
          .filter((el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden')
          .map((el) => ({ name: el.textContent?.trim(), height: el.getBoundingClientRect().height }))
          .filter((t) => t.height < 44),
      );
      expect(small, screen).toEqual([]);
    }
  });
});
