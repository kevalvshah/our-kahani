## What changed

## QA
- [ ] `npm run qa` passes locally (or CI is green)
- [ ] New screens are added to `SCREENS` in `e2e/helpers.ts` (so accessibility and visual tests cover them)
- [ ] Intended visual changes: baselines updated and image diffs reviewed
- [ ] Manual checks from `docs/QA.md` done where relevant (real iPhone / Android)

## Privacy check (CLAUDE.md rule 7)
- [ ] No new table, column, log line, storage object or network call can hold plaintext
- [ ] Changes under `src/crypto/` or `supabase/`: what can the server see afterwards?
