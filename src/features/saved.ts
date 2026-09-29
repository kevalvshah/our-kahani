// Saved notes: private to each person, encrypted with their own notes key (the partner never
// has it), and never announced. Pure helpers here; the screen is ui/screens/Saved.tsx.

export interface SavedItem {
  kind: 'card' | 'note' | 'gentle' | 'photo';
  src: string;
  q: string;
  theirs: string;
  mine: string;
  label: string;
  note: string;
  /** yyyy-mm-dd, optional (birthdays, plans). */
  date: string;
  t: number;
  /** The partner's voice note, if the saved answer or heads-up had one (kept 28 days). */
  voice?: import('./cardLogic').VoiceNote;
}

export function daysUntil(date: string, now = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const t = new Date(`${date}T00:00:00`);
  const n = new Date(now);
  n.setHours(0, 0, 0, 0);
  const d = Math.round((t.getTime() - n.getTime()) / 86_400_000);
  return Number.isNaN(d) ? null : d;
}

export function untilText(date: string, now = new Date()): string {
  const d = daysUntil(date, now);
  if (d === null) return '';
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  return d > 1 ? `in ${d} days` : '';
}

/** The nearest saved date in the next two weeks, for the reminder on Today. */
export function upcomingSaved(items: SavedItem[], now = new Date()): SavedItem | undefined {
  return items
    .filter((x) => {
      const d = daysUntil(x.date, now);
      return d !== null && d >= 0 && d <= 14;
    })
    .sort((a, b) => daysUntil(a.date, now)! - daysUntil(b.date, now)!)[0];
}

export function matchesSearch(x: SavedItem, q: string, labelName: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [x.q, x.theirs, x.mine, x.note, x.src, labelName].join(' ').toLowerCase().includes(needle);
}
