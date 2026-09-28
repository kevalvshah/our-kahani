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
]);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const problems = [];
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
    if (!ALLOWED_URLS.has(url)) problems.push(`${file}: third-party URL ${url}`);
  }
}

// Performance budget (gzipped). Phones on slow connections come first.
const BUDGET = { '.js': 60 * 1024, '.css': 15 * 1024 };
const totals = { '.js': 0, '.css': 0 };
for (const file of walk(DIST)) {
  const ext = file.slice(file.lastIndexOf('.'));
  if (ext in totals) totals[ext] += gzipSync(readFileSync(file)).length;
}
for (const [ext, limit] of Object.entries(BUDGET)) {
  if (totals[ext] > limit) problems.push(`bundle budget: ${ext} is ${totals[ext]} B gzipped, limit ${limit} B`);
}

const headers = readFileSync(join(DIST, '_headers'), 'utf8');
if (!/Content-Security-Policy:.*script-src 'self'/.test(headers)) problems.push('dist/_headers: missing strict CSP');

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`dist check passed: no inline scripts, no third-party hosts, CSP present, JS ${totals['.js']} B / CSS ${totals['.css']} B gzipped`);
