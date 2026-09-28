import type { Bytes } from '../crypto/bytes';
import type { SessionManager } from './session';

// Encrypted photos and voice notes live in Cloudflare R2 behind a small Worker
// (workers/media). The Worker checks the person's sign-in and room membership with Supabase,
// then stores or returns the bytes. It only ever sees ciphertext: files are encrypted on the
// phone with the room key before upload, and decrypted on the phone after download.

export const MEDIA_URL: string = import.meta.env.VITE_MEDIA_WORKER_URL || '';
export const MAX_MEDIA_BYTES = 1_000_000;

export class MediaError extends Error {
  override name = 'MediaError';
}

export function createMedia(session: SessionManager, base = MEDIA_URL) {
  async function call(method: string, roomId: string, objectId: string, body?: Bytes): Promise<Response> {
    if (!base) throw new MediaError('Photos and voice notes are not switched on yet.');
    const res = await fetch(`${base}/o/${encodeURIComponent(roomId)}/${encodeURIComponent(objectId)}`, {
      method,
      headers: { Authorization: `Bearer ${await session.accessToken()}`, 'Content-Type': 'application/octet-stream' },
      body,
    });
    if (!res.ok) throw new MediaError(res.status === 413 ? 'That file is too big.' : 'Could not reach the photo store.');
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
  };
}

export type Media = ReturnType<typeof createMedia>;
