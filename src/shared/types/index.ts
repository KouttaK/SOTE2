export type TriggerMode = 'trigger' | 'exact_match';

export interface Token {
  id: string;
  type: 'choice' | 'cursor' | 'clipboard' | 'input' | 'date' | 'url' | 'title' | 'random' | 'flow_ref' | 'counter' | 'math';
  config: Record<string, unknown>;
}

/** Config shape for a `flow_ref` token — "Incluir Fluxo" ("Flow Include").
 * Lets one flow's action reuse another flow's content by reference instead
 * of copy-pasting it, so a shared snippet (e.g. an email signature) only
 * needs to be edited in one place. `flowLabel` is a denormalized copy of
 * the target flow's name/shortcut, cached purely for display in the pill
 * and tokens-preview list (same pattern as `input`'s `config.label`) — the
 * actual content resolved at expansion time always comes fresh from
 * `flowId` (see resolveFlowRefToken in ActionContentResolver.ts), so a
 * rename of the target flow is reflected correctly at runtime even though
 * this cached label may look stale in the editor until the token is
 * reopened/resaved. */
export interface FlowRefTokenConfig {
  flowId: string;
  flowLabel?: string;
}

export interface CounterConfig {
  counterId?: string;
  counterName?: string;
  start?: number;
  step?: number;
  padLength?: number;
  current?: number;
  counterGroupId?: string;
  displayMode?: 'visible' | 'silent';        // 'visible': exibe número no texto; 'silent': apenas avança internamente sem poluir o texto (default: 'visible')
  incrementMode?: 'always' | 'visible_only'; // 'always': sempre incrementa; 'visible_only': não incrementa se silencioso (default: 'always')
  scope?: 'global' | 'site';                 // 'global': único em qualquer site; 'site': contador isolado por domínio (default: 'global')
}

/** A single weighted phrase inside a 'random' token's config
 * (`token.config.options`). `weight` is a percentage (0-100); every
 * option belonging to the same token always sums to exactly 100 — see
 * shared/utils/randomWeights.ts, which keeps that invariant whenever an
 * option is added, removed, or edited. */
export interface RandomTokenOption {
  id: string;
  weight: number;
  text: string;
}

export interface Block {
  id: string;
  type: 'trigger' | 'condition' | 'action';
  /**
   * For `type: 'trigger'` → TriggerBlock.
   * For `type: 'condition'` → ConditionBlock — the dedicated Se/Senão Se/
   * Senão step some flows still use as a separate top-level step, kept
   * for backward compatibility with flows saved before block-adding was
   * unified (see editor.ts's renderFlow()).
   * For `type: 'action'` → a full BranchTarget (ActionBlock | ConditionBlock
   * | RandomBlock), not just a plain ActionBlock. This is what lets the
   * unified "+ Adicionar Bloco" menu offer Random (or a nested Condition)
   * directly at the top level of a flow with no dedicated Condition step —
   * exactly the same way a branch's own leaf already could. Resolved at
   * runtime by ConditionResolver.ts's resolveFlowActionBlock via
   * resolveLeaf(), the same function every nested branch target goes
   * through.
   */
  data: TriggerBlock | ConditionBlock | BranchTarget;
}

export interface TriggerBlock {
  shortcut: string;
  smartCase: boolean;
  forceCapitalize: boolean;
  /** When true (or omitted if defaulting to true), prevents expansion inside words (e.g. typing "subdata" won't trigger "data"). */
  wordBoundary?: boolean;
  /** When true, groups multiple input tokens in this flow into a single unified form popup. */
  groupInputs?: boolean;
}

export interface ConditionBlock {
  rules: ConditionRule[];
  elseBranch?: BranchTarget;
}

export interface ConditionRule {
  type: 'domain' | 'time' | 'weekday' | 'date' | 'field_type' | 'field_content' | 'clipboard_content' | 'variable_value' | 'time_since_last_expansion';
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
  type: 'domain' | 'time' | 'weekday' | 'date' | 'field_type' | 'field_content' | 'clipboard_content' | 'variable_value' | 'time_since_last_expansion';
  operator: 'equals' | 'contains' | 'not_contains' | 'before' | 'after';
  value: string;
}

/**
 * What a branch (a rule's `action`, or a ConditionBlock's `elseBranch`)
 * ultimately leads to: a leaf ActionBlock (the normal case); another whole
 * ConditionBlock, to support nested conditions; or a RandomBlock, to
 * support choosing between several alternative outputs at random. This
 * recursive union is what lets "Se X, então Se Y, então Z" trees (and "Se
 * X, então (aleatoriamente A ou B)" trees) be built to arbitrary depth
 * while staying 100% backward-compatible with existing saved Flows: an
 * old rule's `action` is always a plain ActionBlock (no `rules`/`options`
 * field), so `isConditionBlock()`/`isRandomBlock()` below correctly treat
 * it as a leaf.
 */
export type BranchTarget = ActionBlock | ConditionBlock | RandomBlock | RepeatBlock;

/** Narrows a BranchTarget to a nested ConditionBlock (as opposed to a leaf ActionBlock). */
export function isConditionBlock(target: BranchTarget | null | undefined): target is ConditionBlock {
  return !!target && Array.isArray((target as ConditionBlock).rules);
}

export interface RepeatBlock {
  type: 'repeat';
  count: number;
  separator?: string;
  target: BranchTarget;
  pos?: { x: number; y: number };
}

/** Narrows a BranchTarget to a RepeatBlock. */
export function isRepeatBlock(target: BranchTarget | null | undefined): target is RepeatBlock {
  return !!target && (target as RepeatBlock).type === 'repeat' && typeof (target as RepeatBlock).count === 'number' && (target as RepeatBlock).target !== undefined;
}

