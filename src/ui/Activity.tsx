import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { RoomData } from '../data/RoomData';
import { badges, newlyWaiting, newSince, waitingCounts, waitingRefs, type Area, type Item } from '../features/activity';
import { PATHS } from './router';

// Toasts for what the partner did (when the app opens, and live while it is open) and the
// counters on each tab, pack and game. "Seen" times live on this device only.

interface Seen {
  at: number;
  waiting: string[];
  areas: Partial<Record<Area, number>>;
}

const key = (room: string) => `ok.seen.${room}`;

function load(room: string): Seen | null {
  try {
    const raw = localStorage.getItem(key(room));
    return raw ? (JSON.parse(raw) as Seen) : null;
  } catch {
    return null;
  }
}

function save(room: string, seen: Seen) {
  try {
    localStorage.setItem(key(room), JSON.stringify(seen));
  } catch {
    // Storage blocked: counters reset next visit.
  }
}

export const AREA_PATH: Record<Area, string> = {
  today: PATHS.today,
  packs: PATHS.packs,
  micro: PATHS.micro,
  antakshari: PATHS.antakshari,
  story: PATHS.story,
  photo: PATHS.photo,
  movie: PATHS.movie,
  gentle: PATHS.gentle,
};

export interface Toast extends Item {
  id: number;
}

export function useActivity(d: RoomData, route: string) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seen = useRef<Seen | null>(null);
  const [areasSeen, setAreasSeen] = useState<Partial<Record<Area, number>>>({});
  const nextId = useRef(1);
  const waiting = useMemo(() => waitingRefs(d.status), [d.status]);

  // New since last look → toasts; then move "last look" to now.
  useEffect(() => {
    if (!d.loaded) return;
    const now = Date.now();
    const prev = seen.current ?? load(d.room.id);
    if (!prev) {
      // First visit on this device: start counting from now, without a flood of toasts.
      seen.current = { at: now, waiting, areas: {} };
      save(d.room.id, seen.current);
      return;
    }
    if (!seen.current) setAreasSeen(prev.areas ?? {});
    const items = [...newSince(d.records, prev.at, d.partner), ...newlyWaiting(waiting, prev.waiting, d.partner)];
    if (items.length) {
      setToasts((t) => [...t, ...items.map((i) => ({ ...i, id: nextId.current++ }))].slice(-4));
    }
    seen.current = { ...prev, at: now, waiting, areas: seen.current?.areas ?? prev.areas ?? {} };
    save(d.room.id, seen.current);
  }, [d.loaded, d.records, waiting, d.room.id]);

  // Opening an area clears its "new" counter.
  useEffect(() => {
    const area = (Object.keys(AREA_PATH) as Area[]).find((a) => a === route);
    if (!area || !seen.current) return;
    const areas = { ...seen.current.areas, [area]: Date.now() };
    seen.current = { ...seen.current, areas };
    save(d.room.id, seen.current);
    setAreasSeen(areas);
  }, [route, d.records]);

  const counts = useMemo(
    () => badges(d.records, areasSeen, waitingCounts(waiting).areas, d.partner),
    [d.records, areasSeen, waiting, d.partner],
  );

  return {
    toasts,
    dismiss: (id: number) => setToasts((t) => t.filter((x) => x.id !== id)),
    badges: counts,
    packWaiting: waitingCounts(waiting).packs,
  };
}

export function Toasts({ items, onDismiss, onOpen }: { items: Toast[]; onDismiss: (id: number) => void; onOpen: (area: Area) => void }) {
  useEffect(() => {
    if (!items.length) return;
    const t = setTimeout(() => onDismiss(items[0]!.id), 9_000);
    return () => clearTimeout(t);
  }, [items]);
  if (!items.length) return null;
  return (
    <div class="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} class="toast">
          <button type="button" class="toast-text" onClick={() => { onDismiss(t.id); onOpen(t.area); }}>
            {t.text}
          </button>
          <button type="button" class="toast-x" aria-label="Dismiss" onClick={() => onDismiss(t.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

/** A small counter bubble; nothing when zero. */
export function Badge({ n, label }: { n?: number; label?: string }) {
  if (!n) return null;
  return (
    <span class="badge" aria-label={`${n} new${label ? ` in ${label}` : ''}`}>
      {n > 9 ? '9+' : n}
    </span>
  );
}
