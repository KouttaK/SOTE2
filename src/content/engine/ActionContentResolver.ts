/**
 * src/content/engine/ActionContentResolver.ts
 *
 * Resolves a raw ActionBlock (tokens still as <span class="token-pill">
 * placeholders in its HTML, {{VARIABLE}} placeholders in its text) into
 * final ready-to-inject content — variables substituted, every token
 * expanded (via `expandToken`, pausing on a `ChoicePopup` for choice/input
 * tokens), and the Cursor token translated into a plain-text offset.
 *
 * This is the exact same pipeline `content.ts` already used inline for
 * Flow expansion. Extracted here, unchanged, so Forms' per-field insertion
 * (see spec §2: "each Form field is resolved exactly like an Action Block
 * today is resolved") can reuse it verbatim instead of re-implementing —
 * one engine, two places that feed it a different ActionBlock.
 */
import type { ActionBlock, Token, Variable } from '../../shared/types/index.js';
import { ChoicePopup } from './ChoicePopup.js';
import { expandToken, ExpansionContext } from './tokenExpander.js';

export interface ResolvedActionContent {
  /** Final content — HTML for richtext actions, plain text otherwise. Cursor marker already stripped. */
  content: string;
  /** Plain-text character offset where the caret should land, or null = end of content. */
  cursorOffset: number | null;
}

/**
 * Invisible marker used to remember where a Cursor token sat in the
 * expanded content. See content.ts's original comment (preserved here):
 * wrapped in U+2063 (invisible separator) on both sides so it can't
 * collide with anything a user would plausibly type or paste.
 */
const CURSOR_MARKER = '\u2063\u2063SOTE_CURSOR\u2063\u2063';

/**
 * Looks up a token's full definition (type + config) for a pill element
 * found in the saved HTML. Reads config straight off the pill's own
 * `data-token-config` attribute first (the source of truth written at save
 * time — see TokenPill.createHTML), then falls back to the action block's
 * `tokens` array, then to inferring the bare type from the pill's
 * `token-<type>` class as a last resort.
 */
function resolveTokenForPill(pillEl: Element, tokens: Token[]): Token | null {
  const tokenId = pillEl.getAttribute('data-token-id') || crypto.randomUUID();

  const typeClass = Array.from(pillEl.classList).find((c) => c.startsWith('token-') && c !== 'token-pill');
  const classType = typeClass?.replace('token-', '') as Token['type'] | undefined;

  const configAttr = pillEl.getAttribute('data-token-config');
  if (configAttr) {
    try {
      const config = JSON.parse(configAttr);
      const arrayMatch = tokens.find((t) => t.id === pillEl.getAttribute('data-token-id'));
      const type = classType || arrayMatch?.type;
      if (type) {
        return { id: tokenId, type, config };
      }
    } catch {
      // fall through to the array/class fallbacks below
    }
  }

  const arrayMatch = tokens.find((t) => t.id === pillEl.getAttribute('data-token-id'));
  if (arrayMatch) return arrayMatch;

  if (!classType) return null;
  return { id: tokenId, type: classType, config: {} };
}

/**
 * Replaces every `{{KEY}}` occurrence in `text` with the matching Global
 * Variable's value. Unknown keys are left untouched (raw `{{KEY}}` stays in
 * the output) so a typo or a deleted variable doesn't silently swallow the
 * token. When `escapeHtml` is true (richtext actions), the value's own
 * `&`/`<`/`>` are entity-escaped first.
 */
function resolveVariablesInText(text: string, escapeHtml: boolean, variables: Variable[]): string {
  if (!variables?.length || !text.includes('{{')) return text;
  const map = new Map(variables.map((v) => [v.key, v.value]));
  return text.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    const value = map.get(key);
    if (value === undefined) return match;
    if (!escapeHtml) return value;
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  });
}

/**
 * Resolves `actionBlock` into final injectable content. Returns `null` if
 * the user cancelled a choice/input token popup (Esc / click outside).
 */
export async function resolveActionBlockContent(
  actionBlock: ActionBlock,
  element: HTMLElement,
  deps: { choicePopup: ChoicePopup; variables: Variable[]; context: ExpansionContext },
): Promise<ResolvedActionContent | null> {
  const isRichText = actionBlock.format === 'richtext';
  const rawContent = actionBlock.content;

  const container = document.createElement('div');
  container.innerHTML = rawContent;
  const pillEls = Array.from(container.querySelectorAll('.token-pill'));

  let cursorMarkerPlaced = false;

  for (const pillEl of pillEls) {
    const token = resolveTokenForPill(pillEl, actionBlock.tokens || []);
    if (!token) continue;

    if (token.type === 'cursor') {
      if (!cursorMarkerPlaced) {
        pillEl.replaceWith(document.createTextNode(CURSOR_MARKER));
        cursorMarkerPlaced = true;
      } else {
        pillEl.replaceWith(document.createTextNode(''));
      }
      continue;
    }

    let expandedValue = await expandToken(token, deps.context);

    if (expandedValue === null) {
      expandedValue = await deps.choicePopup.showForToken(token, element);
      if (expandedValue === null) {
        return null; // user cancelled
      }
    }

    pillEl.replaceWith(document.createTextNode(expandedValue));
  }

  let expandedContent = container.innerHTML;

  let cursorOffset: number | null = null;
  const markerIndex = expandedContent.indexOf(CURSOR_MARKER);
  if (markerIndex !== -1) {
    const before = expandedContent.slice(0, markerIndex);
    const beforeTmp = document.createElement('div');
    beforeTmp.innerHTML = before;
    cursorOffset = (beforeTmp.textContent || '').length;
    expandedContent = expandedContent.split(CURSOR_MARKER).join('');
  }

  expandedContent = resolveVariablesInText(expandedContent, isRichText, deps.variables);

  return { content: expandedContent, cursorOffset };
}
