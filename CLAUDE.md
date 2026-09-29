# Our Kahani

Tagline: "From pehli baat to our kahani." Repo: `our-kahani`. First season: "Pehli Baat".
Private, end-to-end encrypted card games for two people getting to know each other.
Runs in mobile and laptop browsers only. Free, no ads, no tracking. Built for the Indian
diaspora anywhere (UK, US, Canada, Australia, South Africa, UAE and beyond), open to everyone.

The whole product is trust. If a change could let anyone, including the developer, read what
a couple wrote, do not make it. When a privacy tradeoff is unclear, stop and ask.

`prototype/index.html` is a throwaway demo that shows every screen and rule. Read it for
behaviour and copy. Do not ship it: it has no server, no encryption of its own data, inline
script, and Google Fonts.

## Hard rules: privacy and encryption
1. Plaintext user content never reaches the server, logs, analytics, backups or storage.
   That covers names, answers, comments, photos, voice notes, saved notes, Gentle Corner
   entries, the room hashtag. The server holds ciphertext plus minimal metadata only.
2. Use WebCrypto (AES-256-GCM). Fresh random 96-bit IV per encryption. Bind each ciphertext
   to its room, record and type with AAD so it cannot be moved. Version every envelope.
   Do not invent crypto. Do not add a crypto library without asking.
3. The room key is made on the creator's device and reaches the partner in the invite link
   fragment (after `#`), which browsers do not send to servers. Import it, then remove the
   fragment from the address bar. Never log a full invite URL.
4. The way back into a room is its hashtag plus a room phrase each person picks (owner's
   decision, replacing the 12 random words). The phrase is mandatory once the hashtag locks:
   at least 4 words, checked against names and the hashtag, stretched with PBKDF2-SHA256
   (600,000 rounds, salted with the hashtag) before HKDF derives the lookup token and wrap key.
   The phrase never leaves the device. A weak phrase could be guessed offline by whoever holds
   the database: never lower these limits without asking. If someone loses both device and
   phrase, only their partner can help: a one-time rescue code (80 random bits, 24 hours, single
   use) made on the partner's phone or laptop seals the room key for them. Support
   (support@unicodegroup.com) can explain this but can never see, reset or restore anything, and
   must never ask for a phrase, rescue code or invite link. Never add a server-side reset. Safari deletes IndexedDB and
   localStorage after 7 days of Safari use without interaction, so keys can vanish. Handle "key
   not found" gracefully. Request persistent storage. Nudge iPhone users to add to Home Screen.
5. "Answers stay hidden until both reply" is enforced by the server using metadata only
   (submitted flags), never by hiding data in the client. Withhold the partner's ciphertext
   until the rule passes. Realtime carries "answered" pings only, never content.
6. No email, phone number or real identity is collected. Anonymous auth only. Do not add
   third-party scripts, trackers, or ad SDKs. Keep server logs minimal.
7. Every new table, column, log line or storage object must be checked: could it hold
   plaintext? If yes, encrypt it or do not store it.
8. Saved notes are private to each person and encrypted with a key the partner never has.
   Saving never notifies the partner (surprises stay surprises). First run says saving exists.
9. Gentle Corner (sensitive sharing) is opt-in by both people: either can open it, which invites
   the other; nothing is shared until both have said yes. Its deck goes only as deep as the lighter
   of the two people's chosen depths (light, personal, emotional, deep). A heads-up can be saved by the
   partner only if the sharer ticked "OK to save". Taking it back deletes saved copies. Never
   put a partner's Gentle Corner entry in an export unless they allowed saving. The safety
   footer is country-aware and lists only numbers we have verified: UK 999 and Samaritans
   116 123, US 911 and 988, Canada 911 and 988, Australia 000 and Lifeline 13 11 14. Everywhere
   else say "call your local emergency number" and link findahelpline.com. Never guess numbers.

## Hard rules: room lifecycle
- A room lasts 28 days. In the last 7 days, each sign-in shows: Download everything, Keep it
  4 more weeks, or Remind me later. Keeping needs both people to agree; votes stay hidden from
  each other. Either person can erase now (confirm, offer download first).
