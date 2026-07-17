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
  elseBranch?: BranchTarget;
}

export interface ConditionRule {
  type: 'domain' | 'time' | 'weekday' | 'date' | 'field_type' | 'field_content';
  operator: 'equals' | 'contains' | 'not_contains' | 'before' | 'after';
  value: string;
  action: BranchTarget;
  /**
   * Additional criteria checked alongside the primary type/operator/value
   * above, as a single AND ("E") or OR ("OU") group — e.g. "Domínio contém
   * X E Horário entre Y" — all leading to the same `action`.
   *
   * This replaces nested conditions as the way to combine more than one
   * check before running a single action: previously the only way to test
   * a second condition was to convert the whole branch into another full
   * nested Se/Senão Se/Senão tree (see `BranchTarget` below), which was
   * confusing to read for what is conceptually just "match all/any of
   * these". Old flows that already used a nested ConditionBlock for this
   * keep working exactly as before (still resolved recursively at
   * runtime, still rendered as a nested fan-out in the editor) — this
   * field is purely an additive, simpler alternative for new rules.
   */
  criteria?: ConditionCriterion[];
  /** How `criteria` combine with the primary criterion above and with each
   * other. Only meaningful when `criteria` is non-empty. Defaults to 'AND'
   * when omitted. */
  combinator?: 'AND' | 'OR';
}

/** A single type/operator/value check — the shape shared by a rule's own
 * primary criterion and each entry in its `criteria` group. */
export interface ConditionCriterion {
  type: 'domain' | 'time' | 'weekday' | 'date' | 'field_type' | 'field_content';
  operator: 'equals' | 'contains' | 'not_contains' | 'before' | 'after';
  value: string;
}

/**
 * What a branch (a rule's `action`, or a ConditionBlock's `elseBranch`)
 * ultimately leads to: either a leaf ActionBlock (the normal case), or —
 * to support nested conditions — another whole ConditionBlock whose own
 * rules/elseBranch are evaluated in turn. This recursive union is what
 * lets "Se X, então Se Y, então Z" trees be built to arbitrary depth
 * while staying 100% backward-compatible with existing saved Flows: an
 * old rule's `action` is always a plain ActionBlock (no `rules` array),
 * so `isConditionBlock()` below correctly treats it as a leaf.
 */
export type BranchTarget = ActionBlock | ConditionBlock;

/** Narrows a BranchTarget to a nested ConditionBlock (as opposed to a leaf ActionBlock). */
export function isConditionBlock(target: BranchTarget | null | undefined): target is ConditionBlock {
  return !!target && Array.isArray((target as ConditionBlock).rules);
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
  /** Whether SOTE adds its right-click context menu options (e.g. "Create
   * shortcut from selection"). Defaults to true; the background script
   * removes/recreates the menu whenever this changes. */
  contextMenuEnabled?: boolean;
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