/**
 * A single weighted alternative inside a RandomBlock. `weight` is a
 * percentage (0-100); every option belonging to the same RandomBlock
 * always sums to exactly 100 (see shared/utils/randomWeights.ts). `target`
 * is itself a full BranchTarget — normally a plain ActionBlock, but it can
 * be converted into a nested ConditionBlock or even another nested
 * RandomBlock, exactly like any other branch leaf.
 */
export interface RandomBlockOption {
  id: string;
  weight: number;
  target: BranchTarget;
}

/**
 * "Bloco Aleatório" — an alternative to a plain leaf ActionBlock inside a
 * Condition branch (a rule's `action`, or the `elseBranch`): instead of
 * always running the same action, one of `options` is chosen at random
 * (weighted by each option's `weight`) every time the branch is reached.
 * `type: 'random'` is the discriminant that lets `isRandomBlock()` tell
 * this apart from a plain ActionBlock/ConditionBlock leaf.
 */
export interface RandomBlock {
  type: 'random';
  options: RandomBlockOption[];
  /** When true, avoids picking the exact same option consecutively if there are 2+ options. */
  avoidConsecutive?: boolean;
  /**
   * Free canvas position (in unscaled editor-canvas units) for this
   * block, only meaningful when it is a Nível 3 block detached from a
   * Condition branch (see FlowEditorPage.renderDetachedBranchTarget).
   * Undefined until the user drags it for the first time, at which point
   * the editor assigns a default slot position.
   */
  pos?: { x: number; y: number };
}

/** Narrows a BranchTarget to a RandomBlock (as opposed to a leaf ActionBlock or a ConditionBlock). */
export function isRandomBlock(target: BranchTarget | null | undefined): target is RandomBlock {
  return !!target && (target as RandomBlock).type === 'random' && Array.isArray((target as RandomBlock).options);
}

export interface ActionBlock {
  format: 'plaintext' | 'richtext';
  content: string;
  tokens: Token[];
  /**
   * Free canvas position (in unscaled editor-canvas units), only
   * meaningful when this leaf is a Nível 3 block detached from a
   * Condition branch — see RandomBlock.pos above for the same field.
   */
  pos?: { x: number; y: number };
}

export interface FlowStats {
  usageCount: number;
  lastUsed?: number;
  keysSaved: number;
  /**
   * Times the expansion pipeline threw after a trigger matched (token/
   * variable resolution, injection into the field, etc. — see the
   * `catch` block around handleTrigger() in content.ts). Absent/undefined
   * on flows saved before this existed; treat as 0. Together with
   * `usageCount` (successful completions only — it's incremented from a
   * completely separate code path that only runs *after* injection
   * succeeds) this gives a real success rate instead of an assumed 100%.
   */
  failureCount?: number;
}

export interface Flow {
  id: string;
  name: string;
  blocks: Block[];
  tags: string[];
  folderId?: string;
  enabled: boolean;
  groupInputs?: boolean;
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
  usageCount?: number;
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
  /**
   * Daily count of failed expansion attempts (trigger matched, but the
   * pipeline threw before injection completed) — same shape/bucketing
   * (local calendar day, see localDate.ts) as `analytics` above, which
   * only ever counts successes. Absent on settings saved before this
   * existed; treat as {}.
   */
  analyticsFailures?: Record<string, number>;
  language?: string;
  theme?: string;
  /** Max number of items kept in the clipboard history (default 10, max 50). */
  clipboardHistoryMax?: number;
  searchTrigger: SearchTriggerSettings;
  /** Whether SOTE adds its right-click context menu options (e.g. "Create
   * shortcut from selection"). Defaults to true; the background script
   * removes/recreates the menu whenever this changes. */
  contextMenuEnabled?: boolean;
  /** Default behavior for word boundary when creating new flows (defaults to true). */
  wordBoundaryDefault?: boolean;
  /** Milliseconds to wait before expanding a shortcut when a longer shortcut with the same prefix exists (defaults to 500ms). */
  prefixWaitMs?: number;
  /** When true, exactMatchDelay applies to all shortcuts, not just shortcuts that have longer prefix matches. Default: false for new installs, migrated to true for existing configs with delay. */
  applyDelayToAllShortcuts?: boolean;
  /** Whether the one-time notice about word boundary default has been seen/dismissed. */
  seenWordBoundaryNotice?: boolean;
  /** Whether undo expansion (desfazer expansão) is enabled. Defaults to true. */
  undoEnabled?: boolean;
  /** Duration of the undo window in seconds (0 to 10). Defaults to 5. */
  undoWindowSeconds?: number;
  /** Trigger key to undo expansion: 'backspace', 'ctrl_z', or 'both'. Defaults to 'both'. */
  undoTrigger?: 'backspace' | 'ctrl_z' | 'both';
}

export interface Counter {
  id: string;
  name: string;
  format: string;
  resetRule: 'never' | 'day' | 'month' | 'year';
  startValue: number;
  currentValue: number;
  scope: 'global' | 'site';
  history?: number[];
  step: number;
  padLength: number;
  lastUsedAt?: number;
}

export type SessionScope = 'tab' | 'url' | 'title' | 'global';

export interface SessionVariableEntry {
  value: string;
  savedAt: number;
  ttlHours?: number;
}

export interface InputTokenConfig {
  label: string;
  placeholder?: string;
  rememberValue?: boolean;
  sessionVarName?: string;
  scope?: SessionScope;
  ttlHours?: number;
  autoApply?: boolean;
}

export interface FormField {
  key: string;
  label: string;
  placeholder?: string;
  value?: string;
  prefilled?: boolean;
}

export type SessionData = Record<string, unknown>;

export interface StorageSchema {
  schemaVersion?: number;
  flows: Flow[];
  counters: Counter[];
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