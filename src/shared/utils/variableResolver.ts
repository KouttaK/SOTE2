/**
 * src/shared/utils/variableResolver.ts
 *
 * Replaces every `{{KEY}}` or `{{KEY|fallback}}` occurrence in a string with
 * the matching Global Variable's value.
 *
 * Fallback behavior:
 * If the variable KEY does not exist or its value is an empty string,
 * the fallback is used.
 * If no fallback is provided and the variable does not exist, the placeholder
 * is left untouched (raw `{{KEY}}` stays in output).
 * When `escapeHtml` is true (richtext actions), resolved values have `&`, `<`, `>` escaped.
 */
import type { Variable } from '../types/index.js';

export function resolveVariablesInText(text: string, escapeHtml: boolean, variables?: Variable[]): string {
  if (!text || !text.includes('{{')) return text;
  const map = new Map((variables || []).map((v) => [v.key, v.value]));

  return text.replace(/\{\{\s*([A-Z0-9_]+)\s*(?:\|\s*([^}]*?)\s*)?\}\}/g, (match, key: string, fallback?: string) => {
    const value = map.get(key);
    let resolved: string;

    if (value !== undefined && value !== '') {
      resolved = value;
    } else if (fallback !== undefined) {
      resolved = fallback;
    } else if (value !== undefined) {
      resolved = value;
    } else {
      return match;
    }

    if (!escapeHtml) return resolved;
    return resolved.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  });
}
