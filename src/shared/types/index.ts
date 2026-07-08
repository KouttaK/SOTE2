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
  operator: 'equals' | 'contains' | 'not_contains' | 'before' | 'after';
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

/**
 * Formulários (Forms) — a catalog of fill-in profiles per site.
 *
 * Unlike the old "Templates" (a flat list of reusable snippets), a Form
 * groups several named fields that all belong to the same site (or set of
 * sites): e.g. "Envio de Currículo" has an "Assunto", a "Destinatário" and
 * a "Descrição" field, each with its own content.
 *
 * Nothing new happens at execution time: every field's `value` is a full
 * ActionBlock, resolved exactly like a Flow's action (variables, tokens,
 * conditions all reused as-is) — a Form is just a different way of
 * organising/addressing content that already exists.
 */
export type FormFieldType = 'text' | 'email' | 'richtext';

export interface FormField {
  id: string;
  /** Free-form label, e.g. "Assunto". */
  name: string;
  /**
   * Light metadata only — does not affect execution/resolution. Only used
   * to switch on editing conveniences (e.g. domain autocomplete for the
   * "email" type). Optional: absent/unknown values behave like 'text'.
   */
  type?: FormFieldType;
  /** Resolved exactly like a Flow's action block (text/richtext + variables + tokens + conditions). */
  value: ActionBlock;
}

export interface FormStats {
  usageCount: number;
  lastUsed?: number;
}

export interface Form {
  id: string;
  /** e.g. "Envio de Currículo". */
  name: string;
  /**
   * Domains this Form applies to. Wildcards supported with the exact same
   * syntax/validation already used by Settings.blocklist (e.g. "*.gmail.com").
   */
  sites: string[];
  /** Order matters (display/organisation order in the editor and in search results). */
  fields: FormField[];
  createdAt: number;
  updatedAt: number;
  stats: FormStats;
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

/**
 * "Gatilho de Busca" — a third trigger mode (distinct from Trigger Key and
 * Exact Match) that opens a cursor-anchored search popup instead of
 * expanding automatically. See TriggerSearchDetector.
 */
export interface SearchTriggerSettings {
  /** Master on/off switch for the whole feature. */
  enabled: boolean;
  /** Whether Flows (not just Forms) are included in the search results. Default: true. */
  includeFlows: boolean;
  /** Prefix that restricts results to Forms valid for the current site + all Flows. Default: "//". */
  domainPrefix: string;
  /** Prefix that searches everything regardless of domain. Default: "///". */
  globalPrefix: string;
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
  searchTrigger: SearchTriggerSettings;
}

export interface StorageSchema {
  flows: Flow[];
  variables: Variable[];
  folders: Folder[];
  forms: Form[];
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