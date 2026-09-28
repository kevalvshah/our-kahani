// Usage: node scripts/wait-for-deploy.mjs <base-url> <commit-sha> [timeout-seconds]
// Waits until <base-url>/version.txt reports <commit-sha> (Cloudflare Pages has finished
// building and serving that commit).
//
// Preview deployments may sit behind Cloudflare Access. If CF_ACCESS_CLIENT_ID and
// CF_ACCESS_CLIENT_SECRET (an Access service token) are set, they are sent; if the site is
// behind Access and no token is set, exits 3 so CI can skip the smoke test with a warning.
// Exit codes: 0 serving, 1 timed out, 2 bad usage, 3 behind Access without a token.
const [base, sha, timeoutArg = '900'] = process.argv.slice(2);
if (!base || !sha) {
  console.error('Usage: wait-for-deploy.mjs <base-url> <commit-sha> [timeout-seconds]');
  process.exit(2);
}

const headers = {};
if (process.env.CF_ACCESS_CLIENT_ID && process.env.CF_ACCESS_CLIENT_SECRET) {
  headers['CF-Access-Client-Id'] = process.env.CF_ACCESS_CLIENT_ID;
  headers['CF-Access-Client-Secret'] = process.env.CF_ACCESS_CLIENT_SECRET;
}
const hasToken = Object.keys(headers).length > 0;

async function main() {
  const deadline = Date.now() + Number(timeoutArg) * 1000;
  let last = '';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(new URL('/version.txt', base), { cache: 'no-store', redirect: 'manual', headers });
      const location = res.headers.get('location') ?? '';
      const text = await res.text(); // always drain the body so no request is left open
      if (res.status >= 300 && res.status < 400 && location.includes('cloudflareaccess.com')) {
        if (!hasToken) {
          console.error(`${base} is behind Cloudflare Access and no service token is configured.`);
          return 3;
        }
        last = 'Access rejected the service token';
      } else {
        last = res.ok ? text.trim().slice(0, 80) : `HTTP ${res.status}`;
        if (last === sha) {
          console.log(`${base} is serving ${sha}`);
          return 0;
        }
      }
    } catch (e) {
      last = String(e);
    }
    await new Promise((r) => setTimeout(r, 15_000));
  }
  console.error(`Timed out waiting for ${base} to serve ${sha} (last seen: ${last})`);
  return 1;
}

// Set the exit code rather than calling process.exit() mid-request.
process.exitCode = await main();
