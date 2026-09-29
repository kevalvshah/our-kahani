# QA guide

How Our Kahani is tested, what runs automatically, and how a QA tester can check the work.
The product has no login, email or password, so the whole app can be driven end to end by
Playwright with no test accounts or secrets.

## At a glance

| Type | What it proves | Tool | Where it lives | Runs in CI |
|---|---|---|---|---|
| Static checks | Strict TypeScript, no type errors | `tsc` | `tsconfig*.json` | Yes |
| Unit | Encryption, invite links, safety code, browser detection behave exactly as specified | Vitest | `src/**/*.test.ts` | Yes |
| Coverage limits | Security code is fully tested: 100% lines, functions, statements; 95% branches | Vitest + V8 | `vite.config.ts` | Yes, build fails below the limits |
| Build output | No inline scripts, no third-party hosts, strict CSP file present | Node script | `scripts/check-dist.mjs` | Yes |
| Performance budget | JS under 60 KB and CSS under 15 KB gzipped | Node script | `scripts/check-dist.mjs` | Yes |
| Dependency audit | No known high or critical issues in shipped dependencies | `npm audit` | `package.json` | Yes |
| Functional end to end | Create room, invite, join, broken links, Instagram gate | Playwright | `e2e/invite.spec.ts` | Yes, 5 browsers and devices |
| App shell and screens | Every screen by URL and reload, phone tabs vs laptop sidebar, card picking, "Make it ours" settings, country-aware safety footer, erase room | Playwright | `e2e/app.spec.ts` | Yes |
| Security end to end | Security headers, no CSP violations, no third-party requests, key never stored or logged, page cannot be framed | Playwright | `e2e/security.spec.ts` | Yes |
| Accessibility | WCAG 2.2 AA on every screen in light and dark mode, keyboard-only flow, visible focus, skip link, one h1 per screen | Playwright + axe-core | `e2e/a11y.spec.ts` | Yes |
| Responsive | No sideways scrolling at 320, 375, 768, 1280 px on every screen; touch targets at least 44 px on every screen | Playwright | `e2e/a11y.spec.ts` | Yes |
| Visual regression | Every screen, light and dark, looks the same as the approved screenshot | Playwright screenshots | `e2e/visual.spec.ts` | Yes (Linux only) |
| Deployment smoke | The real Cloudflare deployment (preview for PRs, production for `main`) works with its real headers | Playwright | same specs, `BASE_URL` set | Yes, after Cloudflare deploys |
| Server security | Room isolation, hidden answers, locks, private notes, caps, keep votes, recovery, photo store | SQL (acts as several users, rolls back) | `supabase/tests/*.sql` | Manual after each migration (see below) |
| Full journey | Two people from create to reveal, packs, games, saved notes; recovery on a fresh browser; plaintext canary over all traffic | Playwright against the CI Supabase project | `e2e/journey.spec.ts` | Yes |
| Manual | Real phones, real chat apps, voice and photo round trips | People | this file | No |

## Browsers and devices

Every browser test runs on five setups (see `playwright.config.ts`):

| Project | Engine | Stands in for |
|---|---|---|
| `chromium` | Chromium, desktop | Chrome and Edge on a laptop |
| `firefox` | Firefox, desktop | Firefox on a laptop |
| `webkit` | WebKit, desktop | Safari on a Mac |
| `android-chrome` | Chromium, Pixel 7 screen and touch | Chrome on Android |
| `iphone-safari` | WebKit, iPhone 14 screen and touch | Safari on iPhone |

Emulation is close but not identical to real devices. The manual checklist below covers the gap.

## Running the tests

Needs Node 24 (see `.nvmrc`).

```bash
npm ci
npx playwright install        # once, downloads the test browsers
npm run qa                    # everything: build + checks, unit + coverage, audit, all browser tests
```

Or one type at a time:

