import { useState } from 'preact/hooks';
import { G_DEPTH, G_HELPS, G_PROMISES, G_TOPICS, listLabel } from '../../content/extras';
import { K } from '../../data/kinds';
import { useRoomData } from '../../data/RoomData';
import { FIND_A_HELPLINE, safetyFooterFor } from '../../features/safetyFooter';
import { Back, Check, Done, OptTile, Problem, RevealRow, Wait } from '../components';
import { PATHS } from '../router';

// Gentle Corner: opt-in by both people. A heads-up can be saved by the partner only if the
// sharer ticked "OK to save"; taking it back deletes saved copies (the server cascades the
// delete to any private copy of it). Only verified helpline numbers are shown.

interface GNote {
  topics: string[];
  helps: string[];
  depth: string;
  line: string;
  canSave: boolean;
}

export function GentleCorner() {
  const d = useRoomData();
  const myOn = !!d.mine<{ on: boolean }>(K.GENTLE_OPT, 'gentle')?.data.on;
  const theirOn = !!d.theirs<{ on: boolean }>(K.GENTLE_OPT, 'gentle')?.data.on;
  const open = myOn && theirOn;
  const myNote = d.mine<GNote>(K.GENTLE_NOTE, 'note');
  const theirNote = d.theirs<GNote>(K.GENTLE_NOTE, 'note');
  const [compose, setCompose] = useState(false);

  return (
    <section>
      <Back href={PATHS.today} label="← Today" />
      <div class="question-card">
        <span class="pack-tag">💛 Gentle Corner</span>
        <h1 class="question" tabIndex={-1}>
          Only if you both want it
        </h1>
        <p class="small">
          A private space to share what is on your mind, at your own pace. Nothing here is scored, you never have to share
          details, and you can take back anything you share.
        </p>

        {!open ? (
          <>
            <p class="small muted">It only opens when you both switch it on. Either of you can switch it off again, no explanation needed.</p>
            <div class="switch-row">
              <span class="row-text">
                <span class="row-title">Gentle Corner is {myOn ? 'on for you' : 'off'}</span>
                <span class="row-sub">{myOn ? `It opens when ${d.partner} switches it on too.` : 'Nothing opens until you both say yes.'}</span>
              </span>
              <button type="button" role="switch" aria-checked={myOn} aria-label="Gentle Corner" class="switch" onClick={() => void d.put(K.GENTLE_OPT, 'gentle', { on: !myOn })}>
                <span class="switch-track">
                  <span class="switch-knob" />
                </span>
              </button>
            </div>
          </>
        ) : (
          <>
            {theirNote && <TheirNote noteId={theirNote.id} note={theirNote.data} />}
            <h2 class="sub-title">Yours</h2>
            {myNote ? (
              <MyNote noteId={myNote.id} note={myNote.data} />
            ) : compose ? (
              <Compose onDone={() => setCompose(false)} />
            ) : (
              <button type="button" class="btn btn-secondary btn-block" onClick={() => setCompose(true)}>
                ＋ Share a heads-up
              </button>
            )}
            <button type="button" class="btn btn-secondary btn-block seal" onClick={() => void d.put(K.GENTLE_OPT, 'gentle', { on: false })}>
              I need a break from this
            </button>
          </>
        )}
        <SafetyNote />
      </div>
    </section>
  );
}

function Summary({ note }: { note: GNote }) {
  return (
    <>
      {note.topics.map((t) => (
        <span key={t} class="reveal-line">
          {listLabel(G_TOPICS, t)}
        </span>
      ))}
      <b class="block">What helps:</b>
      {note.helps.map((h) => (
        <span key={h} class="reveal-line">
          {listLabel(G_HELPS, h)}
        </span>
      ))}
      <i class="block">{listLabel(G_DEPTH, note.depth)}</i>
      {note.line && <span class="block">“{note.line}”</span>}
    </>
  );
}

