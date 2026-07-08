/**
 * src/shared/messaging/types.ts
 */
import type { Flow, Form, Settings, ClipboardEntry, Variable } from '../types/index.js';

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
  | { type: 'CLEAR_CLIPBOARD_HISTORY' }
  | { type: 'GET_VARIABLES' }
  | { type: 'VARIABLES_UPDATED'; payload: Variable[] }
  | { type: 'GET_FORMS' }
  | { type: 'SAVE_FORM'; payload: Form }
  | { type: 'DELETE_FORM'; payload: { id: string } }
  | { type: 'FORM_USED'; payload: { formId: string } }
  | { type: 'FORMS_UPDATED'; payload: Form[] };

// Response Types
export type GetFlowsResponse = Flow[];
export type GetSettingsResponse = Settings;
export type GetTabInfoResponse = { url: string | null; title: string | null };
export type GetClipboardHistoryResponse = ClipboardEntry[];
export type GetVariablesResponse = Variable[];
export type GetFormsResponse = Form[];
