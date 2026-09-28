import { newId } from '../crypto/ids';
import { buildInviteUrl } from '../crypto/invite';
import { joinToken, joinVerifier } from '../crypto/joinToken';
import { createKeystore, requestPersistence, type Keystore, type StoredRoom } from '../crypto/keystore';
import { generateRoomKeyBytes, importRoomKey } from '../crypto/roomKey';
import { safetyCode } from '../crypto/safetyCode';
import type { Bytes } from '../crypto/bytes';
import { isPrivateKind } from '../data/kinds';
import { openJson, sealJson } from '../data/payload';
import { createApi, type AnswerStatus, type Api, type RoomRow } from '../net/api';
import { createMedia, type Media } from '../net/media';
import { createPush, type Push } from '../net/push';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../net/config';
import { createSessionManager, type SessionManager } from '../net/session';
import type { Room } from './room';

// Orchestrates rooms: the only place that combines keys, the server and local storage.
// Every value sent to the server is an id, a flag, a one-way token or ciphertext.

export type LoadResult =
  | { state: 'none' }
  | { state: 'ready'; room: Room; offline?: boolean }
  /** The key is on this device but its sign-in was cleared: the recovery words bring it back. */
  | { state: 'lost-access'; roomId: string };

/** A decrypted record, as the app uses it. */
export interface DataRecord<T = unknown> {
  id: string;
  kind: number;
  ref: string;
  mine: boolean;
  data: T;
  createdAt: number;
}

interface Deps {
  api: Api;
  session: SessionManager;
  keystore: Keystore;
  media: Media;
  push: Push;
  origin: string;
}

function safeLocalStorage(): Storage | undefined {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
}

function defaultDeps(): Deps {
  const session = createSessionManager({ url: SUPABASE_URL, apiKey: SUPABASE_PUBLISHABLE_KEY, storage: safeLocalStorage() });
  return {
    session,
    api: createApi({ url: SUPABASE_URL, apiKey: SUPABASE_PUBLISHABLE_KEY, session }),
    keystore: createKeystore(),
    media: createMedia(session),
    push: createPush({ url: SUPABASE_URL, apiKey: SUPABASE_PUBLISHABLE_KEY, session }),
    origin: location.origin,
  };
}

