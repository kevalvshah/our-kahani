# Design: Kartavaya skin

> Implemented in `src/ui/` (tokens in `src/ui/tokens.css`, layout in `src/ui/app.css`, screens in
> `src/ui/screens/`). Deliberate differences from the handoff below:
> - Fonts are self-hosted from `@fontsource` packages (no Google Fonts), per CLAUDE.md.
> - Presentations are real browser behaviour: phones get header + bottom tabs, laptops (1024px+)
>   get the sidebar, the installed Home Screen app swaps the Today footnote. No drawn device frames.
> - No sample people, photos, notes or films in the live app: every name is typed by the person,
>   and screens show designed empty states until there is data.
> - Theme has a third choice, "Phone", matching the copy "Follow the phone, or lock it".
> - The safety code keeps six emoji from the no-animals set (the handoff shows five, one an animal).
> - The invite key highlight uses ink on accent-soft, and the E2E badge uses ink text, because
>   accent-coloured small text on the light paper is below WCAG AA contrast.
> - The safety footer is country-aware from the country chosen at setup, else the browser
>   language (UK, US, Canada, Australia verified numbers; everywhere else the generic line and
>   findahelpline.com).


## Overview
A full visual reskin of Our Kahani (the private, end-to-end encrypted two-person card game in
`kevalvshah/our-kahani`), plus ten screens, four runtime contexts (iPhone Safari, Android Chrome,
installed Home Screen app, laptop browser) and a six-axis personalisation layer.

The visual language is taken from kartavaya.com: teal on warm paper, editorial serif headings over a
neutral sans, quiet 1.5px borders, generous rounding, pill badges and icon-tiled rows. The playful
side of the original Our Kahani prototype is kept: dot-grid paper, big emoji option tiles, chunky
buttons, marigold and kumkum as supporting accents.

No Devanagari is used anywhere: English labels only (a deliberate change from the earlier draft).

## About the design files
The files in this bundle are **design references created in HTML** — a prototype of the intended look
and behaviour, not production code to lift. The task is to **recreate these screens inside the real
app's environment**: `our-kahani` is Vite + TypeScript + Preact with plain CSS in `src/ui/styles.css`,
so implement them as Preact components and CSS custom properties there, following the repo's rules in
`CLAUDE.md` (no inline scripts, no third-party hosts, no Google Fonts in production — self-host the
fonts or substitute a system stack).

`prototype-original-index.html` is the existing throwaway demo from the repo, included only as the
behaviour and copy reference it already is. Do not ship it.

## Fidelity
**High fidelity.** Colours, type sizes, radii, spacing and interactions below are final and should be
matched. Two deliberate placeholders: photos in Right Now and films in Movie Night are emoji blocks —
real photos come from users, and film artwork must never be used (copyright rule in `CLAUDE.md`).

## Design tokens

All theming is CSS custom properties set on a root element carrying
`data-k-theme`, `data-k-accent`, `data-k-motion`, `data-k-emoji`.

### Light (default)
| Token | Value | Use |
| --- | --- | --- |
| `--k-bg` | `#F3EEE5` | page / scroll area (warm paper) |
| `--k-surface` | `#FFFFFF` | cards, rows, headers, nav |
| `--k-surface2` | `#EDE7DC` | option tiles, inset chips |
| `--k-ink` | `#10201E` | body text |
| `--k-muted` | `#5D6B68` | secondary text |
| `--k-line` | `#DCD3C4` | all borders (1.5px) |
| `--k-accent` | `#04837A` | primary actions, active states |
| `--k-accent-soft` | `#DCEEEB` | accent tints, wait boxes |
| `--k-on-accent` | `#FFFFFF` | text on accent |
| `--k-gold` / `--k-gold-soft` | `#B5760A` / `#FBEBCC` | season badge, love button, safety footer |
| `--k-pink` / `--k-pink-soft` | `#C22357` / `#FBE0E8` | today dot, pack tag, partner reveal row |
| `--k-dot` | `rgba(16,32,30,.10)` | dot-grid texture |
| `--k-chrome` / `--k-chrome-ink` | `#E9E3D8` / `#3C4A47` | simulated browser chrome only — not app UI |
| `--k-shadow` | `rgba(16,32,30,.10)` | frame shadow |

