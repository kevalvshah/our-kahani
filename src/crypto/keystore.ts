// Room keys on this device, in IndexedDB. The key used for encryption is stored as a
// non-extractable CryptoKey: page scripts can use it but can never read its bytes.
//
// The creator also keeps the raw key bytes, only so the invite link can be shown again, and
// only until the partner has joined or the invite expires (then `forgetInvite` drops them).
//
// Safari may delete this storage after 7 days without a visit (Home Screen apps are exempt);
// the recovery phrase is the way back, and `requestPersistence` asks the browser to keep it.

import type { Bytes } from './bytes';

export interface StoredRoom {
  id: string;
  role: 'creator' | 'invitee';
  key: CryptoKey;
  /** Six emoji derived from the key, kept so they can be shown again without the raw key. */
  safetyCode: string[];
  /** Raw key bytes for re-showing the invite; creator only, dropped once the partner joins. */
  inviteKey?: Bytes;
  savedAt: number;
}

const DB_NAME = 'our-kahani';
const DB_VERSION = 1;
const ROOMS = 'rooms';
const META = 'meta';
const CURRENT = 'current-room';

function open(idb: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = idb.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ROOMS)) db.createObjectStore(ROOMS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
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
      if (!id) return null;
      return (await run<StoredRoom>(d, [ROOMS], 'readonly', (tx) => tx.objectStore(ROOMS).get(id))) ?? null;
    },

    /** The id of the room this device was last in, even if its key is gone. */
    async currentId(): Promise<string | null> {
      const d = await db();
      return (await run<string>(d, [META], 'readonly', (tx) => tx.objectStore(META).get(CURRENT))) ?? null;
    },

    async forgetInvite(id: string): Promise<void> {
      const d = await db();
      const room = await run<StoredRoom>(d, [ROOMS], 'readonly', (tx) => tx.objectStore(ROOMS).get(id));
      if (!room?.inviteKey) return;
      const { inviteKey: _dropped, ...rest } = room;
      await run(d, [ROOMS], 'readwrite', (tx) => {
        tx.objectStore(ROOMS).put(rest);
      });
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