- At the end date an unkept room is erased: ciphertext deleted and key discarded. No email
  reminders by default. Optional generic notification only ("Your room needs attention").
- Downloads are built on the device (the server cannot read data): a zip with answers .xlsx,
  the person's private notes .xlsx, photos, voice notes, README. See `docs/SECURITY.md`.
- The room hashtag is the room's permanent name. One person suggests, the other agrees or
  counters, then it locks for good. Write-once in the database, and encrypted like everything
  else. It is shown as the room name and is part of the salt for the room phrase, but never
  used alone to look up or authorise anything. Different name later means delete the room and
  start a new one.

## Hard rules: browser only
- Target: latest two versions of Safari (iOS 16.4+ and macOS), Chrome, Edge, Firefox, on phone
  and laptop. No native apps, no app store. Installable as a PWA. Phone-first layout that also
  works well on a laptop, keyboard accessible, touch targets at least 44px.
- Instagram's in-app browser can inject scripts and drops storage. Detect it and ask people to
  open the link in Safari or Chrome before any key is handled.
- Voice: pick the format with `MediaRecorder.isTypeSupported` (Chrome WebM/Opus, Safari
  audio/mp4). 32 kbps, 30 second cap, start recording only from a tap. Test iPhone to Android.
- Photos: compress in the browser (about 1280px longest side, JPEG, target 200 KB or less),
  which also strips location data. Never upload the original.
- Timers use timestamps, not tick counts (background tabs are throttled). Refetch on
  visibility change. iOS web push only works for installed Home Screen apps: optional only.

## Hard rules: cost (stay free)
- Supabase free plan: database over 500 MB makes the project read-only. Working budget 350 MB.
  Media does not go in Postgres. Encrypted photos and voice go to Cloudflare R2.
- Cap per room: items, bytes per item, photos (about 20), voice notes (30 s). Store binary as
  bytea, not base64. One index per table unless measured. Nightly batched deletion of expired
  rooms. Clean up old anonymous users. Daily size check: 60% and 80% alerts to the developer,
  new rooms paused at 70%. Keep-alive ping so the free project never pauses.
- Read-only mode must still allow reading and downloading.
See `docs/STORAGE-BUDGET.md`.

## Product and content rules
- Every interaction is one tap or one line, under 20 seconds. No scores, streaks, quizzes that
  feel like tests, or guilt. Skipping is always fine. Playful and warm, never needy or mocking.
- Reveal after both answer. By default the invited person answers first (a room setting; never
  explain it on screen as a rule about anyone's preferences). Both people have opinions: show a
  one-line "why" with answers so it is not one person agreeing with everything.
- Official packs avoid: alcohol, non-vegetarian food, pets, ex-partners, heavy topics (only
  Gentle Corner handles those, opt in). Names are typed by users; never hardcode people.
- Copyright: no lyrics, poster images, or film dialogue. Films appear as emoji plus title.
- Indo-English voice with light Hindi words, inclusive of all Indian regions and faiths.
  Ten Indic scripts are used for the name and tagline (see prototype). Have native speakers
  review every translation before release.

## How to work here
- Small steps. Run `npm run qa` (build checks, unit tests with coverage, audit, all browser
  tests) and the isolation and plaintext-canary tests before saying done. See `docs/QA.md`.
- New screens go in `SCREENS` in `e2e/helpers.ts` so accessibility and visual tests cover them.
- Any change under `src/crypto/` or `supabase/` needs a short note in the PR on what the
  server can see afterwards.
- Ask before adding a dependency. Check bundle size and whether it phones home.
- Prefer boring, well-known approaches. No cleverness in security code.
- Production code has no inline scripts and no third-party hosts. Set strict security headers.

## More detail (read when relevant, do not import)
`docs/ARCHITECTURE.md` `docs/SECURITY.md` `docs/STORAGE-BUDGET.md` `docs/WEB-ONLY.md`
`docs/PRODUCT.md` `docs/CONTENT-PACKS.md` `docs/BUILD-PLAN.md` `docs/OPEN-DECISIONS.md` `docs/QA.md`
`docs/DESIGN.md` (visual design: tokens, screens, what differs from the handoff)
