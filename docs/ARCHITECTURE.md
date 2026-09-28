# Architecture

## Shape
Browser app (Vite, Preact, TypeScript) on Cloudflare Pages. It talks to:
- **Supabase** (`hobby` org; `our-kahani` for production, `our-kahani-ci` for tests): Postgres
  for small ciphertext records, anonymous auth, row level security on every table. The app uses
  `@supabase/postgrest-js` plus a small hand-written anonymous-session module (`src/net/session.ts`).
- **Cloudflare R2 behind a Pages Function** (`functions/media/[[path]].ts`, served at `/media` on
  the app's own origin): encrypted photos and voice notes. The function holds no Supabase
  secret; it asks `media_allowed()` with the person's own token, so RLS decides.
No other servers. Railway is not needed.

## Data model (`supabase/migrations`)
- `rooms`: id, created_at, ends_at (28 days), cycle.
- `members`: room_id, user_id, role (`creator` or `invitee`). Maximum two.
- `records`: id, room_id, author_id, kind (smallint), ref (opaque card id), submitted,
  created_at, envelope (bytea: version, IV, ciphertext, tag). Everything a person reads
  (names, answers, notes, hashtag, photo captions) lives inside `envelope`.
- `keep_votes`: room_id, user_id, cycle. Each person sees only their own vote.
- `private.join_verifiers`: SHA-256 of the key-derived join token.
- `private.key_backups`: SHA-256 of a lookup token from the 12 words, and the key backup
  sealed under a key from the same words.
- `private.media_purge`: ids of erased or ended rooms, for 8 days, so R2 files are deleted.

Record kinds (`src/data/kinds.ts`), enforced by `private.can_read_record`:

| Kinds | Who can read | Examples |
|---|---|---|
| 1–49 | the partner only after answering the same ref | card answers, movie votes |
| 50 | the partner 90 days after it was written | time capsule |
| 100–199 | the partner as soon as it is sent | profile, reactions, games, photos, settings |
| 140 | as 100–199, but write-once for the room | the hashtag |
| 200–299 | only the author, under their own notes key | saved notes |

Answers can be changed until the partner answers, then they lock. A saved copy of the
partner's record (`copy:<id>`) is deleted by a trigger when the original is taken back.
Caps: 5000 records and 20 photos per room; 16 KB per envelope; 40 media objects of 1.1 MB.

## Functions (RPC)
`create_room`, `join_room`, `room_answers` (who has answered what, never content),
`erase_room`, `vote_keep`, `save_backup`, `recover_room`, `media_allowed`,
`media_purge_list`, `storage_health`.

## Sync
The app polls every 10 seconds and when the tab becomes visible (`src/data/RoomData.tsx`).
Realtime is not used: polling sends nothing extra and keeps the bundle small.

## Client
- `src/crypto/`: keys, envelopes, invite, safety code, join token, recovery words, key store.
- `src/net/`: session, API, photo store client.
- `src/state/`: the controller that joins keys, server and storage; room timing.
- `src/data/`: record kinds, padded JSON payloads, the room data provider.
- `src/content/`: the season, 12 packs and all extras (TypeScript, reviewed like code).
- `src/features/`: card logic, progress, saved notes, Excel and zip, archive, settings.
- `src/ui/`: screens, router, look settings, voice recording, install prompt.
- Matching, search, Excel export and zip download all happen on the device.
- PWA: `public/manifest.webmanifest`, `public/sw.js` (caches only the app's own files).

## Scheduled jobs
- Nightly in Postgres (pg_cron `our-kahani-nightly-cleanup`): erase ended rooms, remove unused
  anonymous accounts, trim the purge list.
- Daily in GitHub Actions (`.github/workflows/daily.yml`): `POST /media/purge` deletes R2 files
  of erased rooms; `storage_health` fails the job at 60% and 80% (GitHub emails the owner) and
  keeps the free project awake. At 70% the database refuses new rooms (`P0008`).

## Setup still needed for photos
Add an R2 binding named `MEDIA` (bucket `our-kahani-media`) to the Pages project:
Cloudflare dashboard → Workers & Pages → our-kahani → Settings → Bindings → Add → R2 bucket.
Until then `/media` answers 503 and the app says photos are not switched on yet.
