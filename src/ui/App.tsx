import { useEffect, useRef, useState } from 'preact/hooks';
import { newId } from '../crypto/ids';
import { buildInviteUrl, parseJoinPath, takeInviteKeyFromLocation } from '../crypto/invite';
import { generateRoomKeyBytes, importRoomKey } from '../crypto/roomKey';
import { safetyCode } from '../crypto/safetyCode';
import { isInAppBrowser } from '../platform/inAppBrowser';

// Stage 1 shell. Keys live in memory only until key storage and Supabase are wired up.

export function App() {
  if (isInAppBrowser(navigator.userAgent)) return <OpenInBrowser />;
  const joinRoomId = parseJoinPath(location.pathname);
  return (
    <main class="page">
      <header>
        <h1>Our Kahani</h1>
        <p class="tagline">From pehli baat to our kahani.</p>
      </header>
      {joinRoomId ? <Join roomId={joinRoomId} /> : <Create />}
      <p class="note">Preview build: nothing is saved or sent yet.</p>
    </main>
  );
}

function OpenInBrowser() {
  // Do not read the fragment here: the person needs the full link to reopen it.
  return (
    <main class="page">
      <h1>Open this in Safari or Chrome</h1>
      <p>
        This browser inside the app can't keep your room safe. Tap the ••• menu and choose
        "Open in browser" (or "Open in Safari"), then carry on there.
      </p>
    </main>
  );
}

function Create() {
  const [room, setRoom] = useState<{ invite: string; code: string[] } | null>(null);
  const [copied, setCopied] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  // The button that was pressed is gone; move focus to the result for keyboard and
  // screen reader users.
  useEffect(() => {
    if (room) heading.current?.focus();
  }, [room]);

  async function create() {
    const raw = generateRoomKeyBytes();
    await importRoomKey(raw);
    setRoom({ invite: buildInviteUrl(location.origin, newId(), raw), code: await safetyCode(raw) });
  }

  async function copy() {
    if (!room) return;
    await navigator.clipboard.writeText(room.invite);
    setCopied(true);
  }

  if (!room) {
    return (
      <section class="card">
        <button class="primary" onClick={create}>Create a room</button>
      </section>
    );
  }
  return (
    <section class="card">
      <h2 ref={heading} tabIndex={-1}>Send this link to your person</h2>
      <p class="hint">Use a chat that is end-to-end encrypted, or read it out. Anyone with the link can open the room.</p>
      <p class="invite">{room.invite}</p>
      <button class="primary" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
      <SafetyCode code={room.code} />
    </section>
  );
}

function Join({ roomId }: { roomId: string }) {
  const [state, setState] = useState<{ code: string[] } | 'missing' | 'loading'>('loading');

  useEffect(() => {
    const raw = takeInviteKeyFromLocation(location, history);
    if (!raw) {
      setState('missing');
      return;
    }
    void importRoomKey(raw).then(() => safetyCode(raw)).then((code) => setState({ code }));
  }, [roomId]);

  if (state === 'loading') return null;
  if (state === 'missing') {
    return (
      <section class="card">
        <h2>This invite link is incomplete</h2>
        <p>Ask for the link again and open the whole thing in Safari or Chrome.</p>
      </section>
    );
  }
  return (
    <section class="card">
      <h2>You're in</h2>
      <SafetyCode code={state.code} />
    </section>
  );
}

function SafetyCode({ code }: { code: string[] }) {
  return (
    <div class="safety">
      <p class="label">Your safety code</p>
      <p class="emoji" aria-label={`Safety code: ${code.join(' ')}`}>{code.join(' ')}</p>
      <p class="hint">Compare this on a call. If it matches on both phones, nobody swapped your invite link on the way.</p>
    </div>
  );
}
