import { useEffect, useRef, useState } from 'preact/hooks';
import { open, seal } from '../crypto/envelope';
import { newId } from '../crypto/ids';
import { K } from '../data/kinds';
import { useRoomData } from '../data/RoomData';
import type { VoiceNote } from '../features/cardLogic';
import { MediaError } from '../net/media';
import { VOICE_SECONDS } from '../platform/voice';
import { controller } from '../state/controller';
import { Problem } from './components';
import { canRecordVoice, startVoice, type Recording } from './voiceRecorder';

// Voice notes for "Remember when" cards: recorded, encrypted with the room key and uploaded as
// ciphertext; played back only after decrypting on the other phone.

const voiceCtx = (roomId: string, obj: string) => ({ roomId, recordId: obj, kind: K.VOICE });

export function VoiceRecord({ onSent }: { onSent: (v: VoiceNote) => void }) {
  const d = useRoomData();
  const [rec, setRec] = useState<Recording | null>(null);
  const [started, setStarted] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const live = useRef(true);

  useEffect(() => () => {
    live.current = false;
    rec?.cancel();
  }, [rec]);
  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [rec]);

  if (!canRecordVoice()) return null;

  async function begin() {
    setProblem(null);
    try {
      const r = await startVoice();
      setStarted(Date.now());
      setNow(Date.now());
      setRec(r);
      const audio = await r.done;
      if (!live.current) return;
      setRec(null);
      if (!audio) return;
      setBusy(true);
      const obj = newId();
      await controller().media.put(d.room.id, obj, await seal(d.room.key, voiceCtx(d.room.id, obj), audio.bytes));
      onSent({ obj, secs: audio.secs, type: audio.type });
    } catch (e) {
      setRec(null);
      setProblem(
        e instanceof MediaError
          ? e.message
          : e instanceof DOMException && e.name === 'NotAllowedError'
            ? 'The microphone is blocked for this site. Allow it in your browser settings, or type a line instead.'
            : 'Could not record. Type a line instead.',
      );
    } finally {
      if (live.current) setBusy(false);
    }
  }

  const secs = Math.min(VOICE_SECONDS, Math.floor((now - started) / 1000));
  return (
    <>
      {rec ? (
        <>
          <p class="timer" role="timer" aria-label={`Recording, ${secs} of ${VOICE_SECONDS} seconds`}>
            🎙️ {secs}s
          </p>
          <div class="bar" aria-hidden="true">
            <i style={{ width: `${(secs / VOICE_SECONDS) * 100}%` }} />
          </div>
          <div class="btn-pair">
            <button type="button" class="btn btn-primary" onClick={() => rec.stop()}>
              Stop and send
            </button>
            <button type="button" class="btn btn-secondary btn-narrow" onClick={() => rec.cancel()}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <button type="button" class="btn btn-secondary btn-block seal" disabled={busy} onClick={() => void begin()}>
          {busy ? 'Locking and sending…' : `🎙️ Record a voice note instead (${VOICE_SECONDS} s)`}
        </button>
      )}
      <Problem text={problem} />
    </>
  );
}

export function VoicePlayer({ note, who }: { note: VoiceNote; who: string }) {
  const d = useRoomData();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    void (async () => {
      try {
        const bytes = await open(d.room.key, voiceCtx(d.room.id, note.obj), await controller().media.get(d.room.id, note.obj));
        made = URL.createObjectURL(new Blob([bytes], { type: note.type }));
        if (alive) setUrl(made);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [note.obj]);

  if (failed) return <span class="small muted">🎙️ Voice note ({note.secs} s) has gone: voice notes are kept for 28 days.</span>;
  if (!url) return <span class="small muted">🎙️ Opening the voice note…</span>;
  return <audio class="voice" controls preload="metadata" src={url} aria-label={`Voice note from ${who}, ${note.secs} seconds`} />;
}
