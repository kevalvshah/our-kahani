import { describe, expect, it } from 'vitest';
import { K } from '../data/kinds';
import type { RoomData } from '../data/RoomData';
import type { DataRecord } from '../state/controller';
import type { Room } from '../state/room';
import { buildArchive, savedSheets } from './archive';
import type { SavedItem } from './saved';

// The download is built on the phone. These tests open the zip (and the xlsx files inside it,
// which are zips too) and check what ends up in it.

const dec = new TextDecoder();

function readZip(zip: Uint8Array): Map<string, Uint8Array> {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const eocd = zip.length - 22;
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out = new Map<string, Uint8Array>();
  for (let i = 0; i < count; i++) {
    const size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const local = v.getUint32(p + 42, true);
    const start = local + 30 + v.getUint16(local + 26, true);
    out.set(dec.decode(zip.subarray(p + 46, p + 46 + nameLen)), zip.subarray(start, start + size));
    p += 46 + nameLen;
  }
  return out;
}

/** All sheet XML of an xlsx, keyed by sheet name. */
function sheets(xlsx: Uint8Array): Record<string, string> {
  const files = readZip(xlsx);
  const names = [...dec.decode(files.get('xl/workbook.xml')).matchAll(/<sheet name="([^"]*)"/g)].map((m) => m[1]!);
  return Object.fromEntries(names.map((n, i) => [n, dec.decode(files.get(`xl/worksheets/sheet${i + 1}.xml`))]));
}

type Rec = Omit<DataRecord, 'id' | 'createdAt'>;

function fake(records: Rec[], names: { me?: string; partner?: string } = {}): RoomData {
  const recs = records.map((r, i) => ({ ...r, id: `id${i}`, createdAt: i }));
  const find = (kind: number, ref: string, mine: boolean) => recs.find((r) => r.kind === kind && r.ref === ref && r.mine === mine);
  return {
    room: { id: 'r', startedAt: 0, endsAt: Date.UTC(2026, 5, 7) } as Room,
    records: recs,
    mine: (kind: number, ref: string) => find(kind, ref, true),
    theirs: (kind: number, ref: string) => find(kind, ref, false),
    list: (kind: number) => recs.filter((r) => r.kind === kind),
    me: names.me ?? 'Asha',
    partner: names.partner ?? 'Ravi Kumar',
  } as unknown as RoomData;
}

const both = (ref: string, mine: unknown, theirs: unknown): Rec[] => [
  { kind: K.ANSWER, ref, mine: true, data: mine },
  { kind: K.ANSWER, ref, mine: false, data: theirs },
];

const savedItem = (over: Partial<SavedItem>): SavedItem => ({
  kind: 'card',
  src: 'Day 1',
  q: 'Chai or coffee?',
  theirs: 'Chai',
  mine: 'Coffee',
  label: 'food',
  note: '',
  date: '',
  t: Date.UTC(2026, 4, 1),
  ...over,
});

const gentle = { topics: ['loud', 'unknown-topic'], helps: ['listen'], depth: 'heads' };

