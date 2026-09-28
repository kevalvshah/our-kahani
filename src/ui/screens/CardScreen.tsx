import { useEffect, useRef, useState } from 'preact/hooks';
import { PACKS, TRY_LABELS, type Card, type CardEntry, type Opt } from '../../content/cards';
import { SEASON_DAYS } from '../../state/room';
import { K } from '../../data/kinds';
import { useRoomData } from '../../data/RoomData';
import {
  allOptions,
  answerText,
  entryFor,
  isAnswered,
  labelFor,
  optionLabel,
  questionText,
  revealBanner,
  sourceText,
  type Answer,
  type BonusCard,
} from '../../features/cardLogic';
import { nextCardFor } from '../../features/progress';
import { Back, Check, Done, Em, Link, OptTile, Problem, RevealRow, Wait } from '../components';
import { cardPath, packPath, PATHS } from '../router';
import { problemText } from '../problems';

// One screen for every card type. My answer is sealed on this phone; the partner's arrives only
// once the server's reveal rule lets it through (after I have answered the same card).

export function CardScreen({ cardRef }: { cardRef: string }) {
  const d = useRoomData();
  const bonus = cardRef.startsWith('bonus:') ? d.list<BonusCard>(K.BONUS_CARD).find((r) => r.ref === cardRef)?.data : undefined;
  const entry = entryFor(cardRef, bonus);

  if (!entry) {
    return (
      <section>
        <Back href={PATHS.today} label="← Today" />
        <h1 class="screen-title" tabIndex={-1}>
          {d.loaded ? 'This card is not here' : 'Opening the card…'}
        </h1>
      </section>
    );
  }

  const pack = entry.pack ? PACKS.find((p) => p.id === entry.pack) : undefined;
  const index = pack ? Number(cardRef.split(':')[2]) : 0;
  const tagLine = pack ? `Card ${index} of ${pack.cards.length}` : entry.day ? `Day ${entry.day} of ${SEASON_DAYS}` : 'Extra card';
  const bonusBy = bonus ? d.list(K.BONUS_CARD).find((r) => r.ref === cardRef)?.mine : undefined;
  const tagText = pack ? `${pack.e} ${pack.name}` : bonus ? (bonusBy ? 'Your card' : `From ${d.partner}`) : entry.tag;

  return (
    <section>
      <Back href={pack ? packPath(pack.id) : PATHS.today} label={pack ? `← ${pack.name}` : '← Today'} />
      <div class="question-card">
        <div class="question-meta">
          <span class="pack-tag">{tagText}</span>
          <span class="small muted">{tagLine}</span>
        </div>
        {entry.card.type === 'noticed' ? (
          <NoticedCard entry={entry} />
        ) : entry.card.type === 'bug' ? (
          <BugCard entry={entry} />
        ) : entry.card.type === 'try' ? (
          <TryCard entry={entry} card={entry.card} />
        ) : (
          <AnswerCard entry={entry} card={entry.card} />
        )}
      </div>
    </section>
  );
}

function Heading({ card }: { card: Card }) {
  if (card.type === 'nhie') {
    return (
      <h1 class="question" tabIndex={-1}>
        <small class="question-pre">Never have I ever…</small>
        {card.q}
      </h1>
    );
  }
  if (card.type === 'guess') {
    return (
      <>
        <h1 class="question question-emoji" tabIndex={-1}>
          <span class="sr-only">Guess the film from these emoji: </span>
          {card.q}
        </h1>
        <p class="small muted">Which film is this?</p>
      </>
    );
  }
  if (card.type === 'noticed') return <h1 class="question" tabIndex={-1}>Things I noticed 🔎</h1>;
  if (card.type === 'bug') return <h1 class="question" tabIndex={-1}>Bug report filed 🐞</h1>;
  return (
    <h1 class="question" tabIndex={-1}>
      {card.q}
    </h1>
  );
}

// ---------------------------------------------------------------------------
// Choice, pick, never have I ever, guess, bet, tick-any, one line, remember when
// ---------------------------------------------------------------------------
type AnswerableCard = Exclude<Card, { type: 'noticed' | 'bug' | 'try' }>;

