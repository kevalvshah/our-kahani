import { newId } from '../crypto/ids';
import { buildInviteUrl } from '../crypto/invite';
import { joinToken, joinVerifier } from '../crypto/joinToken';
import { createKeystore, requestPersistence, type Keystore } from '../crypto/keystore';
import { generateRoomKeyBytes, importRoomKey } from '../crypto/roomKey';
import { safetyCode } from '../crypto/safetyCode';
import type { Bytes } from '../crypto/bytes';
import { KIND_CHOICE, openChoice, sealChoice } from '../features/answers';
import { createApi, type Api } from '../net/api';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../net/config';
import { createSessionManager, type SessionManager } from '../net/session';
import type { Room } from './room';

// Orchestrates rooms: the only place that combines keys, the server and local storage.
// Every value sent to the server is an id, a flag, a one-way token or ciphertext.

export type LoadResult =
  | { state: 'none' }
  | { state: 'ready'; room: Room; offline?: boolean }
  /** The key is on this device but its sign-in was cleared: the recovery phrase brings it back. */
  | { state: 'lost-access'; roomId: string };

export interface CardStatus {
  /** This person's sealed choice, if any. */
  mine: string | null;
  partnerAnswered: boolean;
  /** Only available once both have answered (the server withholds it before). */
  partner: string | null;
}

interface Deps {
  api: Api;
  session: SessionManager;
  keystore: Keystore;
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
    origin: location.origin,
  };
}

export function createController(deps: Deps = defaultDeps()) {
  const { api, session, keystore } = deps;

  async function toRoom(
    stored: { id: string; role: Room['role']; key: CryptoKey; safetyCode: string[]; inviteKey?: Bytes },
    server: { created_at: string; ends_at: string; members: { role: string }[] } | null,
  ): Promise<Room> {
    const partnerJoined = (server?.members.length ?? 1) >= 2;
    if (partnerJoined && stored.inviteKey) await keystore.forgetInvite(stored.id);
    return {
      id: stored.id,
      role: stored.role,
      key: stored.key,
      safetyCode: stored.safetyCode,
      invite:
        stored.inviteKey && !partnerJoined ? buildInviteUrl(deps.origin, stored.id, stored.inviteKey) : undefined,
      partnerJoined,
      startedAt: server ? Date.parse(server.created_at) : Date.now(),
      endsAt: server ? Date.parse(server.ends_at) : Date.now() + 28 * 86_400_000,
    };
  }

  return {
    async load(): Promise<LoadResult> {
      const stored = await keystore.current().catch(() => null);
      if (!stored) return { state: 'none' };
      // Never silently start a new account here: that would make the room look erased.
      if (!session.userId()) return { state: 'lost-access', roomId: stored.id };
      try {
        const server = await api.getRoom(stored.id);
        if (!server) {
          // Erased by the partner, expired, or this browser lost its sign-in.
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
      const verifier = await joinVerifier(await joinToken(raw));
      const id = await api.createRoom(verifier);
      const key = await importRoomKey(raw);
      const code = await safetyCode(raw);
      await keystore.save({ id, role: 'creator', key, safetyCode: code, inviteKey: raw, savedAt: Date.now() });
      void requestPersistence();
      return toRoom({ id, role: 'creator', key, safetyCode: code, inviteKey: raw }, await api.getRoom(id));
    },

    async join(roomId: string, raw: Bytes): Promise<Room> {
      const role = await api.joinRoom(roomId, await joinToken(raw));
      const key = await importRoomKey(raw);
      const code = await safetyCode(raw);
      await keystore.save({ id: roomId, role, key, safetyCode: code, savedAt: Date.now() });
      void requestPersistence();
      return toRoom({ id: roomId, role, key, safetyCode: code }, await api.getRoom(roomId));
    },

    async refresh(room: Room): Promise<Room | null> {
      const result = await this.load();
      return result.state === 'ready' && result.room.id === room.id ? result.room : null;
    },

    async erase(room: Room): Promise<void> {
      await api.eraseRoom(room.id);
      await keystore.remove(room.id);
      session.signOut();
    },

    async cardStatus(room: Room, ref: string): Promise<CardStatus> {
      const me = session.userId();
      const [status, rows] = await Promise.all([api.answers(room.id), api.records(room.id, KIND_CHOICE, ref)]);
      const partnerAnswered = status.some((s) => s.kind === KIND_CHOICE && s.ref === ref && !s.mine);
      const decrypt = async (authorIsMe: boolean) => {
        const row = rows.find((r) => (r.author_id === me) === authorIsMe);
        return row ? openChoice(room.key, { roomId: room.id, recordId: row.id }, row.envelope) : null;
      };
      return { mine: await decrypt(true), partnerAnswered, partner: await decrypt(false) };
    },

    /** Seals and sends an answer. Returns false if it is locked (both have answered). */
    async answer(room: Room, ref: string, choice: string): Promise<boolean> {
      const me = session.userId();
      const rows = await api.records(room.id, KIND_CHOICE, ref);
      const mine = rows.find((r) => r.author_id === me);
      if (mine) {
        return api.updateRecord(mine.id, await sealChoice(room.key, { roomId: room.id, recordId: mine.id }, choice));
      }
      const id = newId();
      await api.insertRecord({
        id,
        roomId: room.id,
        kind: KIND_CHOICE,
        ref,
        envelope: await sealChoice(room.key, { roomId: room.id, recordId: id }, choice),
      });
      return true;
    },
  };
}

export type Controller = ReturnType<typeof createController>;

let instance: Controller | null = null;
/** The app-wide controller, created on first use. */
export function controller(): Controller {
  return (instance ??= createController());
}
