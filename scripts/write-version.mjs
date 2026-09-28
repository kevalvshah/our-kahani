// Writes dist/version.txt with the commit being built, so CI can tell when Cloudflare is
// serving a given commit. Contains only the public commit id, nothing about users.
import { writeFileSync } from 'node:fs';

const sha = process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || 'local';
writeFileSync('dist/version.txt', `${sha}\n`);
