import { expect, masksFor, SCREEN_NAMES, test } from './helpers';

/** The first screen in a worker also builds its rooms (slow on WebKit). */
const SCREEN_TIMEOUT = 120_000;

// Screenshot comparison against baselines in e2e/visual.spec.ts-snapshots/.
// Fonts render differently per OS, so baselines are made and checked on Linux (CI) only.
// Every screen uses the same fixed names (Asha, Ravi, Mira) on a brand-new room, so what is
// shown is the same every run; anything random (invite links, safety codes,
// dates) is masked. To accept an intended change, see "Visual baselines" in docs/QA.md.
test.describe('visual regression', { tag: '@visual' }, () => {
  test.skip(process.platform !== 'linux', 'Visual baselines are Linux-only; runs in CI');

  for (const screen of SCREEN_NAMES) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${screen} (${scheme})`, async ({ stage }) => {
        test.setTimeout(SCREEN_TIMEOUT);
        const shown = await stage.open(screen, { colorScheme: scheme, reducedMotion: 'reduce' });
        // Let late fonts and images settle, and keep the text caret out of the picture.
        await shown.evaluate(() => document.fonts.ready.then(() => true));
        await shown.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        await expect(shown).toHaveScreenshot(`${screen}-${scheme}.png`, {
          fullPage: true,
          mask: masksFor(shown, screen),
          maxDiffPixelRatio: 0.01,
        });
      });
    }
  }
});
