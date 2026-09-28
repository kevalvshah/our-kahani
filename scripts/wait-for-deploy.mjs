// Usage: node scripts/wait-for-deploy.mjs <base-url> <commit-sha> [timeout-seconds]
// Waits until <base-url>/version.txt reports <commit-sha> (Cloudflare Pages has finished
// building and serving that commit). Exits 1 on timeout.
const [base, sha, timeoutArg = '900'] = process.argv.slice(2);
if (!base || !sha) {
  console.error('Usage: wait-for-deploy.mjs <base-url> <commit-sha> [timeout-seconds]');
  process.exit(2);
}
const deadline = Date.now() + Number(timeoutArg) * 1000;
let last = '';
while (Date.now() < deadline) {
  try {
    const res = await fetch(new URL('/version.txt', base), { cache: 'no-store' });
    last = res.ok ? (await res.text()).trim() : `HTTP ${res.status}`;
    if (last === sha) {
      console.log(`${base} is serving ${sha}`);
      process.exit(0);
    }
  } catch (e) {
    last = String(e);
  }
  await new Promise((r) => setTimeout(r, 15_000));
}
console.error(`Timed out waiting for ${base} to serve ${sha} (last seen: ${last})`);
process.exit(1);
