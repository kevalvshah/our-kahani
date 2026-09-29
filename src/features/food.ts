import type { Opt } from '../content/cards';
import type { Diet } from '../content/packTypes';

// Food styles. Each person picks one; food cards follow the stricter of the two, so a dish only
// shows when both people eat it (the same "lighter choice wins" rule as Gentle Corner's depth).
// Nobody picks: vegetarian, which is how all official content was written.

export type FoodStyle = 'pure' | 'veg' | 'egg' | 'nonveg';

export const FOOD_STYLES: { id: FoodStyle; e: string; l: string; sub: string }[] = [
  { id: 'pure', e: '🌿', l: 'Pure veg', sub: 'Jain, or no onion and garlic' },
  { id: 'veg', e: '🥗', l: 'Vegetarian', sub: 'No meat, fish or egg' },
  { id: 'egg', e: '🍳', l: 'Eggetarian', sub: 'Vegetarian, plus egg' },
  { id: 'nonveg', e: '🍗', l: 'Non-veg', sub: 'Meat and fish too' },
];

const ORDER: FoodStyle[] = ['pure', 'veg', 'egg', 'nonveg'];
const ALLOWS: Record<FoodStyle, Diet[]> = { pure: [], veg: ['og'], egg: ['og', 'egg'], nonveg: ['og', 'egg', 'nonveg'] };

/** The room's food style: the stricter of the two people's choices. */
export function roomFood(a: FoodStyle | undefined, b: FoodStyle | undefined): FoodStyle {
  const rank = (x: FoodStyle | undefined) => ORDER.indexOf(x ?? 'veg');
  return ORDER[Math.min(rank(a), rank(b))]!;
}

export function allowedFor(opt: Opt, style: FoodStyle): boolean {
  return !opt.diet || ALLOWS[style].includes(opt.diet);
}

/** Options to show: those the room eats, plus any already picked (an answer never disappears). */
export function foodOptions(opts: Opt[], style: FoodStyle, keep: (string | undefined)[] = []): Opt[] {
  return opts.filter((o) => allowedFor(o, style) || keep.includes(o.id));
}
