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
import type { ActionBlock, Token, Variable, Flow, FlowRefTokenConfig, SessionScope } from '../../shared/types/index.js';
import { ChoicePopup } from './ChoicePopup.js';
import { expandToken, ExpansionContext } from './tokenExpander.js';
import { SessionStore } from './SessionStore.js';
import { TextInjector } from './TextInjector.js';
import { resolveVariablesInText } from '../../shared/utils/variableResolver.js';
import { sanitizeHtml } from '../../shared/utils/sanitizeHtml.js';
import { resolveFlowActionBlock } from './ConditionResolver.js';
import { findVariableKeysInText } from '../../shared/utils/flowVariableScanner.js';

export interface ResolvedActionContent {
  /** Final content — HTML for richtext actions, plain text otherwise. Cursor marker already stripped. */
  content: string;
  /** Plain-text character offset where the caret should land, or null = end of content. */
  cursorOffset: number | null;
  /** Keys of global variables that were resolved and replaced in the content. */
  usedVariables?: string[];
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
  const rawId = pillEl.getAttribute('data-token-id');
  const tokenId = rawId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `tok_${Date.now()}`);

  const typeClass = Array.from(pillEl.classList).find((c) => c.startsWith('token-') && c !== 'token-pill');
  const classType = typeClass?.replace('token-', '') as Token['type'] | undefined;

  const arrayMatch = rawId ? tokens.find((t) => t.id === rawId) : undefined;
  const sourceTokenId = (arrayMatch as any)?.sourceTokenId;

  const configAttr = pillEl.getAttribute('data-token-config');
  if (configAttr) {
    try {
      const config = JSON.parse(configAttr);
      const type = classType || arrayMatch?.type;
      if (type) {
        return {
          id: tokenId,
          type,
          config: { ...(arrayMatch?.config || {}), ...config },
          ...(sourceTokenId ? { sourceTokenId } : {}),
        } as Token;
      }
    } catch {
      // fall through to the array/class fallbacks below
    }
  }

  if (arrayMatch) {
    return {
      ...arrayMatch,
      ...(sourceTokenId ? { sourceTokenId } : {}),
    };
  }

  if (!classType) return null;
  return { id: tokenId, type: classType, config: {} };
}

/**
 * Resolves a single `flow_ref` ("Incluir Fluxo") token: looks up its target
 * flow, resolves that flow's own Condition/Random branches down to a leaf
 * ActionBlock (same logic a direct trigger would use — see
 * ConditionResolver.ts), then recursively expands *that* ActionBlock's
 * content through this same pipeline (so nested flow_ref/choice/input/
 * variable tokens inside the included flow all still work).
 *
 * Returns `{ content: '', isRichText: false }` (never throws) for any
 * "nothing to include" case — unset/blank flowId, target flow deleted,
 * a cycle (this flow is already in `visitedFlowIds`), or the target flow's
 * own conditions matching no branch — so a broken reference degrades to
 * silently expanding to nothing rather than breaking the whole expansion.
 * Returns `null` only when the user cancels a nested choice/input popup,
 * which must propagate all the way up to cancel the entire expansion.
 */
async function resolveFlowRefToken(
  token: Token,
  element: HTMLElement,
  deps: { choicePopup: ChoicePopup; variables: Variable[]; context: ExpansionContext; flows?: Flow[]; shortcutTyped?: string },
  visitedFlowIds: Set<string>,
): Promise<{ content: string; isRichText: boolean } | null> {
  const config = (token.config || {}) as unknown as FlowRefTokenConfig;
  const flowId = config.flowId;

  if (!flowId) return { content: '', isRichText: false };

  if (visitedFlowIds.has(flowId)) {
    console.warn(`[SOTE] Flow include cycle detected (flow "${flowId}" already in the inclusion chain) — skipping.`);
    return { content: '', isRichText: false };
  }

  const targetFlow = (deps.flows || []).find((f) => f.id === flowId);
  if (!targetFlow) {
    console.warn(`[SOTE] Flow include target "${flowId}" no longer exists — skipping.`);
    return { content: '', isRichText: false };
  }

  const nestedActionBlock = resolveFlowActionBlock(targetFlow, element, deps.shortcutTyped, {
    variables: deps.variables,
    clipboardText: deps.context?.clipboardHistory?.[0],
    flow: targetFlow,
  });
  if (!nestedActionBlock) {
    // The included flow has conditions but none matched (and no Else) —
    // nothing to include right now, same as that flow simply not firing.
    return { content: '', isRichText: false };
  }

  const nextVisited = new Set(visitedFlowIds);
  nextVisited.add(flowId);

  const resolved = await resolveActionBlockContent(nestedActionBlock, element, deps, nextVisited);
  if (resolved === null) return null; // user cancelled a nested choice/input popup

  return { content: resolved.content, isRichText: nestedActionBlock.format === 'richtext' };
}

/**
 * Resolves `actionBlock` into final injectable content. Returns `null` if
 * the user cancelled a choice/input token popup (Esc / click outside).
 *
 * `deps.flows` is the full flows list, needed to look up the target of any
 * `flow_ref` ("Incluir Fluxo") token — see resolveFlowRefToken below.
 * `visitedFlowIds` is an internal recursion guard (not meant to be passed
 * by outside callers): every flow_ref expansion adds its target's id to a
 * per-expansion copy before recursing, so a cycle (A includes B includes A)
 * is detected — the id can never appear twice on one chain — and broken
 * instead of hanging the page in infinite recursion.
 */
