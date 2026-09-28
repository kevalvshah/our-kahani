import { newId } from '../../crypto/ids';
import { buildInviteUrl } from '../../crypto/invite';
import { generateRoomKeyBytes, importRoomKey } from '../../crypto/roomKey';
import { safetyCode } from '../../crypto/safetyCode';
import { dayOfSeason, SEASON_DAYS, type Room } from '../../state/room';
import { useRoom } from '../../state/roomContext';
import { Em, Link, Note, Row, Soon } from '../components';
import { navigate, PATHS } from '../router';

export function useCreateRoom() {
  const { setRoom } = useRoom();
  return async function create() {
    const raw = generateRoomKeyBytes();
    const key = await importRoomKey(raw);
    const id = newId();
    const room: Room = {
      id,
      role: 'creator',
      key,
      safetyCode: await safetyCode(raw),
      invite: buildInviteUrl(location.origin, id, raw),
      startedAt: Date.now(),
    };
    setRoom(room);
    navigate(PATHS.invite);
  };
}

function isInstalled(): boolean {
  return (
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function Today() {
  const { room } = useRoom();
  const create = useCreateRoom();
  const day = room ? dayOfSeason(room) : 1;

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

      {room ? (
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
          <p class="caption">0 of {SEASON_DAYS} answered</p>
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
          <button type="button" class="btn btn-cta" onClick={create}>
            <span>
              <Em>🎉</Em> Create a room
            </span>
            <span class="cta-meta" aria-hidden="true">Start →</span>
          </button>
          <p class="caption">Your person joins with a link. No sign-up, no email, no phone number.</p>
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
      <Note>Preview: rooms are not saved yet, so reloading the page starts over.</Note>
    </section>
  );
}
