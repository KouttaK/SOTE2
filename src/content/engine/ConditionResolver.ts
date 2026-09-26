/**
 * src/content/engine/ConditionResolver.ts
 *
 * Resolves a Flow's ConditionBlock (Se/Senão Se/Senão, possibly nested, with
 * Random Block branches too) down to the single leaf ActionBlock that
 * applies right now. This logic used to live only inside TriggerDetector,
 * private to it — extracted here, byte-for-byte unchanged, so it can also
 * be reused by ActionContentResolver when expanding a `flow_ref` token
 * ("Incluir Fluxo"): the included flow's own condition rules (e.g. "only on
 * gmail.com") must still apply when it's pulled in by reference from
 * another flow, exactly as if that flow had been triggered directly.
 */
import type { Flow, ConditionRule, ConditionCriterion, BranchTarget, ActionBlock, RandomBlock, RepeatBlock, Variable, Token } from '../../shared/types/index.js';
import { isConditionBlock, isRandomBlock, isRepeatBlock } from '../../shared/types/index.js';
import { pickWeightedRandom, pickWeightedRandomExcluding } from '../../shared/utils/randomWeights.js';
import { localDateKey } from '../../shared/utils/localDate.js';
import { domainMatchesAny, matchesDomainPattern, normalizeHostLike } from '../../shared/storage/helpers.js';
import { getFieldTypeCategory, getFieldContent } from '../../shared/utils/dom.js';

// Re-exported only so existing imports of these from TriggerDetector.ts keep
// working unchanged (see TriggerDetector.ts, which now delegates here).
export { isConditionBlock, isRandomBlock, isRepeatBlock };

export interface ConditionResolverContext {
  clipboardText?: string;
  variables?: Variable[];
  flow?: Flow;
  lastUsed?: number;
}

// Remembers the last chosen option ID per RandomBlock instance to support `avoidConsecutive`
const lastChosenByBlock = new WeakMap<RandomBlock, string>();

/**
 * Resolves a whole Flow down to the leaf ActionBlock that currently
 * applies: its ConditionBlock's rules if it has one, otherwise its plain
 * Action block. `element` is the field the user was typing in when the
 * shortcut fired (or, for a flow pulled in via `flow_ref`, the same field
 * the *including* flow was triggered from) — needed to evaluate
 * `field_type`/`field_content` criteria. `shortcutTyped` is the shortcut
 * text itself, so `field_content` can exclude it (see getFieldContent) —
 * at resolution time it's still sitting in the field, TextInjector only
 * removes it afterwards.
 */
export function resolveFlowActionBlock(
  flow: Flow,
  element: HTMLElement | null | undefined,
  shortcutTyped?: string,
  context?: ConditionResolverContext | Variable[],
  variables?: Variable[]
): ActionBlock | null {
  const ctx: ConditionResolverContext = Array.isArray(context)
    ? { variables: context, flow }
    : { ...context, flow: context?.flow ?? flow, variables: context?.variables ?? variables };

  const conditionBlock = flow.blocks.find(b => b.type === 'condition');
  if (conditionBlock) {
    return resolveBranchTarget(conditionBlock.data as any, element, shortcutTyped, ctx);
  }

  // No dedicated Condition step: the top-level 'action' block's data is
  // itself a full BranchTarget now (see Block's doc comment in
  // shared/types/index.ts) — usually a plain leaf ActionBlock, but it can
  // also be a nested ConditionBlock or a RandomBlock if the user added one
  // via the unified "+ Adicionar Bloco" menu without a dedicated Condition
  // step. resolveLeaf() handles both, exactly like it does for any other
  // branch's own target.
  const actionEntry = flow.blocks.find(b => b.type === 'action');
  if (!actionEntry) return null;
  return resolveLeaf(actionEntry.data as BranchTarget, element, shortcutTyped, ctx);
}

/**
 * Resolves a ConditionBlock down to the single leaf ActionBlock that
 * matches (or null if nothing matches and there's no elseBranch).
 */
