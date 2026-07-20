/**
 * src/content/engine/tokenExpander.ts
 */

import type { RandomTokenOption, Token } from '../../shared/types/index.js';
import { pickWeightedRandom } from '../../shared/utils/randomWeights.js';

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
      const chosen = pickWeightedRandom(options);
      return chosen?.text ?? '';
    }

    case 'choice':
    case 'input':
      // Requires user interaction via floating popup.
      // This will be implemented in Prompt 09. Returning null tells the engine to pause.
      return null;

    default:
      return '';
  }
}

function formatDate(date: Date, format: string): string {
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
