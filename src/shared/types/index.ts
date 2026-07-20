export type TriggerMode = 'trigger' | 'exact_match';

export interface Token {
  id: string;
  type: 'choice' | 'cursor' | 'clipboard' | 'input' | 'date' | 'url' | 'title' | 'random' | 'flow_ref';
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
   * | RandomBlock | ScriptBlock), not just a plain ActionBlock. This is what
   * lets the
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
 * ultimately leads to: a leaf ActionBlock (the normal case); another whole
 * ConditionBlock, to support nested conditions; a RandomBlock, to support
 * choosing between several alternative outputs at random; or a
 * ScriptBlock, to compute the output with arbitrary sandboxed JS instead
 * of a fixed rule/text. This recursive union is what lets "Se X, então Se
 * Y, então Z" trees (and "Se X, então (aleatoriamente A ou B)", and "Se X,
 * então (calcular via script)" trees) be built to arbitrary depth while
 * staying 100% backward-compatible with existing saved Flows: an old
 * rule's `action` is always a plain ActionBlock (no `rules`/`options`/
 * `code` field), so `isConditionBlock()`/`isRandomBlock()`/`isScriptBlock()`
 * below correctly treat it as a leaf.
 */
export type BranchTarget = ActionBlock | ConditionBlock | RandomBlock | ScriptBlock;

/** Narrows a BranchTarget to a nested ConditionBlock (as opposed to a leaf ActionBlock). */
export function isConditionBlock(target: BranchTarget | null | undefined): target is ConditionBlock {
  return !!target && Array.isArray((target as ConditionBlock).rules);
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
}

/** Narrows a BranchTarget to a RandomBlock (as opposed to a leaf ActionBlock or a ConditionBlock). */
export function isRandomBlock(target: BranchTarget | null | undefined): target is RandomBlock {
  return !!target && (target as RandomBlock).type === 'random' && Array.isArray((target as RandomBlock).options);
}

/**
 * "Bloco de Script/Fórmula" — an alternative to a plain leaf ActionBlock
 * (or to Condition's fixed rules) that computes its own text output via
 * arbitrary JS instead: formatting a number, building a conditional
 * string more elaborate than Condition's rules can express, etc. `code` is
 * the BODY of a function (write `return ...;`, not a full function
 * declaration) — it's run as `new Function('ctx', code)(ctx)` inside a
 * fully isolated extension page (see content/engine/ScriptSandbox.ts and
 * src/sandbox/main.ts), never in the content script's own context, so it
 * can never touch the visited page's DOM/cookies or any browser.*
 * extension API — its only inputs are whatever's in `ctx` (Global
 * Variables, hostname, current date/time, the focused field's type and
 * current content) and its only output is the string it returns, which
 * becomes this leaf's action content. `type: 'script'` is the discriminant
 * that lets `isScriptBlock()` tell this apart from every other leaf type.
 */
export interface ScriptBlock {
  type: 'script';
  code: string;
}

/** Narrows a BranchTarget to a ScriptBlock (as opposed to any other leaf type). */
export function isScriptBlock(target: BranchTarget | null | undefined): target is ScriptBlock {
  return !!target && (target as ScriptBlock).type === 'script' && typeof (target as ScriptBlock).code === 'string';
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