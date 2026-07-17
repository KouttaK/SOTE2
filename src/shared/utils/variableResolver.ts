/**
 * src/shared/utils/variableResolver.ts
 *
 * Replaces every `{{KEY}}` occurrence in a string with the matching Global
 * Variable's value. Shared by ActionContentResolver.ts (final content
 * resolution) and ChoicePopup.ts (so a Choice token's own options can
 * contain variables too, instead of showing/injecting the raw `{{KEY}}`
 * text) — pulled out into its own module so neither of those two has to
 * import from the other just for this.
 */
import type { Variable } from '../types/index.js';

/**
 * Unknown keys are left untouched (raw `{{KEY}}` stays in the output) so a
 * typo or a deleted variable doesn't silently swallow the token. When
 * `escapeHtml` is true (richtext actions), the value's own `&`/`<`/`>` are
 * entity-escaped first.
 */
export function resolveVariablesInText(text: string, escapeHtml: boolean, variables: Variable[]): string {
  if (!variables?.length || !text.includes('{{')) return text;
  const map = new Map(variables.map((v) => [v.key, v.value]));
  return text.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    const value = map.get(key);
    if (value === undefined) return match;
    if (!escapeHtml) return value;
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  });
}
