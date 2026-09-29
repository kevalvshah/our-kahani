import { describe, expect, it } from 'vitest';
import { entryForRef, NHIE_OPTS, PACKS, SEASON, type Card, type CardEntry } from '../content/cards';
import {
  allOptions,
  answerText,
  baseOptions,
  bonusEntry,
  entryFor,
  isAnswered,
  labelFor,
  optionLabel,
  questionText,
  revealBanner,
  sourceText,
  type Answer,
} from './cardLogic';

const day = (n: number) => SEASON[n]!.card;
const entry = (ref: string) => entryForRef(ref)!;
const names = { me: 'Asha', partner: 'Ravi' };

// Real cards from the content, by type.
const choice = day(1); // chai / coffee
const line = day(3); // banner: Two plates, two stories
const bet = day(4); // city / cottage
const noticed = day(5);
const pick = day(6); // in / west
const multi = day(8); // lie, brunch, walk, film, call, cook
const nhie = day(9);
const tryCard = day(14) as Extract<Card, { type: 'try' }>;
const recall = PACKS.find((p) => p.id === 'recall')!.cards[0]!;
const guess = PACKS.find((p) => p.id === 'emoji')!.cards[0]!; // ans ddlj
const plainLine: Card = { type: 'line', q: 'Q?', ph: '' };

describe('entries', () => {
  it('builds bonus cards from room data, with default option names', () => {
    const c = bonusEntry('bonus:1', { kind: 'choice', q: 'Tea?', a: 'Yes' });
    expect(c).toMatchObject({ id: 'bonus:1', tag: 'This or that', card: { type: 'choice', q: 'Tea?' } });
    expect(baseOptions(c.card).map((o) => o.l)).toEqual(['Yes', 'Option 2']);
    expect(baseOptions(bonusEntry('bonus:2', { kind: 'choice', q: 'x', b: 'B' }).card).map((o) => o.l)).toEqual(['Option 1', 'B']);
    const n = bonusEntry('bonus:3', { kind: 'nhie', q: 'sung in public' });
    expect(n.tag).toBe('Never have I ever');
    expect(baseOptions(n.card)).toEqual(NHIE_OPTS);
  });

  it('finds season, pack and bonus entries', () => {
    expect(entryFor('day:1')?.card).toBe(choice);
    expect(entryFor('pack:recall:1')?.pack).toBe('recall');
    expect(entryFor('bonus:x')).toBeNull();
    expect(entryFor('bonus:x', { kind: 'nhie', q: 'q' })?.id).toBe('bonus:x');
    expect(entryFor('nope')).toBeNull();
  });
});

describe('options', () => {
  it('lists base options by card type', () => {
    expect(baseOptions(choice).map((o) => o.id)).toEqual(['chai', 'coffee']);
    expect(baseOptions(tryCard)).toBe(tryCard.items);
    expect(baseOptions(line)).toEqual([]);
    expect(baseOptions(noticed)).toEqual([]);
  });

  it('adds custom options from both people, once each', () => {
    const extra = { id: 'x1', e: '✨', l: 'Green tea' };
    const opts = allOptions(choice, { pick: 'x1', custom: [extra] }, { pick: 'chai', custom: [extra, { id: 'x2', e: '🥛', l: 'Milk' }] }, undefined);
    expect(opts.map((o) => o.id)).toEqual(['chai', 'coffee', 'x1', 'x2']);
  });

  it('labels an option with its emoji, or nothing', () => {
    const opts = baseOptions(choice);
    expect(optionLabel(opts, 'chai')).toBe('☕ Chai');
    expect(optionLabel(opts, 'nope')).toBe('');
    expect(optionLabel(opts, undefined)).toBe('');
  });
});