export function createController(deps: Deps = defaultDeps()) {
  const { api, session, keystore } = deps;

  async function toRoom(stored: StoredRoom, server: RoomRow | null): Promise<Room> {
    const partnerJoined = (server?.members.length ?? 1) >= 2;
    if (partnerJoined && stored.inviteKey) await keystore.forgetInvite(stored.id);
    return {
      id: stored.id,
      role: stored.role,
      key: stored.key,
      notesKey: stored.notesKey,
      safetyCode: stored.safetyCode,
      invite: stored.inviteKey && !partnerJoined ? buildInviteUrl(deps.origin, stored.id, stored.inviteKey) : undefined,
      partnerJoined,
      backedUp: stored.backedUp,
      startedAt: server ? Date.parse(server.created_at) : stored.savedAt,
      endsAt: server ? Date.parse(server.ends_at) : stored.savedAt + 28 * 86_400_000,
    };
  }

  async function store(opts: {
    id: string;
    role: Room['role'];
    raw: Bytes;
    notesRaw: Bytes;
    inviteKey?: Bytes;
    backedUp: boolean;
  }): Promise<StoredRoom> {
    const stored: StoredRoom = {
      id: opts.id,
      role: opts.role,
      key: await importRoomKey(opts.raw),
      notesKey: await importRoomKey(opts.notesRaw),
      safetyCode: await safetyCode(opts.raw),
      inviteKey: opts.inviteKey,
      setupRaw: opts.backedUp ? undefined : { roomKey: opts.raw, notesKey: opts.notesRaw },
      backedUp: opts.backedUp,
      savedAt: Date.now(),
    };
    await keystore.save(stored);
    void requestPersistence();
    return stored;
  }

  return {
    userId: () => session.userId(),
    /** Encrypted photo store, sharing this app's one sign-in. */
    media: deps.media,
    /** Optional notifications (the switch on the Room data screen). */
    push: deps.push,

    async load(): Promise<LoadResult> {
      const stored = await keystore.current().catch(() => null);
      if (!stored) return { state: 'none' };
      // Never silently start a new account here: that would make the room look erased.
      if (!session.userId()) return { state: 'lost-access', roomId: stored.id };
      try {
        const server = await api.getRoom(stored.id);
        if (!server) {
          // Erased by the partner, or ended.
          await keystore.remove(stored.id);
          return { state: 'none' };
        }
        return { state: 'ready', room: await toRoom(stored, server) };
      } catch {
        return { state: 'ready', room: await toRoom(stored, null), offline: true };
      }
    },

    async create(): Promise<Room> {
      const raw = generateRoomKeyBytes();
      const id = await api.createRoom(await joinVerifier(await joinToken(raw)));
      const stored = await store({ id, role: 'creator', raw, notesRaw: generateRoomKeyBytes(), inviteKey: raw, backedUp: false });
      return toRoom(stored, await api.getRoom(id));
    },

    async join(roomId: string, raw: Bytes): Promise<Room> {
      const role = await api.joinRoom(roomId, await joinToken(raw));
      const stored = await store({ id: roomId, role, raw, notesRaw: generateRoomKeyBytes(), backedUp: false });
      return toRoom(stored, await api.getRoom(roomId));
    },

    async refresh(room: Room): Promise<Room | null> {
      const result = await this.load();
      return result.state === 'ready' && result.room.id === room.id ? result.room : null;
    },

    async erase(room: Room): Promise<void> {
      await api.eraseRoom(room.id);
      deps.media.purge();
      await keystore.remove(room.id);
      session.signOut();
    },

    /** Forget this room on this device only (e.g. it was erased elsewhere). */
    async forget(roomId: string): Promise<void> {
      await keystore.remove(roomId);
    },

    // ---- Recovery words ----------------------------------------------------

    newPhrase: async () => (await import('../crypto/recovery')).newPhrase(),

    /** Saves the backup wrapped under the words; the raw key bytes are then dropped. */
    async saveBackup(room: Room, entropy: Bytes): Promise<Room> {
      const stored = await keystore.current();
      if (!stored || stored.id !== room.id || !stored.setupRaw) throw new Error('Nothing to back up');
      const { sealBackup, lookupToken } = await import('../crypto/recovery');
      const envelope = await sealBackup(entropy, room.id, stored.setupRaw);
      await api.saveBackup(room.id, await lookupToken(entropy), envelope);
      await keystore.markBackedUp(room.id);
      return { ...room, backedUp: true };
    },

    /** Brings a room back from the 12 words on a new or cleared browser. */
    async recover(words: string): Promise<Room> {
      const { wordsToEntropy, lookupToken, openBackup } = await import('../crypto/recovery');
      const entropy = await wordsToEntropy(words);
      session.signOut(); // a fresh anonymous account takes over the old one's place
      const { roomId, role, envelope } = await api.recoverRoom(await lookupToken(entropy));
      const backup = await openBackup(entropy, roomId, envelope);
      const stored = await store({ id: roomId, role, raw: backup.roomKey, notesRaw: backup.notesKey, backedUp: true });
      return toRoom(stored, await api.getRoom(roomId));
    },

    // ---- Records -----------------------------------------------------------

    /** Every record this person may read, decrypted on the phone. */
    async records(room: Room): Promise<DataRecord[]> {
      const me = session.userId();
      const rows = await api.allRecords(room.id);
      const out: DataRecord[] = [];
      for (const row of rows) {
        const key = isPrivateKind(row.kind) ? room.notesKey : room.key;
        try {
          const data = await openJson(key, { roomId: room.id, recordId: row.id, kind: row.kind }, row.envelope);
          out.push({ id: row.id, kind: row.kind, ref: row.ref, mine: row.author_id === me, data, createdAt: Date.parse(row.created_at) });
        } catch {
          // Unreadable (e.g. written with a key this device does not have): skip it.
        }
      }
      return out;
    },

    answerStatus(room: Room): Promise<AnswerStatus[]> {
      return api.answers(room.id);
    },

    /** Encrypts and saves one record. Pass the id of this person's existing record to update it. */
    async put(room: Room, kind: number, ref: string, data: unknown, existingId?: string): Promise<{ id: string; ok: boolean }> {
      const key = isPrivateKind(kind) ? room.notesKey : room.key;
      if (existingId) {
        const envelope = await sealJson(key, { roomId: room.id, recordId: existingId, kind }, data);
        return { id: existingId, ok: await api.updateRecord(existingId, envelope) };
      }
      const id = newId();
      const envelope = await sealJson(key, { roomId: room.id, recordId: id, kind }, data);
      await api.insertRecord({ id, roomId: room.id, kind, ref, envelope });
      // A content-free nudge for the partner (if they switched notifications on). Never for
      // private notes: saving stays silent.
      if (!isPrivateKind(kind) && room.partnerJoined) deps.push.notify(room.id);
      return { id, ok: true };
    },

    remove(id: string): Promise<void> {
      return api.deleteRecord(id);
    },

    voteKeep: (room: Room, keep: boolean) => api.voteKeep(room.id, keep),
    myKeepVote: (room: Room) => api.myKeepVote(room.id),
  };
}

export type Controller = ReturnType<typeof createController>;

let instance: Controller | null = null;
/** The app-wide controller, created on first use. */
export function controller(): Controller {
  return (instance ??= createController());
}