function Compose({ onDone }: { onDone: () => void }) {
  const d = useRoomData();
  const [draft, setDraft] = useState<GNote>({ topics: [], helps: [], depth: 'heads', line: '', canSave: false });
  const [problem, setProblem] = useState<string | null>(null);
  const toggle = (key: 'topics' | 'helps', id: string) =>
    setDraft({ ...draft, [key]: draft[key].includes(id) ? draft[key].filter((x) => x !== id) : [...draft[key], id] });

  return (
    <div class="gentle-compose">
      <p class="small muted">You never have to share details. Just pick what feels true.</p>
      <p class="field-label">What would you like {d.partner} to know?</p>
      <div class="checks">
        {G_TOPICS.map(([id, e, l]) => (
          <Check key={id} on={draft.topics.includes(id)} onToggle={() => toggle('topics', id)}>
            {e} {l}
          </Check>
        ))}
      </div>
      <p class="field-label">When it comes up, what helps?</p>
      <div class="checks">
        {G_HELPS.map(([id, e, l]) => (
          <Check key={id} on={draft.helps.includes(id)} onToggle={() => toggle('helps', id)}>
            {e} {l}
          </Check>
        ))}
      </div>
      <p class="field-label">How much would you like to share?</p>
      <div class="options options-stack">
        {G_DEPTH.map(([id, e, l]) => (
          <OptTile key={id} opt={{ id, e, l }} picked={draft.depth === id} stack onPick={() => setDraft({ ...draft, depth: id })} />
        ))}
      </div>
      <label class="field-label" for="gline">
        Anything else? <span class="muted">(optional)</span>
      </label>
      <input id="gline" class="field" maxLength={140} value={draft.line} placeholder="One line, only if you want" autocomplete="off" onInput={(e) => setDraft({ ...draft, line: (e.target as HTMLInputElement).value })} />
      <Check on={draft.canSave} onToggle={() => setDraft({ ...draft, canSave: !draft.canSave })}>
        OK for {d.partner} to save this in their notes
        <small class="check-sub">Optional. You can take it back any time, and their saved copy goes too.</small>
      </Check>
      <Problem text={problem} />
      <div class="btn-pair">
        <button
          type="button"
          class="btn btn-primary"
          onClick={async () => {
            if (!draft.topics.length || !draft.helps.length) return setProblem('Pick at least one thing to share and one thing that helps.');
            await d.put(K.GENTLE_NOTE, 'note', { ...draft, line: draft.line.trim().slice(0, 140) });
            onDone();
          }}
        >
          Share gently 💛
        </button>
        <button type="button" class="btn btn-secondary btn-narrow" onClick={onDone}>
          Not now
        </button>
      </div>
    </div>
  );
}

function MyNote({ noteId, note }: { noteId: string; note: GNote }) {
  const d = useRoomData();
  const resp = d.theirs<{ guess: string[]; promise?: string }>(K.GENTLE_RESPONSE, `resp:${noteId}`)?.data;
  const myReact = d.mine<{ react: string }>(K.GENTLE_REACT, `react:${noteId}`)?.data.react;
  const status = !resp ? `Shared ✓ ${d.partner} can read it whenever they are ready.` : !resp.promise ? `${d.partner} is thinking about it 💛` : `${d.partner} promised: ${listLabel(G_PROMISES, resp.promise)}`;
  return (
    <>
      <div class="bubble bubble-mine">
        <Summary note={note} />
        <small>{status}</small>
      </div>
      {resp?.promise &&
        (myReact ? (
          <Done>You said: {myReact === 'heart' ? 'That helps 💛' : 'Let us talk on a call 📞'}</Done>
        ) : (
          <div class="btn-pair">
            <button type="button" class="btn btn-primary" onClick={() => void d.put(K.GENTLE_REACT, `react:${noteId}`, { react: 'heart' })}>
              That helps 💛
            </button>
            <button type="button" class="btn btn-secondary" onClick={() => void d.put(K.GENTLE_REACT, `react:${noteId}`, { react: 'call' })}>
              Let us talk 📞
            </button>
          </div>
        ))}
      <button type="button" class="btn btn-secondary btn-block seal" onClick={() => void d.remove(noteId)}>
        Take it back
      </button>
    </>
  );
}

