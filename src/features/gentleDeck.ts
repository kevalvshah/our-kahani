import type { CardEntry } from '../content/cards';
import { GENTLE_CARDS, GENTLE_DEPTHS, type GentleDepth } from '../content/gentle';

// The Gentle Corner deck. Each person picks how deep they want to go; the deck only shows cards
// up to the lower of the two choices, so nobody is taken further than they chose.

export const GENTLE_PREFIX = 'gentle:';
const ORDER = GENTLE_DEPTHS.map((x) => x.id);

export function sharedDepth(mine: GentleDepth | undefined, theirs: GentleDepth | undefined): GentleDepth {
  const a = ORDER.indexOf(mine ?? 'light');
  const b = ORDER.indexOf(theirs ?? 'light');
  return ORDER[Math.max(0, Math.min(a, b))]!;
}

/** Cards open at this depth, lightest first. */
export function deckFor(depth: GentleDepth) {
  const upTo = ORDER.indexOf(depth);
  return GENTLE_CARDS.filter((c) => ORDER.indexOf(c.depth) <= upTo);
}

export const gentleRef = (id: string) => `${GENTLE_PREFIX}${id}`;

export function gentleEntry(ref: string): CardEntry | null {
  if (!ref.startsWith(GENTLE_PREFIX)) return null;
  const c = GENTLE_CARDS.find((x) => x.id === ref.slice(GENTLE_PREFIX.length));
  if (!c) return null;
  const depth = GENTLE_DEPTHS.find((x) => x.id === c.depth)!;
  return { id: ref, tag: `💛 Gentle Corner · ${depth.l}`, card: c.card };
}
