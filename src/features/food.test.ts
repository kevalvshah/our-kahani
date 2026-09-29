import { describe, expect, it } from 'vitest';
import type { Opt } from '../content/cards';
import { allowedFor, foodOptions, roomFood } from './food';

const dal: Opt = { id: 'dal', e: '🍲', l: 'Dal' };
const naan: Opt = { id: 'naan', e: '🫓', l: 'Garlic naan', diet: 'og' };
const omelette: Opt = { id: 'om', e: '🍳', l: 'Omelette', diet: 'egg' };
const biryani: Opt = { id: 'bir', e: '🍗', l: 'Chicken biryani', diet: 'nonveg' };
const all = [dal, naan, omelette, biryani];

describe('food styles', () => {
  it('the stricter of the two choices wins; nobody choosing means vegetarian', () => {
    expect(roomFood('nonveg', 'nonveg')).toBe('nonveg');
    expect(roomFood('nonveg', 'egg')).toBe('egg');
    expect(roomFood('pure', 'nonveg')).toBe('pure');
    expect(roomFood(undefined, 'nonveg')).toBe('veg');
    expect(roomFood(undefined, undefined)).toBe('veg');
  });

  it('shows only what the room eats', () => {
    expect(foodOptions(all, 'pure').map((o) => o.id)).toEqual(['dal']);
    expect(foodOptions(all, 'veg').map((o) => o.id)).toEqual(['dal', 'naan']);
    expect(foodOptions(all, 'egg').map((o) => o.id)).toEqual(['dal', 'naan', 'om']);
    expect(foodOptions(all, 'nonveg')).toHaveLength(4);
    expect(allowedFor(biryani, 'egg')).toBe(false);
  });

  it('keeps an option someone already picked', () => {
    expect(foodOptions(all, 'pure', ['bir']).map((o) => o.id)).toEqual(['dal', 'bir']);
  });
});