function AnswerCard({ entry, card }: { entry: CardEntry; card: AnswerableCard }) {
  const d = useRoomData();
  const ref = entry.id;
  const mineRec = d.mine<Answer>(K.ANSWER, ref);
  const theirsRec = d.theirs<Answer>(K.ANSWER, ref);
  const mine = mineRec?.data;
  const theirs = theirsRec?.data;
  const partnerIn = d.partnerAnswered(K.ANSWER, ref);
  const revealed = !!mine && !!theirs && isAnswered(card, mine) && isAnswered(card, theirs);

  const [draft, setDraft] = useState<Answer>(() => mine ?? {});
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState('');
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const synced = useRef(false);

  // Take my saved answer once it arrives (e.g. after a reload).
  useEffect(() => {
    if (mine && !synced.current) {
      setDraft(mine);
      synced.current = true;
    }
  }, [mine]);

  const opts = allOptions(card, draft, theirs);
  const canCustom = card.type === 'choice' || card.type === 'pick' || card.type === 'multi';
  const hasWhy = card.type === 'choice' || card.type === 'pick' || card.type === 'nhie' || card.type === 'multi';
  const changed = JSON.stringify(draft) !== JSON.stringify(mine ?? {});
  const ready = isAnswered(card, draft);

  async function seal(answer: Answer = draft) {
    setSending(true);
    setProblem(null);
    try {
      const ok = await d.put(K.ANSWER, ref, answer);
      if (!ok) setProblem(`${d.partner} has already answered, so this answer is locked in.`);
    } catch (e) {
      setProblem(problemText(e));
    } finally {
      setSending(false);
    }
  }

  function addCustom() {
    const label = customText.trim().slice(0, 40);
    if (!label) return;
    const opt: Opt = { id: `x${Date.now().toString(36)}`, e: '✨', l: label };
    const custom = [...(draft.custom ?? []), opt];
    setDraft(card.type === 'multi' ? { ...draft, custom, picks: [...(draft.picks ?? []), opt.id] } : { ...draft, custom: [opt], pick: opt.id });
    setCustomText('');
    setCustomOpen(false);
  }

  const bettor = card.type === 'bet' ? (d.room.role === 'creator' ? 'me' : 'partner') : null;

  return (
    <>
      <Heading card={card} />

      {revealed && opened ? (
        <Reveal entry={entry} card={card} mine={mine!} theirs={theirs!} theirsId={theirsRec!.id} bettor={bettor} />
      ) : (
        <>
          {card.type === 'bet' && (
            <div class="wait wait-gold">
              {bettor === 'me'
                ? `🎲 Bet on what ${d.partner} will pick. It stays sealed until they pick for real.`
                : `🎲 ${d.partner} placed a sealed bet on you. Now pick for real:`}
            </div>
          )}

          {card.type === 'line' || card.type === 'recall' ? (
            card.type === 'recall' ? (
              <RecallInput card={card} draft={draft} setDraft={setDraft} disabled={revealed} onSend={(a) => void seal(a)} />
            ) : (
              <LineInput
                ph={card.ph}
                value={draft.text ?? ''}
                disabled={revealed}
                onInput={(text) => setDraft({ ...draft, text })}
              />
            )
          ) : card.type === 'multi' ? (
            <>
              <p class="small muted">Tick as many as you like.</p>
              <div class="checks">
                {opts.map((o) => {
                  const on = draft.picks?.includes(o.id) ?? false;
                  return (
                    <Check
                      key={o.id}
                      on={on}
                      disabled={revealed}
                      onToggle={() =>
                        setDraft({ ...draft, picks: on ? (draft.picks ?? []).filter((x) => x !== o.id) : [...(draft.picks ?? []), o.id] })
                      }
                    >
                      {o.e} {o.l}
                      {o.id.startsWith('x') && <small class="check-sub">Your idea ✨</small>}
                    </Check>
                  );
                })}
              </div>
            </>
          ) : (
            <div class={card.type === 'pick' || card.type === 'guess' ? 'options options-stack' : 'options'}>
              {opts.map((o) => (
                <OptTile
                  key={o.id}
                  opt={o}
                  picked={draft.pick === o.id}
                  stack={card.type === 'pick' || card.type === 'guess'}
                  disabled={revealed}
                  extra={o.id.startsWith('x') ? 'Your idea ✨' : undefined}
                  onPick={() => setDraft({ ...draft, pick: o.id, custom: o.id.startsWith('x') ? draft.custom : undefined })}
                />
              ))}
            </div>
          )}

          {canCustom && !revealed && (
            <>
              <button type="button" class="option option-row option-dashed" aria-expanded={customOpen} onClick={() => setCustomOpen(!customOpen)}>
                <span class="option-emoji" aria-hidden="true">
                  ✨
                </span>
                <span class="option-label">Something else…</span>
              </button>
              {customOpen && (
                <div class="custom-row">
                  <label class="field-label" for="custom">
                    Type your own option. {d.partner} sees it when you both open your answers.
                  </label>
                  <input
                    id="custom"
                    class="field"
                    maxLength={40}
                    placeholder="e.g. Rooftop chai"
                    value={customText}
                    autocomplete="off"
                    onInput={(e) => setCustomText((e.target as HTMLInputElement).value)}
                  />
                  <button type="button" class="btn btn-primary btn-block" onClick={addCustom}>
                    Add my option
                  </button>
                </div>
              )}
            </>
          )}

          {hasWhy && !revealed && ready && (
            <div class="field-wrap why-wrap">
              <label class="field-label" for="why">
                Why? <span class="muted">(optional, one line)</span>
              </label>
              <input
                id="why"
                class="field"
                maxLength={80}
                value={draft.why ?? ''}
                autocomplete="off"
                placeholder="A few words, if you like"
                onInput={(e) => setDraft({ ...draft, why: (e.target as HTMLInputElement).value })}
              />
            </div>
          )}

          {!revealed && card.type !== 'recall' && ready && (changed || !mine) && (
            <button type="button" class="btn btn-primary btn-block seal" disabled={sending} onClick={() => void seal()}>
              {sending ? 'Sealing…' : mine ? 'Change my answer' : 'Seal my answer'}
            </button>
          )}

          {!revealed && mine && !changed && !partnerIn && (
            <Wait>
              <b>Sealed.</b> Waiting for {d.partner} 💭 You can change it until they answer. Nobody sees it before then,
              including us.
            </Wait>
          )}
          {!mine && partnerIn && <Wait>{d.partner} is in 💭 Your turn. Answer and both open up.</Wait>}
          {!mine && !partnerIn && !ready && <p class="small muted hint-line">One tap. It stays hidden until you both answer.</p>}

          {revealed && !opened && (
            <button type="button" class="btn btn-primary btn-block seal" onClick={() => setOpened(true)}>
              {d.partner} has answered · open both →
            </button>
          )}
          <Problem text={problem} />
        </>
      )}
    </>
  );
}

