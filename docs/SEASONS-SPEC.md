# Seasons and "together" tools — spec

Status: approved direction from the owner (five seasons, playful first, own pace), built in one
PR. Inputs: `docs/brainstorms/stages.md` (one brainstorm per stage) and
`docs/research/relationship-research.md` (sources and evidence grades).

## 1. Principles (in priority order)

1. **Playful first.** The app is something a couple *wants* to open. At least 2 playful cards for
   every reflective one; never two reflective cards in a row; warm, desi, funny wording; no
   therapy words on screen. Heavier tools are one tap away, never on the main path, never pushed.
2. **Own pace, no labels.** Every season is open from the start. We never tell a couple what
   "stage" they are in (research: stages are themes, not a ladder — Lavner & Bradbury 2010).
3. **Answer separately, then reveal** is the core loop (proven in the category; also safer for a
   partner who avoids live conflict).
4. **Small bids matter most** (Gottman: turning toward bids 86% vs 33%). One-tap reactions,
   voice hugs, "thinking of you". **Never count** anything: no response rates, no streaks.
5. **Gratitude and good news** have the strongest evidence (Algoe; Gordon et al. 2012; Gable 2004):
   Shukriya jar and warm "tell me more" replies.
6. **Hard is ours, harmful is not.** A private "Is this hard, or is this harmful?" page with
   plain signs and verified help. No surveillance features (no read receipts, last seen, location).
7. **Privacy unchanged.** Everything new is an encrypted record; the server sees only kinds,
   opaque refs, times and sizes. Season memory is computed on the device.

## 2. Seasons

| # | Season | Stage theme (never shown as a label) | Feel |
|---|---|---|---|
| 1 | Pehli Baat | Getting to know the real you | Playful, 14 cards (unchanged) |
| 2 | Asli Kahani | The real us: funny habits, little differences, making up fast | Playful with a few gentle cards; opens with 6 Then vs Now callbacks |
| 3 | Sukoon | Comfortable, and still curious | New things, your world, little rituals |
| 4 | Saath | Team us | Thank-yous, choosing each other, life admin + a spark |
| 5 | Virasat | Our story, bigger | Dreams, traditions, giving back, romance anchors |

Refs: Season 1 keeps `day:N`; Seasons 2–5 use `season:<id>:<n>`. All seasons are answer cards
(kind 1): hidden until both answer, as today.

**Then vs Now card** (new card type `then`): shows both people's earlier answers to a Season 1
card (decrypted on the device, only if both had opened it), asks "Still true?" with options
(still true / changed / a bit of both) and an optional one-line why. Reveal line: "Still true for
you both 💛" / "Somebody's changed their mind 👀".

**What I learned about you** (Season 1 recap): the partner's Season 1 answers that both have
opened, in their words, with "you both said this" where it matches. On-device only.

## 3. Together tools

| Tool | What it does | Research | Where |
|---|---|---|---|
| **Dil ki Baat · Say it softly** | Chips: *I felt…* (feelings), *when…* (the moment, not the person), *what would help…* (needs), optional line or voice note. No "you always". | Gentle start-up (Gottman); NVC structure (weak evidence, used as a format only) | `/dil-ki-baat`, from "Talk it through" |
| **One-tap replies** | *I hear you 💛 / Chai and talk tonight? ☕ / Need a little time, not going anywhere / Sorry / Hug*. Every reply nudges to talk in person. | Turning toward bids; bridge not wall | On each soft note |
| **Repair shortcuts** | One tap: *Sorry. Start again? Hug-reset? I was wrong about something. Can we talk?* Partner replies with one tap. | Repair attempts (Gottman) | Dil ki Baat |
| **"I need 20 minutes"** | Timestamped pause; partner sees a calm banner on every screen: "needs a little time, not going anywhere"; ends with "ready to talk". | Flooding and the ≥20-minute break (Gottman) | Dil ki Baat |
| **Shukriya jar** | One thank-you a week each (prompts optional); opens when both have written that week. | Gratitude (Algoe; Gordon 2012) | `/shukriya` |
| **Weekly huddle** | 3 taps: best thing, hard thing, one thing I need (+ optional line); opens when both did it. | "State of the Union", cut to 20 seconds | `/huddle` |
| **Dreams board** | Shared dreams by type; react and add. | Shared meaning (Gottman), self-expansion (Aron) | `/dreams` |
| **Is this hard or harmful?** | Plain "hard" vs "harmful" signs, country-aware verified help, "leaving is not failing". Single-person page, nothing is sent. | WHO, Women's Aid/Refuge, NDVH; coercive control (Stark) | `/hard-or-harmful` |
| **Our Kahani book** | Printable story made on the device: seasons answered, thank-yous, dreams, photos and voice notes still kept. | Shared history | `/our-kahani-book` |

**"What do we need right now?"** on Today: Spark / Talk it through / Just fun / Plan together /
Say thanks. Spark and Just fun lead to playful cards and games; Talk it through opens Dil ki Baat
(the only way in from Today); Plan together opens Season 4–5 cards and the dreams board; Say
thanks opens the Shukriya jar.

## 4. Data (all encrypted records; server sees kind, ref, time, size)

| Kind | Range rule | Ref | Content |
|---|---|---|---|
| 3 SHUKRIYA | answer (hidden until both) | `jar:<yyyy-Www>` | `{t, prompt?, voice?}` |
| 4 HUDDLE | answer | `huddle:<yyyy-Www>` | `{best, hard, need, line?}` |
| 150 SOFT_NOTE | shared | `soft:<stamp>` | `{feelings[], when, needs[], line?, voice?}` |
| 151 SOFT_REPLY | shared | `softreply:<noteId>` | `{r}` |
| 152 PAUSE | shared | `pause` | `{until}` |
| 153 REPAIR / 154 REPAIR_REPLY | shared | `repair:<stamp>` / `repairreply:<id>` | `{r}` |
| 155 DREAM / 156 DREAM_REACT | shared | `dream:<stamp>` / `dreamreact:<id>` | `{type, t}` / `{e}` |

No schema change is needed: the existing rules already cover these ranges.

## 5. Notifications and toasts

Toasts (in-app, on-device) for: a soft note ("sent you something softly 💛"), a repair, a pause
(calm wording), a jar or huddle entry, a new dream. Push stays the generic "Your room needs
attention". **No** read receipts, typing indicators or "last seen".

## 6. Out of scope (parked)

Must-talk cards (owner: keep Season 1 light). AI rewording (would need plaintext on a server).
Therapist directory. Location-based dates. Compatibility scores.

## 7. Success signals (qualitative, no tracking)

We never collect analytics. In the first real-couple reviews: do they open the app on good
days (playful), did a soft note lead to a real conversation, do they pass reflective cards
often (tone too heavy?).

## 8. Build plan (one PR)

1. Content: Seasons 2–5 (playful rebalance), `then` card support, together lists.
2. Logic: season refs, keep playing through seasons, week keys, pause timer (unit-tested).
3. Screens: Seasons, Season, What I learned, Dil ki Baat (composer, replies, repairs, pause),
   partner pause banner, Shukriya jar, Huddle, Dreams, Hard or harmful, Our Kahani book,
   "What do we need" menu on Today; nav entries.
4. Toasts for the new kinds; download includes jar, huddle, dreams.
5. Tests: unit (logic, content rules), e2e journey for a Then vs Now card, a soft note and
   reply, the pause banner, the jar reveal; a11y/visual screens added to `SCREENS`.