### Dark
`--k-bg #0B1211` · `--k-surface #131F1E` · `--k-surface2 #1B2A28` · `--k-ink #EEF3F1` ·
`--k-muted #93A5A1` · `--k-line #263835` · `--k-accent #35B3A6` · `--k-accent-soft #0F2E2B` ·
`--k-on-accent #06201D` · `--k-gold #E9AE44` / `--k-gold-soft #39290B` · `--k-pink #F87FA0` /
`--k-pink-soft #3B1522` · `--k-dot rgba(238,243,241,.09)` · `--k-chrome #1D2C2A` /
`--k-chrome-ink #9FB1AD` · `--k-shadow rgba(0,0,0,.5)`.

### Accent overrides (override `--k-accent`, `--k-accent-soft`, `--k-on-accent` only)
| Accent | Light | Dark |
| --- | --- | --- |
| teal (default) | `#04837A` / `#DCEEEB` / `#FFFFFF` | `#35B3A6` / `#0F2E2B` / `#06201D` |
| kumkum | `#AE2049` / `#F7E2E7` / `#FFFFFF` | `#F0718D` / `#3A1220` / `#1A0810` |
| marigold | `#A96A06` / `#F8EBD2` / `#FFFFFF` | `#E0A337` / `#33260C` / `#1A1305` |
| neel | `#2F4FA8` / `#E2E8F8` / `#FFFFFF` | `#8AA6EE` / `#16204A` / `#0A1026` |

### Typography
- Display / headings: **Instrument Serif**, weight 400, italic used for emphasis inside headings.
  Sizes: page wordmark 30px; hero h1 44px/1.0, `-0.8px`; screen h2 30px; card question 29px/1.12;
  reveal banner 25px; app header wordmark 25px; sub-heading 21–22px.
- UI / body: **Instrument Sans** 400/500/600/700. Body 14.5px/1.5; secondary 13–13.5px;
  labels 11–12.5px, often `letter-spacing:.06em; text-transform:uppercase`; buttons 14–17px/700.
- Monospace (invite link only): `ui-monospace, SFMono-Regular, Menlo, monospace` 12.5px/1.6.
- Production: self-host both faces or fall back to `system-ui` + a serif stack. No Google Fonts CDN.

### Spacing, radius, elevation
- Radii: phone frame 44px (Android 30px, laptop window 14px); question card 26px; option tile 20px;
  buttons and cards 14–18px; icon tile 14px; pills 999px.
- Borders: 1.5px `--k-line` everywhere; 2px on selectable option tiles; 6px left rule on reveal rows.
- Padding: screen body 22px 18px 28px; cards 14–20px; primary button 17px 18px.
- Shadows: frame `0 26px 70px -26px var(--k-shadow)`; primary CTA `0 6px 0 -1px var(--k-accent-soft)`
  with `transform:translateY(2px)` on `:active`.
- Texture: `radial-gradient(circle, var(--k-dot) 1.4px, transparent 1.6px)` at `background-size:15px 15px`
  on the scroll area. Never above the ink opacity given by `--k-dot`.
- Touch targets: every interactive element ≥44px tall.

## Runtime contexts
One app, four presentations. Only chrome and navigation change — never the content.

| Context | Frame | Chrome | Navigation |
| --- | --- | --- | --- |
| iPhone Safari | 390×844, r44 | status bar, URL pill (`ourkahani.app`), bottom toolbar | bottom tabs |
| Android Chrome | 400×844, r30 | status bar, rounded omnibox, tab count, ⋮ | bottom tabs |
| Home Screen app | 390×844, r44, 8px ink bezel | status bar only, home indicator | bottom tabs |
| Laptop browser | 1040×720, r14 | traffic lights, one tab, URL bar | 236px left sidebar, all screens listed |