describe('isAnswered', () => {
  it('needs an answer at all', () => {
    expect(isAnswered(choice, undefined)).toBe(false);
  });
  it('multi needs at least one tick', () => {
    expect(isAnswered(multi, { picks: ['lie'] })).toBe(true);
    expect(isAnswered(multi, { picks: [] })).toBe(false);
    expect(isAnswered(multi, {})).toBe(false);
  });
  it('line takes text or a skip', () => {
    expect(isAnswered(line, { text: 'dosa' })).toBe(true);
    expect(isAnswered(line, { skip: true })).toBe(true);
    expect(isAnswered(line, { text: '' })).toBe(false);
    expect(isAnswered(line, { voice: { obj: 'o', secs: 3, type: 'audio/mp4' } })).toBe(false);
  });
  it('recall also takes a voice note', () => {
    expect(isAnswered(recall, { voice: { obj: 'o', secs: 3, type: 'audio/mp4' } })).toBe(true);
    expect(isAnswered(recall, { text: 'x' })).toBe(true);
    expect(isAnswered(recall, { skip: true })).toBe(true);
    expect(isAnswered(recall, {})).toBe(false);
  });
  it('try needs every item rated', () => {
    const all = Object.fromEntries(tryCard.items.map((it) => [it.id, 'keen']));
    expect(isAnswered(tryCard, { rates: all })).toBe(true);
    expect(isAnswered(tryCard, { rates: { pottery: 'keen' } })).toBe(false);
    expect(isAnswered(tryCard, {})).toBe(false);
  });
  it('everything else needs a pick', () => {
    expect(isAnswered(choice, { pick: 'chai' })).toBe(true);
    expect(isAnswered(choice, {})).toBe(false);
    expect(isAnswered(nhie, { pick: 'have' })).toBe(true);
  });
});

describe('answerText', () => {
  it('is empty with no answer', () => {
    expect(answerText(choice, undefined)).toBe('');
  });
  it('joins multi picks, falling back to the id', () => {
    expect(answerText(multi, { picks: ['lie', 'walk', 'mystery'] })).toBe('A long lie-in, A long walk, mystery');
    expect(answerText(multi, {})).toBe('');
  });
  it('shows text, a skip or a voice note for line and recall cards', () => {
    expect(answerText(line, { text: 'Dosa' })).toBe('Dosa');
    expect(answerText(line, { skip: true })).toBe('Skipped');
    expect(answerText(line, {})).toBe('');
    expect(answerText(recall, { voice: { obj: 'o', secs: 12, type: 'audio/webm' }, text: 'ignored' })).toBe('Voice note (12 s)');
  });
  it('lists try ratings without emoji', () => {
    const rates = { pottery: 'keen', yoga: 'maybe', garba: 'no' };
    const text = answerText(tryCard, { rates });
    expect(text.startsWith('Pottery class: Keen; A yoga workshop: Maybe; Garba or dance class: Not for me; Photo walk: ;')).toBe(true);
    expect(answerText(tryCard, {})).toBe(tryCard.items.map((it) => `${it.l}: `).join('; '));
  });
  it('shows a pick by name, including custom options', () => {
    expect(answerText(choice, { pick: 'chai' })).toBe('Chai');
    expect(answerText(choice, { pick: 'x', custom: [{ id: 'x', e: '✨', l: 'Green tea' }] })).toBe('Green tea');
    expect(answerText(choice, {})).toBe('');
  });
});

describe('text for an entry', () => {
  it('phrases the question by card type', () => {
    expect(questionText(entry('day:9'))).toBe('Never have I ever burned the chai 🫖');
    expect(questionText(entry('pack:emoji:1'))).toBe('Guess the film: 🚂🌾💃');
    expect(questionText(entry('day:5'))).toBe('Things I noticed');
    expect(questionText(entry('day:7'))).toBe('Bug report');
    expect(questionText(entry('day:1'))).toBe('Chai or coffee to start the day?');
  });

  it('names the source', () => {
    expect(sourceText(entry('pack:recall:1'), 'Remember When!')).toBe('Remember When!');
    expect(sourceText(entry('pack:recall:1'))).toBe('Remember When');
    expect(sourceText(bonusEntry('bonus:1', { kind: 'nhie', q: 'q' }))).toBe('Our own card');
    expect(sourceText(entry('day:1'))).toBe('Day 1 · This or that');
    const noDay: CardEntry = { id: 'x', tag: 'Tag', card: choice };
    expect(sourceText(noDay)).toBe('Tag');
  });

  it('picks a Saved label', () => {
    expect(labelFor(entry('day:9'))).toBe('nhie');
    expect(labelFor(entry('pack:screen:1'))).toBe('watch');
    expect(labelFor(entry('pack:recall:1'))).toBe('other');
    expect(labelFor(entry('day:1'))).toBe('other');
  });
});

