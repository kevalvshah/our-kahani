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