Laptop differences: no in-app header (the sidebar carries the wordmark, day count and room hashtag);
content column capped at 760px and centred; list rows become a two-column grid; bottom tabs hidden.
Installed context also swaps the Today footnote to the Home Screen message.

Bottom tabs are Today / Packs / Saved / Room. Everything else is reached from Today's "More ways to
play" rows (and from the sidebar on laptop).

## Screens

### 1. Today (`today`)
Purpose: the one thing waiting on you, plus everything else on offer.
- Season badge pill (gold-soft on 1.5px gold, "✨ Season 1 · Pehli Baat").
- Hero h1 "From pehli baat *to our kahani.* 💛" — italic clause in `--k-pink`.
- Intro paragraph, max 52ch: "One small card a day. One tap or one line, under twenty seconds.
  Answers stay hidden until you both reply — no scores, no streaks, skipping is always fine."
- Day strip: 14 circles, `grid-template-columns:repeat(7,1fr)`, gap 8px, max-width 420px.
  Answered = accent fill with ✓; today = pink border, pink-soft fill, `0 0 0 4px var(--k-pink-soft)`;
  future = surface on line border; beyond day 8 = muted text.
- Caption: "5 of 14 answered · dashed days are not in this demo".
- Primary CTA "🎉 Open today's card / Day 6 →" (accent, 700, pressed-down shadow), then ghost
  "💛 Send a 'thinking of you'".
- "🎲 More ways to play" rows: 42px tinted icon tile, title 15.5px/700, one-line description, pill on
  the right. Rows: Micro-Dates (Spin), Movie Night (Swipe), Right Now (New), Gentle Corner (On/Off),
  Invite & safety code (Setup), Make it ours (Look).
- Dashed footnote: chat-link delivery, or the Home Screen variant when installed.

### 2. Card + reveal (`card`)
Purpose: answer today's card, then see both answers.
- Back link "← Today".
- Question card: 26px radius, tag pill "💛 Warm Words" (pink-soft on pink), day label right,
  question "How does affection land best for you?", sub "Pick one. It stays hidden until Meera
  answers too."
- 2×2 option grid, 12px gap. Tile: centred, 42px emoji, 17px/600 label, 2px border, surface2 fill;
  selected = accent border + accent-soft fill + `k-pop .4s ease` on the emoji.
- After picking: accent-soft wait box ("**Saved.** Waiting for Meera…") and the reveal CTA
  "Meera has answered · open both →".
- Reveal block: banner 25px serif (both-same vs different copy), two rows with 6px left rules
  (yours accent, theirs pink), partner's line carries an italic one-line "why". Rows fade in with
  `k-lift .8s` (blur 10px → 0) inside a `k-rise .45s` container.
- Then a gold "💛 🥹 😂 🔥" reaction button and "🔖 Save this", with the note that saving is silent.

### 3. Card packs (`packs`)
Rows with 44px tinted emoji tile, name, blurb, progress pill (`4/9`). Seven official packs:
Warm Words 💛, Fair Warning ⚠️, Desi Abroad ✈️, Festival Season 🪔, Garba Season 💃,
Remember When ⏳, Screen Time 📺.

### 4. Movie Night (`movie`)
Centred 26px card, max 420px: 64px emoji stand-in, film title, "2 h 18 m · Hindi · Sci-fi",
👈 / 👉 buttons, counter line ("3 seen · 6 left in tonight's pile."). Below: "Matches so far" rows
with a "Both yes" pill, then a dashed note on watching apart (screen sharing goes black on big
streaming apps; SharePlay where supported; watch-party extension or a 3-2-1 countdown).
No poster art, ever — emoji plus title only.

### 5. Right Now (`photo`)
Primary "📷 Share a photo", then a responsive grid (`repeat(auto-fill,minmax(150px,1fr))`) of 4:5
tiles with tinted emoji placeholders, author and time. Dashed note: photos are shrunk and encrypted
on device, which strips location; the original never leaves the phone.

