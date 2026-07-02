/**
 * src/shared/messaging/types.ts
 */
import type { Flow, Settings, ClipboardEntry } from '../types/index.js';

export type Message =
  | { type: 'GET_FLOWS' }
  | { type: 'GET_SETTINGS' }
  | { type: 'SETTINGS_UPDATED'; payload: Partial<Settings> }
  | { type: 'FLOWS_UPDATED'; payload: Flow[] }
  | { type: 'FLOW_USED'; payload: { flowId: string; keysSaved: number } }
  | { type: 'SNOOZE'; payload: { duration: number } } // duration in ms
  | { type: 'BLOCKLIST_ADD'; payload: { domain: string } }
  | { type: 'GET_TAB_INFO' }
  | { type: 'CLIPBOARD_COPY'; payload: { text: string } }
  | { type: 'GET_CLIPBOARD_HISTORY' }
  | { type: 'CLIPBOARD_HISTORY_UPDATED'; payload: ClipboardEntry[] }
  | { type: 'CLEAR_CLIPBOARD_HISTORY' };

// Response Types
export type GetFlowsResponse = Flow[];
export type GetSettingsResponse = Settings;
export type GetTabInfoResponse = { url: string | null; title: string | null };
export type GetClipboardHistoryResponse = ClipboardEntry[];
