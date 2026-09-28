# Open decisions

1. Licence: MIT (simple) or AGPL-3.0 (keeps forks open). Decide before making the repo public.
2. Invite key handling: fragment-only, or add a short code exchanged on a call (a PAKE) so a
   chat provider reading the link cannot open the room.
3. Reminder email: none, or an opt-in email stored apart from the room. Default is none.
4. Read-only grace week after the end date: off by default; decide.
5. Room length: 28 days now; 90 days was floated for unopened rooms.
6. UI framework: plain TypeScript, Preact or React. Keep the bundle small.
7. Who answers first by default: the invited person. Keep as a room setting?
8. Translations: native review of all ten languages for name, tagline and copy.
9. Whether the first room is a surprise for the partner (affects first-run wording).
10. Domain, app name trademark check, GitHub org or user for the repo.
