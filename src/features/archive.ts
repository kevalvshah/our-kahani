import { PACKS, SEASON } from '../content/cards';
import { G_DEPTH, G_HELPS, G_TOPICS, labelOf } from '../content/extras';
import { K } from '../data/kinds';
import type { RoomData } from '../data/RoomData';
import { allOptions, answerText, entryFor, isAnswered, questionText, sourceText, type Answer, type BonusCard } from './cardLogic';
import type { SavedItem } from './saved';
import { makeXlsx, makeZip, slug, type Sheet } from './xlsx';

// "Download everything", built on this phone from decrypted data (the server cannot read the
// data, so it cannot build this). Only answers both people have opened are included, and a
// partner's Gentle Corner note only if they allowed saving.

const plain = (list: [string, string, string][], id: string) => list.find((x) => x[0] === id)?.[2] ?? id;
/** YYYY-MM-DD in this phone's own time zone (not UTC, which can be a day off). */
const localDate = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const today = () => localDate(Date.now());

export function savedSheets(items: SavedItem[], me: string, partner: string): Sheet[] {
  const rows = [['Saved on', 'Category', 'Source', 'Question or topic', `${partner} said`, 'You said', 'Your note', 'Date']];
  [...items]
    .sort((a, b) => b.t - a.t)
    .forEach((x) => rows.push([localDate(x.t), labelOf(x.label)[2], x.src, x.q, x.theirs, x.mine, x.note, x.date]));
  const dated = items
    .filter((x) => x.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((x) => [x.date, x.note || x.q, labelOf(x.label)[2], x.theirs]);
  return [
    { name: 'Saved', rows, widths: [12, 16, 20, 40, 36, 30, 36, 12] },
    { name: 'Important dates', rows: [['Date', 'What', 'Category', `${partner} said`], ...dated], widths: [12, 40, 16, 36] },
    {
      name: 'About',
      rows: [
        ['Item', 'Details'],
        ['Exported by', me],
        ['About', partner],
        ['Exported on', today()],
        ['Items saved', String(items.length)],
        ['Privacy', 'This file has things your partner shared with you. Keep it somewhere private.'],
      ],
      widths: [16, 70],
    },
  ];
}

/** Decrypted photos and voice notes, fetched by the caller (this module does no network). */
export interface MediaFile {
  name: string;
  data: Uint8Array;
}

export function buildArchive(d: RoomData, media: MediaFile[] = []): { bytes: Uint8Array<ArrayBuffer>; name: string } {
  const me = d.me === 'You' ? 'Me' : d.me;
  const partner = d.partner;
  const sheets: Sheet[] = [];

  // Answers both have opened.
  const ans = [['Source', 'Question or topic', `${me} (you)`, partner]];
  const refs = [
    ...Object.keys(SEASON).map((n) => `day:${n}`),
    ...PACKS.flatMap((p) => p.cards.map((_, i) => `pack:${p.id}:${i + 1}`)),
    ...d.list(K.BONUS_CARD).map((r) => r.ref),
  ];
  for (const ref of refs) {
    const bonus = d.list<BonusCard>(K.BONUS_CARD).find((r) => r.ref === ref)?.data;
    const entry = entryFor(ref, bonus);
    if (!entry) continue;
    const card = entry.card;
    if (card.type === 'noticed' || card.type === 'bug') continue;
    const mine = d.mine<Answer>(K.ANSWER, ref)?.data;
    const theirs = d.theirs<Answer>(K.ANSWER, ref)?.data;
    if (!isAnswered(card, mine) || !isAnswered(card, theirs)) continue;
    const opts = allOptions(card, mine, theirs);
    const pack = entry.pack ? PACKS.find((p) => p.id === entry.pack) : undefined;
    ans.push([sourceText(entry, pack?.name), questionText(entry), answerText(card, mine, opts), answerText(card, theirs, opts)]);
  }
  sheets.push({ name: 'Answers', rows: ans, widths: [20, 44, 34, 34] });

  const watched = d.list<{ t: string; when: string }>(K.WATCHED);
  if (watched.length) sheets.push({ name: 'Watched together', rows: [['Title', 'When'], ...watched.map((w) => [w.data.t, w.data.when])], widths: [40, 16] });

  const chapters = d.list<{ start: string; lines: { by: string; t: string }[] }>(K.STORY_CHAPTER);
  if (chapters.length) {
    sheets.push({
      name: 'Stories',
      rows: [['Chapter', 'Opening line', 'Sentences'], ...chapters.map((c, i) => [`Chapter ${i + 1}`, c.data.start, c.data.lines.map((l) => `${l.by}: ${l.t}`).join(' / ')])],
      widths: [12, 44, 80],
    });
  }
  const songs = d.list<{ songs: string[] }>(K.ANTA_SAVED);
  if (songs.length) sheets.push({ name: 'Our Soundtrack', rows: [['Chain', 'Songs'], ...songs.map((c, i) => [`Chain ${i + 1}`, c.data.songs.join(' > ')])], widths: [12, 80] });

  type GNote = { topics: string[]; helps: string[]; depth: string; line: string; canSave: boolean };
  const g = [['From', 'Shared', 'What helps', 'How much', 'Line']];
  const myNote = d.mine<GNote>(K.GENTLE_NOTE, 'note')?.data;
  const theirNote = d.theirs<GNote>(K.GENTLE_NOTE, 'note')?.data;
  for (const [who, n] of [
    [me, myNote],
    [partner, theirNote?.canSave ? theirNote : undefined],
  ] as const) {
    if (n) g.push([who, n.topics.map((x) => plain(G_TOPICS, x)).join('; '), n.helps.map((x) => plain(G_HELPS, x)).join('; '), plain(G_DEPTH, n.depth), n.line]);
  }
  if (g.length > 1) sheets.push({ name: 'Gentle Corner', rows: g, widths: [14, 44, 44, 28, 40] });

  const capMine = d.mine<{ line: string }>(K.CAPSULE, 'capsule');
  const capTheirs = d.theirs<{ line: string }>(K.CAPSULE, 'capsule');
  const cap = [['From', 'Line']];
  if (capMine) cap.push([me, capMine.data.line]);
  if (capTheirs) cap.push([partner, capTheirs.data.line]);
  if (cap.length > 1) sheets.push({ name: 'Time capsule', rows: cap, widths: [14, 60] });

  const hashtag = d.list<{ tag: string }>(K.HASHTAG)[0]?.data.tag;
  sheets.push({
    name: 'About',
    rows: [
      ['Item', 'Details'],
      ['Exported by', me],
      ['Room', hashtag ?? '(not named yet)'],
      ['Exported on', today()],
      ['Note', "Only answers you have both opened are included. A partner's Gentle Corner note is included only if they allowed saving."],
    ],
    widths: [16, 80],
  });

  const saved = d.list<SavedItem>(K.SAVED).map((r) => r.data);
  const files = [{ name: 'our-answers.xlsx', data: makeXlsx(sheets) }];
  if (saved.length) files.push({ name: `notes-about-${slug(partner)}.xlsx`, data: makeXlsx(savedSheets(saved, me, partner)) });
  const readme = `Your room data, ${today()}

This file was put together on your phone. The server cannot read your data, so it cannot make this for you.

Inside:
- our-answers.xlsx: the answers you both opened, plus watched-together, stories, songs and more
${saved.length ? `- notes-about-${slug(partner)}.xlsx: your private saved notes. Only you have these\n` : ''}${media.length ? `- media/: ${media.length} photos and voice notes, unlocked on this phone\n` : ''}
Your room stays until one of you erases it. Photos and voice notes are kept for 28 days each, so keep this file safe.
Keep this file somewhere private.
`;
  return { bytes: makeZip([{ name: 'README.txt', data: readme }, ...files, ...media.map((m) => ({ name: `media/${m.name}`, data: m.data }))]), name: `room-data-${today()}.zip` };
}
