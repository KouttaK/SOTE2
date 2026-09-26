/**
 * src/shared/utils/localDate.ts
 *
 * `date.toISOString().split('T')[0]` is a common trap: `toISOString()`
 * always converts to **UTC** first, so anyone west of Greenwich (e.g.
 * Brazil, UTC-3) gets tomorrow's date for several hours every evening
 * (from local midnight-minus-offset onward — 21:00 local for UTC-3).
 * Everything that means "today" for a human — the "Data específica"
 * condition rule, the daily usage chart, the streak counter — needs the
 * viewer's own calendar day, not UTC's. This is that instead.
 */

/** `date`'s calendar day in the *local* timezone, as "YYYY-MM-DD". */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
