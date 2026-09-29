import { useState } from 'preact/hooks';
import { controller } from '../../state/controller';
import { useRoom } from '../../state/roomContext';
import { Brand } from '../Brand';
import { Em, Link, Note, Row } from '../components';
import { InstallHint } from '../Install';
import { problemText } from '../problems';
import { navigate, PATHS } from '../router';

// The first screen before there is a room on this device. Kept apart from Today so the first
// download stays small: the card packs load only once someone is in a room.

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

export function isInstalled(): boolean {
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
        Small cards, one tap or one line, at your own pace. Answers stay hidden until you both reply — no
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

