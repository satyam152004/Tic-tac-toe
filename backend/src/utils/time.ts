/** Period keys for the daily/weekly/monthly leaderboards (all UTC). */
export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

/** ISO-8601 week key, e.g. 2026-W47 */
export function weekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export const DAY_MS = 24 * 60 * 60 * 1000;
export const addMs = (d: Date, ms: number): Date => new Date(d.getTime() + ms);
export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