describe('buildArchive', () => {
  it('always has a README and the answers workbook', () => {
    const { bytes, name } = buildArchive(fake([]));
    expect(name).toMatch(/^room-data-\d{4}-\d{2}-\d{2}\.zip$/);
    const files = readZip(bytes);
    expect([...files.keys()]).toEqual(['README.txt', 'our-answers.xlsx']);
    const readme = dec.decode(files.get('README.txt'));
    expect(readme).toContain('The server cannot read your data');
    expect(readme).toContain('Your room ends on 2026-06-07');
    expect(readme).not.toContain('notes-about');
    expect(readme).not.toContain('media/');
    const s = sheets(files.get('our-answers.xlsx')!);
    expect(Object.keys(s)).toEqual(['Answers', 'About']);
    expect(s.About).toContain('(not named yet)');
    expect(s.About).toContain('2026-06-07');
    expect(s.Answers).toContain('Asha (you)');
  });

  it('includes only answers both people have given, and never noticed or bug cards', () => {
    const d = fake([
      ...both('day:1', { pick: 'chai' }, { pick: 'coffee' }),
      { kind: K.ANSWER, ref: 'day:2', mine: true, data: { pick: 'garba' } }, // partner has not answered
      ...both('day:3', { text: 'Dosa' }, { skip: true }),
      ...both('day:5', { pick: 'x' }, { pick: 'y' }), // noticed card
      ...both('day:7', { pick: 'x' }, { pick: 'y' }), // bug card
      ...both('pack:recall:1', { voice: { obj: 'o', secs: 9, type: 'audio/mp4' } }, { text: 'Our first call' }),
      { kind: K.BONUS_CARD, ref: 'bonus:b1', mine: false, data: { kind: 'choice', q: 'Beach or hills?', a: 'Beach', b: 'Hills' } },
      ...both('bonus:b1', { pick: 'a' }, { pick: 'b', custom: [{ id: 'c', e: '✨', l: 'Unused' }] }),
      // A bonus record with a malformed ref is skipped, not a crash.
      { kind: K.BONUS_CARD, ref: 'weird', mine: false, data: { kind: 'nhie', q: 'Hidden bonus' } },
      ...both('weird', { pick: 'have' }, { pick: 'have' }),
    ]);
    const s = sheets(readZip(buildArchive(d).bytes).get('our-answers.xlsx')!).Answers!;
    expect(s).toContain('Day 1 · This or that');
    expect(s).toContain('Chai or coffee to start the day?');
    expect(s).toContain('>Chai<');
    expect(s).toContain('>Coffee<');
    expect(s).not.toContain('garba floor or sofa');
    expect(s).toContain('>Dosa<');
    expect(s).toContain('>Skipped<');
    expect(s).not.toContain('Things I noticed');
    expect(s).not.toContain('Bug report');
    expect(s).toContain('>Remember When<');
    expect(s).toContain('Voice note (9 s)');
    expect(s).toContain('Our own card');
    expect(s).toContain('Beach or hills?');
    expect(s).toContain('>Hills<');
    expect(s).not.toContain('Hidden bonus');
    expect([...s.matchAll(/<row /g)]).toHaveLength(5); // header + 4 answers
  });

  it('adds watched, stories, songs, time capsule and the room name when present', () => {
    const d = fake([
      { kind: K.WATCHED, ref: 'w', mine: true, data: { t: '🚂 DDLJ', when: '2026-05-02' } },
      { kind: K.STORY_CHAPTER, ref: 's', mine: true, data: { start: 'Once upon a time', lines: [{ by: 'Asha', t: 'a chai' }, { by: 'Ravi', t: 'went cold' }] } },
      { kind: K.ANTA_SAVED, ref: 'a', mine: false, data: { songs: ['One', 'Two'] } },
      { kind: K.CAPSULE, ref: 'capsule', mine: true, data: { line: 'See you in 90 days' } },
      { kind: K.CAPSULE, ref: 'capsule', mine: false, data: { line: '=Hello from Ravi' } },
      { kind: K.HASHTAG, ref: 'tag', mine: true, data: { tag: '#ChaiAndCoffee' } },
    ]);
    const s = sheets(readZip(buildArchive(d).bytes).get('our-answers.xlsx')!);
    expect(Object.keys(s)).toEqual(['Answers', 'Watched together', 'Stories', 'Our Soundtrack', 'Time capsule', 'About']);
    expect(s['Watched together']).toContain('🚂 DDLJ');
    expect(s.Stories).toContain('Chapter 1');
    expect(s.Stories).toContain('Asha: a chai / Ravi: went cold');
    expect(s['Our Soundtrack']).toContain('One &gt; Two');
    expect(s['Time capsule']).toContain('See you in 90 days');
    expect(s['Time capsule']).toContain(`'=Hello from Ravi`); // formula neutralised
    expect(s.About).toContain('#ChaiAndCoffee');
  });

  it('includes one capsule line from either side alone', () => {
    const theirsOnly = sheets(readZip(buildArchive(fake([{ kind: K.CAPSULE, ref: 'capsule', mine: false, data: { line: 'Only theirs' } }])).bytes).get('our-answers.xlsx')!);
    expect(theirsOnly['Time capsule']).toContain('Only theirs');
  });

  it("includes the partner's Gentle Corner note only if they allowed saving", () => {
    const mineNote = { kind: K.GENTLE_NOTE, ref: 'note', mine: true, data: { ...gentle, line: 'My line', canSave: false } };
    const theirs = (canSave: boolean) => ({ kind: K.GENTLE_NOTE, ref: 'note', mine: false, data: { ...gentle, line: 'Their line', canSave } });

    const allowed = sheets(readZip(buildArchive(fake([mineNote, theirs(true)])).bytes).get('our-answers.xlsx')!)['Gentle Corner']!;
    expect(allowed).toContain('My line');
    expect(allowed).toContain('Their line');
    expect(allowed).toContain('Loud or heated arguments; unknown-topic');
    expect(allowed).toContain('Just listen, no fixing');
    expect(allowed).toContain('Just the heads-up');

    const refused = sheets(readZip(buildArchive(fake([mineNote, theirs(false)])).bytes).get('our-answers.xlsx')!)['Gentle Corner']!;
    expect(refused).toContain('My line');
    expect(refused).not.toContain('Their line');

    const onlyTheirsRefused = sheets(readZip(buildArchive(fake([theirs(false)])).bytes).get('our-answers.xlsx')!);
    expect(onlyTheirsRefused['Gentle Corner']).toBeUndefined();
    const zip = buildArchive(fake([theirs(false)])).bytes;
    expect(dec.decode(zip)).not.toContain('Their line');
  });

  it('adds private saved notes as their own workbook, named after the partner', () => {
    const d = fake([{ kind: K.SAVED, ref: 's1', mine: true, data: savedItem({ note: 'Loves chai', date: '2026-06-01' }) }], { me: 'You', partner: 'Ravi Kumar' });
    const files = readZip(buildArchive(d).bytes);
    expect([...files.keys()]).toEqual(['README.txt', 'our-answers.xlsx', 'notes-about-Ravi-Kumar.xlsx']);
    expect(dec.decode(files.get('README.txt'))).toContain('- notes-about-Ravi-Kumar.xlsx: your private saved notes');
    const s = sheets(files.get('notes-about-Ravi-Kumar.xlsx')!);
    expect(Object.keys(s)).toEqual(['Saved', 'Important dates', 'About']);
    expect(s.Saved).toContain('Loves chai');
    expect(s.About).toContain('>Me<'); // "You" is written as "Me" in the file
    expect(sheets(files.get('our-answers.xlsx')!).Answers).toContain('Me (you)');
  });

  it('adds media files under media/', () => {
    const photo = new Uint8Array([0xff, 0xd8, 0xff, 1, 2]);
    const voice = new Uint8Array([7, 7, 7]);
    const files = readZip(buildArchive(fake([]), [{ name: 'photo-1.jpg', data: photo }, { name: 'voice-1.m4a', data: voice }]).bytes);
    expect(files.get('media/photo-1.jpg')).toEqual(photo);
    expect(files.get('media/voice-1.m4a')).toEqual(voice);
    expect(dec.decode(files.get('README.txt'))).toContain('- media/: 2 photos and voice notes');
  });
});