export function resolveBranchTarget(
  condition: { rules: ConditionRule[]; elseBranch?: BranchTarget },
  element: HTMLElement | null | undefined,
  shortcutTyped?: string,
  context?: ConditionResolverContext | Variable[],
  variables?: Variable[]
): ActionBlock | null {
  const ctx: ConditionResolverContext = Array.isArray(context)
    ? { variables: context }
    : { ...context, variables: context?.variables ?? variables };

  const rules = condition.rules as ConditionRule[];
  const hostname = typeof window !== 'undefined' && window.location ? window.location.hostname : '';
  const now = new Date();

  for (const rule of rules) {
    let passed = evaluateCriterion(rule, hostname, now, element, shortcutTyped, ctx);

    // Additional "E"/"OU" criteria (see ConditionRule.criteria) — a
    // single AND/OR group evaluated alongside the primary criterion
    // above, all gating the same rule.action.
    if (rule.criteria && rule.criteria.length > 0) {
      const combinator = rule.combinator || 'AND';
      for (const criterion of rule.criteria) {
        const criterionPassed = evaluateCriterion(criterion, hostname, now, element, shortcutTyped, ctx);
        passed = combinator === 'OR' ? (passed || criterionPassed) : (passed && criterionPassed);
      }
    }

    if (passed && rule.action) {
      // A branch's action can be a plain leaf ActionBlock, a nested
      // ConditionBlock (further Se/Senão Se/Senão rules), or a
      // RandomBlock (one of several alternatives chosen at random) — in
      // either non-leaf case we resolve further instead of returning it
      // as-is.
      return resolveLeaf(rule.action, element, shortcutTyped, ctx);
    }
  }

  // If no rule passed, fall back to the elseBranch — which may itself
  // be a nested condition or a Random Block rather than a plain action.
  const elseBranch = condition.elseBranch;
  if (!elseBranch) return null;
  return resolveLeaf(elseBranch, element, shortcutTyped, ctx);
}

/**
 * Resolves a single branch target down to a leaf ActionBlock: recurses
 * into nested ConditionBlocks (evaluating their rules in turn), and for
 * a RandomBlock picks one option at random (weighted by each option's
 * `weight`, a percentage that always sums to 100 across the set) and
 * resolves *that* option's own target — which may itself be another
 * nested Condition or Random Block, resolved recursively in turn.
 */
export function resolveLeaf(
  target: BranchTarget,
  element: HTMLElement | null | undefined,
  shortcutTyped?: string,
  context?: ConditionResolverContext | Variable[],
  variables?: Variable[]
): ActionBlock | null {
  const ctx: ConditionResolverContext = Array.isArray(context)
    ? { variables: context }
    : { ...context, variables: context?.variables ?? variables };

  if (isConditionBlock(target)) return resolveBranchTarget(target, element, shortcutTyped, ctx);
  if (isRandomBlock(target)) {
    let chosen: any = null;
    if (target.avoidConsecutive) {
      const lastId = lastChosenByBlock.get(target) ?? (target as any)._lastChosenId;
      chosen = pickWeightedRandomExcluding(target.options, lastId);
    } else {
      chosen = pickWeightedRandom(target.options);
    }
    if (!chosen) return null;
    if (target.avoidConsecutive && chosen.id) {
      lastChosenByBlock.set(target, chosen.id);
      try { (target as any)._lastChosenId = chosen.id; } catch { /* ignore if frozen */ }
    }
    return resolveLeaf(chosen.target, element, shortcutTyped, ctx);
  }
  if (isRepeatBlock(target)) {
    const leaf = resolveLeaf(target.target, element, shortcutTyped, ctx);
    if (!leaf) return null;
    const count = Math.max(1, Math.min(100, Number.isFinite(target.count) ? Math.floor(target.count) : 1));
    const separator = target.separator ?? '';

    if (count === 1) {
      return {
        format: leaf.format,
        content: leaf.content,
        tokens: (leaf.tokens || []).map((t) => ({
          ...t,
          sourceTokenId: (t as any).sourceTokenId || t.id,
          counterGroupId: (t.config as any)?.counterGroupId || t.id,
        })),
        pos: leaf.pos,
      };
    }

    const replicatedContent: string[] = [];
    const consolidatedTokens: Token[] = [];

    for (let i = 0; i < count; i++) {
      let currentContent = leaf.content;
      const tokenMap = new Map<string, string>();

      if (leaf.tokens && leaf.tokens.length > 0) {
        for (const t of leaf.tokens) {
          const newId = i === 0 ? t.id : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `tok_${Date.now()}_${Math.random()}`);
          tokenMap.set(t.id, newId);
          const config = t.config ? JSON.parse(JSON.stringify(t.config)) : {};
          const sourceTokenId = (t as any).sourceTokenId || t.id;
          const counterGroupId = (t.config as any)?.counterGroupId || t.id;
          config.counterGroupId = counterGroupId;

          consolidatedTokens.push({
            ...t,
            id: newId,
            sourceTokenId,
            counterGroupId,
            config,
          } as Token);
        }

        if (i > 0) {
          for (const [oldId, newId] of tokenMap.entries()) {
            currentContent = currentContent.replaceAll(`data-token-id="${oldId}"`, `data-token-id="${newId}"`);
          }
        }
      }

      replicatedContent.push(currentContent);
    }

    return {
      format: leaf.format,
      content: replicatedContent.join(separator),
      tokens: consolidatedTokens,
      pos: leaf.pos,
    };
  }
  return target as ActionBlock;
}

