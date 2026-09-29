// Room keys on this device, in IndexedDB. Keys used for encryption are stored as
// non-extractable CryptoKeys: page scripts can use them but can never read their bytes.
//
// Raw key bytes are kept only while needed:
//   - `inviteKey`: the creator's copy for re-showing the invite link, dropped once the partner
//     has joined;
//   - `setupRaw`: the room and notes keys, until the recovery backup is saved, then dropped.
//
// Safari may delete this storage after 7 days without a visit (Home Screen apps are exempt);
// the recovery phrase is the way back, and `requestPersistence` asks the browser to keep it.

import type { Bytes } from './bytes';

export interface StoredRoom {
  id: string;
  role: 'creator' | 'invitee';
  key: CryptoKey;
  /** This person's own key for private saved notes. The partner never has it. */
  notesKey: CryptoKey;
  /** Six emoji derived from the room key, kept so they can be shown again. */
  safetyCode: string[];
  inviteKey?: Bytes;
  setupRaw?: { roomKey: Bytes; notesKey: Bytes };
  /** True once the recovery backup is saved on the server. */
  backedUp: boolean;
  savedAt: number;
}

const DB_NAME = 'our-kahani';
const DB_VERSION = 2;
const ROOMS = 'rooms';
const META = 'meta';
const CURRENT = 'current-room';

function open(idb: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = idb.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Version 1 stored rooms without a notes key; they cannot be upgraded, so start clean.
      if (db.objectStoreNames.contains(ROOMS)) db.deleteObjectStore(ROOMS);
      if (db.objectStoreNames.contains(META)) db.deleteObjectStore(META);
      db.createObjectStore(ROOMS, { keyPath: 'id' });
      db.createObjectStore(META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(db: IDBDatabase, stores: string[], mode: IDBTransactionMode, fn: (tx: IDBTransaction) => IDBRequest<T> | void) {
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    const req = fn(tx);
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function createKeystore(idb: IDBFactory = indexedDB) {
  let dbPromise: Promise<IDBDatabase> | null = null;
  const db = () => (dbPromise ??= open(idb));

  async function get(id: string): Promise<StoredRoom | null> {
    const d = await db();
    return (await run<StoredRoom>(d, [ROOMS], 'readonly', (tx) => tx.objectStore(ROOMS).get(id))) ?? null;
  }

  async function put(room: StoredRoom): Promise<void> {
    const d = await db();
    await run(d, [ROOMS], 'readwrite', (tx) => {
      tx.objectStore(ROOMS).put(room);
    });
  }

  return {
    async save(room: StoredRoom): Promise<void> {
      const d = await db();
      await run(d, [ROOMS, META], 'readwrite', (tx) => {
        tx.objectStore(ROOMS).put(room);
        tx.objectStore(META).put(room.id, CURRENT);
      });
    },

    async current(): Promise<StoredRoom | null> {
      const d = await db();
      const id = await run<string>(d, [META], 'readonly', (tx) => tx.objectStore(META).get(CURRENT));
      return id ? get(id) : null;
    },

    async forgetInvite(id: string): Promise<void> {
      const room = await get(id);
      if (!room?.inviteKey) return;
      const { inviteKey: _dropped, ...rest } = room;
      await put(rest);
    },

    /** Called once the recovery backup is saved: the raw key bytes are no longer needed. */
    async markBackedUp(id: string): Promise<void> {
      const room = await get(id);
      if (!room) return;
      const { setupRaw: _dropped, ...rest } = room;
      await put({ ...rest, backedUp: true });
    },

    async remove(id: string): Promise<void> {
      const d = await db();
      await run(d, [ROOMS, META], 'readwrite', (tx) => {
        tx.objectStore(ROOMS).delete(id);
        tx.objectStore(META).delete(CURRENT);
      });
    },
  };
}

export type Keystore = ReturnType<typeof createKeystore>;

/** Asks the browser not to evict this site's storage. Best effort; returns what was granted. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (await navigator.storage?.persisted?.()) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
