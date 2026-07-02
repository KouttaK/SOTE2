export type TriggerMode = 'trigger' | 'exact_match';

export interface Token {
  id: string;
  type: 'choice' | 'cursor' | 'clipboard' | 'input' | 'date' | 'url' | 'title';
  config: Record<string, unknown>;
}

export interface Block {
  id: string;
  type: 'trigger' | 'condition' | 'action';
  data: TriggerBlock | ConditionBlock | ActionBlock;
}

export interface TriggerBlock {
  shortcut: string;
  smartCase: boolean;
  forceCapitalize: boolean;
}

export interface ConditionBlock {
  rules: ConditionRule[];
  elseBranch?: ActionBlock;
}

export interface ConditionRule {
  type: 'domain' | 'time' | 'weekday' | 'date' | 'field_type' | 'field_content';
  operator: 'equals' | 'contains' | 'matches' | 'before' | 'after';
  value: string;
  action: ActionBlock;
}

export interface ActionBlock {
  format: 'plaintext' | 'richtext';
  content: string;
  tokens: Token[];
}

export interface FlowStats {
  usageCount: number;
  lastUsed?: number;
  keysSaved: number;
}

export interface Flow {
  id: string;
  name: string;
  blocks: Block[];
  tags: string[];
  folderId?: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  stats: FlowStats;
}

export interface Variable {
  id: string;
  key: string;
  value: string;
  description?: string;
  updatedAt: number;
}

export interface Template {
  id: string;
  name: string;
  tag: string;
  content: string;
  format: 'plaintext' | 'richtext';
  updatedAt: number;
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  order: number;
}

/** A single entry captured from a 'copy' (or 'cut') event on the page. */
export interface ClipboardEntry {
  text: string;
  timestamp: number;
}

export interface Settings {
  triggerMode: TriggerMode;
  triggerKeys: string[];
  exactMatchChar: string;
  exactMatchDelay?: number;
  globalEnabled: boolean;
  snoozeUntil?: number;
  blocklist: string[];
  commandPaletteShortcut: string;
  analytics: Record<string, number>;
  language?: string;
  theme?: string;
  /** Max number of items kept in the clipboard history (default 10, max 50). */
  clipboardHistoryMax?: number;
}

export interface StorageSchema {
  flows: Flow[];
  variables: Variable[];
  templates: Template[];
  folders: Folder[];
  settings: Settings;
  /**
   * Optional on purpose: clipboard history is local, ephemeral, and can
   * contain sensitive copied text, so it's intentionally excluded from
   * export/import backups (see settings.ts's #btn-export handler).
   */
  clipboardHistory?: ClipboardEntry[];
}
declare module '*.css';
declare module '*.css?inline' {
  const content: string;
  export default content;
}