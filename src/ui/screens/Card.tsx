import { useEffect, useState } from 'preact/hooks';
import { TODAY_CARD } from '../../packs/official';
import { controller, type CardStatus } from '../../state/controller';
import { dayOfSeason } from '../../state/room';
import { useRoom } from '../../state/roomContext';
import { Em, Link } from '../components';
import { PATHS } from '../router';
import { problemText } from './Today';

// Today's card. The pick is sealed on this phone and sent as ciphertext; the partner's answer
// is withheld by the server (row level security) until this person has answered too.

const CARD_REF = 'warm.1';
const POLL_MS = 10_000;

function optionLabel(id: string | null) {
  const o = TODAY_CARD.options.find((x) => x.id === id);
  return o ? `${o.label} ${o.emoji}` : '';
}

export function Card() {
  const { room } = useRoom();
  const [pick, setPick] = useState<string | null>(null);
  const [status, setStatus] = useState<CardStatus | null>(null);
  const [sending, setSending] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const day = room ? dayOfSeason(room) : 1;

  // Fetch now, every few seconds while open, and when the tab comes back (timers are throttled
  // in background tabs).
  useEffect(() => {
    if (!room) return;
    let live = true;
    const load = () =>
      void controller()
        .cardStatus(room, CARD_REF)
        .then((s) => {
          if (!live) return;
          setStatus(s);
          setPick((p) => p ?? s.mine);
        })
        .catch(() => {});
    load();
    const timer = setInterval(load, POLL_MS);
    document.addEventListener('visibilitychange', load);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', load);
    };
  }, [room?.id]);

  const bothAnswered = !!status?.mine && !!status.partner;
  const locked = bothAnswered;

  async function seal() {
    if (!room || !pick || sending) return;
    setSending(true);
    setProblem(null);
    try {
      const ok = await controller().answer(room, CARD_REF, pick);
      if (!ok) setProblem('Your person has already answered, so this answer is locked in.');
      setStatus(await controller().cardStatus(room, CARD_REF));
    } catch (e) {
      setProblem(problemText(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <section>
      <Link class="back" href={PATHS.today}>
        ← Today
      </Link>
      <div class="question-card">
        <div class="question-meta">
          <span class="pack-tag">
            <Em>💛</Em> Warm Words
          </span>
          <span class="small muted">Day {day}</span>
        </div>
        <h1 class="question" tabIndex={-1}>
          {TODAY_CARD.q}
        </h1>
        <p class="small muted">Pick one. It stays hidden until your person answers too.</p>
        <div class="options">
          {TODAY_CARD.options.map((o) => (
            <button
              key={o.id}
              type="button"
              class={pick === o.id ? 'option is-picked' : 'option'}
              aria-pressed={pick === o.id}
              disabled={locked}
              onClick={() => setPick(o.id)}
            >
              <span class="option-emoji" aria-hidden="true">
                {o.emoji}
              </span>
              <span class="option-label">{o.label}</span>
            </button>
          ))}
        </div>

        {!room && pick && (
          <div class="wait" role="status">
            <b>Picked.</b> Nothing is sent yet. <Link href={PATHS.invite}>Make your room</Link> to seal it and play
            with your person.
          </div>
        )}

        {room && pick && pick !== status?.mine && !locked && (
          <button type="button" class="btn btn-primary btn-block seal" onClick={seal} disabled={sending}>
            {sending ? 'Sealing…' : status?.mine ? 'Change my answer' : 'Seal my answer'}
          </button>
        )}

        {room && status?.mine && !status.partnerAnswered && pick === status.mine && (
          <div class="wait" role="status">
            <b>Sealed.</b> Waiting for your person. You can change it until they answer — nobody sees it before then,
            including us.
          </div>
        )}

        {room && !status?.mine && status?.partnerAnswered && (
          <div class="wait" role="status">
            Your person has answered. Pick yours to open both.
          </div>
        )}

        {problem && (
          <p class="caption error" role="alert">
            {problem}
          </p>
        )}

        {bothAnswered && !revealed && (
          <button type="button" class="btn btn-primary btn-block seal" onClick={() => setRevealed(true)}>
            Your person has answered · open both →
          </button>
        )}
      </div>

      {bothAnswered && revealed && status && (
        <div class="reveal" role="status">
          <p class="reveal-banner">
            {status.mine === status.partner
              ? `You both picked ${optionLabel(status.mine).toLowerCase()}`
              : 'Two different picks. Good to know 😄'}
          </p>
          <div class="reveal-rows">
            <div class="reveal-row reveal-mine">
              <span class="reveal-who">You</span>
              <span class="reveal-answer">{optionLabel(status.mine)}</span>
            </div>
            <div class="reveal-row reveal-theirs">
              <span class="reveal-who">Your person</span>
              <span class="reveal-answer">{optionLabel(status.partner)}</span>
            </div>
          </div>
          <p class="small muted">Saved notes are private and never send a notice, so surprises stay surprises.</p>
        </div>
      )}
    </section>
  );
}
