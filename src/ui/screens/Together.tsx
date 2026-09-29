import { useEffect, useState } from 'preact/hooks';
import { FEELINGS, NEEDS, REPAIRS, SOFT_REPLIES, WHEN_HINTS, type Item } from '../../content/together';
import { K } from '../../data/kinds';
import { useRoomData } from '../../data/RoomData';
import type { VoiceNote } from '../../features/cardLogic';
import { PAUSE_MS, pauseLeft } from '../../features/together';
import { Back, Done, Link, Problem, ScreenTitle, Wait } from '../components';
import { PATHS } from '../router';
import { VoicePlayer, VoiceRecord } from '../Voice';

// Dil ki Baat: for when something is hard to say face to face. Everything here is built from
// gentle pieces (no "you always"), answered with one tap, and always nudges back to talking.

interface Soft {
  feelings: string[];
  when: string;
  needs: string[];
  line?: string;
  voice?: VoiceNote;
}

const label = (list: Item[], id: string) => {
  const x = list.find(([i]) => i === id);
  return x ? `${x[1]} ${x[2]}` : id;
};

const stamp = () => Date.now().toString(36);

export function DilKiBaat() {
  const d = useRoomData();
  const [compose, setCompose] = useState(false);
  const notes = d.list<Soft>(K.SOFT_NOTE).slice().reverse();
  return (
    <section>
      <Back href={PATHS.today} label="← Today" />
      <ScreenTitle emoji="🫶" lead="For the things that are hard to say out loud. Say it softly, and then talk about it together.">
        Dil ki Baat
      </ScreenTitle>
      <PauseControl />
      <h2 class="sub-title">Say it softly</h2>
      {compose ? (
        <Composer onDone={() => setCompose(false)} />
      ) : (
        <button type="button" class="btn btn-primary btn-block" onClick={() => setCompose(true)}>
          💬 Tell {d.partner} how you feel
        </button>
      )}
      {notes.map((n) => (
        <SoftNote key={n.id} id={n.id} note={n.data} mine={n.mine} />
      ))}
      <h2 class="sub-title">Repair, in one tap</h2>
      <Repairs />
      <div class="panel">
        <p class="small">
          Every couple has hard weeks. If things feel <b>harmful</b> rather than hard, that is different, and you deserve help.
        </p>
        <Link class="btn btn-secondary btn-block" href={PATHS.safety}>
          Is this hard, or is this harmful?
        </Link>
      </div>
    </section>
  );
}

function Composer({ onDone }: { onDone: () => void }) {
  const d = useRoomData();
  const [draft, setDraft] = useState<Soft>({ feelings: [], when: '', needs: [] });
  const [problem, setProblem] = useState<string | null>(null);
  const toggle = (key: 'feelings' | 'needs', id: string) =>
    setDraft((x) => ({ ...x, [key]: x[key].includes(id) ? x[key].filter((y) => y !== id) : [...x[key], id] }));

  async function send() {
    if (!draft.feelings.length) return setProblem('Pick at least one feeling.');
    if (!draft.needs.length) return setProblem('Pick what would help, even if it is just “listen”.');
    await d.add(K.SOFT_NOTE, `soft:${stamp()}`, { ...draft, when: draft.when.trim().slice(0, 120), line: draft.line?.trim().slice(0, 140) || undefined });
    onDone();
  }

  return (
    <div class="panel">
      <p class="field-label">
        I felt… <span class="pill tint-gold">Select one or more</span>
      </p>
      <div class="chip-row" role="group" aria-label="Feelings">
        {FEELINGS.map(([id, e, l]) => (
          <button key={id} type="button" class={draft.feelings.includes(id) ? 'chip is-on' : 'chip'} aria-pressed={draft.feelings.includes(id)} onClick={() => toggle('feelings', id)}>
            {e} {l}
          </button>
        ))}
      </div>
      <label class="field-label" for="swhen">
        …when <span class="muted">(about the moment, not the person)</span>
      </label>
      <input id="swhen" class="field" maxLength={120} value={draft.when} placeholder={WHEN_HINTS[0] ?? 'when plans changed last minute'} autocomplete="off" onInput={(e) => setDraft({ ...draft, when: (e.target as HTMLInputElement).value })} />
      <div class="chip-row">
        {WHEN_HINTS.slice(1).map((h) => (
          <button key={h} type="button" class="chip" onClick={() => setDraft({ ...draft, when: h })}>
            {h}
          </button>
        ))}
      </div>
      <p class="field-label">
        What would help is… <span class="pill tint-gold">Select one or more</span>
      </p>
      <div class="chip-row" role="group" aria-label="What would help">
        {NEEDS.map(([id, e, l]) => (
          <button key={id} type="button" class={draft.needs.includes(id) ? 'chip is-on' : 'chip'} aria-pressed={draft.needs.includes(id)} onClick={() => toggle('needs', id)}>
            {e} {l}
          </button>
        ))}
      </div>
      <label class="field-label" for="sline">
        Anything else? <span class="muted">(optional, one line)</span>
      </label>
      <input id="sline" class="field" maxLength={140} value={draft.line ?? ''} autocomplete="off" onInput={(e) => setDraft({ ...draft, line: (e.target as HTMLInputElement).value })} />
      {draft.voice ? <Done>🎙️ Voice note added.</Done> : <VoiceRecord label="🎙️ Or say it in a voice note (optional)" onSent={(voice) => setDraft({ ...draft, voice })} />}
      <p class="small muted">It reads as “I felt… when… what would help is…”. There is no “you always” here, on purpose.</p>
      <Problem text={problem} />
      <div class="btn-pair">
        <button type="button" class="btn btn-primary" onClick={() => void send()}>
          Send softly 💛
        </button>
        <button type="button" class="btn btn-secondary btn-narrow" onClick={onDone}>
          Not now
        </button>
      </div>
    </div>
  );
}

