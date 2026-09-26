/**
 * src/shared/utils/formatDate.ts
 *
 * Formats a Date using SOTE's own small token syntax (DD, MM, YYYY, HH, mm,
 * ss) — not a full date-formatting library, just what the {date} token
 * needs. Shared between the runtime expander (content/engine/
 * tokenExpander.ts) and DateModal.ts's live format preview, so the preview
 * shown while editing a flow is guaranteed to match what actually gets
 * typed when the flow expands.
 */
export function formatDate(date: Date, format: string): string {
  const pad = (n: number) => n.toString().padStart(2, '0');

  const DD = pad(date.getDate());
  const MM = pad(date.getMonth() + 1);
  const YYYY = date.getFullYear().toString();
  const HH = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());

  return format
    .replace(/DD/g, DD)
    .replace(/MM/g, MM)
    .replace(/YYYY/g, YYYY)
    .replace(/HH/g, HH)
    .replace(/mm/g, mm)
    .replace(/ss/g, ss);
}
