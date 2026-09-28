import { useEffect, useState } from 'preact/hooks';
import { ApiError } from '../../net/api';
import { SessionError } from '../../net/session';
import { controller } from '../../state/controller';
import { dayOfSeason, SEASON_DAYS } from '../../state/room';
import { useRoom } from '../../state/roomContext';
import { Em, Link, Note, Row, Soon } from '../components';
import { navigate, PATHS } from '../router';

/** Plain words for anything that can go wrong while making or joining a room. */
export function problemText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'offline') return 'You seem to be offline. Check your connection and try again.';
    if (e.code === 'too-many-rooms') return 'You already have three open rooms on this device.';
    if (e.code === 'invalid-invite') return 'This invite is not valid any more. Invites last 48 hours: ask for a new one.';
    if (e.code === 'room-full') return 'This room already has two people.';
  }
  if (e instanceof SessionError) return 'We could not reach our server just now. Please try again in a moment.';
  return 'Something went wrong. Please try again.';
}

export function useCreateRoom() {
  const { setRoom } = useRoom();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function create() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setRoom(await controller().create());
      navigate(PATHS.invite);
    } catch (e) {
      setError(problemText(e));
    } finally {
      setBusy(false);
    }
  }
  return { create, busy, error };
}

function isInstalled(): boolean {
  return (
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function Today() {
  const { room, status } = useRoom();
  const { create, busy, error } = useCreateRoom();
  const [answered, setAnswered] = useState(0);
  const day = room ? dayOfSeason(room) : 1;

  useEffect(() => {
    if (!room) return;
    let live = true;
    void controller()
      .cardStatus(room, 'warm.1')
      .then((s) => live && setAnswered(s.mine ? 1 : 0))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [room?.id]);

  return (
    <section>
      <span class="season-badge">
        <Em>✨</Em> Season 1 · Pehli Baat
      </span>
      <h1 class="hero" tabIndex={-1}>
        From pehli baat <em>to our kahani.</em> <Em>💛</Em>
      </h1>
      <p class="lead">
        One small card a day. One tap or one line, under twenty seconds. Answers stay hidden until you both
        reply — no scores, no streaks, skipping is always fine.
      </p>

      {status === 'loading' ? (
        <p class="caption" role="status">
          Opening your room…
        </p>
      ) : status === 'lost-access' ? (
        <div class="panel panel-gold" role="status">
          <div class="panel-title">This browser lost its sign-in for your room</div>
          <p class="small">
            Your room's key is still on this phone, but the browser cleared the rest. Your twelve recovery words will
            bring it back; that arrives in the next update.
          </p>
        </div>
      ) : room ? (
        <>
          <ol class="days" aria-label={`Day ${day} of ${SEASON_DAYS}`}>
            {Array.from({ length: SEASON_DAYS }, (_, i) => i + 1).map((n) => (
              <li
                key={n}
                class={n === day ? 'day is-today' : n < day ? 'day is-past' : 'day'}
                aria-current={n === day ? 'date' : undefined}
              >
                {n}
              </li>
            ))}
          </ol>
          <p class="caption">
            {answered} of {SEASON_DAYS} answered
          </p>
          {!room.partnerJoined && room.role === 'creator' && (
            <p class="caption">
              Waiting for your person to join. <Link href={PATHS.invite}>Show the invite link</Link>
            </p>
          )}
          <Link class="btn btn-cta" href={PATHS.card}>
            <span>
              <Em>🎉</Em> Open today's card
            </span>
            <span class="cta-meta">Day {day} →</span>
          </Link>
          <button type="button" class="btn btn-ghost" disabled>
            <Em>💛</Em> Send a “thinking of you” <Soon />
          </button>
        </>
      ) : (
        <>
          <button type="button" class="btn btn-cta" onClick={create} disabled={busy} aria-busy={busy}>
            <span>
              <Em>🎉</Em> {busy ? 'Making your room…' : 'Create a room'}
            </span>
            <span class="cta-meta" aria-hidden="true">
              Start →
            </span>
          </button>
          {error ? (
            <p class="caption error" role="alert">
              {error}
            </p>
          ) : (
            <p class="caption">Your person joins with a link. No sign-up, no email, no phone number.</p>
          )}
        </>
      )}

      <h2 class="section-title">
        <Em>🎲</Em> More ways to play
      </h2>
      <div class="rows">
        <Row emoji="🎲" tint="gold" title="Micro-Dates" sub="Spin for a fifteen-minute date" pill="Soon" />
        <Row emoji="🍿" tint="pink" title="Movie Night" sub="Home or apart. Swipe to pick what to watch" pill="Swipe" href={PATHS.movie} />
        <Row emoji="📷" tint="accent" title="Right Now" sub="Share a photo of what you are up to, whenever" pill="New" href={PATHS.photo} />
        <Row emoji="💛" tint="pink" title="Gentle Corner" sub="Opt-in for both. Share what is on your mind" pill="Off" href={PATHS.gentle} />
        <Row emoji="🔗" tint="gold" title="Invite & safety code" sub="The link, the twelve words, the emoji check" pill="Setup" href={PATHS.invite} />
        <Row emoji="🎨" tint="accent" title="Make it ours" sub="Theme, accent, text size, motion — just for you" pill="Look" href={PATHS.look} />
      </div>
      <Note dashed>
        {isInstalled()
          ? 'Added to your Home Screen, so it opens like an app and your keys stay put. It is still just the website.'
          : 'Your room arrives as a link in your chat. One tap, no login, no account.'}
      </Note>
    </section>
  );
}
