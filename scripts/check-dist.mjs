// Fails the build if the production output breaks the no-inline-script / no-third-party rules.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
// Namespace strings inside Preact, not network requests.
const ALLOWED_URLS = new Set([
  'http://www.w3.org/1998/Math/MathML',
  'http://www.w3.org/1999/xhtml',
  'http://www.w3.org/2000/svg',
  'http://www.w3.org/1999/xlink',
  'http://www.w3.org/XML/1998/namespace',
  // Office Open XML namespaces inside the on-device Excel writer (identifiers, never fetched).
  'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  'http://schemas.openxmlformats.org/package/2006/content-types',
  'http://schemas.openxmlformats.org/package/2006/relationships',
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet',
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles',
  // Links a person can tap (never fetched by the app; CSP connect-src stays 'self').
  // Required by CLAUDE.md rule 9 for the Gentle Corner safety footer.
  'https://findahelpline.com',
]);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

// The backend origin the CSP lets the app connect to is first-party, not third-party.
const headersText = readFileSync(join(DIST, '_headers'), 'utf8');
const connectSrc = (/Content-Security-Policy:.*?connect-src ([^;]+);/.exec(headersText)?.[1] ?? '').split(' ').filter((s) => s.startsWith('https://'));

const problems = [];
if (headersText.includes('%SUPABASE_ORIGIN%')) problems.push('dist/_headers: Supabase origin was not filled in');
if (connectSrc.length !== 1) problems.push(`dist/_headers: expected exactly one backend origin in connect-src, found ${connectSrc.length}`);
for (const file of walk(DIST)) {
  if (!/\.(html|js|css|mjs|json|webmanifest)$/.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  if (file.endsWith('.html')) {
    for (const tag of text.match(/<script\b[^>]*>/gi) ?? []) {
      if (!/\bsrc=/.test(tag)) problems.push(`${file}: inline <script>`);
    }
    if (/\son[a-z]+\s*=/i.test(text)) problems.push(`${file}: inline event handler`);
    if (/<link[^>]+href=["']?https?:/i.test(text)) problems.push(`${file}: external stylesheet or link`);
  }
  for (const url of text.match(/https?:\/\/[A-Za-z0-9.-]+[^\s"'`)]*/g) ?? []) {
    const firstParty = connectSrc.some((origin) => url === origin || url.startsWith(`${origin}/`));
    if (!ALLOWED_URLS.has(url) && !firstParty) problems.push(`${file}: third-party URL ${url}`);
  }
}

// Performance budget (gzipped). Phones on slow connections come first: the JS the first screen
// loads (the entry chunk named in index.html) stays small; screens opened later load on demand.
const BUDGET = { entryJs: 60 * 1024, totalJs: 160 * 1024, css: 20 * 1024 };
const gz = (file) => gzipSync(readFileSync(file)).length;
const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const entry = /<script[^>]+src="\/([^"]+\.js)"/.exec(html)?.[1];
const totals = { entryJs: entry ? gz(join(DIST, entry)) : 0, totalJs: 0, css: 0 };
for (const file of walk(DIST)) {
  if (file.endsWith('.js')) totals.totalJs += gz(file);
  if (file.endsWith('.css')) totals.css += gz(file);
}
for (const [what, limit] of Object.entries(BUDGET)) {
  if (totals[what] > limit) problems.push(`bundle budget: ${what} is ${totals[what]} B gzipped, limit ${limit} B`);
}

const headers = readFileSync(join(DIST, '_headers'), 'utf8');
if (!/Content-Security-Policy:.*script-src 'self'/.test(headers)) problems.push('dist/_headers: missing strict CSP');

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`dist check passed: no inline scripts, no third-party hosts, CSP present, first-screen JS ${totals.entryJs} B, all JS ${totals.totalJs} B, CSS ${totals.css} B gzipped`);
