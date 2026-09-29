import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
// Set BASE_URL to test a deployed site instead of a local build (post-deploy smoke test).
const BASE_URL = process.env.BASE_URL;

// Local builds under test talk to the CI Supabase project, never production: the tests create
// and erase real rooms and anonymous users. Both values are public by design.
if (!BASE_URL && !process.env.VITE_SUPABASE_URL) {
  process.env.VITE_SUPABASE_URL = 'https://yarkzlhuklweotdaywcr.supabase.co';
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_7VU8E8yHnbiwe1ds9YTFqQ_ONgKd9Ns';
}

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  // In CI, missing visual baselines are written (and uploaded) instead of failing the run.
  updateSnapshots: process.env.CI ? 'missing' : 'none',
  expect: { toHaveScreenshot: { animations: 'disabled' } },
  use: {
    baseURL: BASE_URL ?? `http://localhost:${PORT}`,
    // Cloudflare Access service token, only when testing a protected preview deployment.
    extraHTTPHeaders:
      BASE_URL && process.env.CF_ACCESS_CLIENT_ID && process.env.CF_ACCESS_CLIENT_SECRET
        ? {
            'CF-Access-Client-Id': process.env.CF_ACCESS_CLIENT_ID,
            'CF-Access-Client-Secret': process.env.CF_ACCESS_CLIENT_SECRET,
          }
        : undefined,
    trace: 'retain-on-failure',
    // The offline service worker is tested on its own (e2e/pwa.spec.ts). Everywhere else it is
    // blocked: tests watch and route requests, and Playwright's Firefox can stall page loads
    // that a worker handles.
    serviceWorkers: 'block',
  },
  // Latest Chromium, Firefox and WebKit on laptop and phone sizes (docs/WEB-ONLY.md).
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'android-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'iphone-safari', use: { ...devices['iPhone 14'] } },
  ],
  webServer: BASE_URL ? undefined : {
    // Tests run against the production build, served with the production headers.
    command: `npx vite build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
