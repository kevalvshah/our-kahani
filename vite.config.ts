import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

// `vite preview` serves the production build with the same headers as public/_headers,
// so the e2e tests run under the real CSP. Local preview is plain http, so the
// https-only parts are dropped there.
function previewHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of readFileSync('public/_headers', 'utf8').split(/\r?\n/)) {
    const match = /^\s+([A-Za-z-]+):\s*(.+)$/.exec(line);
    if (match) headers[match[1]!] = match[2]!.trim();
  }
  delete headers['Strict-Transport-Security'];
  const csp = headers['Content-Security-Policy'];
  if (csp) headers['Content-Security-Policy'] = csp.replace(/;\s*upgrade-insecure-requests/, '');
  return headers;
}

export default defineConfig({
  plugins: [preact()],
  build: {
    // Keep production output free of inline scripts so the strict CSP holds.
    modulePreload: { polyfill: false },
    sourcemap: false,
  },
  preview: {
    headers: previewHeaders(),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Security-critical code must stay fully tested. UI is covered by the e2e suite.
      include: ['src/crypto/**', 'src/platform/**'],
      exclude: ['**/*.test.ts', '**/__snapshots__/**'],
      reporter: ['text', 'html', 'json-summary'],
      thresholds: { lines: 100, functions: 100, statements: 100, branches: 95 },
    },
  },
});
