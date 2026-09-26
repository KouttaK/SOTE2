/**
 * src/content/engine/tokenExpander.ts
 */

import type { RandomTokenOption, Token } from '../../shared/types/index.js';
import { pickWeightedRandom, pickWeightedRandomExcluding } from '../../shared/utils/randomWeights.js';
import { formatDate } from '../../shared/utils/formatDate.js';
import { evaluateMath } from '../../shared/utils/mathEvaluator.js';

export interface ExpansionContext {
  tabUrl: string;
  tabTitle: string;
  /**
   * Locally-tracked clipboard history, newest item first (index 0 = most
   * recently copied text = "Clipboard 1" in the UI). Populated by the
   * content script from 'copy'/'cut' events and kept in sync with the
   * background's persisted history. Optional so existing callers/tests
   * that don't care about clipboard tokens don't need to pass it.
   */
  clipboardHistory?: string[];
}

// In-memory counter state per token ID to persist sequence across expansions
const counterState = new Map<string, number>();

/** Resets in-memory counter state (useful for test isolation) */
export function resetCounterState(): void {
  counterState.clear();
}

export async function expandToken(token: Token, context: ExpansionContext): Promise<string | null> {
  switch (token.type) {
    case 'url':
      return context.tabUrl;

    case 'title':
      return context.tabTitle;

    case 'date': {
      const format = (token.config?.format as string) || 'DD/MM/YYYY';
      return formatDate(new Date(), format);
    }

    case 'clipboard': {
      // token.config.index is 1-based: 1 = most recent copy, 2 = second
      // most recent, etc. (see ClipboardModal.ts / TokenPill.ts).
      const index = Math.max(1, (token.config?.index as number) || 1);
      const history = context.clipboardHistory ?? [];
      const fromHistory = history[index - 1];

      if (fromHistory !== undefined) {
        return fromHistory;
      }

      // No tracked history yet for this slot. For index 1 only, fall back
      // to reading the live OS clipboard directly — covers the moment
      // right after install/reload, before any 'copy' event has been
      // captured on a SOTE-monitored page. Indexes 2+ have no equivalent
      // fallback (there's no "second most recent" without history), so
      // they simply resolve to an empty string.
      if (index === 1) {
        try {
          const text = await navigator.clipboard.readText();
          return text;
        } catch (err) {
          console.warn('[SOTE] Failed to read clipboard:', err);
          return '';
        }
      }

      console.warn(`[SOTE] Clipboard history has no item at index ${index} (history length: ${history.length}).`);
      return '';
    }

    case 'cursor':
      // The engine handles cursor positioning after expansion.
      // Here we just return an empty string to remove the token from output.
      return '';

    case 'random': {
      // Unlike 'choice', this never defers to a popup — one option is
      // picked automatically (weighted by each option's `weight`, a
      // percentage that always sums to 100 across the set) every time
      // the shortcut expands.
      const options = (token.config?.options as RandomTokenOption[]) || [];
      const avoidConsecutive = Boolean(token.config?.avoidConsecutive);
      let chosen: RandomTokenOption | null = null;
      if (avoidConsecutive) {
        chosen = pickWeightedRandomExcluding(options, (token as any)._lastChosenId);
        if (chosen) (token as any)._lastChosenId = chosen.id;
      } else {
        chosen = pickWeightedRandom(options);
      }
      return chosen?.text ?? '';
    }

    case 'counter': {
      const cfg = (token.config || {}) as {
        start?: number;
        step?: number;
        padLength?: number;
        current?: number;
        counterGroupId?: string;
        displayMode?: 'visible' | 'silent';
        incrementMode?: 'always' | 'visible_only';
        scope?: 'global' | 'site';
      };
      const start = typeof cfg.start === 'number' ? cfg.start : 1;
      const step = typeof cfg.step === 'number' ? cfg.step : 1;
      const displayMode = cfg.displayMode ?? 'visible';
      const incrementMode = cfg.incrementMode ?? 'always';
      const scope = cfg.scope ?? 'global';

      let siteDomain = '';
      if (scope === 'site') {
        if (context?.tabUrl) {
          try {
            siteDomain = new URL(context.tabUrl).hostname;
          } catch {
            siteDomain = context.tabUrl;
          }
        } else if (typeof window !== 'undefined' && window.location?.hostname) {
          siteDomain = window.location.hostname;
        }
      }

      const rawCounterKey = (token as any).sourceTokenId || (token.config as any)?.counterGroupId || token.id;
      const counterKey = (scope === 'site' && siteDomain) ? `${siteDomain}:${rawCounterKey}` : rawCounterKey;

      let val: number;
      if (counterKey && counterState.has(counterKey)) {
        val = counterState.get(counterKey)!;
      } else if (scope === 'global' && typeof cfg.current === 'number') {
        val = cfg.current;
      } else {
        val = start;
      }

      const shouldIncrement = incrementMode === 'always' || displayMode === 'visible';
      if (shouldIncrement) {
        const nextVal = val + step;
        if (scope === 'global') {
          cfg.current = nextVal;
        }
        if (counterKey) {
          counterState.set(counterKey, nextVal);
        }
      }

      if (displayMode === 'silent') {
        return '';
      }

      let res = String(val);
      if (cfg.padLength && cfg.padLength > 0) {
        const isNegative = val < 0;
        const absStr = String(Math.abs(val)).padStart(cfg.padLength, '0');
        res = isNegative ? `-${absStr}` : absStr;
      }
      return res;
    }

    case 'math': {
      const expr = (token.config?.expression as string) || '';
      if (!expr.trim()) return '';
      try {
        const val = evaluateMath(expr);
        return String(val);
      } catch (err) {
        console.warn('[SOTE] Math evaluation failed:', err);
        return '';
      }
    }

    case 'choice':
    case 'input':
      // Requires user interaction via floating popup.
      // Returning null signals the engine to pause and delegate to ChoicePopup via ActionContentResolver.ts.
      return null;

    default:
      return '';
  }
}
