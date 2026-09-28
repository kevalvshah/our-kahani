import { useEffect, useState } from 'preact/hooks';
import { parseJoinPath, takeInviteKeyFromLocation } from '../../crypto/invite';
import { controller } from '../../state/controller';
import { useRoom } from '../../state/roomContext';
import { Em, Link, ScreenTitle } from '../components';
import { PATHS } from '../router';
import { problemText, useCreateRoom } from './Today';

export function Invite() {
  const { room, setRoom } = useRoom();
  const { create, busy, error } = useCreateRoom();
  const [copied, setCopied] = useState(false);

  // Check whether the partner has joined (then the invite is no longer needed).
  useEffect(() => {
    if (!room || room.partnerJoined || room.role !== 'creator') return;
    let live = true;
    const check = () =>
      void controller()
        .refresh(room)
        .then((next) => live && next && next.partnerJoined && setRoom(next))
        .catch(() => {});
    const timer = setInterval(check, 10_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [room?.id, room?.partnerJoined]);

  if (!room) {
    return (
      <section>
        <ScreenTitle emoji="🔗" lead="Make your room first. Its key is made on this phone and goes into the link you send.">
          Invite &amp; safety code
        </ScreenTitle>
        <button type="button" class="btn btn-primary btn-block" onClick={create} disabled={busy}>
          {busy ? 'Making your room…' : 'Create a room'}
        </button>
        {error && (
          <p class="caption error" role="alert">
            {error}
          </p>
        )}
      </section>
    );
  }

  if (!room.invite) {
    return (
      <section>
        <ScreenTitle
          emoji="🔗"
          lead={
            room.partnerJoined
              ? 'You are both in. The link is not needed any more, so this phone has forgotten it.'
              : 'You joined with your person’s link, so the link stays with them.'
          }
        >
          {room.partnerJoined ? 'You’re both in' : 'Invite & safety code'}
        </ScreenTitle>
        <SafetyCode code={room.safetyCode} />
        <TwelveWords />
      </section>
    );
  }

  const [base, fragment] = room.invite.split('#') as [string, string];
  const invite = room.invite;
  const canShare = typeof navigator.share === 'function';

  async function copy() {
    try {
      await navigator.clipboard.writeText(invite);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section>
      <ScreenTitle
        emoji="🔗"
        lead="Use a chat you trust, or read it out. The key lives in the part after the # and never reaches our server. The link works for 48 hours."
      >
        Send this to your person
      </ScreenTitle>
      <div class="panel">
        <p class="invite">
          {base}
          <span class="invite-key">#{fragment}</span>
        </p>
        <div class="btn-pair">
          <button type="button" class="btn btn-primary" onClick={copy}>
            {copied ? 'Copied' : 'Copy link'}
          </button>
          {canShare && (
            <button
              type="button"
              class="btn btn-secondary btn-narrow"
              onClick={() => void navigator.share({ url: invite }).catch(() => {})}
            >
              Share
            </button>
          )}
        </div>
      </div>
      <SafetyCode code={room.safetyCode} />
      <TwelveWords />
    </section>
  );
}

function SafetyCode({ code }: { code: string[] }) {
  return (
    <div class="panel">
      <div class="panel-title">Your safety code</div>
      <p class="emoji" aria-label={`Safety code: ${code.join(' ')}`}>
        {code.join(' ')}
      </p>
      <p class="small">Compare this on a call. If it matches on both phones, nobody swapped the link on the way.</p>
    </div>
  );
}

function TwelveWords() {
  return (
    <div class="panel panel-gold">
      <div class="panel-title">
        Your twelve words <Em>📝</Em>
      </div>
      <p class="small">
        Coming next: twelve words to write down. They are the only way back if this browser forgets you — which
        Safari does after a week of not opening the room. On iPhone, add Our Kahani to your Home Screen to make
        that far less likely.
      </p>
    </div>
  );
}

export function Join() {
  const { room, setRoom } = useRoom();
  const [state, setState] = useState<'working' | 'missing' | 'failed' | 'done'>('working');
  const [problem, setProblem] = useState('');

  useEffect(() => {
    const roomId = parseJoinPath(location.pathname);
    // Always read and strip the fragment first, even when the path is bad.
    const raw = takeInviteKeyFromLocation(location, history);
    if (!raw || !roomId) {
      setState(room ? 'done' : 'missing');
      return;
    }
    void controller()
      .join(roomId, raw)
      .then((joined) => {
        setRoom(joined);
        setState('done');
      })
      .catch((e: unknown) => {
        setProblem(problemText(e));
        setState('failed');
      });
  }, []);

  if (state === 'working') {
    return (
      <section>
        <ScreenTitle lead="Checking the invite and saving the key on this phone.">Joining your room…</ScreenTitle>
      </section>
    );
  }
  if (state === 'missing') {
    return (
      <section>
        <ScreenTitle lead="Ask for the link again and open the whole thing in Safari or Chrome.">
          This invite link is incomplete
        </ScreenTitle>
      </section>
    );
  }
  if (state === 'failed' || !room) {
    return (
      <section>
        <ScreenTitle lead={problem}>We could not open this room</ScreenTitle>
        <Link class="btn btn-secondary btn-block" href={PATHS.today}>
          Go to today
        </Link>
      </section>
    );
  }
  return (
    <section>
      <ScreenTitle emoji="🎉" lead="Your room's key is on this phone now. It was never sent to our server.">
        You're in
      </ScreenTitle>
      <SafetyCode code={room.safetyCode} />
      <Link class="btn btn-primary btn-block" href={PATHS.today}>
        Go to today →
      </Link>
    </section>
  );
}
