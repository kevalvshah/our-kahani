# Build plan

Stage 0 (done): clickable prototype in `prototype/index.html`.

Stage 1: rooms and E2E core. Create room, invite link, join, recovery phrase, safety code,
key storage and recovery, delete room. Supabase schema with RLS. First card types (choice,
line) with the server-side reveal rule. Crypto tests, isolation tests, plaintext canary test.
Instagram in-app browser detection. Mobile and laptop layout.

Stage 2: seasons and packs. Pack loader (JSON), Pehli Baat season, remaining card types,
custom options, add-your-own cards, love and thinking-of-you.

Stage 3: Saved and export. Private notes, labels, dates, reminders, Excel export, zip download.

Stage 4: room lifecycle. 28-day timer, login popup, keep needs both, erase, download everything.

Stage 5: media. Photo compress and encrypt, R2 Worker, voice notes with cross-browser tests.

Stage 6: Gentle Corner with consent flags and country-aware safety footer.

Stage 7: extras. Movie Night, Micro-Dates, Antakshari, Story Relay, Time Capsule.

Stage 8: polish. PWA install, optional generic notifications, laptop layout, translations
reviewed by native speakers, accessibility pass, real-device test round.

Success signal for early users: both people answer at least 4 of the first 7 cards and ask for more.
