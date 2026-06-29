/**
 * src/content/engine/tokenExpander.ts
 */

import type { Token } from '../../shared/types/index.js';

export interface ExpansionContext {
  tabUrl: string;
  tabTitle: string;
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
      // In Manifest V3 content scripts, navigator.clipboard.readText() works 
      // if the document is focused and the user has granted permission.
      // Or we can rely on a background script proxy.
      // For now, we attempt to read from navigator.clipboard natively.
      try {
        // We currently only read the latest item (index 1 is latest).
        // Extended clipboard history is a deeper system feature.
        const text = await navigator.clipboard.readText();
        return text;
      } catch (err) {
        console.warn('Failed to read clipboard:', err);
        return '';
      }
    }

    case 'cursor':
      // The engine handles cursor positioning after expansion.
      // Here we just return an empty string to remove the token from output.
      return '';

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
