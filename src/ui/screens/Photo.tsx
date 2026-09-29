import { useEffect, useState } from 'preact/hooks';
import { open, seal } from '../../crypto/envelope';
import { newId } from '../../crypto/ids';
import { K } from '../../data/kinds';
import { useRoomData } from '../../data/RoomData';
import { compressImage } from '../../features/image';
import { MediaError } from '../../net/media';
import { controller } from '../../state/controller';
import type { DataRecord } from '../../state/controller';
import { Back, Problem, Wait } from '../components';
import { PATHS } from '../router';

// Right Now: share a photo whenever, no schedule. Compressed and encrypted on the phone; the
// photo store only ever holds ciphertext. At most 20 photos per room (the server enforces it).

interface PhotoMeta {
  obj: string;
  caption: string;
  w: number;
  h: number;
}

const media = () => controller().media;

const photoCtx = (roomId: string, obj: string) => ({ roomId, recordId: obj, kind: K.PHOTO });

export function Photo() {
  const d = useRoomData();
  const feed = d.list<PhotoMeta>(K.PHOTO).slice().reverse();
  const [pending, setPending] = useState<{ bytes: Uint8Array<ArrayBuffer>; url: string; w: number; h: number; orig: number } | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const enabled = media().enabled();

  async function choose(file: File | undefined) {
    if (!file) return;
    setProblem(null);
    if (file.size > 25 * 1024 * 1024) return setProblem('That photo is over 25 MB. Try a smaller one.');
    setBusy(true);
    try {
      const c = await compressImage(file);
      setPending({ ...c, url: URL.createObjectURL(new Blob([c.bytes], { type: 'image/jpeg' })), orig: file.size });
    } catch {
      setProblem('Could not read that photo. Try a JPEG or PNG. (HEIC photos may not open on some laptops.)');
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!pending) return;
    setBusy(true);
    setProblem(null);
    try {
      const obj = newId();
      const key = d.room.key;
      await media().put(d.room.id, obj, await seal(key, photoCtx(d.room.id, obj), pending.bytes));
      await d.add(K.PHOTO, `photo:${obj}`, { obj, caption: caption.trim().slice(0, 80), w: pending.w, h: pending.h } satisfies PhotoMeta);
      URL.revokeObjectURL(pending.url);
      setPending(null);
      setCaption('');
    } catch (e) {
      setProblem(e instanceof MediaError ? e.message : 'Could not send that photo. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <Back href={PATHS.today} label="← Today" />
      <div class="question-card">
        <span class="pack-tag">📷 Right Now</span>
        <h1 class="question" tabIndex={-1}>
          What are you up to?
        </h1>
        {!enabled ? (
          <Wait>Photos switch on once the private photo store is set up. Everything else in your room works already.</Wait>
        ) : busy && !pending ? (
          <Wait>Shrinking your photo…</Wait>
        ) : pending ? (
          <>
            <img class="photo" src={pending.url} alt="Preview of your photo" />
            <p class="small muted">
              {Math.max(1, Math.round(pending.orig / 1024))} KB → {Math.max(1, Math.round(pending.bytes.length / 1024))} KB. Location and camera details are removed.
            </p>
            <label class="field-label" for="pcap">
              Caption (optional)
            </label>
            <input id="pcap" class="field" maxLength={80} value={caption} autocomplete="off" onInput={(e) => setCaption((e.target as HTMLInputElement).value)} />
            <div class="btn-pair">
              <button type="button" class="btn btn-primary" disabled={busy} onClick={() => void send()}>
                {busy ? 'Sending…' : 'Send 📷'}
              </button>
              <button type="button" class="btn btn-secondary btn-narrow" onClick={() => setPending(null)}>
                Choose another
              </button>
            </div>
          </>
        ) : (
          <>
            <label class="btn btn-primary btn-block file-label">
              📷 Share what you are up to
              <input class="sr-only" type="file" accept="image/*" onChange={(e) => void choose((e.target as HTMLInputElement).files?.[0])} />
            </label>
            <p class="small muted">Whenever you feel like it. No schedule, no streaks. Photos are shrunk and locked on your phone, and location details are removed.</p>
          </>
        )}
        <Problem text={problem} />
        <h2 class="sub-title">Shared so far</h2>
        {feed.length ? (
          <div class="photo-grid">
            {feed.map((p) => (
              <PhotoCard key={p.id} rec={p} />
            ))}
          </div>
        ) : (
          <p class="small muted">Nothing yet. Share the first one 📷</p>
        )}
      </div>
    </section>
  );
}

function PhotoCard({ rec }: { rec: DataRecord<PhotoMeta> }) {
  const d = useRoomData();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const reaction = rec.mine
    ? d.theirs<{ e: string }>(K.PHOTO_REACTION, `react:${rec.data.obj}`)?.data.e
    : d.mine<{ e: string }>(K.PHOTO_REACTION, `react:${rec.data.obj}`)?.data.e;

  useEffect(() => {
    let live = true;
    let made: string | null = null;
    void (async () => {
      try {
        const bytes = await open(d.room.key, photoCtx(d.room.id, rec.data.obj), await media().get(d.room.id, rec.data.obj));
        made = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
        if (live) setUrl(made);
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [rec.data.obj]);

  return (
    <div class="photo-card">
      {url ? (
        <img src={url} alt={`Photo from ${rec.mine ? 'you' : d.partner}${rec.data.caption ? `: ${rec.data.caption}` : ''}`} />
      ) : (
        <div class="photo-placeholder" aria-hidden="true">
          {failed ? '⚠️' : '⏳'}
        </div>
      )}
      <div class="photo-meta">
        <b>{rec.mine ? 'You' : d.partner}</b>
        <small class="block muted">
          {new Date(rec.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          {rec.data.caption ? ` · ${rec.data.caption}` : ''}
        </small>
        {rec.mine ? (
          <>
            {reaction && <small class="block">{d.partner} sent {reaction}</small>}
            <button
              type="button"
              class="btn-small"
              onClick={async () => {
                await media().remove(d.room.id, rec.data.obj).catch(() => {});
                await d.remove(rec.id);
              }}
            >
              Delete
            </button>
          </>
        ) : reaction ? (
          <small class="block">You sent {reaction}</small>
        ) : (
          <div class="cheers">
            {['🤗', '💛', '😂', '🔥'].map((e) => (
              <button key={e} type="button" aria-label={`React ${e}`} onClick={() => void d.put(K.PHOTO_REACTION, `react:${rec.data.obj}`, { e })}>
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
