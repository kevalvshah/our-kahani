import { useState } from 'preact/hooks';
import { DREAM_TYPES, HUDDLE_BEST, HUDDLE_HARD, HUDDLE_NEED, SHUKRIYA_PROMPTS, type Item } from '../../content/together';
import { K } from '../../data/kinds';
import { useRoomData } from '../../data/RoomData';
import type { VoiceNote } from '../../features/cardLogic';
import { weekKey } from '../../features/together';
import { Back, Done, Problem, ScreenTitle, Wait } from '../components';
import { PATHS } from '../router';
import { VoicePlayer, VoiceRecord } from '../Voice';

// Little weekly rituals (a thank-you jar, a 20-second huddle) and a dreams board. Each weekly
// entry is an answer: the server keeps it hidden until both of you have written that week.

const label = (list: Item[], id: string) => {
  const x = list.find(([i]) => i === id);
  return x ? `${x[1]} ${x[2]}` : id;
};

const pastWeeks = (list: { ref: string }[], prefix: string, now: string) =>
  [...new Set(list.map((r) => r.ref).filter((r) => r.startsWith(prefix) && r !== `${prefix}${now}`))].sort().reverse();

// ---------------------------------------------------------------------------
// Shukriya jar
// ---------------------------------------------------------------------------
interface Thanks {
  t: string;
  voice?: VoiceNote;
}