| Command | Runs |
|---|---|
| `npm run typecheck` | Static checks |
| `npm test` | Unit tests |
| `npm run test:coverage` | Unit tests with coverage limits; HTML report in `coverage/index.html` |
| `npm run build` | Type-check, build, then the output and bundle-size check |
| `npm run audit:prod` | Dependency audit |
| `npm run test:e2e` | All browser tests, all five setups |
| `npm run test:functional` | Only the invite and join flow |
| `npm run test:security` | Only the security tests |
| `npm run test:a11y` | Accessibility and responsive tests |
| `npm run test:visual` | Screenshot comparison (Linux or the container only) |
| `npx playwright test --project=iphone-safari` | Any of the above on one setup |
| `npx playwright test --ui` | Opens Playwright's UI to watch and step through tests |
| `npx playwright show-report` | Opens the last HTML report |

The browser tests build the app and serve it with `vite preview`, using the same security
headers as production (read from `public/_headers`), so a CSP mistake fails the tests.

### In the container (same as CI)

CI runs browser tests inside the pinned Playwright Linux image, so results and screenshots
are identical everywhere. With Docker installed:

```bash
docker compose -f docker-compose.qa.yml run --rm qa
```

Use this when your own machine differs (for example, Windows blocking the test Firefox, or
screenshots that only match on Linux).

### Against a deployed site

```bash
BASE_URL=https://our-kahani.pages.dev npx playwright test --project=chromium --grep "@functional|@security"
```

On Windows PowerShell: `$env:BASE_URL="https://our-kahani.pages.dev"; npx playwright test ...`

## CI/CD pipeline

`.github/workflows/ci.yml` runs on every pull request and every push to `main`:

```
Pull request:  checks ──► e2e (5 browser setups in parallel)
                     └──► preview-smoke (waits for the Cloudflare preview of this commit, tests it)

Merge to main: checks ──► e2e ──► production-smoke (waits for Cloudflare production, tests it)
```

1. **checks**: type-check, unit tests with coverage limits, build, output and bundle check,
   dependency audit. Uploads `coverage`.
2. **e2e**: the full Playwright suite, one job per browser setup, inside the pinned container.
   Uploads the HTML report, traces for any failure, and any new screenshot baselines.
3. **Deploys are done by Cloudflare Pages**, which is connected to this repo: every branch gets
   a preview at `https://<branch>.our-kahani.pages.dev`, and `main` goes to production. Each
   build writes `/version.txt` with its commit id.
4. **preview-smoke** / **production-smoke**: wait until `/version.txt` shows this commit, then
   run the functional and security tests on Chromium and iPhone Safari against the real
   deployment, including Cloudflare's real security headers.

Production only changes when a pull request is merged into `main`, and branch protection
(below) makes merging wait for every check. Every Dependabot update PR runs the same pipeline.

### Checking a run as a QA tester

1. On GitHub open **Actions**, then the run (or the **Checks** tab on a pull request).
2. Each job shows pass or fail. Failing tests are listed at the top with file and line.
3. Scroll to **Artifacts** and download:
   - `playwright-report-<setup>`: unzip, then open `playwright-report/index.html`. Every test,
     every step, and for failures a screenshot, video frame and **trace** (a step-by-step
     replay you can open with `npx playwright show-trace trace.zip` or at trace.playwright.dev,
     which runs in your browser and does not upload the file).
   - `coverage`: open `index.html` to see which lines of the security code are tested.
   - `new-visual-baselines-<setup>`: only present when a screen had no approved screenshot yet.

## Visual baselines

Approved screenshots live in `e2e/visual.spec.ts-snapshots/` and are made on Linux, because
fonts render slightly differently on each operating system. Local runs on Windows or macOS
skip visual tests; use the container or CI.

- **New screen**: CI writes the missing screenshots and uploads them as
  `new-visual-baselines-*` (the test fails until they are committed). Look at them, then commit
  them into `e2e/visual.spec.ts-snapshots/`.