### 6. Gentle Corner (`gentle`)
Opt-in row with a 58×34 pill switch (accent when on). When on: a composer card with a sample
heads-up, a ticked "OK for Meera to save this" consent control, "Send gently", and the line about
taking it back deleting saved copies. Always visible: a gold safety panel —
"United Kingdom: 999 for emergencies, Samaritans 116 123, any time. Elsewhere: call your local
emergency number or find a line at findahelpline.com." Only verified numbers; make it country-aware
in production per `CLAUDE.md`.

### 7. Saved (`saved`)
Private note cards: uppercase accent label, date right, note body. "⬇️ Export to Excel" below.
Copy: "Your private notes about Meera. Silent, never shared, exportable to Excel."

### 8. Room data (`room`)
Definition list (Room `#chaiaurbaat`, Ends `19 days from today`, Encryption `AES-256-GCM, on device`),
then Download everything (accent), Keep it four more weeks, Erase the room, and the note that erasing
discards the keys for good.

### 9. Invite & safety code (`invite`)
Monospace invite link with the `#k=…` fragment coloured in accent to make the point that the key
lives after the hash; Copy link / Share; safety-code card with five emoji at 34px and the
compare-on-a-call explanation; gold panel on writing down the twelve words, Safari's 7-day storage
eviction, and adding to the Home Screen.

### 10. Make it ours (`look`)
Six setting cards, each a title, one-line description and a row of ≥44px choice buttons:
Theme (Light/Dark), Accent (Teal/Kumkum/Marigold/Neel), Text size (Small/Regular/Large),
Motion (Playful/Calm), Background (Dotted/Plain), Emoji icons (On/Off).
Framing copy: "Your settings, on your device only. They are never sent anywhere and your person can
pick something completely different."

### 11. In-app browser block (`blocked`)
Full-height centred: 🚪, "Open this in Safari or Chrome", explanation that the key has not been
touched yet, "Copy the link instead". Shown before any key handling when
`isInAppBrowser(navigator.userAgent)` is true (already in `src/platform/inAppBrowser.ts`). No bottom
tabs on this screen.

## Interactions & behaviour
- Tab / sidebar / jump navigation: pure client state, no route change needed for the prototype;
  in production use the app's routing.
- Card: tapping an option sets the pick and can be changed until reveal; reveal is gated on the
  partner's `submitted` flag and enforced server-side (RLS), never by hiding data client-side.
- Movie Night: either button advances the pile and increments the counter.
- Gentle Corner: the switch is per person; the corner only opens when both are on.
- Animations: `k-pop` 0.4s on selection, `k-rise` 0.45s on the reveal container, `k-lift` 0.8s blur
  removal on the answers. All suppressed when Motion = Calm (`[data-k-motion="calm"] *{animation:none;
  transition:none}`) and should also respect `prefers-reduced-motion`.
- Text size applies a scale to the content column (prototype uses `zoom`; in production prefer a root
  font-size / `rem` scale or a `--k-scale` multiplier).
- Emoji icons off hides `[data-k-em]` tiles only — never the words.
- Responsive: phone layout is a single column; at laptop width the sidebar appears, rows become two
  columns and the column caps at 760px. Nothing is fixed-height except the simulated device frames.

## State
`theme`, `accent`, `textSize`, `motion`, `texture`, `emojiIcons` — persist per device
(localStorage is fine; they contain no user content, but keep them out of anything synced).
`tab` (current screen), `pick` (today's answer), `revealed`, `gentle` (per-person opt-in),
`movieSeen`, `who` (prototype-only phone-swap toggle; the real app has one person per device).

Everything a person can read — names, answers, notes, photos, the hashtag — stays inside the
encrypted envelope. None of the settings above may be attached to server-side records that could
identify a person.

## Assets
None. All iconography is system emoji; photo and film artwork are deliberate placeholders. Fonts are
Instrument Serif and Instrument Sans (SIL Open Font License) — self-host in production.

## Files
- `Our Kahani - Kartavaya skin.dc.html` — the design reference: all ten screens, four contexts,
  light/dark, four accents, and the personalisation layer. Open it in a browser.
- `prototype-original-index.html` — the repo's existing demo (`prototype/index.html`), behaviour and
  copy reference only.
