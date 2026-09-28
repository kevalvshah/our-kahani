import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';
import preact from '@preact/preset-vite';
import { DEFAULT_SUPABASE_URL } from './src/net/defaults';

// The single backend origin the app may connect to (CSP connect-src).
const SUPABASE_ORIGIN = new URL(process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).origin;
const fillHeaders = (text: string) => text.replaceAll('%SUPABASE_ORIGIN%', SUPABASE_ORIGIN);

/** Writes the real Supabase origin into dist/_headers after the build. */
function securityHeaders(): Plugin {
  let outDir = 'dist';
  return {
    name: 'our-kahani-security-headers',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    writeBundle() {
      const file = resolve(outDir, '_headers');
      writeFileSync(file, fillHeaders(readFileSync(file, 'utf8')));
    },
  };
}

// `vite preview` serves the production build with the same headers as public/_headers,
// so the e2e tests run under the real CSP. Local preview is plain http, so the
// https-only parts are dropped there.
function previewHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of fillHeaders(readFileSync('public/_headers', 'utf8')).split(/\r?\n/)) {
    const match = /^\s+([A-Za-z-]+):\s*(.+)$/.exec(line);
    if (match) headers[match[1]!] = match[2]!.trim();
  }
  delete headers['Strict-Transport-Security'];
  const csp = headers['Content-Security-Policy'];
  if (csp) headers['Content-Security-Policy'] = csp.replace(/;\s*upgrade-insecure-requests/, '');
  return headers;
}

export default defineConfig({
  plugins: [preact(), securityHeaders()],
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
      // Security-critical code and app logic must stay fully tested. UI is covered by e2e.
      include: ['src/crypto/**', 'src/platform/**', 'src/features/**', 'src/state/**', 'src/net/**', 'src/ui/look.ts'],
      // Browser glue (Preact context, IndexedDB key store, the controller that wires them to the
      // server) is covered by the e2e suite against a real Supabase project.
      exclude: [
        '**/*.test.ts',
        '**/__snapshots__/**',
        'src/state/roomContext.ts',
        'src/state/controller.ts',
        'src/crypto/keystore.ts',
        'src/net/config.ts',
        'src/net/defaults.ts',
      ],
      reporter: ['text', 'html', 'json-summary'],
      thresholds: { lines: 100, functions: 100, statements: 100, branches: 95 },
    },
  },
});
