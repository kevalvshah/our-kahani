import { useEffect, useRef, useState } from 'preact/hooks';
import { K } from '../../data/kinds';
import { useRoomData } from '../../data/RoomData';
import { open } from '../../crypto/envelope';
import { buildArchive, type MediaFile } from '../../features/archive';
import type { Answer } from '../../features/cardLogic';
import { currentSettings } from '../../features/settings';
import { downloadFile } from '../../features/xlsx';
import { controller } from '../../state/controller';
import { useRoom } from '../../state/roomContext';
import { Back, Done, Field, Problem, SupportLine } from '../components';
import { problemText } from '../problems';
import { NotificationSwitch } from '../Notifications';
import { navigate, PATHS } from '../router';

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** Photos and voice notes, fetched and unlocked on this phone. Any that fail are left out. */
async function mediaFiles(d: ReturnType<typeof useRoomData>): Promise<MediaFile[]> {
  const media = controller().media;
  if (!media.enabled()) return [];
  const wanted: { obj: string; kind: number; name: string }[] = [];
  const stamp = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace(/[T:]/g, '-');
  for (const p of d.list<{ obj: string }>(K.PHOTO)) {
    wanted.push({ obj: p.data.obj, kind: K.PHOTO, name: `photo-${stamp(p.createdAt)}-${p.mine ? 'me' : 'partner'}.jpg` });
  }
  for (const a of d.list<Answer>(K.ANSWER)) {
    const v = a.data.voice;
    if (v) wanted.push({ obj: v.obj, kind: K.VOICE, name: `voice-${stamp(a.createdAt)}-${a.mine ? 'me' : 'partner'}.${v.type.includes('mp4') ? 'm4a' : v.type.includes('ogg') ? 'ogg' : 'webm'}` });
  }
  const out: MediaFile[] = [];
  for (const w of wanted) {
    try {
      const data = await open(d.room.key, { roomId: d.room.id, recordId: w.obj, kind: w.kind }, await media.get(d.room.id, w.obj));
      out.push({ name: `${String(out.length + 1).padStart(2, '0')}-${w.name}`, data });
    } catch {
      // Not reachable right now: the spreadsheet still has everything else.
    }
  }
  return out;
}

export async function download(d: ReturnType<typeof useRoomData>): Promise<string> {
  const media = await mediaFiles(d);
  const { bytes, name } = buildArchive(d, media);
  downloadFile(name, bytes, 'application/zip');
  try {
    localStorage.setItem(downloadedKey(d.room.id), String(Date.now()));
  } catch {
    // fine: the reminder may show again
  }
  return 'Saved to your device 📥';
}