function TheirNote({ noteId, note }: { noteId: string; note: GNote }) {
  const d = useRoomData();
  const resp = d.mine<{ guess: string[]; promise?: string }>(K.GENTLE_RESPONSE, `resp:${noteId}`)?.data;
  const [guess, setGuess] = useState<string[]>([]);
  const saved = d.list(K.SAVED).find((r) => r.ref === `copy:${noteId}`);

  return (
    <>
      <h2 class="sub-title">From {d.partner}</h2>
      <div class="bubble bubble-theirs">
        <Summary note={note} />
      </div>
      {note.canSave &&
        (saved ? (
          <div class="pingbar">
            <span>🔖 Saved to your notes</span>
            <button type="button" class="btn-small" onClick={() => void d.remove(saved.id)}>
              Undo
            </button>
          </div>
        ) : (
          <button
            type="button"
            class="btn btn-secondary btn-block"
            onClick={() =>
              void d.add(K.SAVED, `copy:${noteId}`, {
                kind: 'gentle',
                src: 'Gentle Corner',
                q: `A heads-up ${d.partner} shared`,
                theirs: `Shared: ${note.topics.map((x) => listLabel(G_TOPICS, x)).join('; ')}. What helps: ${note.helps.map((x) => listLabel(G_HELPS, x)).join('; ')}.${note.line ? ` “${note.line}”` : ''}`,
                mine: '',
                label: 'care',
                note: '',
                date: '',
                t: Date.now(),
              })
            }
          >
            🔖 Save this in my notes
          </button>
        ))}
      {!resp ? (
        <>
          <p class="field-label">Care card 1: what do you think helps {d.partner}?</p>
          <div class="checks">
            {G_HELPS.map(([id, e, l]) => (
              <Check key={id} on={guess.includes(id)} onToggle={() => setGuess(guess.includes(id) ? guess.filter((x) => x !== id) : [...guess, id])}>
                {e} {l}
              </Check>
            ))}
          </div>
          <button type="button" class="btn btn-primary btn-block seal" disabled={!guess.length} onClick={() => void d.put(K.GENTLE_RESPONSE, `resp:${noteId}`, { guess })}>
            Done ✓
          </button>
        </>
      ) : (
        <>
          <div class="reveal">
            <p class="reveal-banner">{resp.guess.some((x) => note.helps.includes(x)) ? 'You already knew some of this 💛' : 'Now you know 💛'}</p>
            <RevealRow who="You" tone="mine">
              {resp.guess.map((x) => (
                <span key={x} class="reveal-line">
                  {listLabel(G_HELPS, x)}
                </span>
              ))}
            </RevealRow>
            <RevealRow who={d.partner} tone="theirs">
              {note.helps.map((x) => (
                <span key={x} class="reveal-line">
                  {listLabel(G_HELPS, x)}
                </span>
              ))}
            </RevealRow>
          </div>
          {!resp.promise ? (
            <>
              <p class="field-label">Care card 2: pick one tiny promise</p>
              <div class="options options-stack">
                {G_PROMISES.map(([id, e, l]) => (
                  <OptTile key={id} opt={{ id, e, l }} picked={false} stack onPick={() => void d.put(K.GENTLE_RESPONSE, `resp:${noteId}`, { ...resp, promise: id })} />
                ))}
              </div>
            </>
          ) : (
            <Done>Promise sent 💛 {listLabel(G_PROMISES, resp.promise)}</Done>
          )}
        </>
      )}
      {!resp && <Wait>Take your time. {d.partner} does not see a timer.</Wait>}
    </>
  );
}

function SafetyNote() {
  const d = useRoomData();
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  const footer = safetyFooterFor(d.myProfile?.country, langs);
  return (
    <div class="safety" role="note">
      <b>If things feel urgent</b>
      <br />
      Gentle Corner is a place to share, not therapy or an emergency service.
      {footer.country && (
        <>
          <br />
          {footer.country}: {footer.lines.join(', ')}.
        </>
      )}
      <br />
      {footer.country ? 'Elsewhere' : 'Wherever you are'}: call your local emergency number or find a line at{' '}
      <a href={FIND_A_HELPLINE} rel="noopener noreferrer" target="_blank">
        findahelpline.com
      </a>
      .
    </div>
  );
}
