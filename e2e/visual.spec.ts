import { expect, test } from '@playwright/test';
import { openScreen, SCREENS } from './helpers';

// Screenshot comparison against committed baselines in e2e/visual.spec.ts-snapshots/.
// Fonts render differently per OS, so baselines are made and checked on Linux (CI) only.
// To accept an intended change, see "Visual baselines" in docs/QA.md.
test.describe('visual regression', { tag: '@visual' }, () => {
  test.skip(process.platform !== 'linux', 'Visual baselines are Linux-only; runs in CI');

  for (const scheme of ['light', 'dark'] as const) {
    for (const screen of SCREENS) {
      test(`${screen} (${scheme})`, async ({ page, browser }) => {
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
        const shown = await openScreen(screen, page, browser);
        await shown.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
        await expect(shown).toHaveScreenshot(`${screen}-${scheme}.png`, {
          fullPage: true,
          // The invite link and safety code are random every run.
          mask: [shown.locator('.invite'), shown.locator('.emoji')],
          maxDiffPixelRatio: 0.01,
        });
      });
    }
  }
});