export function RoomDataScreen() {
  const d = useRoomData();
  const { setRoom } = useRoom();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const hashtag = d.list<{ tag: string }>(K.HASHTAG)[0]?.data.tag;

  /** Everything is downloaded to this device first, then the room is erased for both. */
  async function downloadAndErase() {
    setProblem(null);
    setBusy(true);
    try {
      setMsg('Putting everything together on this device…');
      await download(d);
      await controller().erase(d.room);
      setRoom(null);
      navigate(PATHS.today);
    } catch (e) {
      setProblem(problemText(e));
      setBusy(false);
    }
  }

  return (
    <section>
      <Back href={PATHS.today} label="← Today" />
      <div class="question-card">
        <span class="pack-tag">🗄️ Room data</span>
        <h1 class="question" tabIndex={-1}>
          Your room, your pace
        </h1>
        <dl class="facts">
          <div>
            <dt>Room</dt>
            <dd>{hashtag ?? 'Hashtag not chosen yet'}</dd>
          </div>
          <div>
            <dt>Started</dt>
            <dd>{fmtDate(d.room.startedAt)}</dd>
          </div>
          <div>
            <dt>Your person</dt>
            <dd>{d.room.partnerJoined ? `${d.partner} joined` : 'Not joined yet'}</dd>
          </div>
          <div>
            <dt>Encryption</dt>
            <dd>AES-256-GCM, on device</dd>
          </div>
        </dl>
        <p class="small">
          Your room stays for as long as you both want it: no end date. <b>Photos and voice notes are kept for 28 days each</b>, so
          download them to keep them. Everything stays locked with your key the whole time.
        </p>
        <p class="small muted">Downloads are put together on your device, because the server can't read your data. Each of you can download at any time.</p>
        {msg && <Done>{msg}</Done>}
        <button type="button" class="btn btn-primary btn-block" onClick={() => { setMsg('Putting it together on this device…'); void download(d).then(setMsg); }}>
          📥 Download everything (zip)
        </button>
        <Problem text={problem} />
        <AnswerOrder />
        <NotificationSwitch />
        <Rescue />
        <Devices />
        {confirm ? (
          <div class="panel panel-pink">
            <div class="panel-title">Erase this room?</div>
            <p class="small">
              First, everything is downloaded to this device (your answers and notes in Excel, plus any photos and voice notes still
              kept). Then every answer, photo and note is deleted for both of you. It can't be undone.
            </p>
            <div class="stack">
              <button type="button" class="btn btn-danger" disabled={busy} onClick={() => void downloadAndErase()}>
                {busy ? 'Downloading, then erasing…' : '📥 Download and erase'}
              </button>
              <button type="button" class="btn btn-secondary" disabled={busy} onClick={() => setConfirm(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" class="btn btn-secondary btn-quiet btn-block seal" onClick={() => setConfirm(true)}>
            🧹 Erase this room
          </button>
        )}
        <p class="small muted">Erasing deletes the ciphertext and discards the keys. Nobody can bring the room back, including us.</p>
      </div>
      <SupportLine />
    </section>
  );
}

/** This person's devices: add one with hashtag + phrase; sign the others out if one is lost. */
function Devices() {
  const d = useRoomData();
  const [devices, setDevices] = useState<{ addedAt: number; thisDevice: boolean }[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    void controller().myDevices(d.room).then(setDevices).catch(() => setDevices(null));
  }, [d.room.id]);
  const others = (devices ?? []).filter((x) => !x.thisDevice).length;
  const day = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  async function signOut() {
    const n = await controller().signOutOtherDevices(d.room).catch(() => 0);
    setMsg(n ? `Signed out ${n} other ${n === 1 ? 'device' : 'devices'}.` : 'Nothing to sign out.');
    setConfirm(false);
    setDevices(await controller().myDevices(d.room).catch(() => null));
  }

  return (
    <div class="panel">
      <div class="panel-title">Your devices{devices ? ` · ${devices.length}` : ''}</div>
      {devices && devices.length > 0 && (
        <ul class="device-list">
          {devices.map((x, i) => (
            <li key={i}>
              {x.thisDevice ? '📍 This device' : `Another device`} <span class="muted">· added {day(x.addedAt)}</span>
            </li>
          ))}
        </ul>
      )}
      <p class="small">
        Play on your phone and laptop: on the other device choose <b>Enter my room</b> and type your hashtag and phrase
        (up to four devices).
      </p>
      {msg && <Done>{msg}</Done>}
      {others > 0 &&
        (confirm ? (
          <div class="btn-pair">
            <button type="button" class="btn btn-danger" onClick={() => void signOut()}>
              Sign them out
            </button>
            <button type="button" class="btn btn-secondary btn-narrow" onClick={() => setConfirm(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" class="btn btn-secondary btn-block" onClick={() => setConfirm(true)}>
            Lost one? Sign out my other devices
          </button>
        ))}
    </div>
  );
}

/**
 * Partner rescue, on whichever device (phone or laptop) still has the room: a one-time code for a partner who lost
 * both their device and their phrase. This person's own phrase unlocks the room key to seal.
 */
function Rescue() {
  const d = useRoomData();
  const hashtag = d.list<{ tag: string }>(K.HASHTAG)[0]?.data.tag;
  const [step, setStep] = useState<'idle' | 'phrase' | 'code'>('idle');
  const [waiting, setWaiting] = useState<number | null>(null);
  const [phrase, setPhrase] = useState('');
  const [made, setMade] = useState<{ code: string; expiresAt: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const ready = !!hashtag && d.room.partnerJoined && d.room.backedUp;

  useEffect(() => {
    if (ready) void controller().rescueStatus(d.room).then(setWaiting).catch(() => setWaiting(null));
  }, [ready, d.room.id]);

  if (!ready || !hashtag) return null;
  const time = (ms: number) => new Date(ms).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });

  async function make() {
    setBusy(true);
    setProblem(null);
    try {
      const r = await controller().makeRescue(d.room, hashtag!, phrase);
      setMade(r);
      setWaiting(r.expiresAt);
      setPhrase('');
      setStep('code');
    } catch (e) {
      setProblem(problemText(e));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    await controller().cancelRescue(d.room).catch(() => undefined);
    setWaiting(null);
    setMade(null);
    setStep('idle');
  }

  if (step === 'code' && made) {
    return (
      <div class="panel panel-gold">
        <div class="panel-title">Rescue code for {d.partner}</div>
        <p class="rescue-code" aria-label={`Rescue code ${made.code.split('').join(' ')}`}>
          {made.code}
        </p>
        <p class="small">
          Give it to {d.partner} yourself: in person, on a call, or in an end-to-end encrypted chat. On their new device:
          <b> Enter my room → I have a rescue code</b>, then <b>{hashtag}</b> and this code. It works once, until{' '}
          {time(made.expiresAt)}. Then they pick a new phrase.
        </p>
        <div class="btn-pair">
          <button
            type="button"
            class="btn btn-secondary"
            onClick={() => void navigator.clipboard?.writeText(made.code).then(() => setCopied(true)).catch(() => undefined)}
          >
            {copied ? 'Copied' : 'Copy the code'}
          </button>
          <button type="button" class="btn btn-secondary btn-narrow" onClick={() => void cancel()}>
            Cancel it
          </button>
        </div>
        <p class="small muted">This screen shows the code once. Leaving it is fine: make a new one if it gets lost.</p>
      </div>
    );
  }

  return (
    <div class="panel">
      <div class="panel-title">Help {d.partner} back in</div>
      <p class="small">
        If {d.partner} lost their devices and their phrase, you can make a one-time rescue code for them. It works once, for
        24 hours, and signs their old devices out. Their old private notes cannot come back.
      </p>
      {waiting && step === 'idle' && (
        <p class="small">
          A rescue code is waiting until {time(waiting)}.{' '}
          <button type="button" class="link-button" onClick={() => void cancel()}>
            Cancel it
          </button>
        </p>
      )}
      {step === 'phrase' ? (
        <>
          <Field id="myphrase" label="Your own phrase (to unlock the room key on this device)" value={phrase} onInput={setPhrase} maxLength={120} />
          <Problem text={problem} />
          <div class="btn-pair">
            <button type="button" class="btn btn-primary" disabled={busy || !phrase.trim()} onClick={() => void make()}>
              {busy ? 'Making it…' : 'Make the rescue code'}
            </button>
            <button type="button" class="btn btn-secondary btn-narrow" onClick={() => setStep('idle')}>
              Not now
            </button>
          </div>
        </>
      ) : (
        <button type="button" class="btn btn-secondary btn-block" onClick={() => setStep('phrase')}>
          {waiting ? 'Make a new rescue code' : `Help ${d.partner} back in`}
        </button>
      )}
    </div>
  );
}

/** Room setting: who answers each card first. Either person can change it. */
function AnswerOrder() {
  const d = useRoomData();
  const on = currentSettings(d.list(K.ROOM_SETTINGS)).inviteeFirst;
  const first = d.room.role === 'creator' ? d.partner : 'You';
  return (
    <div class="switch-row">
      <span class="row-text">
        <span class="row-title">{first} answer{first === 'You' ? '' : 's'} first</span>
        <span class="row-sub">{on ? 'Each card opens for the other person once this answer is in.' : 'Off: either of you can go first.'}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Take turns answering"
        class="switch"
        onClick={() => void d.add(K.ROOM_SETTINGS, 'settings', { inviteeFirst: !on })}
      >
        <span class="switch-track">
          <span class="switch-knob" />
        </span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The last-week reminder, shown on opening the app in the final 7 days
// ---------------------------------------------------------------------------
const snoozeKey = (room: string) => `ok.remind-later.${room}`;

/** Photos and voice notes that will go within a week, and have not been downloaded since. */
export function mediaExpiringSoon(d: ReturnType<typeof useRoomData>, lastDownload: number, now = Date.now()): number {
  const week = 7 * 86_400_000;
  const keep = 28 * 86_400_000;
  const soon = (at: number) => at > lastDownload && now - at > keep - week && now - at < keep;
  const photos = d.list(K.PHOTO).filter((p) => soon(p.createdAt)).length;
  const voices = d.list<Answer>(K.ANSWER).filter((a) => a.data.voice && soon(a.createdAt)).length;
  return photos + voices;
}

const downloadedKey = (room: string) => `ok.downloaded.${room}`;

/** Every visit: if photos or voice notes will be deleted within a week, offer the download. */
export function MediaReminder() {
  const d = useRoomData();
  const [snoozed, setSnoozed] = useState(() => {
    try {
      return localStorage.getItem(snoozeKey(d.room.id)) === new Date().toDateString();
    } catch {
      return false;
    }
  });
  const [msg, setMsg] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  let last = 0;
  try {
    last = Number(localStorage.getItem(downloadedKey(d.room.id)) ?? 0);
  } catch {
    last = 0;
  }
  const count = mediaExpiringSoon(d, last);
  const show = count > 0 && !snoozed && !msg;

  useEffect(() => {
    if (show) dialog.current?.querySelector<HTMLElement>('button')?.focus();
  }, [show]);

  if (!show) return msg ? <Done>{msg}</Done> : null;
  const later = () => {
    setSnoozed(true);
    try {
      localStorage.setItem(snoozeKey(d.room.id), new Date().toDateString());
    } catch {
      // fine: it just asks again next time
    }
  };
  return (
    <div class="modal" onKeyDown={(e) => e.key === 'Escape' && later()}>
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="mtitle" ref={dialog}>
        <h2 id="mtitle" class="screen-title">
          {count === 1 ? 'A photo or voice note is' : `${count} photos and voice notes are`} leaving soon 📸
        </h2>
        <p class="small">
          Photos and voice notes are kept for 28 days each. Download them to keep them; your answers and notes stay in the room.
        </p>
        <div class="stack">
          <button type="button" class="btn btn-primary" onClick={() => { void download(d).then(setMsg); }}>
            📥 Download everything
          </button>
          <button type="button" class="btn btn-secondary" onClick={later}>
            Remind me later
          </button>
        </div>
      </div>
    </div>
  );
}
