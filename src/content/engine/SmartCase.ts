/**
 * src/content/engine/SmartCase.ts
 */

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

  // isAllUpper: every alphabetic character in the shortcut is uppercase
  // (non-letter characters like digits are neutral and do NOT count as
  // uppercase, so "A1" or "BR2" no longer falsely triggers ALL-CAPS mode).
  const letters = originalTyped.replace(/[^a-zA-Z]/g, '');
  const isAllUpper = letters.length > 0 && letters === letters.toUpperCase();
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
 * Capitalizes the first real LETTER of a plain-text string — skipping
 * over the invisible cursor marker plus any leading non-letter characters
 * (spaces, punctuation, digits, emoji, an unresolved `{{VAR}}` token,
 * etc.) to find it, rather than only ever looking at character 0. Force
 * Capitalize used to visibly do nothing whenever the expansion happened
 * to start with anything but a letter — capitalizing "(" or "1" is a
 * silent no-op, so e.g. an action starting with "(obs: ..." or a Date/
 * Variable token never actually got capitalized.
 */
function capitalizeFirstLetterPlain(str: string): string {
  if (!str) return str;
  let i = 0;
  while (i < str.length && !/[a-zà-öø-ÿ]/i.test(str[i])) i++;
  if (i >= str.length) return str;
  return str.slice(0, i) + str.charAt(i).toUpperCase() + str.slice(i + 1);
}

/**
 * Same idea as capitalizeFirstLetterPlain, but safe for HTML strings: it
 * skips over tags (e.g. <p>, <strong>), entities, whitespace, AND any
 * other non-letter character (punctuation, digits, emoji, an unresolved
 * `{{VAR}}` token, a token-pill's own inner text like an icon glyph) to
 * find the first real visible LETTER and uppercases only that, leaving
 * everything else — including any leading punctuation — intact. Used so
 * Force Capitalize / Smart Case also work for richtext actions, which is
 * the default action format for new flows.
 *
 * Previously this bailed out and returned the string completely
 * unmodified the moment it hit any non-letter, non-whitespace character
 * (e.g. a "(" starting a parenthetical, or the "{" of an unresolved
 * `{{VAR}}` token) — silently disabling Force Capitalize for any action
 * that didn't happen to start with a letter, which given SOTE's own
 * dynamic tokens (Date, Variable, Choice...) landing at the start of an
 * action is a very ordinary thing to do, made the toggle look completely
 * broken rather than just imperfect on an edge case.
 */
function capitalizeFirstLetterHtml(html: string): string {
  if (!html) return html;

  let inTag = false;
  for (let i = 0; i < html.length; i++) {
    const ch = html[i];
    if (ch === '<') { inTag = true; continue; }
    if (ch === '>') { inTag = false; continue; }
    if (inTag) continue;

    // HTML entities (most commonly &nbsp; — richtext editors routinely
    // serialize a leading/filler non-breaking space this way) aren't
    // whitespace *characters*, so the \s check below never saw them:
    // the loop hit the "not a letter" case on the very first "&" and
    // used to give up before ever reaching the real first letter.
    // Skipping a whole "&...;" reference here (not just &nbsp;
    // specifically) covers any other whitespace-ish entity the same way.
    if (ch === '&') {
      const entityEnd = html.indexOf(';', i);
      if (entityEnd !== -1 && entityEnd - i <= 10) {
        i = entityEnd;
        continue;
      }
    }

    if (/[a-zà-öø-ÿ]/i.test(ch)) {
      return html.slice(0, i) + ch.toUpperCase() + html.slice(i + 1);
    }
    // Not a letter (whitespace, cursor marker, punctuation, digit,
    // emoji...) — skip it and keep looking for the first real letter,
    // instead of giving up on the whole string.
  }
  return html;
}
