import { VoicePlayer, VoiceRecord } from '../Voice';
import type { VoiceNote } from '../../features/cardLogic';
import { useState } from 'preact/hooks';
import { G_DEPTH, G_HELPS, G_PROMISES, G_TOPICS, listLabel } from '../../content/extras';
import { K } from '../../data/kinds';
import { useRoomData } from '../../data/RoomData';
import { FIND_A_HELPLINE, safetyFooterFor } from '../../features/safetyFooter';
import { Back, Check, Done, Link, OptTile, Problem, RevealRow, Wait } from '../components';
import { GENTLE_DEPTHS, type GentleDepth } from '../../content/gentle';
import { deckFor, gentleRef, sharedDepth } from '../../features/gentleDeck';
import { doneByMe } from '../../features/progress';
import { cardPath, PATHS } from '../router';

// Gentle Corner: either person can open it (an invite); it starts only when the other joins. A heads-up can be saved by the partner only if the
// sharer ticked "OK to save"; taking it back deletes saved copies (the server cascades the
// delete to any private copy of it). Only verified helpline numbers are shown.

interface GNote {
  topics: string[];
  helps: string[];
  depth: string;
  line: string;
  canSave: boolean;
  /** Optional voice note with the heads-up (kept 28 days). */
  voice?: VoiceNote;
}

interface GOpt {
  on: boolean;
  depth?: GentleDepth;
}

export function GentleCorner() {
  const d = useRoomData();
  const mineOpt = d.mine<GOpt>(K.GENTLE_OPT, 'gentle')?.data;
  const theirOpt = d.theirs<GOpt>(K.GENTLE_OPT, 'gentle')?.data;
  const myOn = !!mineOpt?.on;
  const theirOn = !!theirOpt?.on;
  const open = myOn && theirOn;
  const myNote = d.mine<GNote>(K.GENTLE_NOTE, 'note');
  const theirNote = d.theirs<GNote>(K.GENTLE_NOTE, 'note');
  const [compose, setCompose] = useState(false);
  const setOpt = (next: GOpt) => void d.put(K.GENTLE_OPT, 'gentle', next);

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

        {!open && theirOn && !myOn ? (
          <div class="panel panel-gold">
            <div class="panel-title">{d.partner} invited you in 💛</div>
            <p class="small">
              {d.partner} opened Gentle Corner. It opens for both of you only if you join too. No pressure, and no reason
              needed either way.
            </p>
            <div class="btn-pair">
              <button type="button" class="btn btn-primary" onClick={() => setOpt({ on: true, depth: mineOpt?.depth ?? 'light' })}>
                Join 💛
              </button>
              <button type="button" class="btn btn-secondary btn-narrow" onClick={() => setOpt({ on: false, depth: mineOpt?.depth })}>
                Not now
              </button>
            </div>
          </div>
        ) : !open ? (
          <>
            <p class="small muted">
              Either of you can open it; it starts only when the other joins too. Either of you can switch it off again, no
              explanation needed.
            </p>
            <div class="switch-row">
              <span class="row-text">
                <span class="row-title">{myOn ? `Waiting for ${d.partner} to join` : 'Gentle Corner is off'}</span>
                <span class="row-sub">
                  {myOn ? `${d.partner} gets a gentle invite. Nothing opens until they say yes.` : `Switch it on to invite ${d.partner}.`}
                </span>
              </span>
              <button type="button" role="switch" aria-checked={myOn} aria-label="Gentle Corner" class="switch" onClick={() => setOpt({ on: !myOn, depth: mineOpt?.depth ?? 'light' })}>
                <span class="switch-track">
                  <span class="switch-knob" />
                </span>
              </button>
            </div>
          </>
        ) : (
          <>
            <Deck mine={mineOpt?.depth} theirs={theirOpt?.depth} onPick={(depth) => setOpt({ on: true, depth })} />
            <h2 class="sub-title">Heads-ups</h2>
            {theirNote && <TheirNote noteId={theirNote.id} note={theirNote.data} />}
            {myNote ? (
              <MyNote noteId={myNote.id} note={myNote.data} />
            ) : compose ? (
              <Compose onDone={() => setCompose(false)} />
            ) : (
              <button type="button" class="btn btn-secondary btn-block" onClick={() => setCompose(true)}>
                ＋ Share a heads-up
              </button>
            )}
            <button type="button" class="btn btn-secondary btn-block seal" onClick={() => setOpt({ on: false, depth: mineOpt?.depth })}>
              I need a break from this
            </button>
          </>
        )}
        <SafetyNote />
      </div>
    </section>
  );
}

/** The depth each person is comfortable with, and the cards open at the shared depth. */
function Deck({ mine, theirs, onPick }: { mine?: GentleDepth; theirs?: GentleDepth; onPick: (d: GentleDepth) => void }) {
  const d = useRoomData();
  const shared = sharedDepth(mine, theirs);
  const cards = deckFor(shared);
  const sharedLabel = GENTLE_DEPTHS.find((x) => x.id === shared)!;
  const done = cards.filter((c) => doneByMe(d, gentleRef(c.id))).length;
  return (
    <>
      <h2 class="sub-title">How deep would you like to go?</h2>
      <p class="small muted">
        Pick what feels right for you. Cards go only as deep as the lighter of your two choices, and {d.partner} never sees
        which one you picked.
      </p>
      <div class="depth-grid" role="group" aria-label="How deep">
        {GENTLE_DEPTHS.map((x) => (
          <button key={x.id} type="button" class={(mine ?? 'light') === x.id ? 'depth is-on' : 'depth'} aria-pressed={(mine ?? 'light') === x.id} onClick={() => onPick(x.id)}>
            <span class="depth-e" aria-hidden="true">
              {x.e}
            </span>
            <span class="depth-l">{x.l}</span>
            <span class="depth-sub">{x.sub}</span>
          </button>
        ))}
      </div>
      <p class="small">
        Open together: <b>{sharedLabel.e} {sharedLabel.l}</b> · {done}/{cards.length} answered
      </p>
      <div class="rows">
        {cards.map((c) => {
          const ref = gentleRef(c.id);
          const mineDone = doneByMe(d, ref);
          const theirsIn = d.partnerAnswered(K.ANSWER, ref);
          const q = 'q' in c.card ? c.card.q : '';
          return (
            <Link key={c.id} class="row" href={cardPath(ref)}>
              <span class="row-emoji" aria-hidden="true">
                {GENTLE_DEPTHS.find((x) => x.id === c.depth)!.e}
              </span>
              <span class="row-text">
                <span class="row-title">{q}</span>
                <span class="row-sub">
                  {mineDone ? (theirsIn ? 'Both answered · open it' : 'Answered · waiting') : theirsIn ? `${d.partner} answered · your turn` : 'Not yet'}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </>
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
      <p class="field-label">What would you like {d.partner} to know? <span class="pill tint-gold">Select one or more</span></p>
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
      {draft.voice ? (
        <Done>🎙️ Voice note added. It goes with your heads-up.</Done>
      ) : (
        <VoiceRecord label="🎙️ Add a voice note (optional)" onSent={(voice) => setDraft({ ...draft, voice })} />
      )}
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
        {note.voice && <VoicePlayer note={note.voice} who="you" />}
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
        {note.voice && <VoicePlayer note={note.voice} who={d.partner} />}
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
                ...(note.voice ? { voice: note.voice } : {}),
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