export async function resolveActionBlockContent(
  actionBlock: ActionBlock,
  element: HTMLElement,
  deps: { choicePopup: ChoicePopup; variables: Variable[]; context: ExpansionContext; flows?: Flow[]; shortcutTyped?: string },
  visitedFlowIds: Set<string> = new Set(),
): Promise<ResolvedActionContent | null> {
  const isRichText = actionBlock.format === 'richtext';
  const rawContent = actionBlock.content;

  const container = document.createElement('div');
  container.innerHTML = sanitizeHtml(rawContent);

  const UI_LEAK_SELECTORS =
    '.block-dock, .block-dock-toggle, .block-dock-chips, .block-dock-chip, .block-dock-label, .block-dock-toggle-label, .block-type-label, .block-type-icon, .block-type-meta, .block-badge, .block-header, .block-header-actions, .floating-node-header, .floating-node-grip, .floating-node-label, .tokens-preview, .token-menu-overlay, .token-menu-list, .token-menu-search-wrap, .token-menu-section-label, .token-menu-row, .token-menu-row-text, .token-menu-row-desc, .rt-toolbar, .rt-btn';
  container.querySelectorAll(UI_LEAK_SELECTORS).forEach((el) => el.remove());

  const pillEls = Array.from(container.querySelectorAll('.token-pill'));

  let cursorMarkerPlaced = false;
  let anchorPlaced = false;
  const sessionCollected = new Map<string, string>();

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

    if (token.type === 'flow_ref') {
      // Included flow's own Cursor/choice/input/variable tokens all still
      // work here because this recurses into the exact same function —
      // choice/input popups pause and prompt the user just like they would
      // if the included flow had been triggered directly, and any Cursor
      // token *inside* the included flow's action is intentionally NOT
      // honored (its cursorOffset is discarded below): only the including
      // flow's own Cursor token controls where the caret ends up.
      const resolved = await resolveFlowRefToken(token, element, deps, visitedFlowIds);
      if (resolved === null) return null; // user cancelled a nested choice/input popup

      if (resolved.isRichText) {
        const wrapper = document.createElement('span');
        wrapper.innerHTML = resolved.content;
        pillEl.replaceWith(...Array.from(wrapper.childNodes));
      } else {
        pillEl.replaceWith(document.createTextNode(resolved.content));
      }
      continue;
    }

    let expandedValue = await expandToken(token, deps.context);

    if (expandedValue === null) {
      if (token.type === 'input') {
        const cfg = (token.config || {}) as any;
        const remember = cfg.rememberValue !== false;
        const varName = typeof cfg.sessionVarName === 'string' ? cfg.sessionVarName.trim() : '';
        const scope: SessionScope = cfg.scope || 'tab';
        const autoApply = Boolean(cfg.autoApply);
        const ttlHours = typeof cfg.ttlHours === 'number' && cfg.ttlHours > 0 ? cfg.ttlHours : undefined;

        let sessionValue: string | undefined;
        if (varName) {
          if (sessionCollected.has(varName)) {
            sessionValue = sessionCollected.get(varName);
          } else {
            sessionValue = await SessionStore.getInstance().getSessionVariable(varName, scope, {
              url: typeof window !== 'undefined' ? window.location?.href : '',
              title: typeof document !== 'undefined' ? document.title : '',
            });
          }
        }

        // Auto-reuse directly if autoApply is enabled OR if already confirmed in this same expansion run
        const canAutoReuse = sessionValue !== undefined && (autoApply || (varName && sessionCollected.has(varName)));

        if (canAutoReuse) {
          expandedValue = sessionValue!;
        } else {
          if (!anchorPlaced) {
            anchorPlaced = TextInjector.placeContentEditableAnchor(element);
          }
          const userVal = await deps.choicePopup.showForToken(token, element, deps.variables, sessionValue);
          if (userVal === null) {
            if (anchorPlaced) TextInjector.removeContentEditableAnchor(element);
            return null; // user cancelled
          }
          expandedValue = userVal;
          if (varName && (remember || Boolean(cfg.rememberValue))) {
            sessionCollected.set(varName, userVal);
            await SessionStore.getInstance().setSessionVariable(varName, userVal, scope, {
              url: typeof window !== 'undefined' ? window.location?.href : '',
              title: typeof document !== 'undefined' ? document.title : '',
            }, ttlHours);
          }
        }
      } else {
        // About to hand focus off to the ChoicePopup for a while — some
        // sites' custom rich-text editors (TipTap/ProseMirror, Slate,
        // Draft.js...) don't reliably restore the caret to where it was once
        // `element` regains focus, so drop an invisible anchor at the *real*
        // current position first (only once — the first popup is the only
        // point where `element` still definitely has the right caret).
        if (!anchorPlaced) {
          anchorPlaced = TextInjector.placeContentEditableAnchor(element);
        }

        expandedValue = await deps.choicePopup.showForToken(token, element, deps.variables);
        if (expandedValue === null) {
          if (anchorPlaced) TextInjector.removeContentEditableAnchor(element);
          return null; // user cancelled
        }
      }
    }

    pillEl.replaceWith(document.createTextNode(expandedValue));
  }

  let expandedContent = container.innerHTML;

  const foundKeys = findVariableKeysInText(expandedContent);
  const knownKeys = new Set((deps.variables || []).map((v) => v.key));
  const usedVariables = foundKeys.filter((k) => knownKeys.has(k));

  expandedContent = resolveVariablesInText(expandedContent, isRichText, deps.variables);

  let cursorOffset: number | null = null;
  const markerIndex = expandedContent.indexOf(CURSOR_MARKER);
  if (markerIndex !== -1) {
    const before = expandedContent.slice(0, markerIndex);
    const beforeTmp = document.createElement('div');
    beforeTmp.innerHTML = before;
    cursorOffset = (beforeTmp.textContent || '').length;
    expandedContent = expandedContent.split(CURSOR_MARKER).join('');
  }

  return { content: expandedContent, cursorOffset, usedVariables };
}
