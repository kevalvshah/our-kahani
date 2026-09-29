import { InstallHint } from '../Install';
import { useState } from 'preact/hooks';
import { dayRef, PACKS, SEASON } from '../../content/cards';
import { hashtagOptions, normaliseHashtag } from '../../content/extras';
import { K } from '../../data/kinds';
import { useRoomData } from '../../data/RoomData';
import type { BonusCard } from '../../features/cardLogic';
import { doneByMe, firstWaiting, packProgress, seasonDone } from '../../features/progress';
import { upcomingSaved, untilText, type SavedItem } from '../../features/saved';
import { controller } from '../../state/controller';
import { dayOfSeason, daysLeft, SEASON_DAYS } from '../../state/room';
import { useRoom } from '../../state/roomContext';
import { Brand } from '../Brand';
import { Done, Em, Link, Note, Problem, Row } from '../components';
import { problemText } from '../problems';
import { cardPath, navigate, packPath, PATHS } from '../router';

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
      navigate(PATHS.today);
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

/** Welcome screen before there is a room on this device. */
export function Welcome() {
  const { status } = useRoom();
  const { create, busy, error } = useCreateRoom();
  return (
    <section>
      <span class="season-badge">
        <Em>✨</Em> Season 1 · Pehli Baat
      </span>
      <Brand />
      <p class="lead">
        One small card a day. One tap or one line, under twenty seconds. Answers stay hidden until you both reply — no
        scores, no streaks, skipping is always fine.
      </p>
      {status === 'loading' ? (
        <p class="caption" role="status">
          Opening your room…
        </p>
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
          <Link class="btn btn-ghost" href={PATHS.recover}>
            <Em>🔑</Em> Enter my room (hashtag + phrase)
          </Link>
        </>
      )}
      <InstallHint />
      <Note dashed>
        {isInstalled()
          ? 'Added to your Home Screen, so it opens like an app and your keys stay put. It is still just the website.'
          : 'Your room arrives as a link in your chat. One tap, no login, no account.'}
      </Note>
      <div class="rows home-rows">
        <Row emoji="🔐" tint="accent" title="Privacy" sub="Locked on your phone. Even the developer cannot read it" pill="E2E" href={PATHS.privacy} />
        <Row emoji="🎨" tint="accent" title="Make it ours" sub="Theme, accent, text size, motion — just for you" pill="Look" href={PATHS.look} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Home, inside a room
// ---------------------------------------------------------------------------
export function Today() {
  const d = useRoomData();
  const today = dayOfSeason(d.room);
  const next = firstWaiting(d);
  const done = seasonDone(d);
  const greeting = d.myProfile?.greeting || 'Namaste';
  const left = daysLeft(d.room);

  return (
    <section>
      <span class="season-badge">
        <Em>✨</Em> Season 1 · Pehli Baat
      </span>
      <Hashtag />
      <h1 class="hero" tabIndex={-1}>
        {greeting}, <em>{d.me}</em> <Em>👋</Em>
      </h1>
      <p class="lead">
        {d.room.partnerJoined
          ? 'One small card a day. One tap or one line, and you are done.'
          : d.room.role === 'creator'
            ? 'Your cards are ready. Send the link so your person can join.'
            : 'One small card a day. One tap or one line, and you are done.'}
      </p>

      {!d.room.partnerJoined && d.room.role === 'creator' && (
        <div class="pingbar">
          <span>🔗 Waiting for your person to join</span>
          <Link class="btn-small" href={PATHS.invite}>
            Show link
          </Link>
        </div>
      )}
      <PartnerPing />
      <UpcomingDate />

      <ol class="days" aria-label={`Day ${today} of ${SEASON_DAYS}`}>
        {Array.from({ length: SEASON_DAYS }, (_, i) => i + 1).map((n) => {
          const ref = dayRef(n);
          const isDone = SEASON[n] && doneByMe(d, ref);
          const open = n <= today;
          const label = `Day ${n}${isDone ? ', answered' : open ? '' : ', not yet'}`;
          return (
            <li key={n}>
              {open ? (
                <Link
                  class={`day${isDone ? ' is-done' : ''}${ref === next ? ' is-today' : ''}`}
                  href={cardPath(ref)}
                  aria-label={label}
                  aria-current={n === today ? 'date' : undefined}
                >
                  {isDone ? '✓' : n}
                </Link>
              ) : (
                <span class="day is-future" aria-label={label}>
                  {n}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p class="caption">
        {done} of {SEASON_DAYS} answered · No streaks. Skip any day, no guilt.
      </p>

      {next ? (
        <Link class="btn btn-cta" href={cardPath(next)}>
          <span>
            <Em>🎉</Em> {next.startsWith('day:') ? "Open today's card" : 'Open the extra card waiting for you'}
          </span>
          <span class="cta-meta">{next.startsWith('day:') ? `Day ${next.split(':')[1]} →` : '→'}</span>
        </Link>
      ) : (
        <Done>Nothing waiting on you 🎉 Try a pack, or add a card for {d.partner}.</Done>
      )}
      <ThinkingOfYou />

      <h2 class="section-title">
        <Em>🃏</Em> Card packs
      </h2>
      <p class="small muted section-sub">Play in any order, skip freely.</p>
      <div class="rows">
        {PACKS.map((p) => {
          const pr = packProgress(d, p.id);
          return (
            <Row
              key={p.id}
              emoji={p.e}
              tint={pr.done === pr.total ? 'plain' : 'gold'}
              title={p.name}
              sub={p.blurb}
              pill={`${pr.done}/${pr.total}`}
              href={packPath(p.id)}
            />
          );
        })}
      </div>

      <h2 class="section-title">
        <Em>🎲</Em> More ways to play
      </h2>
      <MoreWays />

      <h2 class="section-title">
        <Em>✍️</Em> Make it ours
      </h2>
      <p class="small muted section-sub">Add your own this-or-that or a Never have I ever. It lands on {d.partner}'s phone as a card.</p>
      <Link class="btn btn-secondary btn-block" href={PATHS.add}>
        ＋ Add a card
      </Link>
      <BonusList />

      <div class="rows home-rows">
        <Row emoji="🗄️" tint={left <= 7 ? 'pink' : 'plain'} title="Room data" sub="Download everything, keep it 4 more weeks, or erase" pill={`${left}d`} href={PATHS.room} />
        <Row emoji="🔐" tint="accent" title="Privacy" sub="Locked on your phone. Even the developer cannot read it" pill="E2E" href={PATHS.privacy} />
      </div>
      <InstallHint />
      <InstallHint />
      <Note dashed>
        {isInstalled()
          ? 'Added to your Home Screen, so it opens like an app and your keys stay put. It is still just the website.'
          : 'On iPhone, add Our Kahani to your Home Screen (Share, then Add to Home Screen) so Safari keeps your room.'}
      </Note>
    </section>
  );
}

function MoreWays() {
  const d = useRoomData();
  const savedCount = d.list(K.SAVED).length;
  const gentleOn = !!d.mine<{ on: boolean }>(K.GENTLE_OPT, 'gentle')?.data.on;
  const songs = d.list(K.ANTAKSHARI);
  const lastSong = songs[songs.length - 1];
  const myAntaTurn = !lastSong || !lastSong.mine;
  const lines = d.list(K.STORY_LINE);
  const lastLine = lines[lines.length - 1];
  const capsuleSealed = !!d.mine(K.CAPSULE, 'capsule');
  return (
    <div class="rows">
      <Row emoji="🎲" tint="gold" title="Micro-Dates" sub="Spin for a 15-minute date. Nothing to plan" pill="Spin" href={PATHS.micro} />
      <Row emoji="🎵" tint="pink" title="Antakshari Lite" sub="Last letter, next song" pill={myAntaTurn ? 'Your turn' : 'Waiting'} href={PATHS.antakshari} />
      <Row emoji="📖" tint="accent" title="Story Relay" sub="One silly sentence each" pill={!lastLine || !lastLine.mine ? 'Your turn' : 'Waiting'} href={PATHS.story} />
      <Row emoji="⏳" tint="gold" title="Time Capsule" sub="Optional. A line for three months from now" pill={capsuleSealed ? 'Sealed' : 'Open'} href={PATHS.capsule} />
      <Row emoji="🍿" tint="pink" title="Movie Night" sub="Home or apart. Swipe to pick what to watch" pill="Swipe" href={PATHS.movie} />
      <Row emoji="📷" tint="accent" title="Right Now" sub="Share a photo of what you are up to, whenever" pill="Share" href={PATHS.photo} />
      <Row emoji="💛" tint="pink" title="Gentle Corner" sub="Opt-in for both. Share what is on your mind" pill={gentleOn ? 'On' : 'Off'} href={PATHS.gentle} />
      <Row emoji="🔖" tint="gold" title="Saved" sub={`Your private notes about ${d.partner}`} pill={String(savedCount)} href={PATHS.saved} />
      <Row emoji="🔗" tint="gold" title="Invite & safety code" sub="The link and the emoji check" pill="Setup" href={PATHS.invite} />
      <Row emoji="🎨" tint="accent" title="Make it ours" sub="Theme, accent, text size, motion — just for you" pill="Look" href={PATHS.look} />
    </div>
  );
}

function BonusList() {
  const d = useRoomData();
  const cards = d.list<BonusCard>(K.BONUS_CARD);
  if (!cards.length) return null;
  return (
    <div class="rows bonus-rows">
      {cards.map((c) => {
        const waiting = !doneByMe(d, c.ref);
        return (
          <Row
            key={c.id}
            emoji={c.data.kind === 'nhie' ? '🙋' : '🤔'}
            tint={c.mine ? 'accent' : 'pink'}
            title={c.data.kind === 'nhie' ? `Never have I ever… ${c.data.q}` : c.data.q}
            sub={c.mine ? 'You added this' : `Added by ${d.partner}`}
            pill={waiting ? 'Your turn' : 'Waiting'}
            pillTint={waiting ? 'gold' : 'plain'}
            href={cardPath(c.ref)}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Room hashtag: one suggests, the other agrees (locks for good) or counters
// ---------------------------------------------------------------------------
function Hashtag() {
  const d = useRoomData();
  const final = d.list<{ tag: string }>(K.HASHTAG)[0]?.data.tag;
  const mineS = d.mine<{ tag: string; at: number }>(K.HASHTAG_SUGGESTION, 'hashtag');
  const theirsS = d.theirs<{ tag: string; at: number }>(K.HASHTAG_SUGGESTION, 'hashtag');
  const [picked, setPicked] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [countering, setCountering] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (final) {
    return (
      <span class="pill tint-gold hashtag-pill" title="The room name is permanent">
        🔒 {final}
      </span>
    );
  }
  if (!d.partnerProfile || !d.myProfile) return null;

  const latest = [mineS, theirsS].filter(Boolean).sort((a, b) => a!.data.at - b!.data.at).pop();
  const options = hashtagOptions(d.me, d.partner);

  async function suggest() {
    const tag = normaliseHashtag(custom) || picked || options[0]!;
    if (custom.trim() && !normaliseHashtag(custom)) {
      setProblem('Use letters or numbers for the name.');
      return;
    }
    setProblem(null);
    await d.put(K.HASHTAG_SUGGESTION, 'hashtag', { tag, at: Date.now() });
    setCountering(false);
    setCustom('');
  }

  async function agree(tag: string) {
    try {
      await d.add(K.HASHTAG, 'hashtag', { tag });
    } catch (e) {
      setProblem(problemText(e));
      void d.refresh();
    }
  }

  if (latest && !countering) {
    if (latest.mine) {
      return (
        <div class="panel panel-accent">
          <div class="panel-title">You suggested {latest.data.tag}</div>
          <p class="small">Waiting for {d.partner} to agree 💭 The room name locks for good once you both say yes.</p>
          <button type="button" class="btn btn-secondary btn-block" onClick={() => setCountering(true)}>
            Change my suggestion
          </button>
        </div>
      );
    }
    return (
      <div class="panel panel-accent">
        <div class="panel-title">
          {d.partner} suggests {latest.data.tag} 🎉
        </div>
        <p class="small">
          It would become your room's name. Once you both agree, <b>it is locked and can't be changed later</b>.
        </p>
        <div class="btn-pair">
          <button type="button" class="btn btn-primary" onClick={() => void agree(latest.data.tag)}>
            Agree and lock it 🔒
          </button>
          <button type="button" class="btn btn-secondary btn-narrow" onClick={() => setCountering(true)}>
            Suggest another
          </button>
        </div>
        <Problem text={problem} />
      </div>
    );
  }

  return (
    <div class="panel panel-accent">
      <div class="panel-title">{countering ? 'Suggest a different one' : '🎉 Name your room together'}</div>
      <p class="small">
        Choose the room's hashtag together. Suggest one, and it locks when {d.partner} agrees. <b>Once locked, it can't be changed.</b> It is
        your room's name: with a phrase each of you picks next, it opens your room on any device.
      </p>
      <div class="chip-row" role="group" aria-label="Suggested names">
        {options.map((o) => (
          <button key={o} type="button" class={(picked ?? options[0]) === o && !custom ? 'chip is-on' : 'chip'} aria-pressed={(picked ?? options[0]) === o && !custom} onClick={() => { setPicked(o); setCustom(''); }}>
            {o}
          </button>
        ))}
      </div>
      <label class="field-label" for="rtag">
        Or type your own
      </label>
      <input id="rtag" class="field" maxLength={25} value={custom} placeholder="#YourOwn" autocomplete="off" onInput={(e) => setCustom((e.target as HTMLInputElement).value)} />
      <Problem text={problem} />
      <div class="btn-pair">
        <button type="button" class="btn btn-primary" onClick={() => void suggest()}>
          Suggest this one
        </button>
        {countering && (
          <button type="button" class="btn btn-secondary btn-narrow" onClick={() => setCountering(false)}>
            Never mind
          </button>
        )}
      </div>
      <p class="small muted">Nobody can find your room with it. If you share it publicly, people can read your names, so share it only if you like.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thinking of you
// ---------------------------------------------------------------------------
const seenKey = (room: string) => `ok.ping-seen.${room}`;

function PartnerPing() {
  const d = useRoomData();
  const ping = d.theirs<{ at: number }>(K.PING, 'ping')?.data.at;
  const [seen, setSeen] = useState(() => {
    try {
      return Number(localStorage.getItem(seenKey(d.room.id)) ?? 0);
    } catch {
      return 0;
    }
  });
  if (!ping || ping <= seen) return null;
  return (
    <div class="pingbar">
      <span>{d.partner} is thinking of you 💛</span>
      <button
        type="button"
        class="btn-small"
        onClick={() => {
          setSeen(ping);
          try {
            localStorage.setItem(seenKey(d.room.id), String(ping));
          } catch {
            // private mode: fine, it shows again next visit
          }
        }}
      >
        Aww
      </button>
    </div>
  );
}

function ThinkingOfYou() {
  const d = useRoomData();
  const [sent, setSent] = useState(false);
  return (
    <>
      <button
        type="button"
        class="btn btn-ghost"
        disabled={!d.room.partnerJoined}
        onClick={() => {
          void d.put(K.PING, 'ping', { at: Date.now() });
          setSent(true);
        }}
      >
        <Em>💛</Em> Send a “thinking of you”
      </button>
      {sent && <Done>Sent 💛 {d.partner} will see it next time they open the app.</Done>}
    </>
  );
}

function UpcomingDate() {
  const d = useRoomData();
  const u = upcomingSaved(d.list<SavedItem>(K.SAVED).map((r) => r.data));
  if (!u) return null;
  const when = untilText(u.date);
  return (
    <div class="pingbar">
      <span>
        🎁 {when === 'today' ? 'Today' : `Coming up ${when}`}: {u.note || u.q}
        <small class="block muted">Only you see this</small>
      </span>
      <Link class="btn-small" href={PATHS.saved}>
        Open
      </Link>
    </div>
  );
}
