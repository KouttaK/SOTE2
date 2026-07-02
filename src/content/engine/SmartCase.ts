/**
 * src/content/engine/SmartCase.ts
 */

// Invisible marker TextInjector/content.ts use internally to remember where
// a Cursor token was. Must be skipped over here the same way whitespace is,
// otherwise a Cursor token placed before any real text would make
// capitalization bail out on the marker instead of finding the real first
// letter that follows it.
const CURSOR_MARKER_CHAR = '\u2063';

export function applyCasing(
  originalTyped: string,
  expansionText: string,
  forceCapitalize: boolean,
  isHtml: boolean = false
): string {
  const capitalize = isHtml ? capitalizeFirstLetterHtml : capitalizeFirstLetterPlain;

  // Force Capitalize always wins and must not depend on what was typed —
  // it used to be checked *after* the `!originalTyped` early return below,
  // which meant it silently did nothing whenever shortcutTyped was empty.
  if (forceCapitalize) {
    return capitalize(expansionText);
  }

  if (!originalTyped) return expansionText;

  const isAllUpper = originalTyped === originalTyped.toUpperCase() && /[A-Z]/.test(originalTyped);
  const isFirstUpper = originalTyped[0] === originalTyped[0].toUpperCase() && /[A-Z]/.test(originalTyped[0]);

  if (isAllUpper && !isHtml) {
    // Whole-word uppercasing is only safe for plain text — doing it on an
    // HTML string would also uppercase tag/attribute names.
    return expansionText.toUpperCase();
  }

  if (isFirstUpper) {
    return capitalize(expansionText);
  }

  // Otherwise, all lowercase or mixed, leave as is
  return expansionText;
}

/**
 * Capitalizes the first real letter of a plain-text string, skipping over
 * the invisible cursor marker if it happens to sit at the very start.
 */
function capitalizeFirstLetterPlain(str: string): string {
  if (!str) return str;
  let i = 0;
  while (i < str.length && str[i] === CURSOR_MARKER_CHAR) i++;
  if (i >= str.length) return str;
  return str.slice(0, i) + str.charAt(i).toUpperCase() + str.slice(i + 1);
}

/**
 * Same idea as capitalizeFirstLetter, but safe for HTML strings: it skips
 * over tags (e.g. <p>, <strong>) and whitespace to find the first real
 * visible character and uppercases only that, leaving all markup intact.
 * Used so Force Capitalize / Smart Case also work for richtext actions,
 * which is the default action format for new flows.
 */
function capitalizeFirstLetterHtml(html: string): string {
  if (!html) return html;

  let inTag = false;
  for (let i = 0; i < html.length; i++) {
    const ch = html[i];
    if (ch === '<') { inTag = true; continue; }
    if (ch === '>') { inTag = false; continue; }
    if (inTag) continue;

    if (/\s/.test(ch) || ch === CURSOR_MARKER_CHAR) continue; // skip leading whitespace/newlines/cursor marker
    if (/[a-zà-öø-ÿ]/i.test(ch)) {
      return html.slice(0, i) + ch.toUpperCase() + html.slice(i + 1);
    }
    // First visible character isn't a letter (number/emoji/punctuation) —
    // nothing sensible to capitalize, leave the content untouched.
    return html;
  }
  return html;
}
