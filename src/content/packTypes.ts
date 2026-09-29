// Shapes shared by the pack files (kept apart so the pack files do not import each other).

/**
 * Food a couple may not both eat. A food option carrying one of these shows only when both
 * people's food choice allows it (the stricter choice wins, like Gentle Corner's depth):
 * - `og`: onion, garlic or root vegetables (left out for Jain and no-onion-garlic homes)
 * - `egg`: contains egg
 * - `nonveg`: meat or fish
 */
export type Diet = 'og' | 'egg' | 'nonveg';

type RawOpt = [id: string, emoji: string, label: string, diet?: Diet];

export type RawCard =
  | { t: 'choice' | 'guess'; q: string; o: RawOpt[]; ans?: string; cheer?: boolean }
  | { t: 'nhie'; q: string }
  | { t: 'multi'; q: string; o: RawOpt[]; cheer?: boolean }
  | { t: 'line' | 'recall'; q: string; ph: string; banner?: string; cheer?: boolean };

/** A pack as written in a content file: id (lower-case letters only), name, emoji, blurb, cards. */
export type RawPack = [id: string, name: string, emoji: string, blurb: string, cards: RawCard[]];
