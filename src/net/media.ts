import type { Bytes } from '../crypto/bytes';
import type { SessionManager } from './session';

// Encrypted photos live in Cloudflare R2 behind a Pages Function on the app's own origin
// (functions/media). It checks the person's sign-in and room membership with Supabase, then
// stores or returns the bytes. It only ever sees ciphertext: files are encrypted on the phone
// with the room key before upload, and decrypted on the phone after download.

export const MEDIA_URL: string = import.meta.env.VITE_MEDIA_URL ?? (import.meta.env.PROD ? '/media' : '');
export const MAX_MEDIA_BYTES = 1_000_000;

export class MediaError extends Error {
  override name = 'MediaError';
}

function mediaProblem(status: number): string {
  if (status === 413) return 'That file is too big.';
  if (status === 409) return 'This room has reached its photo limit.';
  if (status === 503 || status === 404) return 'Photos are not switched on yet.';
  return 'Could not reach the photo store.';
}

export function createMedia(session: SessionManager, base = MEDIA_URL) {
  async function call(method: string, roomId: string, objectId: string, body?: Bytes): Promise<Response> {
    if (!base) throw new MediaError('Photos and voice notes are not switched on yet.');
    const res = await fetch(`${base}/o/${encodeURIComponent(roomId)}/${encodeURIComponent(objectId)}`, {
      method,
      headers: { Authorization: `Bearer ${await session.accessToken()}`, 'Content-Type': 'application/octet-stream' },
      body,
    });
    if (!res.ok) throw new MediaError(mediaProblem(res.status));
    return res;
  }
  return {
    enabled: () => !!base,
    async put(roomId: string, objectId: string, bytes: Bytes): Promise<void> {
      if (bytes.length > MAX_MEDIA_BYTES) throw new MediaError('That file is too big.');
      await call('PUT', roomId, objectId, bytes);
    },
    async get(roomId: string, objectId: string): Promise<Bytes> {
      return new Uint8Array(await (await call('GET', roomId, objectId)).arrayBuffer());
    },
    async remove(roomId: string, objectId: string): Promise<void> {
      await call('DELETE', roomId, objectId);
    },
    /** Asks the store to delete the files of erased rooms now, instead of waiting for the daily run. */
    purge(): void {
      if (base) void fetch(`${base}/purge`, { method: 'POST' }).catch(() => undefined);
    },
  };
}

export type Media = ReturnType<typeof createMedia>;
