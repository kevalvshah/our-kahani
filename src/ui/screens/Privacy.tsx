import { useState } from 'preact/hooks';
import { toBase64Url } from '../../crypto/bytes';
import { EnvelopeError, open, seal } from '../../crypto/envelope';
import { utf8 } from '../../crypto/bytes';
import { generateRoomKeyBytes, importRoomKey } from '../../crypto/roomKey';
import { useRoom } from '../../state/roomContext';
import { Back, Done, RevealRow, ScreenTitle, SupportLine } from '../components';
import { PATHS } from '../router';

// Explains, and shows, the lock. The demo uses a throwaway key made for this screen only;
// nothing typed here is saved or sent.

const ctx = { roomId: 'demo', recordId: 'demo', kind: 1 };

export function Privacy() {
  const { room } = useRoom();
  const [text, setText] = useState('');
  const [demo, setDemo] = useState<{ key: CryptoKey; env: Uint8Array<ArrayBuffer>; plain: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function lock() {
    if (!text.trim()) return;
    const key = await importRoomKey(generateRoomKeyBytes());
    setDemo({ key, env: await seal(key, ctx, utf8(text.trim())), plain: text.trim() });
    setMsg(null);
  }

  async function tryWrongKey() {
    if (!demo) return;
    try {
      await open(await importRoomKey(generateRoomKeyBytes()), ctx, demo.env);
      setMsg('Unexpected: it unlocked.');
    } catch (e) {
      if (e instanceof EnvelopeError) setMsg('Wrong key: it will not unlock. That is what the server sees. ✋');
    }
  }

  async function tryTamper() {
    if (!demo) return;
    const bad = demo.env.slice();
    bad[bad.length - 1] = bad[bad.length - 1]! ^ 1;
    try {
      await open(demo.key, ctx, bad);
      setMsg('Unexpected: it unlocked.');
    } catch {
      setMsg('One character changed: it will not unlock. Tampering is caught. 🛡️');
    }
  }

  return (
    <section>
      <Back href={PATHS.today} label="← Today" />
      <ScreenTitle emoji="🔐" lead="Everything you type is locked on your phone before it leaves. The server only keeps scrambled text and does not have the key, so the developer sees the same scrambled text. Only the two of you can open it.">
        Even the developer can't read it
      </ScreenTitle>
      {room && (
        <div class="panel">
          <div class="panel-title">Your safety code</div>
          <p class="emoji" aria-label={`Safety code: ${room.safetyCode.join(' ')}`}>
            {room.safetyCode.join(' ')}
          </p>
          <p class="small">Compare this on a call. If it matches on both phones, nobody swapped your invite link on the way.</p>
        </div>
      )}
      <div class="panel">
        <label class="field-label" for="privtext">
          Try it: type something private
        </label>
        <input id="privtext" class="field" maxLength={120} value={text} placeholder="e.g. My favourite flower is a sunflower" autocomplete="off" onInput={(e) => setText((e.target as HTMLInputElement).value)} />
        <button type="button" class="btn btn-primary btn-block" onClick={() => void lock()}>
          Lock it 🔒
        </button>
        {demo && (
          <div class="reveal">
            <RevealRow who="You see" tone="mine">
              {demo.plain}
            </RevealRow>
            <RevealRow who="Server sees" tone="theirs">
              <span class="cipher">{toBase64Url(demo.env)}</span>
            </RevealRow>
            <div class="btn-pair">
              <button type="button" class="btn btn-secondary" onClick={() => void tryWrongKey()}>
                Try a wrong key
              </button>
              <button type="button" class="btn btn-secondary" onClick={() => void tryTamper()}>
                Change one character
              </button>
            </div>
            {msg && <Done>{msg}</Done>}
          </div>
        )}
        <p class="small muted">This demo uses a throwaway key made just now. Nothing typed here is saved or sent.</p>
      </div>
      <div class="panel">
        <div class="panel-title">What the server can see</div>
        <p class="small">
          <b>Cannot:</b> names, answers, photos, saved notes, the room hashtag, your room phrase.
        </p>
        <p class="small">
          <b>Can:</b> that a room exists, roughly when things happen, how many things there are, and their size range.
        </p>
      </div>
      <div class="safety">
        Honest limits: this protects your data if the database is read or leaked. It can't help if someone has your unlocked
        phone, or if the app's own code were swapped, which is why the code is open source. Whoever can read the chat you send
        the invite link in could copy it, so use an end-to-end encrypted chat or read it out. Your room phrase protects the backup
        of your key, so pick one others could not guess: a weak phrase could be guessed by anyone holding the database. If
        you lose your device and forget your phrase, only your person can help you back in, with a one-time rescue code from
        their phone or laptop. If you both lose everything, nobody can bring the room back, including us.
      </div>
      <SupportLine />
    </section>
  );
}
