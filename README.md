# Our Kahani

*From pehli baat to our kahani.*

Private, end-to-end encrypted card games for two people getting to know each other. Runs in any
mobile or laptop browser. Free, no ads, no tracking. Made with the Indian diaspora in mind
(UK, US, Canada, Australia, South Africa, UAE and beyond), open to everyone.

> Status: design and prototype. `prototype/index.html` is a clickable demo of every screen.
> The real app is not built yet. See `docs/BUILD-PLAN.md`.

## What it is
- One small card at a time: this-or-that, tick-any, one-line, Never Have I Ever, emoji film
  guesses, timed "Remember When", photo and voice moments, Movie Night with swipe to pick.
- Answers stay hidden until you both reply. No scores, no streaks, skipping is always fine.
- Packs: Warm Words, Fair Warning, Desi Abroad, Festival Season, Garba Season, Screen Time,
  Remember When and more. The first season is **Pehli Baat** (14 days).
- Saved notes about your partner: private, silent, exportable to Excel.
- Gentle Corner: an opt-in space for sharing what is on your mind, with consent built in.
- Your room lasts 28 days. Before it ends you can download everything or keep it 4 more weeks.

## Privacy promise
- End-to-end encrypted. The database holds scrambled data only, so even the developer cannot
  read names, answers, photos, voice notes or saved notes.
- No email or phone number needed. No ads. No tracking. No third-party scripts.
- You hold the key. Lose your phone and your 12-word recovery phrase and nobody can bring the
  room back, including us.
- Honest limits are in `docs/SECURITY.md`.

## Tech (planned)
Vite and TypeScript on Cloudflare Pages. Supabase (Postgres, Realtime, anonymous auth) for
ciphertext records. Cloudflare R2 with a small Worker for encrypted photos and voice.
Browser only: no app store, no native apps.

## Repo map
- `CLAUDE.md` rules for Claude Code and contributors
- `docs/` architecture, security, storage budget, web-only notes, product, packs, plan
- `prototype/` throwaway demo (single HTML file)

## Languages
The name and tagline appear in Hindi, Gujarati, Punjabi, Marathi, Bengali, Tamil, Telugu,
Kannada, Malayalam and Urdu. Translations need review by native speakers.

## License
To be decided. See `docs/OPEN-DECISIONS.md`.