- **Intended change**: run **Actions > Update visual baselines > Run workflow** on your branch
  (or `npm run test:visual:update` in the container). It commits new screenshots to the branch;
  review the image diffs in the pull request.
- **Unintended change**: the test fails and the report shows expected, actual and a diff image.

The invite link and safety code are random every run, so they are masked in screenshots.

## Deploy setup and approval

Cloudflare Pages project `our-kahani` is connected to this GitHub repo. One-off settings, done
by the repo owner:

1. Cloudflare **Workers & Pages > our-kahani > Settings > Build**: framework preset *None*,
   build command `npm run build`, build output directory `dist`, root directory empty.
   Environment variable `NODE_VERSION` = `24`. (If the build command is missing, Pages serves
   the raw source and the security headers are not applied.)
2. Cloudflare **Custom domains**: add `kahani.unicodegroup.com`. Then set the GitHub repository
   variable `PRODUCTION_URL` to `https://kahani.unicodegroup.com` so production smoke tests use it.
3. GitHub **Settings > Branches**: protect `main`; require a pull request, and require the
   `Static checks, unit tests, build`, all five `Browser tests (...)` and
   `Smoke test Cloudflare preview` checks to pass. This is the approval gate for production.
4. Optional: require a review approval on pull requests, so a second person signs off each release.

No Cloudflare deploy secrets are stored in GitHub: Cloudflare pulls from the repo itself.

### Preview deployments behind Cloudflare Access

Preview URLs (`<branch>.our-kahani.pages.dev`) are protected with Cloudflare Access, so only
you can open them. For CI to smoke-test them:

1. Cloudflare Zero Trust > **Access > Service Auth > Service Tokens > Create service token**
   (name it `github-ci`). Copy the Client ID and Client Secret.
2. In the Access application protecting the previews, add a policy with action **Service Auth**
   that includes that service token.
3. GitHub **Settings > Secrets and variables > Actions**: add `CF_ACCESS_CLIENT_ID` and
   `CF_ACCESS_CLIENT_SECRET`.

Without them, "Smoke test Cloudflare preview" passes with a warning and skips the tests; the
production smoke test after each merge still runs (production is public).

## Traceability: rules to tests

| Rule (CLAUDE.md, docs/SECURITY.md) | Test |
|---|---|
| AES-256-GCM, fresh random IV every time | `envelope.test.ts`: different ciphertext and IV for the same text |
| Ciphertext bound to room, record and type (AAD) | `envelope.test.ts`: moved to another room, record or type fails |
| Right key opens, wrong key fails, tampering fails | `envelope.test.ts` |
| Envelopes are versioned | `envelope.test.ts`: header byte, unknown version rejected |
| Keys cannot be exported from the browser | `envelope.test.ts`: non-extractable |
| Key travels only in the link fragment | `invite.test.ts`; `invite.spec.ts` |
| Fragment removed from the address bar after import | `invite.test.ts`; `invite.spec.ts` (also after reload) |
| Never log or store the full invite or key | `security.spec.ts`: console, storage, cookies, title |
| Safety code matches on both phones, differs for a swapped link | `safetyCode.test.ts`; `invite.spec.ts` |
| Instagram in-app browser: ask to open Safari or Chrome before handling keys | `inAppBrowser.test.ts`; `invite.spec.ts` |
| No third-party scripts or hosts, no inline scripts, strict CSP | `check-dist.mjs`; `security.spec.ts` |
| Touch targets at least 44 px, keyboard accessible, phone-first | `a11y.spec.ts` |
| Room isolation, reveal rule, answer locks, erase | `supabase/tests/rls.sql` |
| Private notes, write-once hashtag, capsule, saved copies, caps, keep votes, recovery, photo store checks, storage guard | `supabase/tests/features.sql` |
| Plaintext canary: no name, answer, note, song or key in any request, on either phone | `journey.spec.ts`; `security.spec.ts` |
| The whole product with two people (setup, words, hashtag, cards, reveal, packs, games, saved notes, recovery) | `journey.spec.ts` |
| Photo store: members only, size and count caps, purge of erased rooms | `mediaFunction.test.ts` |
| The invited person answers first by default; either can switch it off | `settings.test.ts`; `journey.spec.ts` |
| Partner rescue: one-time, 24 hours, own phrase checked, lost device locked out | `rescue.test.ts`; `api.test.ts`; `journey.spec.ts` |