function SoftNote({ id, note, mine }: { id: string; note: Soft; mine: boolean }) {
  const d = useRoomData();
  const reply = (mine ? d.theirs : d.mine).call(d, K.SOFT_REPLY, `softreply:${id}`) as { data: { r: string } } | undefined;
  const text = `I felt ${note.feelings.map((f) => label(FEELINGS, f)).join(', ')}${note.when ? ` ${note.when.startsWith('when') ? note.when : `when ${note.when}`}` : ''}. What would help is ${note.needs.map((n) => label(NEEDS, n)).join(', ')}.`;
  return (
    <div class={`bubble ${mine ? 'bubble-mine' : 'bubble-theirs'} soft-note`}>
      <p class="small">{text}</p>
      {note.line && <p class="small">“{note.line}”</p>}
      {note.voice && <VoicePlayer note={note.voice} who={mine ? 'you' : d.partner} />}
      <small>{mine ? 'You' : d.partner}</small>
      {mine ? (
        <>
          {reply ? <Done>{d.partner}: {label(SOFT_REPLIES, reply.data.r)}</Done> : <Wait>Sent 💛 {d.partner} can reply whenever they are ready.</Wait>}
          <button type="button" class="btn-small" onClick={() => void d.remove(id)}>
            Take it back
          </button>
        </>
      ) : reply ? (
        <Done>You replied: {label(SOFT_REPLIES, reply.data.r)}. Talk about it over chai tonight? ☕</Done>
      ) : (
        <div class="chip-row" role="group" aria-label="Reply">
          {SOFT_REPLIES.map(([rid, e, l]) => (
            <button key={rid} type="button" class="chip" onClick={() => void d.put(K.SOFT_REPLY, `softreply:${id}`, { r: rid })}>
              {e} {l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** "I need 20 minutes. I'm not going anywhere." For when one of you is overwhelmed mid-argument. */
export function PauseControl() {
  const d = useRoomData();
  const mine = d.mine<{ until: number }>(K.PAUSE, 'pause')?.data.until;
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);
  const left = pauseLeft(mine);
  return left ? (
    <div class="panel panel-gold">
      <p class="small">
        ⏸️ You asked for a pause. {d.partner} knows you are not going anywhere. <b>{left} min</b> left.
      </p>
      <button type="button" class="btn btn-secondary btn-block" onClick={() => void d.put(K.PAUSE, 'pause', { until: 0 })}>
        I'm ready to talk again
      </button>
    </div>
  ) : (
    <button type="button" class="btn btn-secondary btn-block" onClick={() => void d.put(K.PAUSE, 'pause', { until: Date.now() + PAUSE_MS })}>
      ⏸️ I need 20 minutes. I'm not going anywhere.
    </button>
  );
}

function Repairs() {
  const d = useRoomData();
  const recent = d.list<{ r: string }>(K.REPAIR).slice(-4).reverse();
  return (
    <>
      <div class="chip-row" role="group" aria-label="Repair">
        {REPAIRS.map(([id, e, l]) => (
          <button key={id} type="button" class="chip" onClick={() => void d.add(K.REPAIR, `repair:${stamp()}`, { r: id })}>
            {e} {l}
          </button>
        ))}
      </div>
      {recent.map((x) => {
        const back = (x.mine ? d.theirs : d.mine).call(d, K.REPAIR_REPLY, `repairreply:${x.id}`) as { data: { r: string } } | undefined;
        return (
          <div key={x.id} class={`bubble ${x.mine ? 'bubble-mine' : 'bubble-theirs'}`}>
            {label(REPAIRS, x.data.r)}
            <small>{x.mine ? 'You' : d.partner}</small>
            {back ? (
              <Done>{x.mine ? d.partner : 'You'}: {label(SOFT_REPLIES, back.data.r)}</Done>
            ) : (
              !x.mine && (
                <div class="chip-row">
                  {SOFT_REPLIES.map(([rid, e, l]) => (
                    <button key={rid} type="button" class="chip" onClick={() => void d.put(K.REPAIR_REPLY, `repairreply:${x.id}`, { r: rid })}>
                      {e} {l}
                    </button>
                  ))}
                </div>
              )
            )}
          </div>
        );
      })}
    </>
  );
}