describe('revealBanner', () => {
  const b = (card: Card, mine: Answer, theirs: Answer, n: { me: string; partner: string; bettor?: string } = names) => revealBanner(card, mine, theirs, n);

  it('nhie', () => {
    expect(b(nhie, { pick: 'have' }, { pick: 'have' })).toBe('Both guilty 😄');
    expect(b(nhie, { pick: 'never' }, { pick: 'never' })).toBe('Two angels 😇');
    expect(b(nhie, { pick: 'have' }, { pick: 'never' })).toBe('One of you has a story 👀');
  });
  it('pick', () => {
    expect(b(pick, { pick: 'in' }, { pick: 'in' })).toBe('Sunday plan: 🇮🇳 Indian series');
    expect(b(pick, { pick: 'in' }, { pick: 'west' })).toBe('Two different picks. Take turns, or flip a coin 🪙');
  });
  it('guess', () => {
    expect(b(guess, { pick: 'ddlj' }, { pick: 'ddlj' })).toBe('Both got it 🎉');
    expect(b(guess, { pick: 'ddlj' }, { pick: 'kkhh' })).toBe('Asha got it 😄');
    expect(b(guess, { pick: 'ddlj' }, { pick: 'kkhh' }, { me: 'You', partner: 'Ravi' })).toBe('You got it 😄');
    expect(b(guess, { pick: 'kkhh' }, { pick: 'ddlj' })).toBe('Ravi got it 😄');
    expect(b(guess, { pick: 'kkhh' }, { pick: 'jwm' })).toBe('Tough one! Nobody got it 😅');
  });
  it('bet', () => {
    expect(b(bet, { pick: 'city' }, { pick: 'city' }, { ...names, bettor: 'Ravi' })).toBe('Ravi called it 😏');
    expect(b(bet, { pick: 'city' }, { pick: 'city' })).toBe('The bet called it 😏');
    expect(b(bet, { pick: 'city' }, { pick: 'cottage' }, { ...names, bettor: 'Asha' })).toBe('Asha was way off 🙈 They will live.');
    expect(b(bet, { pick: 'city' }, { pick: 'cottage' })).toBe('The bet was way off 🙈 They will live.');
  });
  it('multi', () => {
    expect(b(multi, { picks: ['lie', 'walk'] }, { picks: ['walk', 'lie', 'film'] })).toBe('2 in common 🎉');
    expect(b(multi, { picks: ['lie'] }, { picks: ['film'] })).toBe('No overlap yet. Plenty new to try 😄');
    expect(b(multi, {}, {})).toBe('No overlap yet. Plenty new to try 😄');
  });
  it('line and recall', () => {
    expect(b(line, { text: 'a' }, { text: 'b' })).toBe('Two plates, two stories 🍽️');
    expect(b(plainLine, { text: 'a' }, { text: 'b' })).toBe('Two answers ✍️');
    expect(b(recall, { text: 'a' }, { text: 'b' })).toBe('Two memories 🧠');
  });
  it('try', () => {
    const keen = (...ids: string[]) => ({ rates: Object.fromEntries(ids.map((id) => [id, 'keen'])) });
    expect(b(tryCard, keen('pottery', 'yoga'), keen('pottery', 'yoga'))).toBe('Both keen on 2 things 🎉');
    expect(b(tryCard, keen('pottery'), keen('pottery', 'yoga'))).toBe('Both keen on 1 thing 🎉');
    expect(b(tryCard, keen('pottery'), keen('yoga'))).toBe('No double-keens yet. Try a Maybe!');
    expect(b(tryCard, {}, {})).toBe('No double-keens yet. Try a Maybe!');
  });
  it('choice and other types', () => {
    expect(b(choice, { pick: 'chai' }, { pick: 'chai' })).toBe('You both picked chai ☕ 🎉');
    expect(b(choice, { pick: 'zzz' }, { pick: 'zzz' })).toBe('You both picked the same 🎉');
    expect(b(choice, { pick: 'chai' }, { pick: 'coffee' })).toBe('Two different picks. Good to know 😄');
  });
});

describe('gentle cards', () => {
  it('resolve through entryFor', () => {
    expect(entryFor('gentle:g-light-1')?.id).toBe('gentle:g-light-1');
    expect(entryFor('gentle:nope')).toBeNull();
  });
});

describe('then vs now', () => {
  it('has a warm reveal line for each outcome', () => {
    const card = { type: 'then' as const, q: 'Still?', from: 'day:1', opts: [] };
    const names = { me: 'You', partner: 'Ravi' };
    expect(revealBanner(card, { pick: 'same' }, { pick: 'same' }, names)).toBe('Still true for you both 💛');
    expect(revealBanner(card, { pick: 'changed' }, { pick: 'changed' }, names)).toBe('You have both changed a little 🌱');
    expect(revealBanner(card, { pick: 'same' }, { pick: 'changed' }, names)).toBe('Somebody has changed their mind 👀');
  });
});
