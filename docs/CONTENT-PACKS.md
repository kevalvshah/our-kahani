# Content packs

Packs are JSON files loaded by the app, so anyone can write one. Official packs are reviewed.

## Shape (sketch)
```json
{
  "id": "warm",
  "name": "Warm Words",
  "emoji": "💛",
  "blurb": "Affection, compliments, small kindnesses",
  "categoryOptIn": false,
  "cards": [
    { "type": "multi", "q": "How does affection land best for you?",
      "options": [["hugs","🤗","Hugs"],["words","💬","Kind words"]] },
    { "type": "choice", "q": "Nickname vibe?", "options": [["sweet","🍯","Something sweet"]] },
    { "type": "line", "q": "One thing you appreciated this week?", "placeholder": "One line" }
  ]
}
```
Types: `choice`, `pick`, `multi`, `nhie`, `guess`, `line`, `recall`, `bet`.

## Official packs in the prototype
Garba Season, Warm Words, Remember When, Fair Warning, Screen Time, Desi Abroad, Festival Season,
College Days, Filmy Fun, Family Tamasha, Dream and Cherish, Emoji Filmy Guess.

## Rules
- Follow the content rules in `CLAUDE.md`. No lyrics, posters or dialogue.
- Inclusive of all Indian regions, faiths and countries of residence. Playful, never stereotyping.
- Sensitive categories (Warm Words touch, Gentle Corner) are opt-in by both people.
- Community packs may be shared; only reviewed packs are featured.

## Gentle Corner deck
Lives in `src/content/gentle.ts`. Opt-in by both people. Card ids (`g-light-1`, `g-deep-14`, ...)
are stable: only append new cards at the end of a depth, never reorder.

### Depth levels
| Depth | What it covers |
|---|---|
| Light 🌤️ | Easy, feel-good sharing |
| Personal 🌱 | Habits, wishes and what matters to you |
| Emotional 🤍 | Feelings, worries and what comforts you |
| Deep 🌊 | Values, family, the future, and past hurts, handled gently |

Each person picks how deep they are happy to go. The deck shows cards up to the lower of the
two chosen depths, so nobody is taken further than they chose. Each depth has at least 12 cards.

### What the cards draw on
- Arthur Aron's escalating self-disclosure: easy shares first, deeper ones only once both opt in.
- John Gottman's love maps and open-ended questions: everyday likes, habits, hopes, people who matter.
- Love-language style preferences: how care lands best (words, time, gifts, help, touch).
- Attachment-aware comfort and soothing: listening, solving or space when stressed or quiet.
- Gottman's repair attempts: what a good apology looks like, what helps you reconnect.
- Diaspora family life: family involvement in decisions, faith and traditions, money, where to
  live, caring for parents. Children are asked once, neutrally, with "not sure yet" as an equal answer.

`GENTLE_RESEARCH_NOTES` in `gentle.ts` holds the plain-English version of these notes.

### Safety rules for Gentle Corner cards
- Never graphic. Never about trauma details, self-harm, abuse or ex-partners.
- Past hurts are only asked as "what helps you", never "what happened".
- Every tick-any or this-or-that card has a kind way out (option id `pass`, "Rather not say" or
  "Pass for now"). One-line cards say "or skip". Skipping is always fine.
- Never-have-I-ever cards stay at Light and Personal only.
- Phrase emotional and deep cards so both people can answer comfortably and the reveal feels caring.
- The safety footer and the rules in `CLAUDE.md` (saving, taking back, exports) still apply.
- `src/content/content.test.ts` checks card counts, unique ids, the pass option and a banned-word list.
