# Security and encryption

## Goal
The developer and the host must not be able to read user content from the database, storage,
backups or logs. Only the two people in a room can.

## Design
- **Room key**: 256-bit AES-GCM key generated on the creator's device with WebCrypto.
- **Envelope**: `{v, iv(12 bytes), ct+tag}` with AAD = `room:<id>|record:<id>|type:<kind>|v1`.
  Random IV every time. Decryption fails if a ciphertext is moved or altered.
- **Invite**: `https://<host>/join/<roomId>#<key material>`. The fragment is not sent to
  servers. On join, import the key, then clear the fragment from the URL. Single-use, expires
  in about 48 hours; the room closes to a third person once two have joined.
- **Safety code**: six emoji derived from a hash of the key, shown on both phones. Compare on
  a call to detect a swapped link.
- **Recovery (hashtag + room phrase)**: once both lock the hashtag, each person picks their own
  phrase (at least 4 words, not just names or the hashtag). PBKDF2-SHA256 with 600,000 rounds,
  salted with the normalised hashtag, turns hashtag + phrase into a secret; HKDF derives a
  lookup token and a wrap key from it. The room key and the notes key are sealed under the
  wrap key and stored by `save_backup`. On another device, "Enter my room" asks for both;
  `recover_room` returns the backup and moves the membership to that browser's anonymous
  account. Until the hashtag locks, the key lives only on the device.
- **Partner rescue**: if someone loses both their device and their phrase, their partner (on any
  device where the room is open) types their own phrase to open their own backup, then their
  device makes a one-time rescue code (80 random bits, Crockford base32). HKDF from code +
  hashtag gives a lookup token (server keeps its SHA-256) and a key that seals the room key. The
  server hands the sealed copy out once, within 24 hours (`use_rescue`), moving the lost person's
  place to the new browser, removing their old backup and their old private notes (sealed with
  a notes key nobody has any more). They then pick a new phrase. The old device loses access.
  Support cannot do any of this: there is no server-side reset.
- **Personal notes**: each person has their own key for Saved notes; the partner never has it.
- **Key storage**: non-extractable CryptoKey in IndexedDB where possible. Safari can delete
  script-writable storage after 7 days of Safari use without interaction (Home Screen web apps
  are exempt). Ask for persistent storage and expect loss; recovery must work.
- **Media**: compress (photos: stripped of location and camera details), then encrypt with the
  room key on the device, then upload to `/media`. The photo store checks membership with the
  person's own token and sees size and time only.
- **Downloads**: built in the browser after decrypting locally.

## What the server can see
- A room exists, its two anonymous member ids and roles, when it started and ends.
- For each record: its kind (a number), an opaque ref such as `day:3`, `season:s2:4`,
  `pack:warm:2` or `jar:2026-W40`, who
  wrote it and when, and its padded size (plaintext is padded to 64, 256, 1024, 4096 or 12288
  bytes, so a size never gives away an answer).
- Who has answered which card (to apply the reveal rule), never the answer.
- "Keep this room" votes, a yes per person, never shown to the partner.
- SHA-256 hashes of the join token and of the recovery lookup token, and the recovery backup
  sealed under a key from hashtag + room phrase.
- For photos and voice notes: the R2 object id, size and time, all ciphertext.
- How many devices each person uses (each is a separate anonymous account) and when each was
  added; which seat (creator or invitee) each record, vote and backup belongs to.
- For a partner rescue (24 hours): who made it and for whom, when it expires, the SHA-256 of its
  lookup token and the room key sealed under a key from the code. Never the code.
- If a person switches notifications on: their device's push address (a random URL at Google,
  Mozilla, Apple or Microsoft) and when they last nudged their partner. Pushes carry no payload;
  the push service learns only that a push arrived.
- IP addresses in host logs. Keep logs minimal and short-lived.
It never sees a name, answer, note, hashtag, caption, photo, voice note, key or room phrase.

## Honest limits (say these to users)
- Kind numbers show *which* tool was used, not what was said: the server can tell that a
  Dil ki Baat note (150), an "I need 20 minutes" pause (152) or a repair (153) was sent, and
  when, but never its words, feeling or need. Same as Gentle Corner (130–133) today.
- We serve the app's code. A changed version could steal keys. Mitigate: open source, strict
  CSP, no third-party scripts, pinned dependencies, reproducible builds later.
- The invite link carries the key. Whoever can read the message it is sent in could copy it.
  Prefer an end-to-end encrypted chat or reading it aloud. Instagram DMs were not end-to-end
  encrypted by default as far as we know; verify. Instagram's in-app browser has been reported
  to inject scripts; require Safari or Chrome.
- Screenshots, unlocked phones, shoulder-surfing are out of scope.
- If keys and the room phrase are both lost, only the partner can help (rescue code). If both
  people lose everything, data is gone.
- A partner can use a rescue to take over the other person's place (they already share the room
  key). The rescued person's old device then shows the room as gone, which makes this visible.
- The room phrase is chosen by a person, so it is weaker than random words. Whoever holds the
  database could try guesses offline against the stored backup; 600,000 PBKDF2 rounds make each
  guess slow and the hashtag salt makes each guess work for one room only, but a phrase that is
  easy to guess can still be found. The app says so when the phrase is chosen.

## Tests that must exist
Where they are: crypto in `src/crypto/*.test.ts`; isolation, reveal and lifecycle in
`supabase/tests/rls.sql` and `supabase/tests/features.sql`; the plaintext canary over all
network traffic in `e2e/journey.spec.ts` and `e2e/security.spec.ts`.

1. Crypto: right key opens, wrong key fails, tampering fails, AAD swap fails, same text gives
   different ciphertext.
2. Isolation: two rooms; every read of the other room returns nothing.
3. Reveal rule: partner ciphertext is not delivered before both have answered.
4. Plaintext canary: write known words through the UI, dump every table and storage bucket,
   fail the build if any canary appears.
5. Lifecycle: rooms have no end date; photos and voice notes go after 28 days; erased means gone.
