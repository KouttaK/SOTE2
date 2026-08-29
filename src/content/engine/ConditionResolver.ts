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
import type { Flow, ConditionRule, ConditionCriterion, BranchTarget, ActionBlock } from '../../shared/types/index.js';
import { isConditionBlock, isRandomBlock } from '../../shared/types/index.js';
import { pickWeightedRandom } from '../../shared/utils/randomWeights.js';
import { localDateKey } from '../../shared/utils/localDate.js';
import { domainMatchesAny, matchesDomainPattern, normalizeHostLike } from '../../shared/storage/helpers.js';
import { getFieldTypeCategory, getFieldContent } from '../../shared/utils/dom.js';

// Re-exported only so existing imports of these from TriggerDetector.ts keep
// working unchanged (see TriggerDetector.ts, which now delegates here).
export { isConditionBlock, isRandomBlock };

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
export function resolveFlowActionBlock(flow: Flow, element: HTMLElement | null | undefined, shortcutTyped?: string): ActionBlock | null {
  const conditionBlock = flow.blocks.find(b => b.type === 'condition');
  if (conditionBlock) {
    return resolveBranchTarget(conditionBlock.data as any, element, shortcutTyped);
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
  return resolveLeaf(actionEntry.data as BranchTarget, element, shortcutTyped);
}

/**
 * Resolves a ConditionBlock down to the single leaf ActionBlock that
 * matches (or null if nothing matches and there's no elseBranch).
 */
export function resolveBranchTarget(condition: { rules: ConditionRule[]; elseBranch?: BranchTarget }, element: HTMLElement | null | undefined, shortcutTyped?: string): ActionBlock | null {
  const rules = condition.rules as ConditionRule[];
  const hostname = window.location.hostname;
  const now = new Date();

  // Most-specific-first: sort a shallow copy by specificity (descending)
  // so rules with more conditions are evaluated before less specific
  // ones. A rule whose own action is itself a nested ConditionBlock
  // outweighs any number of plain AND/OR criteria (the +1000), and beyond
  // that more AND/OR criteria ranks higher still — this prevents a
  // generic rule (e.g. "time between 08-12") from shadowing a more
  // specific one (e.g. "time between 08-12 AND weekday = Fri", or one
  // with its own nested Se/Senão) just because it was created first and
  // therefore sits earlier in the persisted array.
  // This exact formula is duplicated (not shared) in editor.ts's own
  // specificityScore, which sorts rule columns left-to-right for display
  // the same way — keeping the two in sync is what lets "a rule with a
  // nested condition or more AND/OR always renders to the left" also mean
  // "...and is evaluated first", instead of the visual order silently
  // lying about actual priority.
  // The sort is stable (Array.prototype.sort is stable in all modern
  // engines / ES2019+), so rules with equal specificity keep their
  // original relative order — which means the user's creation order (or
  // manual drag-and-drop reordering in the editor) still acts as a
  // tiebreaker.
  const specificityScore = (rule: ConditionRule): number =>
    (isConditionBlock(rule.action) ? 1000 : 0) + (rule.criteria?.length ?? 0);
  const sortedRules = [...rules].sort((a, b) => specificityScore(b) - specificityScore(a));

  for (const rule of sortedRules) {
    let passed = evaluateCriterion(rule, hostname, now, element, shortcutTyped);

    // Additional "E"/"OU" criteria (see ConditionRule.criteria) — a
    // single AND/OR group evaluated alongside the primary criterion
    // above, all gating the same rule.action.
    if (rule.criteria && rule.criteria.length > 0) {
      const combinator = rule.combinator || 'AND';
      for (const criterion of rule.criteria) {
        const criterionPassed = evaluateCriterion(criterion, hostname, now, element, shortcutTyped);
        passed = combinator === 'OR' ? (passed || criterionPassed) : (passed && criterionPassed);
      }
    }

    if (passed && rule.action) {
      // A branch's action can be a plain leaf ActionBlock, a nested
      // ConditionBlock (further Se/Senão Se/Senão rules), or a
      // RandomBlock (one of several alternatives chosen at random) — in
      // either non-leaf case we resolve further instead of returning it
      // as-is.
      return resolveLeaf(rule.action, element, shortcutTyped);
    }
  }

  // If no rule passed, fall back to the elseBranch — which may itself
  // be a nested condition or a Random Block rather than a plain action.
  const elseBranch = condition.elseBranch;
  if (!elseBranch) return null;
  return resolveLeaf(elseBranch, element, shortcutTyped);
}

/**
 * Resolves a single branch target down to a leaf ActionBlock: recurses
 * into nested ConditionBlocks (evaluating their rules in turn), and for
 * a RandomBlock picks one option at random (weighted by each option's
 * `weight`, a percentage that always sums to 100 across the set) and
 * resolves *that* option's own target — which may itself be another
 * nested Condition or Random Block, resolved recursively in turn.
 */
export function resolveLeaf(target: BranchTarget, element: HTMLElement | null | undefined, shortcutTyped?: string): ActionBlock | null {
  if (isConditionBlock(target)) return resolveBranchTarget(target, element, shortcutTyped);
  if (isRandomBlock(target)) {
    const chosen = pickWeightedRandom(target.options);
    if (!chosen) return null;
    return resolveLeaf(chosen.target, element, shortcutTyped);
  }
  return target as ActionBlock;
}

/**
 * Evaluates a single type/operator/value criterion (a rule's own
 * primary check, or one entry of its `criteria` AND/OR group) against
 * the current page/time/focused field. Shared by both so the matching
 * logic — and its legacy-format fallbacks — only lives in one place.
 */
export function evaluateCriterion(criterion: ConditionCriterion, hostname: string, now: Date, element?: HTMLElement | null, shortcutTyped?: string): boolean {
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