export function ShukriyaJar() {
  const d = useRoomData();
  const week = weekKey(Date.now());
  const ref = `jar:${week}`;
  const mine = d.mine<Thanks>(K.SHUKRIYA, ref)?.data;
  const theirs = d.theirs<Thanks>(K.SHUKRIYA, ref)?.data;
  const partnerIn = d.partnerAnswered(K.SHUKRIYA, ref);
  const [text, setText] = useState(mine?.t ?? '');
  const [voice, setVoice] = useState<VoiceNote | undefined>(mine?.voice);
  const [prompt] = useState(() => SHUKRIYA_PROMPTS[Math.floor(Math.random() * SHUKRIYA_PROMPTS.length)] ?? 'Thank you for…');
  const [problem, setProblem] = useState<string | null>(null);
  const all = d.list<Thanks>(K.SHUKRIYA);

  async function save() {
    const t = text.trim().slice(0, 200);
    if (!t && !voice) return setProblem('A few words or a voice note is plenty.');
    setProblem(null);
    const ok = await d.put(K.SHUKRIYA, ref, voice ? { t, voice } : { t });
    if (!ok) setProblem(`${d.partner} has already opened this week's jar, so yours is locked in.`);
  }

  return (
    <section>
      <Back href={PATHS.today} label="← Today" />
      <ScreenTitle emoji="🫙" lead={`One thank-you a week each. The jar opens when you have both dropped one in.`}>
        Shukriya jar
      </ScreenTitle>
      {mine && theirs ? (
        <div class="reveal">
          <p class="reveal-banner">This week's jar is open 💛</p>
          <div class="bubble bubble-theirs">
            {theirs.t}
            {theirs.voice && <VoicePlayer note={theirs.voice} who={d.partner} />}
            <small>{d.partner}</small>
          </div>
          <div class="bubble bubble-mine">
            {mine.t}
            {mine.voice && <VoicePlayer note={mine.voice} who="you" />}
            <small>You</small>
          </div>
        </div>
      ) : (
        <div class="panel">
          <label class="field-label" for="thanks">
            {prompt}
          </label>
          <input id="thanks" class="field" maxLength={200} value={text} placeholder="…the chai you made when I was tired" autocomplete="off" onInput={(e) => setText((e.target as HTMLInputElement).value)} />
          {voice ? <Done>🎙️ Voice note added.</Done> : <VoiceRecord label="🎙️ Say it instead (optional)" onSent={setVoice} />}
          <Problem text={problem} />
          <button type="button" class="btn btn-primary btn-block seal" onClick={() => void save()}>
            {mine ? 'Change mine' : 'Drop it in the jar 🫙'}
          </button>
          {mine ? (
            <Wait>In the jar ✓ {partnerIn ? 'Opening…' : `It opens when ${d.partner} adds theirs.`}</Wait>
          ) : partnerIn ? (
            <Wait>{d.partner} has dropped one in 👀 Add yours and it opens.</Wait>
          ) : null}
        </div>
      )}
      {pastWeeks(all, 'jar:', week).length > 0 && (
        <>
          <h2 class="sub-title">Past weeks</h2>
          {pastWeeks(all, 'jar:', week).map((r) => {
            const m = d.mine<Thanks>(K.SHUKRIYA, r)?.data;
            const t = d.theirs<Thanks>(K.SHUKRIYA, r)?.data;
            return (
              <details key={r} class="chapter">
                <summary>{r.slice(4).replace('-W', ' · week ')}</summary>
                {t && <p class="small">💛 {d.partner}: {t.t}</p>}
                {m && <p class="small">💛 You: {m.t}</p>}
              </details>
            );
          })}
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Weekly huddle
// ---------------------------------------------------------------------------
interface Huddle {
  best: string;
  hard: string;
  need: string;
  line?: string;
}

function Pick({ title, items, value, onPick }: { title: string; items: Item[]; value: string; onPick: (id: string) => void }) {
  return (
    <>
      <p class="field-label">{title}</p>
      <div class="chip-row" role="group" aria-label={title}>
        {items.map(([id, e, l]) => (
          <button key={id} type="button" class={value === id ? 'chip is-on' : 'chip'} aria-pressed={value === id} onClick={() => onPick(id)}>
            {e} {l}
          </button>
        ))}
      </div>
    </>
  );
}

export function WeeklyHuddle() {
  const d = useRoomData();
  const week = weekKey(Date.now());
  const ref = `huddle:${week}`;
  const mine = d.mine<Huddle>(K.HUDDLE, ref)?.data;
  const theirs = d.theirs<Huddle>(K.HUDDLE, ref)?.data;
  const partnerIn = d.partnerAnswered(K.HUDDLE, ref);
  const [draft, setDraft] = useState<Huddle>(mine ?? { best: '', hard: '', need: '' });
  const ready = draft.best && draft.hard && draft.need;

  const show = (h: Huddle, who: string) => (
    <div class={`bubble ${who === 'You' ? 'bubble-mine' : 'bubble-theirs'}`}>
      <p class="small">🌟 {label(HUDDLE_BEST, h.best)}</p>
      <p class="small">🌧️ {label(HUDDLE_HARD, h.hard)}</p>
      <p class="small">🤲 {label(HUDDLE_NEED, h.need)}</p>
      {h.line && <p class="small">“{h.line}”</p>}
      <small>{who}</small>
    </div>
  );

  return (
    <section>
      <Back href={PATHS.today} label="← Today" />
      <ScreenTitle emoji="🤝" lead="Three taps, twenty seconds: how was your week, really? It opens when you have both done it.">
        Weekly huddle
      </ScreenTitle>
      {mine && theirs ? (
        <div class="reveal">
          <p class="reveal-banner">Your week, together 💛</p>
          {show(theirs, d.partner)}
          {show(mine, 'You')}
          <p class="small muted">Anything to talk about? Chai and a chat tonight ☕</p>
        </div>
      ) : (
        <div class="panel">
          <Pick title="Best thing this week" items={HUDDLE_BEST} value={draft.best} onPick={(best) => setDraft({ ...draft, best })} />
          <Pick title="A hard thing" items={HUDDLE_HARD} value={draft.hard} onPick={(hard) => setDraft({ ...draft, hard })} />
          <Pick title="One thing I'd love from you" items={HUDDLE_NEED} value={draft.need} onPick={(need) => setDraft({ ...draft, need })} />
          <label class="field-label" for="hline">
            Anything else? <span class="muted">(optional)</span>
          </label>
          <input id="hline" class="field" maxLength={120} value={draft.line ?? ''} autocomplete="off" onInput={(e) => setDraft({ ...draft, line: (e.target as HTMLInputElement).value })} />
          <button type="button" class="btn btn-primary btn-block seal" disabled={!ready} onClick={() => void d.put(K.HUDDLE, ref, { ...draft, line: draft.line?.trim() || undefined })}>
            {mine ? 'Update mine' : 'Done ✓'}
          </button>
          {mine ? <Wait>Done ✓ {partnerIn ? 'Opening…' : `It opens when ${d.partner} does theirs.`}</Wait> : partnerIn ? <Wait>{d.partner} has done theirs 👀</Wait> : null}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Dreams board
// ---------------------------------------------------------------------------
interface Dream {
  type: string;
  t: string;
}

const stamp = () => Date.now().toString(36);

export function DreamsBoard() {
  const d = useRoomData();
  const dreams = d.list<Dream>(K.DREAM).slice().reverse();
  const [type, setType] = useState(DREAM_TYPES[0]?.[0] ?? 'travel');
  const [text, setText] = useState('');

  async function add() {
    const t = text.trim().slice(0, 140);
    if (!t) return;
    setText('');
    await d.add(K.DREAM, `dream:${stamp()}`, { type, t });
  }

  return (
    <section>
      <Back href={PATHS.today} label="← Today" />
      <ScreenTitle emoji="🌠" lead="Big or small, silly or serious: the things you want to do together one day.">
        Dreams board
      </ScreenTitle>
      <div class="panel">
        <div class="chip-row" role="group" aria-label="Kind of dream">
          {DREAM_TYPES.map(([id, e, l]) => (
            <button key={id} type="button" class={type === id ? 'chip is-on' : 'chip'} aria-pressed={type === id} onClick={() => setType(id)}>
              {e} {l}
            </button>
          ))}
        </div>
        <label class="field-label" for="dream">
          One day, let's…
        </label>
        <input id="dream" class="field" maxLength={140} value={text} placeholder="see the Northern Lights with a flask of chai" autocomplete="off" onInput={(e) => setText((e.target as HTMLInputElement).value)} />
        <button type="button" class="btn btn-primary btn-block" disabled={!text.trim()} onClick={() => void add()}>
          Add to the board 🌠
        </button>
      </div>
      {dreams.length ? (
        <div class="dream-grid">
          {dreams.map((x) => {
            const react = (x.mine ? d.theirs : d.mine).call(d, K.DREAM_REACT, `dreamreact:${x.id}`) as { data: { e: string } } | undefined;
            return (
              <div key={x.id} class="dream">
                <span class="pill tint-gold">{label(DREAM_TYPES, x.data.type)}</span>
                <p>{x.data.t}</p>
                <small class="muted">{x.mine ? 'Your dream' : `${d.partner}'s dream`}</small>
                {react ? (
                  <small class="block">{x.mine ? d.partner : 'You'}: {react.data.e}</small>
                ) : (
                  !x.mine && (
                    <div class="cheers">
                      {['😍', '🙌', '🤞', '💛'].map((e) => (
                        <button key={e} type="button" aria-label={`React ${e}`} onClick={() => void d.put(K.DREAM_REACT, `dreamreact:${x.id}`, { e })}>
                          {e}
                        </button>
                      ))}
                    </div>
                  )
                )}
                {x.mine && (
                  <button type="button" class="btn-small" onClick={() => void d.remove(x.id)}>
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p class="small muted">Nothing here yet. Add the first one 🌠</p>
      )}
    </section>
  );
}