describe('savedSheets', () => {
  it('lists saved items newest first, and dated ones by date', () => {
    const items = [
      savedItem({ q: 'Old', t: Date.UTC(2026, 3, 1), date: '2026-07-01', label: 'important' }),
      savedItem({ q: 'New', t: Date.UTC(2026, 4, 2), date: '2026-06-01', note: 'Birthday' }),
      savedItem({ q: 'Undated', t: Date.UTC(2026, 4, 1), label: 'no-such-label' }),
    ];
    const [saved, dates, about] = savedSheets(items, 'Asha', 'Ravi');
    expect(saved!.rows[0]).toContain('Ravi said');
    expect(saved!.rows.slice(1).map((r) => r[3])).toEqual(['New', 'Undated', 'Old']);
    expect(saved!.rows[1]![0]).toBe('2026-05-02');
    expect(saved!.rows[2]![1]).toBe('Other'); // unknown labels fall back
    expect(saved!.rows[3]![1]).toBe('Important dates');
    expect(dates!.rows.slice(1)).toEqual([
      ['2026-06-01', 'Birthday', 'Food', 'Chai'],
      ['2026-07-01', 'Old', 'Important dates', 'Chai'],
    ]);
    expect(about!.rows).toContainEqual(['Exported by', 'Asha']);
    expect(about!.rows).toContainEqual(['About', 'Ravi']);
    expect(about!.rows).toContainEqual(['Items saved', '3']);
    // The input is not reordered.
    expect(items.map((x) => x.q)).toEqual(['Old', 'New', 'Undated']);
  });
});
