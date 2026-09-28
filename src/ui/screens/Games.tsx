import { useState } from 'preact/hooks';
import { ANTAKSHARI_STARTERS, MICRO, STORY_STARTERS } from '../../content/extras';
import { K } from '../../data/kinds';
import { useRoomData } from '../../data/RoomData';
import type { DataRecord } from '../../state/controller';
import { Back, Chips, Done, Problem, RevealRow, ScreenTitle, Wait } from '../components';
import { PATHS } from '../router';

const stamp = () => Date.now().toString(36);

// ---------------------------------------------------------------------------
// Micro-Dates
// ---------------------------------------------------------------------------
interface MicroState {
  round: number;
  cur: number;
  resp: 'keen' | 'swap' | null;
  when: string | null;
  done: number;
  finished?: number;
  at: number;
}

export function MicroDates() {
  const d = useRoomData();
  const mine = d.mine<MicroState>(K.MICRO, 'micro')?.data;
  const theirs = d.theirs<MicroState>(K.MICRO, 'micro')?.data;
  const cur = [mine, theirs].filter(Boolean).sort((a, b) => a!.round - b!.round || a!.at - b!.at).pop();
  const round = cur?.round ?? 0;
  const finished = mine?.finished === round || theirs?.finished === round;
  const active = cur && !finished ? cur : null;
  const myResp = mine?.round === round ? mine.resp : null;
  const theirResp = theirs?.round === round ? theirs.resp : null;
  const when = (mine?.round === round ? mine.when : null) ?? (theirs?.round === round ? theirs.when : null);
  const doneCount = Math.max(mine?.done ?? 0, theirs?.done ?? 0);
  const base = (over: Partial<MicroState>): MicroState => ({
    round,
    cur: active?.cur ?? 0,
    resp: myResp,
    when: mine?.when ?? null,
    done: mine?.done ?? 0,
    at: Date.now(),
    ...over,
  });

  function spin() {
    let i = Math.floor(Math.random() * MICRO.length);
    if (MICRO.length > 1 && i === active?.cur) i = (i + 1) % MICRO.length;
    void d.put(K.MICRO, 'micro', { ...base({}), round: round + 1, cur: i, resp: 'keen', when: null, finished: undefined });
  }

  const idea = active ? MICRO[active.cur] : null;
  return (
    <section>
      <Back href={PATHS.today} label="← Today" />
      <div class="question-card">
        <span class="pack-tag">🎲 Micro-Dates</span>
        {!idea ? (
          <>
            <h1 class="question" tabIndex={-1}>
              Spin for a 15-minute date 🎲
            </h1>
            <p class="small muted">
              Small enough for a weekday. Nothing to plan.{doneCount ? ` ${doneCount} done so far.` : ''}
            </p>
            <button type="button" class="btn btn-primary btn-block seal" onClick={spin}>
              Spin 🎲
            </button>
          </>
        ) : (
          <>
            <div class="big-emoji" aria-hidden="true">
              {idea.e}
            </div>
            <h1 class="question" tabIndex={-1}>
              {idea.t}
            </h1>
            <p class="small">
              {idea.d} <b>About 15 minutes.</b>
            </p>
            {!(myResp && theirResp) ? (
              <>
                <div class="btn-pair">
                  <button type="button" class={myResp === 'keen' ? 'chip is-on chip-wide' : 'chip chip-wide'} aria-pressed={myResp === 'keen'} onClick={() => void d.put(K.MICRO, 'micro', base({ resp: 'keen' }))}>
                    Keen 🙌
                  </button>
                  <button type="button" class={myResp === 'swap' ? 'chip is-on chip-wide' : 'chip chip-wide'} aria-pressed={myResp === 'swap'} onClick={() => void d.put(K.MICRO, 'micro', base({ resp: 'swap' }))}>
                    Swap 🔄
                  </button>
                </div>
                {myResp && <Wait>Waiting for {d.partner} 💭 Tap to change your answer.</Wait>}
              </>
            ) : myResp === 'keen' && theirResp === 'keen' ? (
              <>
                <p class="reveal-banner">Both keen 🎉</p>
                {!when ? (
                  <>
                    <p class="field-label">When?</p>
                    <Chips
                      label="When"
                      value={null}
                      options={[
                        ['Tonight', 'Tonight'],
                        ['Tomorrow', 'Tomorrow'],
                        ['This weekend', 'This weekend'],
                      ]}
                      onPick={(w) => void d.put(K.MICRO, 'micro', base({ when: w }))}
                    />
                  </>
                ) : (
                  <>
                    <Done>Planned: {when} ✅</Done>
                    <button type="button" class="btn btn-primary btn-block seal" onClick={() => void d.put(K.MICRO, 'micro', base({ done: doneCount + 1, finished: round }))}>
                      We did it 🎉
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                <p class="reveal-banner">Different mood, no stress 🙂</p>
                <button type="button" class="btn btn-primary btn-block" onClick={spin}>
                  Spin again 🎲
                </button>
              </>
            )}
            {!(myResp === 'keen' && theirResp === 'keen' && when) && (
              <button type="button" class="btn btn-secondary btn-block seal" onClick={spin}>
                Not this one, spin again
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Antakshari Lite: last letter, next song (song titles only, never lyrics)
// ---------------------------------------------------------------------------
const lastLetter = (t: string) => {
  const x = t.replace(/[^A-Za-z]/g, '');
  return x ? x.slice(-1).toUpperCase() : '';
};
const firstLetter = (t: string) => t.match(/[A-Za-z]/)?.[0]?.toUpperCase() ?? '';

function since<T>(items: DataRecord<T>[], after: number) {
  return items.filter((x) => x.createdAt > after);
}

export function Antakshari() {
  const d = useRoomData();
  const saved = d.list<{ songs: string[] }>(K.ANTA_SAVED);
  const lastSaved = saved[saved.length - 1]?.createdAt ?? 0;
  const chain = since(d.list<{ t?: string; pass?: boolean }>(K.ANTAKSHARI), lastSaved);
  const starter = ANTAKSHARI_STARTERS[saved.length % ANTAKSHARI_STARTERS.length]!;
  const songs = [starter, ...chain.filter((x) => x.data.t).map((x) => x.data.t!)];
  const L = lastLetter(songs[songs.length - 1]!);
  const last = chain[chain.length - 1];
  const myTurn = !last || !last.mine;
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  async function add() {
    const t = text.trim().slice(0, 60);
    if (!t) return;
    if (firstLetter(t) !== L) return setProblem(`It needs to start with “${L}”. Try another 🎵`);
    setProblem(null);
    setText('');
    await d.add(K.ANTAKSHARI, `song:${stamp()}`, { t });
  }

  return (
    <section>
      <Back href={PATHS.today} label="← Today" />
      <div class="question-card">
        <span class="pack-tag">🎵 Antakshari Lite</span>
        <h1 class="question" tabIndex={-1}>
          Last letter, next song
        </h1>
        <p class="small muted">Start your song with the last letter of the previous one. Titles only. Take turns.</p>
        <div class="chain">
          <div class="bubble">
            🎵 {starter}
            <small>Starter</small>
          </div>
          {chain.map((x) => (
            <div key={x.id} class={`bubble ${x.mine ? 'bubble-mine' : 'bubble-theirs'}`}>
              {x.data.pass ? '⏭️ passed' : `🎵 ${x.data.t}`}
              <small>{x.mine ? 'You' : d.partner}</small>
            </div>
          ))}
        </div>
        {myTurn ? (
          <>
            <label class="field-label" for="anta">
              Your song starts with <b class="accent-text">{L}</b>
            </label>
            <input id="anta" class="field" maxLength={60} value={text} placeholder="Hindi, Gujarati or English" autocomplete="off" onInput={(e) => setText((e.target as HTMLInputElement).value)} />
            <Problem text={problem} />
            <div class="btn-pair">
              <button type="button" class="btn btn-primary" onClick={() => void add()}>
                Add song 🎵
              </button>
              <button type="button" class="btn btn-secondary btn-narrow" onClick={() => void d.add(K.ANTAKSHARI, `song:${stamp()}`, { pass: true })}>
                Pass
              </button>
            </div>
          </>
        ) : (
          <Wait>
            Waiting for {d.partner} 🎵 They need a song starting with {L}
          </Wait>
        )}
        {songs.length >= 7 && (
          <button type="button" class="btn btn-secondary btn-block seal" onClick={() => void d.add(K.ANTA_SAVED, `chain:${stamp()}`, { songs })}>
            Save this chain to Our Soundtrack 🎶
          </button>
        )}
        {saved.length > 0 && (
          <>
            <h2 class="sub-title">Our Soundtrack</h2>
            {saved.map((c, i) => (
              <details key={c.id} class="chapter">
                <summary>
                  Chain {i + 1} · {c.data.songs.length} songs
                </summary>
                {c.data.songs.map((t, j) => (
                  <div key={j}>🎵 {t}</div>
                ))}
              </details>
            ))}
          </>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Story Relay: one sentence each
// ---------------------------------------------------------------------------
export function StoryRelay() {
  const d = useRoomData();
  const chapters = d.list<{ start: string; lines: { by: string; t: string }[] }>(K.STORY_CHAPTER);
  const lastChapter = chapters[chapters.length - 1]?.createdAt ?? 0;
  const lines = since(d.list<{ t: string }>(K.STORY_LINE), lastChapter);
  const names = d.room.role === 'creator' ? [d.me, d.partner] : [d.partner, d.me];
  const start = STORY_STARTERS[chapters.length % STORY_STARTERS.length]!.replace('{A}', names[0]!).replace('{B}', names[1]!);
  const last = lines[lines.length - 1];
  const myTurn = !last || !last.mine;
  const [text, setText] = useState('');

  async function finish(extra?: { by: string; t: string }) {
    const all = lines.map((l) => ({ by: l.mine ? d.me : d.partner, t: l.data.t }));
    await d.add(K.STORY_CHAPTER, `chapter:${stamp()}`, { start, lines: extra ? [...all, extra] : all });
  }

  async function add() {
    const t = text.trim().slice(0, 140);
    if (!t) return;
    setText('');
    await d.add(K.STORY_LINE, `line:${stamp()}`, { t });
    if (lines.length + 1 >= 8) await finish({ by: d.me, t });
  }

  return (
    <section>
      <Back href={PATHS.today} label="← Today" />
      <div class="question-card">
        <span class="pack-tag">📖 Story Relay</span>
        <h1 class="question" tabIndex={-1}>
          One sentence each
        </h1>
        <div class="story-start">{start}</div>
        <div class="chain">
          {lines.map((x) => (
            <div key={x.id} class={`bubble ${x.mine ? 'bubble-mine' : 'bubble-theirs'}`}>
              {x.data.t}
              <small>{x.mine ? 'You' : d.partner}</small>
            </div>
          ))}
        </div>
        {myTurn ? (
          <>
            <label class="field-label" for="story">
              Your sentence ({lines.length} so far)
            </label>
            <input id="story" class="field" maxLength={140} value={text} placeholder="One sentence. Keep it silly." autocomplete="off" onInput={(e) => setText((e.target as HTMLInputElement).value)} />
            <div class="btn-pair">
              <button type="button" class="btn btn-primary" disabled={!text.trim()} onClick={() => void add()}>
                Add ✍️
              </button>
              <button type="button" class="btn btn-secondary btn-narrow" disabled={lines.length < 4} onClick={() => void finish()}>
                Finish 🎬
              </button>
            </div>
          </>
        ) : (
          <Wait>Waiting for {d.partner} ✍️</Wait>
        )}
        {chapters.length > 0 && (
          <>
            <h2 class="sub-title">Chapters so far</h2>
            {chapters.map((c, i) => (
              <details key={c.id} class="chapter">
                <summary>
                  Chapter {i + 1} · {c.data.lines.length} sentences
                </summary>
                <p class="small">
                  <i>{c.data.start}</i>
                </p>
                {c.data.lines.map((l, j) => (
                  <p key={j} class="small">
                    {l.t} <span class="muted">— {l.by}</span>
                  </p>
                ))}
              </details>
            ))}
          </>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Time Capsule: sealed by the server for 90 days, then both lines open
// ---------------------------------------------------------------------------
const CAPSULE_DAYS = 90;
const fmtDate = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export function TimeCapsule() {
  const d = useRoomData();
  const mine = d.mine<{ line: string }>(K.CAPSULE, 'capsule');
  const theirs = d.theirs<{ line: string }>(K.CAPSULE, 'capsule');
  const theySealed = d.partnerAnswered(K.CAPSULE, 'capsule');
  const opensAt = (mine?.createdAt ?? Date.now()) + CAPSULE_DAYS * 86_400_000;
  const opened = !!theirs;
  const [text, setText] = useState('');

  return (
    <section>
      <Back href={PATHS.today} label="← Today" />
      <div class="question-card">
        <span class="pack-tag">⏳ Time Capsule</span>
        <h1 class="question" tabIndex={-1}>
          A note to future us
        </h1>
        <p class="small">
          Optional, and best kept for when things feel right. Write one line to your future selves. The server keeps it sealed
          for three months: until <b>{fmtDate(opensAt)}</b>. Your room needs to still be around then (keep it going from Room
          data).
        </p>
        {!mine ? (
          <>
            <label class="field-label" for="cap">
              One line for future us
            </label>
            <input id="cap" class="field" maxLength={140} value={text} autocomplete="off" onInput={(e) => setText((e.target as HTMLInputElement).value)} />
            <button type="button" class="btn btn-primary btn-block" disabled={!text.trim()} onClick={() => void d.put(K.CAPSULE, 'capsule', { line: text.trim() })}>
              Seal it 🔒
            </button>
          </>
        ) : (
          <div class="sealed">🔒 Your line is sealed</div>
        )}
        <p class="small muted">
          {mine ? 'You sealed ✓' : 'You have not sealed yet'} · {theySealed ? `${d.partner} sealed ✓` : `${d.partner} not yet`}
        </p>
        {opened && (
          <div class="reveal">
            <p class="reveal-banner">Three months later 💌</p>
            {mine && <RevealRow who="You" tone="mine">{mine.data.line}</RevealRow>}
            <RevealRow who={d.partner} tone="theirs">
              {theirs.data.line}
            </RevealRow>
          </div>
        )}
      </div>
    </section>
  );
}
