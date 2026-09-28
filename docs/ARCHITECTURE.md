# Architecture

## Shape
Browser app (Vite, TypeScript) on Cloudflare Pages. It talks to:
- **Supabase**: Postgres for small ciphertext records, Realtime for "answered" pings,
  anonymous auth. Row-level security on every table.
- **Cloudflare R2 + Worker**: encrypted photos and voice notes. The Worker only issues
  short-lived upload and download links and runs scheduled jobs.
No other servers. Railway is not needed.

## Data model (sketch; refine in Stage 1)
- `rooms`: id, created_at, ends_at, cycle, name_ciphertext (write-once), state flags.
- `members`: room_id, member_id, joined_at, role (`creator` or `invitee`). Maximum two.
- `records`: id, room_id, author_id, kind (smallint), ref (card id, opaque), created_at,
  submitted (bool), envelope (bytea: version, IV, ciphertext, tag). One index: (room_id, created_at).
- `blobs`: id, room_id, author_id, object_key, size, created_at (the object itself is ciphertext in R2).
- `votes`: room_id, member_id, cycle, keep (bool). Used only for the keep-4-weeks rule.
Everything readable to a person (names, answers, notes, hashtag) lives inside `envelope`.

## Reveal rule (server side, metadata only)
A partner's record for a card is returned only when the rule passes, using `submitted`
flags, roles and card type. The server never needs plaintext. RLS enforces it. Clients also
hide it, but the server is the guard.

## Realtime
Broadcast events carry `{room, kind: "answered" | "photo" | "voice"}` only. Content is fetched
through the protected route.

## Client
- `src/crypto/`: key generation, envelopes, recovery phrase, safety code. Small, tested, boring.
- `src/state/`: decrypted in-memory state. Never persist plaintext.
- `src/packs/`: card packs as JSON (see `CONTENT-PACKS.md`).
- `src/features/`: cards, saved, movie night, room data, gentle corner, photos, voice.
- Matching, search, Excel export, zip download all happen on the device.

## Room lifecycle jobs (Worker cron)
Nightly: delete expired rooms in batches (rows and R2 objects). Daily: size check and alerts,
keep-alive ping. Rooms are erased by deleting ciphertext and discarding keys.
