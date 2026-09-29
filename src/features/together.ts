// Small pieces of logic for Dil ki Baat and the weekly rituals. No network, no storage.

export const PAUSE_MS = 20 * 60_000;

/** ISO year-week, e.g. "2026-W40": the Shukriya jar and huddle open once per week. */
export function weekKey(ms: number): string {
  const d = new Date(ms);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3));
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((thursday.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Minutes left on a "need 20 minutes" pause, or 0 once it is over. */
export function pauseLeft(until: number | undefined, now = Date.now()): number {
  if (!until || until <= now) return 0;
  return Math.ceil((until - now) / 60_000);
}

/** "Hard or harmful": nothing here decides for anyone; it only shows the right help. */
export const SAFETY_NOTE =
  'Every couple has hard seasons. But if you are afraid of your partner, controlled, cut off, or hurt, that is not a hard season, and leaving is not failing.';