function LineInput({ ph, value, disabled, onInput }: { ph: string; value: string; disabled?: boolean; onInput: (v: string) => void }) {
  return (
    <div class="field-wrap">
      <label class="field-label sr-only" for="line">
        Your answer
      </label>
      <input
        id="line"
        class="field"
        maxLength={80}
        placeholder={ph}
        value={value}
        disabled={disabled}
        autocomplete="off"
        onInput={(e) => onInput((e.target as HTMLInputElement).value)}
      />
    </div>
  );
}

const RECALL_SECONDS = 60;

function RecallInput({
  card,
  draft,
  setDraft,
  disabled,
  onSend,
}: {
  card: { ph: string };
  draft: Answer;
  setDraft: (a: Answer) => void;
  disabled?: boolean;
  onSend: (a: Answer) => void;
}) {
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  // Timers use timestamps, not tick counts (background tabs are throttled).
  useEffect(() => {
    if (start === null) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [start]);
  const left = start === null ? RECALL_SECONDS : Math.max(0, RECALL_SECONDS - Math.floor((now - start) / 1000));
  const expired = start !== null && left === 0;

  if (disabled || draft.skip || (draft.text && start === null)) {
    return <p class="small muted">{draft.skip ? 'You skipped this one 🙂' : `You sent: “${draft.text}”`}</p>;
  }
  if (start === null) {
    return (
      <>
        <p class="small muted">Sixty seconds on the clock. Type one line. Skipping is always fine.</p>
        <button type="button" class="btn btn-primary btn-block" onClick={() => { setStart(Date.now()); setNow(Date.now()); }}>
          Start the 60-second timer ⏱️
        </button>
        <button type="button" class="btn btn-secondary btn-block seal" onClick={() => onSend({ skip: true })}>
          Skip this one
        </button>
      </>
    );
  }
  if (expired) {
    return (
      <>
        <p class="timer" aria-live="polite">⏱️</p>
        <p class="reveal-banner center">Time's up</p>
        <p class="small muted center">No worries. Try again, or skip it.</p>
        <div class="btn-pair">
          <button type="button" class="btn btn-primary" onClick={() => { setStart(Date.now()); setNow(Date.now()); }}>
            Try again
          </button>
          <button type="button" class="btn btn-secondary" onClick={() => onSend({ skip: true })}>
            Skip
          </button>
        </div>
      </>
    );
  }
  return (
    <>
      <p class="timer" role="timer" aria-label={`${left} seconds left`}>
        {left}
      </p>
      <div class="bar" aria-hidden="true">
        <i style={{ width: `${(left / RECALL_SECONDS) * 100}%` }} />
      </div>
      <LineInput ph={card.ph} value={draft.text ?? ''} onInput={(text) => setDraft({ ...draft, text })} />
      <button type="button" class="btn btn-primary btn-block" disabled={!draft.text?.trim()} onClick={() => onSend({ text: draft.text!.trim() })}>
        Send
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// The reveal
// ---------------------------------------------------------------------------
function Reveal({
  entry,
  card,
  mine,
  theirs,
  theirsId,
  bettor,
}: {
  entry: CardEntry;
  card: AnswerableCard;
  mine: Answer;
  theirs: Answer;
  theirsId: string;
  bettor: 'me' | 'partner' | null;
}) {
  const d = useRoomData();
  const opts = allOptions(card, mine, theirs);
  const banner = revealBanner(card, mine, theirs, {
    me: 'You',
    partner: d.partner,
    bettor: bettor === 'me' ? 'You' : bettor === 'partner' ? d.partner : undefined,
  });

  const show = (a: Answer, who: 'me' | 'partner') => {
    if (card.type === 'multi') {
      return (a.picks ?? []).map((id) => (
        <span key={id} class="reveal-line">
          {optionLabel(opts, id)}
          {id.startsWith('x') && <span class="added">✨ added by {who === 'me' ? 'you' : d.partner}</span>}
        </span>
      ));
    }
    if (card.type === 'line' || card.type === 'recall') return a.skip ? 'Skipped this one 🙂' : a.text;
    const label = optionLabel(opts, a.pick);
    if (card.type === 'bet') return `${(who === 'me') === (bettor === 'me') ? 'Bet on' : 'Picked'} ${label}`;
    if (card.type === 'guess') return `${label} ${a.pick === card.ans ? '✅' : ''}`;
    return (
      <>
        {label}
        {a.pick?.startsWith('x') && <span class="added">✨ added by {who === 'me' ? 'you' : d.partner}</span>}
      </>
    );
  };

  const common = card.type === 'multi' ? (mine.picks ?? []).filter((x) => theirs.picks?.includes(x)) : [];

  return (
    <div class="reveal">
      <p class="reveal-banner">{banner}</p>
      <div class="reveal-rows">
        {common.length > 0 && (
          <RevealRow who="Both" tone="both">
            {common.map((id) => (
              <span key={id} class="reveal-line">
                {optionLabel(opts, id)}
              </span>
            ))}
          </RevealRow>
        )}
        <RevealRow who="You" tone="mine">
          {show(mine, 'me')}
          {mine.why && <span class="why">“{mine.why}”</span>}
        </RevealRow>
        <RevealRow who={d.partner} tone="theirs">
          {show(theirs, 'partner')}
          {theirs.why && <span class="why">“{theirs.why}”</span>}
        </RevealRow>
      </div>
      {card.type === 'guess' && <p class="small muted">It was {optionLabel(opts, card.ans)} 🎬</p>}
      {card.type === 'pick' && <p class="small muted">Pick a time, press play together 📺</p>}
      {card.type === 'nhie' && <StoryThread cardRef={entry.id} />}
      {'cheer' in card && card.cheer ? <Reactions cardRef={entry.id} set="cheer" /> : <Reactions cardRef={entry.id} set="love" />}
      <SaveButton entry={entry} card={card} mine={mine} theirs={theirs} theirsId={theirsId} />
      <NextButton entry={entry} />
    </div>
  );
}

const LOVE = ['🤗', '💛', '🫶', '😊'];
const CHEER = ['👏', '🔥', '💪', '🌟'];

function Reactions({ cardRef, set }: { cardRef: string; set: 'love' | 'cheer' }) {
  const d = useRoomData();
  const ref = `${set}:${cardRef}`;
  const mine = d.mine<{ e: string }>(K.REACTION, ref)?.data.e;
  const theirs = d.theirs<{ e: string }>(K.REACTION, ref)?.data.e;
  const list = set === 'love' ? LOVE : CHEER;
  return (
    <div class="reactions">
      {theirs && <Done>{d.partner} sent you {theirs}</Done>}
      {mine ? (
        <p class="small muted">You sent {mine}</p>
      ) : (
        <>
          <p class="field-label">{set === 'love' ? 'Send a little love:' : `Send ${d.partner} a cheer:`}</p>
          <div class="cheers">
            {list.map((e) => (
              <button key={e} type="button" aria-label={`Send ${e}`} onClick={() => void d.put(K.REACTION, ref, { e })}>
                {e}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function SaveButton({
  entry,
  card,
  mine,
  theirs,
  theirsId,
}: {
  entry: CardEntry;
  card: Card;
  mine?: Answer;
  theirs: Answer;
  theirsId: string;
}) {
  const d = useRoomData();
  const saved = d.list(K.SAVED).find((r) => r.ref === `copy:${theirsId}`);
  if (saved) {
    return (
      <div class="pingbar">
        <span>🔖 Saved to your notes about {d.partner}</span>
        <button type="button" class="btn-small" onClick={() => void d.remove(saved.id)}>
          Undo
        </button>
      </div>
    );
  }
  const pack = entry.pack ? PACKS.find((p) => p.id === entry.pack) : undefined;
  const opts = allOptions(card, mine, theirs);
  return (
    <button
      type="button"
      class="btn btn-secondary btn-block"
      onClick={() =>
        void d.add(K.SAVED, `copy:${theirsId}`, {
          kind: 'card',
          src: sourceText(entry, pack?.name),
          q: questionText(entry),
          theirs: answerText(card, theirs, opts) + (theirs.why ? ` — “${theirs.why}”` : ''),
          mine: answerText(card, mine, opts),
          label: labelFor(entry),
          note: '',
          date: '',
          t: Date.now(),
        })
      }
    >
      🔖 Save {d.partner}'s answer
    </button>
  );
}

function StoryThread({ cardRef }: { cardRef: string }) {
  const d = useRoomData();
  const askRef = `ask:${cardRef}`;
  const tellRef = `tell:${cardRef}`;
  const iAsked = !!d.mine(K.STORY_ASK, askRef);
  const theyAsked = !!d.theirs(K.STORY_ASK, askRef);
  const myTell = d.mine<{ text?: string; skip?: boolean }>(K.STORY_TELL, tellRef)?.data;
  const theirTell = d.theirs<{ text?: string; skip?: boolean }>(K.STORY_TELL, tellRef)?.data;
  const [text, setText] = useState('');
  return (
    <div class="thread">
      {myTell?.text && <RevealRow who="You" tone="mine">“{myTell.text}”</RevealRow>}
      {theirTell?.text && <RevealRow who={d.partner} tone="theirs">“{theirTell.text}”</RevealRow>}
      {theyAsked && !myTell && (
        <div class="custom-row">
          <label class="field-label" for="tell">
            {d.partner} wants the story 👀 One line is plenty.
          </label>
          <input id="tell" class="field" maxLength={100} value={text} placeholder="The short version…" autocomplete="off" onInput={(e) => setText((e.target as HTMLInputElement).value)} />
          <div class="btn-pair">
            <button type="button" class="btn btn-primary" disabled={!text.trim()} onClick={() => void d.put(K.STORY_TELL, tellRef, { text: text.trim() })}>
              Send
            </button>
            <button type="button" class="btn btn-secondary" onClick={() => void d.put(K.STORY_TELL, tellRef, { skip: true })}>
              Not today 🙂
            </button>
          </div>
        </div>
      )}
      {!iAsked ? (
        <button type="button" class="btn btn-secondary btn-block" onClick={() => void d.put(K.STORY_ASK, askRef, { at: Date.now() })}>
          Tell me the story 👀
        </button>
      ) : !theirTell ? (
        <Wait>Asked {d.partner} for the story 💭</Wait>
      ) : theirTell.skip ? (
        <Wait>{d.partner} is saving that one for later 🙂</Wait>
      ) : null}
    </div>
  );
}

function NextButton({ entry }: { entry: CardEntry }) {
  const d = useRoomData();
  const next = nextCardFor(d, entry);
  if (next) {
    return (
      <Link class="btn btn-cta seal" href={cardPath(next)}>
        <span>Chalo, next card ✨</span>
        <span class="cta-meta">→</span>
      </Link>
    );
  }
  const pack = entry.pack ? PACKS.find((p) => p.id === entry.pack) : undefined;
  return (
    <Link class="btn btn-secondary btn-block seal" href={pack ? packPath(pack.id) : PATHS.today}>
      {pack ? `Back to ${pack.name}` : 'Back to Pehli Baat'}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Things I noticed (day 5): each writes one small thing, the other reacts
// ---------------------------------------------------------------------------
const NOTICED_REACTIONS = [
  { id: 'right', e: '🎯', l: 'Spot on', msg: 'is glowing somewhere 🌟' },
  { id: 'sweet', e: '🥹', l: 'Aww', msg: 'Aww indeed. Message received 💛' },
  { id: 'wrong', e: '🙈', l: 'Not quite', msg: 'Ha. Noted for next time 📝' },
];

function NoticedCard({ entry }: { entry: CardEntry }) {
  const d = useRoomData();
  const ref = entry.id;
  const myNote = d.mine<{ note: string }>(K.NOTICED, ref)?.data.note;
  const theirNote = d.theirs<{ note: string }>(K.NOTICED, ref)?.data.note;
  const myReact = d.mine<{ react: string }>(K.REACTION, `noticed:${ref}`)?.data.react;
  const theirReact = d.theirs<{ react: string }>(K.REACTION, `noticed:${ref}`)?.data.react;
  const [text, setText] = useState('');
  const reactOf = (id?: string) => NOTICED_REACTIONS.find((r) => r.id === id);

  return (
    <>
      <Heading card={entry.card} />
      <h2 class="sub-title">For {d.partner}</h2>
      {myNote ? (
        <>
          <div class="sticky">
            {myNote}
            <small>from you, one small thing you noticed</small>
          </div>
          {theirReact ? (
            <RevealRow who={d.partner} tone="theirs">
              {reactOf(theirReact)?.e} {reactOf(theirReact)?.l}
            </RevealRow>
          ) : (
            <Wait>Sent. Waiting for {d.partner} to react 💭</Wait>
          )}
        </>
      ) : (
        <div class="custom-row">
          <label class="field-label" for="noticed">
            One small thing you noticed about {d.partner}
          </label>
          <input
            id="noticed"
            class="field"
            maxLength={120}
            value={text}
            placeholder="e.g. You like less sugar in your chai. Noted ☕"
            autocomplete="off"
            onInput={(e) => setText((e.target as HTMLInputElement).value)}
          />
          <button type="button" class="btn btn-primary btn-block" disabled={!text.trim()} onClick={() => void d.put(K.NOTICED, ref, { note: text.trim() })}>
            Send it
          </button>
        </div>
      )}

      <h2 class="sub-title">From {d.partner}</h2>
      {theirNote ? (
        <>
          <div class="sticky">
            {theirNote}
            <small>from {d.partner}, one small thing they noticed</small>
          </div>
          {myReact ? (
            <p class="small">
              {reactOf(myReact)?.e} {reactOf(myReact)?.id === 'right' ? `${d.partner} ${reactOf(myReact)?.msg}` : reactOf(myReact)?.msg}
            </p>
          ) : (
            <>
              <p class="small muted">Tap how it landed.</p>
              <div class="options options-three">
                {NOTICED_REACTIONS.map((r) => (
                  <OptTile key={r.id} opt={{ id: r.id, e: r.e, l: r.l }} picked={false} onPick={() => void d.put(K.REACTION, `noticed:${ref}`, { react: r.id })} />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <Wait>Waiting for {d.partner} to write theirs 💭</Wait>
      )}
      {myNote && myReact && <NextButton entry={entry} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Bug report (day 7): each files one playful bug; the other sets the severity; the filer replies
// ---------------------------------------------------------------------------
const SEVERITY = [
  { id: 'adorable', e: '🥹', l: 'Adorable' },
  { id: 'minor', e: '🐛', l: 'Minor' },
  { id: 'critical', e: '🚨', l: 'Critical' },
];

function Ticket({ title, summary, severity, reply }: { title: string; summary: string; severity?: string; reply?: string }) {
  const sev = SEVERITY.find((s) => s.id === severity);
  const status = reply === 'fixed' ? 'Fixed ✅ (in progress)' : reply === 'wontfix' ? "Won't fix 😌 (it's a feature)" : 'Open';
  return (
    <div class="ticket">
      <div class="ticket-head">
        <span>Bug #1</span>
        <span>{title}</span>
      </div>
      <div class="ticket-row">
        <b>Summary</b>
        <span>{summary}</span>
      </div>
      <div class="ticket-row">
        <b>Severity</b>
        <span>{sev ? `${sev.e} ${sev.l}` : 'loading…'}</span>
      </div>
      <div class="ticket-row">
        <b>Status</b>
        <span class="status">{status}</span>
      </div>
    </div>
  );
}

function BugCard({ entry }: { entry: CardEntry }) {
  const d = useRoomData();
  const ref = entry.id;
  const myBug = d.mine<{ summary: string }>(K.BUG, ref)?.data.summary;
  const theirBug = d.theirs<{ summary: string }>(K.BUG, ref)?.data.summary;
  const sevOnMine = d.theirs<{ sev: string }>(K.BUG_STEP, `sev:${ref}`)?.data.sev;
  const sevOnTheirs = d.mine<{ sev: string }>(K.BUG_STEP, `sev:${ref}`)?.data.sev;
  const myReply = d.mine<{ reply: string }>(K.BUG_STEP, `reply:${ref}`)?.data.reply;
  const theirReply = d.theirs<{ reply: string }>(K.BUG_STEP, `reply:${ref}`)?.data.reply;
  const [text, setText] = useState('');

  return (
    <>
      <Heading card={entry.card} />
      <h2 class="sub-title">Your report on {d.partner}</h2>
      {myBug ? (
        <>
          <Ticket title="Filed by you" summary={myBug} severity={sevOnMine} reply={myReply} />
          {!sevOnMine ? (
            <Wait>Bug filed. Waiting for {d.partner} to set the severity 💭</Wait>
          ) : !myReply ? (
            <>
              <p class="field-label">Your reply, developer:</p>
              <div class="btn-pair">
                <button type="button" class="btn btn-primary" onClick={() => void d.put(K.BUG_STEP, `reply:${ref}`, { reply: 'fixed' })}>
                  Fixed ✅
                </button>
                <button type="button" class="btn btn-secondary" onClick={() => void d.put(K.BUG_STEP, `reply:${ref}`, { reply: 'wontfix' })}>
                  Won't fix 😌
                </button>
              </div>
            </>
          ) : null}
        </>
      ) : (
        <div class="custom-row">
          <label class="field-label" for="bug">
            One tiny, loveable “bug” about {d.partner}
          </label>
          <input
            id="bug"
            class="field"
            maxLength={100}
            value={text}
            placeholder="e.g. Goes quiet for the first 10 minutes of calls."
            autocomplete="off"
            onInput={(e) => setText((e.target as HTMLInputElement).value)}
          />
          <button type="button" class="btn btn-primary btn-block" disabled={!text.trim()} onClick={() => void d.put(K.BUG, ref, { summary: text.trim() })}>
            File the bug 🐞
          </button>
        </div>
      )}

      <h2 class="sub-title">{d.partner}'s report on you</h2>
      {theirBug ? (
        <>
          <Ticket title={`Filed by ${d.partner}`} summary={theirBug} severity={sevOnTheirs} reply={theirReply} />
          {!sevOnTheirs && (
            <>
              <p class="field-label">Tester, set the severity:</p>
              <div class="options options-stack">
                {SEVERITY.map((s) => (
                  <OptTile key={s.id} opt={s} picked={false} stack onPick={() => void d.put(K.BUG_STEP, `sev:${ref}`, { sev: s.id })} />
                ))}
              </div>
            </>
          )}
          {sevOnTheirs && !theirReply && <Wait>Severity sent. {d.partner} will reply soon ✍️</Wait>}
        </>
      ) : (
        <Wait>Waiting for {d.partner} to file theirs 💭</Wait>
      )}
      {myBug && sevOnTheirs && <NextButton entry={entry} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Halfway Date (day 14): rate each idea, then both open
// ---------------------------------------------------------------------------
function TryCard({ entry, card }: { entry: CardEntry; card: Extract<Card, { type: 'try' }> }) {
  const d = useRoomData();
  const ref = entry.id;
  const mine = d.mine<Answer>(K.ANSWER, ref)?.data;
  const theirs = d.theirs<Answer>(K.ANSWER, ref)?.data;
  const partnerIn = d.partnerAnswered(K.ANSWER, ref);
  const [rates, setRates] = useState<Record<string, string>>(mine?.rates ?? {});
  const [problem, setProblem] = useState<string | null>(null);
  const done = Object.keys(rates).length;
  const revealed = !!mine && !!theirs;
  const season = d.mine<{ choice: string }>(K.SEASON_NEXT, 'season2')?.data.choice;
  const theirSeason = d.theirs<{ choice: string }>(K.SEASON_NEXT, 'season2')?.data.choice;

  if (revealed) {
    const both = card.items.filter((it) => mine.rates?.[it.id] === 'keen' && theirs.rates?.[it.id] === 'keen');
    const first = both[0];
    return (
      <>
        <Heading card={card} />
        <div class="reveal">
          <p class="reveal-banner">{revealBanner(card, mine, theirs, { me: 'You', partner: d.partner })}</p>
          <table class="compare">
            <thead>
              <tr>
                <th scope="col">Idea</th>
                <th scope="col">You</th>
                <th scope="col">{d.partner}</th>
              </tr>
            </thead>
            <tbody>
              {card.items.map((it) => {
                const b = mine.rates?.[it.id] === 'keen' && theirs.rates?.[it.id] === 'keen';
                return (
                  <tr key={it.id} class={b ? 'is-both' : undefined}>
                    <th scope="row">
                      {it.e} {it.l}
                      {b ? ' 🎯' : ''}
                    </th>
                    <td>{TRY_LABELS[mine.rates?.[it.id] ?? '']}</td>
                    <td>{TRY_LABELS[theirs.rates?.[it.id] ?? '']}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div class="panel panel-accent">
            <div class="panel-title">Halfway Date idea 🚆</div>
            <p class="small">
              {first ? `${first.e} ${first.l}` : 'Pick any Maybe you both share'}, somewhere roughly halfway between you. No pressure on
              dates.
            </p>
            {!season ? (
              <>
                <p class="field-label">Season 2?</p>
                <div class="btn-pair">
                  <button type="button" class="btn btn-primary" onClick={() => void d.put(K.SEASON_NEXT, 'season2', { choice: 'yes' })}>
                    Yes please 🎉
                  </button>
                  <button type="button" class="btn btn-secondary" onClick={() => void d.put(K.SEASON_NEXT, 'season2', { choice: 'later' })}>
                    Later 🙂
                  </button>
                </div>
              </>
            ) : (
              <Done>
                {season === 'yes' && theirSeason === 'yes'
                  ? 'Season 2 is on for both of you 🎉 New packs are waiting in Card packs.'
                  : season === 'yes'
                    ? `You said yes to Season 2 🎉 Waiting for ${d.partner}.`
                    : 'Totally fine. Season 2 waits for you 🙂'}
              </Done>
            )}
          </div>
          <Reactions cardRef={ref} set="love" />
        </div>
      </>
    );
  }

  return (
    <>
      <Heading card={card} />
      <div class="try-list">
        {card.items.map((it) => (
          <div key={it.id} class="try-item" role="group" aria-label={it.l}>
            <div class="try-title">
              {it.e} {it.l}
            </div>
            <div class="try-choices">
              {Object.entries(TRY_LABELS).map(([k, l]) => (
                <button key={k} type="button" class={rates[it.id] === k ? 'chip is-on' : 'chip'} aria-pressed={rates[it.id] === k} disabled={!!mine} onClick={() => setRates({ ...rates, [it.id]: k })}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {mine ? (
        <Wait>Your answers are saved. Waiting for {d.partner} 💭</Wait>
      ) : (
        <button
          type="button"
          class="btn btn-primary btn-block seal"
          disabled={done < card.items.length}
          onClick={() =>
            void d.put(K.ANSWER, ref, { rates }).catch((e) => setProblem(problemText(e)))
          }
        >
          Show us {done < card.items.length ? `(${done}/${card.items.length})` : '🎉'}
        </button>
      )}
      {!mine && partnerIn && <Wait>{d.partner} has rated them all 💭 Your turn.</Wait>}
      <Problem text={problem} />
    </>
  );
}

