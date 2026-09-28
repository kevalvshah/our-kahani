import { createContext, type ComponentChildren } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { AnswerStatus } from '../net/api';
import { controller, type DataRecord } from '../state/controller';
import type { Room } from '../state/room';
import { K } from './kinds';

// Room data for the screens: every record this person may read, decrypted on the phone, kept in
// sync by polling (every 10 s while visible, and whenever the tab comes back). Realtime pings can
// replace polling later without changing any screen.

const POLL_MS = 10_000;

export interface Profile {
  name: string;
  country?: string;
  greeting?: string;
}

export interface RoomData {
  room: Room;
  loaded: boolean;
  records: DataRecord[];
  status: AnswerStatus[];
  /** This person's record of a kind and ref. */
  mine<T>(kind: number, ref: string): DataRecord<T> | undefined;
  /** The partner's record of a kind and ref (only once the server lets it through). */
  theirs<T>(kind: number, ref: string): DataRecord<T> | undefined;
  /** All records of a kind, oldest first. */
  list<T>(kind: number, filter?: (r: DataRecord<T>) => boolean): DataRecord<T>[];
  /** Whether the partner has answered (from metadata; their answer may still be hidden). */
  partnerAnswered(kind: number, ref: string): boolean;
  myProfile: Profile | null;
  partnerProfile: Profile | null;
  me: string;
  partner: string;
  /** Creates or updates this person's record of a kind and ref. Returns false if locked. */
  put(kind: number, ref: string, data: unknown): Promise<boolean>;
  /** Adds a new record even if one with the same ref exists (lists: songs, photos, notes). */
  add(kind: number, ref: string, data: unknown): Promise<string>;
  remove(id: string): Promise<void>;
  refresh(): Promise<void>;
}

const Ctx = createContext<RoomData | null>(null);

export function useRoomData(): RoomData {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRoomData outside RoomDataProvider');
  return v;
}

export function useMaybeRoomData(): RoomData | null {
  return useContext(Ctx);
}

export function RoomDataProvider({ room, children }: { room: Room; children: ComponentChildren }) {
  const [records, setRecords] = useState<DataRecord[]>([]);
  const [status, setStatus] = useState<AnswerStatus[]>([]);
  const [loaded, setLoaded] = useState(false);
  const live = useRef(true);
  const inflight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(() => {
    inflight.current ??= (async () => {
      try {
        const [recs, st] = await Promise.all([controller().records(room), controller().answerStatus(room)]);
        if (!live.current) return;
        setRecords(recs);
        setStatus(st);
        setLoaded(true);
      } catch {
        if (live.current) setLoaded(true);
      } finally {
        inflight.current = null;
      }
    })();
    return inflight.current;
  }, [room.id]);

  useEffect(() => {
    live.current = true;
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      live.current = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const value = useMemo<RoomData>(() => {
    const find = <T,>(kind: number, ref: string, mine: boolean) =>
      records.find((r) => r.kind === kind && r.ref === ref && r.mine === mine) as DataRecord<T> | undefined;
    const myProfile = (find<Profile>(K.PROFILE, 'profile', true)?.data as Profile | undefined) ?? null;
    const partnerProfile = (find<Profile>(K.PROFILE, 'profile', false)?.data as Profile | undefined) ?? null;

    return {
      room,
      loaded,
      records,
      status,
      mine: (kind, ref) => find(kind, ref, true),
      theirs: (kind, ref) => find(kind, ref, false),
      list: <T,>(kind: number, filter?: (r: DataRecord<T>) => boolean) =>
        (records.filter((r) => r.kind === kind) as DataRecord<T>[]).filter((r) => (filter ? filter(r) : true)),
      partnerAnswered: (kind, ref) => status.some((s) => s.kind === kind && s.ref === ref && !s.mine),
      myProfile,
      partnerProfile,
      me: myProfile?.name || 'You',
      partner: partnerProfile?.name || 'Your person',
      async put(kind, ref, data) {
        const existing = find(kind, ref, true);
        const { id, ok } = await controller().put(room, kind, ref, data, existing?.id);
        if (ok) {
          // Show it straight away; the next refresh confirms it.
          setRecords((rs) => {
            const rest = rs.filter((r) => r.id !== id);
            return [...rest, { id, kind, ref, mine: true, data, createdAt: existing?.createdAt ?? Date.now() }];
          });
        }
        void refresh();
        return ok;
      },
      async add(kind, ref, data) {
        const { id } = await controller().put(room, kind, ref, data);
        setRecords((rs) => [...rs, { id, kind, ref, mine: true, data, createdAt: Date.now() }]);
        void refresh();
        return id;
      },
      async remove(id) {
        await controller().remove(id);
        setRecords((rs) => rs.filter((r) => r.id !== id));
        void refresh();
      },
      refresh,
    };
  }, [room, records, status, loaded, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
