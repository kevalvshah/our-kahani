import { GENTLE_PREFIX, gentleEntry } from './gentleDeck';
import { entryForRef, NHIE_OPTS, TRY_LABELS, type Card, type CardEntry, type Opt } from '../content/cards';
import { PACK_LABEL } from '../content/extras';

// Pure card logic, shared by the card screen, Saved and the download.

/** What one person sent for a card (inside the encrypted envelope). */
export interface Answer {
  pick?: string;
  picks?: string[];
  why?: string;
  text?: string;
  skip?: boolean;
  rates?: Record<string, string>;
  /** Options this person added with "Something else…" (shown at the reveal). */
  custom?: Opt[];
  /** A voice note (recall cards): the encrypted audio is in the photo store under `obj`. */
  voice?: VoiceNote;
}

export interface VoiceNote {
  obj: string;
  secs: number;
  type: string;
}

export interface BonusCard {
  kind: 'choice' | 'nhie';
  q: string;
  a?: string;
  b?: string;
}

export function bonusEntry(ref: string, bonus: BonusCard): CardEntry {
  const card: Card =
    bonus.kind === 'nhie'
      ? { type: 'nhie', q: bonus.q, opts: NHIE_OPTS }
      : { type: 'choice', q: bonus.q, opts: [{ id: 'a', e: '👈', l: bonus.a ?? 'Option 1' }, { id: 'b', e: '👉', l: bonus.b ?? 'Option 2' }] };
  return { id: ref, tag: bonus.kind === 'nhie' ? 'Never have I ever' : 'This or that', card };
}

export function entryFor(ref: string, bonus?: BonusCard): CardEntry | null {
  if (ref.startsWith('bonus:')) return bonus ? bonusEntry(ref, bonus) : null;
  if (ref.startsWith(GENTLE_PREFIX)) return gentleEntry(ref);
  return entryForRef(ref);
}

export function baseOptions(card: Card): Opt[] {
  if ('opts' in card) return card.opts;
  if (card.type === 'try') return card.items;
  return [];
}

/** Base options plus any custom options either person added. */
export function allOptions(card: Card, ...answers: (Answer | undefined)[]): Opt[] {
  const extra = answers.flatMap((a) => a?.custom ?? []);
  return [...baseOptions(card), ...extra.filter((x, i) => extra.findIndex((y) => y.id === x.id) === i)];
}

export function optionLabel(opts: Opt[], id: string | undefined): string {
  const o = opts.find((x) => x.id === id);
  return o ? `${o.e} ${o.l}` : '';
}

export function isAnswered(card: Card, a: Answer | undefined): boolean {
  if (!a) return false;
  switch (card.type) {
    case 'multi':
      return (a.picks?.length ?? 0) > 0;
    case 'line':
      return !!a.text || !!a.skip;
    case 'recall':
      return !!a.text || !!a.skip || !!a.voice;
    case 'try':
      return !!a.rates && Object.keys(a.rates).length === card.items.length;
    default:
      return !!a.pick;
  }
}

/** Plain text of an answer, for Saved notes and the Excel download. */
export function answerText(card: Card, a: Answer | undefined, opts: Opt[] = allOptions(card, a)): string {
  if (!a) return '';
  const plain = (id: string) => opts.find((o) => o.id === id)?.l ?? id;
  switch (card.type) {
    case 'multi':
      return (a.picks ?? []).map(plain).join(', ');
    case 'line':
    case 'recall':
      if (a.voice) return `Voice note (${a.voice.secs} s)`;
      return a.skip ? 'Skipped' : (a.text ?? '');
    case 'try':
      return card.items.map((it) => `${it.l}: ${TRY_LABELS[a.rates?.[it.id] ?? '']?.replace(/[^\p{L}\s]/gu, '').trim() ?? ''}`).join('; ');
    default:
      return a.pick ? plain(a.pick) : '';
  }
}

export function questionText(entry: CardEntry): string {
  const c = entry.card;
  if (c.type === 'nhie') return `Never have I ever ${c.q}`;
  if (c.type === 'guess') return `Guess the film: ${c.q}`;
  if (c.type === 'noticed') return 'Things I noticed';
  if (c.type === 'bug') return 'Bug report';
  return c.q;
}

export function sourceText(entry: CardEntry, packName?: string): string {
  if (entry.pack) return packName ?? entry.tag;
  if (entry.id.startsWith('bonus:')) return 'Our own card';
  return entry.day ? `Day ${entry.day} · ${entry.tag}` : entry.tag;
}

export function labelFor(entry: CardEntry): string {
  if (entry.card.type === 'nhie') return 'nhie';
  return (entry.pack && PACK_LABEL[entry.pack]) || 'other';
}

/** The headline once both have answered. */
export function revealBanner(card: Card, mine: Answer, theirs: Answer, names: { me: string; partner: string; bettor?: string }): string {
  const opts = allOptions(card, mine, theirs);
  switch (card.type) {
    case 'nhie':
      if (mine.pick === theirs.pick) return mine.pick === 'have' ? 'Both guilty 😄' : 'Two angels 😇';
      return 'One of you has a story 👀';
    case 'pick': {
      if (mine.pick === theirs.pick) return `Sunday plan: ${optionLabel(opts, mine.pick)}`;
      return 'Two different picks. Take turns, or flip a coin 🪙';
    }
    case 'guess': {
      const ans = card.ans;
      const a = mine.pick === ans;
      const b = theirs.pick === ans;
      if (a && b) return 'Both got it 🎉';
      if (a) return `${names.me === 'You' ? 'You' : names.me} got it 😄`;
      if (b) return `${names.partner} got it 😄`;
      return 'Tough one! Nobody got it 😅';
    }
    case 'bet':
      return mine.pick === theirs.pick ? `${names.bettor ?? 'The bet'} called it 😏` : `${names.bettor ?? 'The bet'} was way off 🙈 They will live.`;
    case 'multi': {
      const common = (mine.picks ?? []).filter((x) => theirs.picks?.includes(x));
      return common.length ? `${common.length} in common 🎉` : 'No overlap yet. Plenty new to try 😄';
    }
    case 'line':
      return card.banner ?? 'Two answers ✍️';
    case 'recall':
      return 'Two memories 🧠';
    case 'try': {
      const both = card.items.filter((it) => mine.rates?.[it.id] === 'keen' && theirs.rates?.[it.id] === 'keen');
      return both.length ? `Both keen on ${both.length} ${both.length > 1 ? 'things' : 'thing'} 🎉` : 'No double-keens yet. Try a Maybe!';
    }
    default: {
      if (mine.pick === theirs.pick) {
        const o = opts.find((x) => x.id === mine.pick);
        return `You both picked ${o ? `${o.l.toLowerCase()} ${o.e}` : 'the same'} 🎉`;
      }
      return 'Two different picks. Good to know 😄';
    }
  }
}