/**
 * Evaluates a single type/operator/value criterion (a rule's own
 * primary check, or one entry of its `criteria` AND/OR group) against
 * the current page/time/focused field. Shared by both so the matching
 * logic — and its legacy-format fallbacks — only lives in one place.
 */
export function evaluateCriterion(
  criterion: ConditionCriterion,
  hostname: string,
  now: Date,
  element?: HTMLElement | null,
  shortcutTyped?: string,
  context?: ConditionResolverContext | Variable[],
  variables?: Variable[]
): boolean {
  const ctx: ConditionResolverContext = Array.isArray(context)
    ? { variables: context }
    : { ...context, variables: context?.variables ?? variables };

  let passed = false;
  switch (criterion.type) {
    case 'domain': {
      // 'equals' uses the unified wildcard matcher (anchored, supports
      // *.google.com, *google*, https://site.com etc.).
      // 'contains' / 'not_contains' keep substring semantics — but a
      // person typing `*.google.com` into a "contém" field (natural
      // instinct, since 'equals' supports wildcards) would otherwise
      // never match anything: hostnames never literally contain the `*`
      // character, so leaving it in made 'contains' always false and
      // 'not_contains' always true. Stripping it makes `*.google.com`
      // behave as `.google.com` here — a plain, forgiving substring.
      const normValue = normalizeHostLike(criterion.value).replace(/\*/g, '');
      if (criterion.operator === 'equals') passed = matchesDomainPattern(hostname, criterion.value);
      else if (criterion.operator === 'contains') passed = normValue.length > 0 && hostname.includes(normValue);
      else if (criterion.operator === 'not_contains') passed = normValue.length === 0 || !hostname.includes(normValue);
      break;
    }
    case 'weekday': {
      // New format: JSON { op: 'is'|'is_not', days: ['Mon','Tue',...] }
      // Legacy format: comma-separated indices "0,1,2"
      const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const today = dayMap[now.getDay()];
      let weekdayParsed: { op: string; days: string[] } | null = null;
      try { weekdayParsed = JSON.parse(criterion.value); } catch { /* */ }
      if (weekdayParsed && Array.isArray(weekdayParsed.days)) {
        const included = weekdayParsed.days.includes(today);
        passed = weekdayParsed.op === 'is_not' ? !included : included;
      } else {
        // Legacy: comma-separated day indices
        passed = criterion.value.split(',').includes(now.getDay().toString());
      }
      break;
    }
    case 'time': {
      // New format: JSON { op: 'between'|'before'|'after', from?, to?, at? }
      // Legacy format: "08:00,18:00"
      const toMin = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
      const nowMins = now.getHours() * 60 + now.getMinutes();
      let timeParsed: { op: string; from?: string; to?: string; at?: string } | null = null;
      try { timeParsed = JSON.parse(criterion.value); } catch { /* */ }
      if (timeParsed && timeParsed.op) {
        if (timeParsed.op === 'between' && timeParsed.from && timeParsed.to) {
          const f = toMin(timeParsed.from), t = toMin(timeParsed.to);
          passed = f <= t ? nowMins >= f && nowMins <= t : nowMins >= f || nowMins <= t;
        } else if (timeParsed.op === 'before' && timeParsed.at) {
          passed = nowMins < toMin(timeParsed.at);
        } else if (timeParsed.op === 'after' && timeParsed.at) {
          passed = nowMins > toMin(timeParsed.at);
        }
      } else {
        // Legacy: "08:00,18:00"
        const [startStr, endStr] = criterion.value.split(',');
        if (startStr && endStr) {
          const startMins = toMin(startStr), endMins = toMin(endStr);
          if (startMins <= endMins) {
            passed = nowMins >= startMins && nowMins <= endMins;
          } else {
            passed = nowMins >= startMins || nowMins <= endMins;
          }
        }
      }
      break;
    }
    case 'date': {
      // value expected as "2024-12-25", meant as the viewer's own
      // calendar day — must compare against the LOCAL date, not UTC
      // (toISOString() converts to UTC first, which silently rolls over
      // to tomorrow's date for several hours every evening in Brazil).
      const todayDate = localDateKey(now);
      passed = todayDate === criterion.value;
      break;
    }
    case 'field_type': {
      // value is one of the FieldTypeCategory buckets (email, password,
      // tel, number, url, search, textarea, contenteditable, text) — see
      // getFieldTypeCategory(). Only 'equals' ("É")/'not_contains'
      // ("Não é") are meaningful here; anything else falls back to
      // 'equals', same as the editor's dropdown only offering those two.
      const category = getFieldTypeCategory(element);
      passed = criterion.operator === 'not_contains' ? category !== criterion.value : category === criterion.value;
      break;
    }
    case 'field_content': {
      // Checks what's already typed in the focused field — e.g. "if the
      // field already contains 'Prezado', don't repeat the greeting".
      const content = getFieldContent(element, shortcutTyped);
      const target = criterion.value || '';
      if (criterion.operator === 'not_contains') passed = !content.includes(target);
      else if (criterion.operator === 'equals') passed = content.trim() === target.trim();
      else passed = content.includes(target); // default: 'contains'
      break;
    }
    case 'clipboard_content': {
      // Validates whether clipboard text satisfies equals, contains, or not_contains
      let clipText = ctx.clipboardText;
      if (clipText === undefined && element) {
        clipText = (element as any)._clipboardText ?? (element as any).clipboardText;
      }
      if (clipText === undefined && typeof document !== 'undefined' && document.activeElement) {
        clipText = (document.activeElement as any)._clipboardText ?? (document.activeElement as any).clipboardText;
      }
      clipText = clipText ?? '';
      const target = criterion.value || '';
      if (criterion.operator === 'equals') passed = clipText.trim() === target.trim();
      else if (criterion.operator === 'not_contains') passed = !clipText.includes(target);
      else passed = clipText.includes(target); // default: 'contains'
      break;
    }
    case 'variable_value': {
      // Validates if a global variable satisfies the criterion.
      // Criterion value can be "KEY:VALOR" or JSON { key, val } / { key, value }.
      let varKey = '';
      let targetVal = '';
      try {
        const parsed = JSON.parse(criterion.value);
        if (parsed && typeof parsed === 'object') {
          varKey = parsed.key || '';
          targetVal = parsed.val ?? parsed.value ?? '';
        }
      } catch {
        const colonIdx = criterion.value.indexOf(':');
        if (colonIdx !== -1) {
          varKey = criterion.value.slice(0, colonIdx).trim();
          targetVal = criterion.value.slice(colonIdx + 1);
        } else {
          varKey = criterion.value.trim();
          targetVal = '';
        }
      }

      const vars = ctx.variables ?? [];
      const matched = vars.find((v) => v.key === varKey);
      const actualVal = matched ? (matched.value ?? '') : '';

      if (criterion.operator === 'equals') passed = actualVal.trim() === targetVal.trim();
      else if (criterion.operator === 'not_contains') passed = !actualVal.includes(targetVal);
      else passed = actualVal.includes(targetVal); // default: 'contains'
      break;
    }
    case 'time_since_last_expansion': {
      // Compares elapsed time (in minutes) since flow.stats.lastUsed with criterion.value
      const lastUsed = ctx.lastUsed ?? ctx.flow?.stats?.lastUsed;
      const thresholdMinutes = parseFloat(criterion.value) || 0;
      if (lastUsed === undefined || lastUsed === null || isNaN(Number(lastUsed))) {
        // Never expanded: passes for 'after' (more than X min ago), fails for 'before'
        passed = criterion.operator === 'after';
      } else {
        const elapsedMinutes = (now.getTime() - Number(lastUsed)) / (1000 * 60);
        if (criterion.operator === 'before') {
          passed = elapsedMinutes < thresholdMinutes;
        } else {
          // default: 'after'
          passed = elapsedMinutes > thresholdMinutes;
        }
      }
      break;
    }
    default:
      // Fail closed: an unrecognized rule type must never be treated as
      // a pass. Previously this defaulted to `true`, which meant any
      // rule type the evaluator didn't know about (a typo, a future
      // type not yet implemented here, corrupted data, etc.) would
      // silently let its action run — the opposite of what a safety/
      // gating rule is supposed to do.
      console.warn(`[SOTE] Unrecognized condition rule type "${criterion.type}" — treating as not passed.`);
      passed = false;
  }
  return passed;
}

// `domainMatchesAny` isn't used directly in this module (TriggerDetector
// still uses it for the global blocklist check) but is re-exported so any
// future consumer of this module doesn't need a second import path for it.
export { domainMatchesAny };