## Database tests

`supabase/tests/rls.sql` and `supabase/tests/features.sql` act as several users inside one
transaction, then raise `ALL RLS TESTS PASSED` / `ALL FEATURE TESTS PASSED`, which rolls
everything back. Seeing that message as an error is the pass; any message starting with `FAIL`
is a failure. Run them against the CI project (never production) after every migration:

```bash
psql "$CI_SUPABASE_DB_URL" -f supabase/tests/rls.sql
```

or paste the file into the Supabase SQL editor of `our-kahani-ci`. They are not run by CI
yet, because that needs the database password as a repository secret.

## Manual test checklist (each release)

Automated tests use emulated devices. Before a release, a person checks on real devices:

- [ ] iPhone Safari (browser tab): create room, copy link, open on a second phone, safety codes match
- [ ] iPhone added to Home Screen: same flow
- [ ] Android Chrome: same flow
- [ ] Link opened from Instagram DM: the "Open in Safari or Chrome" screen shows, and "Open in browser" carries the full link
- [ ] Link opened from WhatsApp: opens in the phone's browser and joins
- [ ] Laptop Chrome and Safari: layout and keyboard use
- [ ] Dark mode on phone and laptop
- [ ] Screen reader: VoiceOver (iPhone) and TalkBack (Android) read the safety code and buttons
- [ ] Large text (iOS Dynamic Type or Android font size at maximum): nothing cut off
- [ ] Slow connection (Chrome DevTools "Slow 3G"): app loads and works
- [ ] Voice note on a "Remember when" card, iPhone to Android and back
- [ ] Photo from iPhone (HEIC) and Android on Right Now; both appear in the downloaded zip
- [ ] Recovery: clear the site's data, then "Enter my room" with the hashtag and phrase brings the room back; a wrong phrase is refused
- [ ] Install: Chrome shows "Add it"; the installed app opens offline to the last screen shell
- [ ] Partner rescue from a laptop and from a phone: Room data → Help … back in (own phrase) →
      code; on a new device Enter my room → I have a rescue code → new phrase; the code fails a
      second time; the lost device shows Welcome
- [ ] support@unicodegroup.com link opens the mail app on Enter your room, the phrase screen,
      Room data and Privacy

### Exploratory ideas

- Paste an invite link with a character missing, extra spaces, or cut in half.
- Open the same invite link on three devices (once the server is wired, only two may join).
- Press back and forward after joining; reload; open in a private window.
- Leave a tab in the background for an hour, then return.

## Reporting a bug

Open a GitHub issue with: device and browser (and version), steps, what you expected, what
happened, and a screenshot. **Never paste a full invite link**: the part after `#` is the room key.
If a CI run found it, link the run and attach the trace.

## Known limits of the current setup

- Visual tests run on Linux only (CI or the container).
- WebKit does not move focus to buttons with Tab unless a Safari setting is on, so the
  keyboard tests are skipped on WebKit; check keyboard use on a real Mac manually.
- Some Windows machines block the test Firefox from starting; use the container or rely on CI.
- Firefox in the CI container occasionally stalls on a first page load; the one automatic retry
  covers it and the run reports the test as "flaky". A test that fails twice fails the run.
- Full-page screenshots on phone sizes show the bottom tabs part-way down the page: that is how
  full-page capture stitches sticky elements, not how the app looks on a phone.
- The security headers in the main browser tests come from `vite preview`; the preview and
  production smoke tests check the real Cloudflare ones.
