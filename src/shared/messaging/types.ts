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
  | { type: 'FLOW_EXECUTION_FAILED'; payload: { flowId: string } }
  | { type: 'SNOOZE'; payload: { duration: number } } // duration in ms
  | { type: 'BLOCKLIST_ADD'; payload: { domain: string } }
  | { type: 'GET_TAB_INFO' }
  | { type: 'CLIPBOARD_COPY'; payload: { text: string } }
  | { type: 'GET_CLIPBOARD_HISTORY' }
  | { type: 'CLIPBOARD_HISTORY_UPDATED'; payload: ClipboardEntry[] }
  | { type: 'CLEAR_CLIPBOARD_HISTORY' }
  | { type: 'GET_VARIABLES' }
  | { type: 'VARIABLES_UPDATED'; payload: Variable[] }
  | { type: 'VARIABLES_USED'; payload: { keys: string[] } }
  | { type: 'GET_FORMS' }
  | { type: 'SAVE_FORM'; payload: Form }
  | { type: 'DELETE_FORM'; payload: { id: string } }
  | { type: 'FORM_USED'; payload: { formId: string } }
  | { type: 'FORMS_UPDATED'; payload: Form[] }
  | { type: 'GET_SELECTION' }
  | { type: 'FRAME_PROTECTED_STATUS_CHANGED'; payload: { isProtected: boolean } }
  | { type: 'GET_ACTIVE_TAB_PROTECTION_STATUS' };
