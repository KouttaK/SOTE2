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
import type { Flow, ConditionRule, ConditionCriterion, BranchTarget, ActionBlock, Variable } from '../../shared/types/index.js';
import { isConditionBlock, isRandomBlock, isScriptBlock } from '../../shared/types/index.js';
import { pickWeightedRandom } from '../../shared/utils/randomWeights.js';
import { localDateKey } from '../../shared/utils/localDate.js';
import { domainMatchesAny, matchesDomainPattern, normalizeHostLike } from '../../shared/storage/helpers.js';
import { getFieldTypeCategory, getFieldContent } from '../../shared/utils/dom.js';
import { runScript, ScriptContext } from './ScriptSandbox.js';

// Re-exported only so existing imports of these from TriggerDetector.ts keep
// working unchanged (see TriggerDetector.ts, which now delegates here).
export { isConditionBlock, isRandomBlock, isScriptBlock };

/**
 * Resolves a whole Flow down to the leaf ActionBlock that currently
 * applies: its ConditionBlock's rules if it has one, otherwise its plain
 * Action block. `element` is the field the user was typing in when the
 * shortcut fired (or, for a flow pulled in via `flow_ref`, the same field
 * the *including* flow was triggered from) — needed to evaluate
 * `field_type`/`field_content` criteria and, now, to build the `ctx` a
 * Script block's code runs against. `variables` is likewise needed for
 * that same `ctx` (see ScriptContext) — resolution is async now because
 * running a Script block's code means round-tripping to the sandboxed
 * extension page (see ScriptSandbox.ts).
 */
export async function resolveFlowActionBlock(flow: Flow, element: HTMLElement | null | undefined, variables: Variable[]): Promise<ActionBlock | null> {
  const conditionBlock = flow.blocks.find(b => b.type === 'condition');
  if (conditionBlock) {
    return resolveBranchTarget(conditionBlock.data as any, element, variables);
  }

  // No dedicated Condition step: the top-level 'action' block's data is
  // itself a full BranchTarget now (see Block's doc comment in
  // shared/types/index.ts) — usually a plain leaf ActionBlock, but it can
  // also be a nested ConditionBlock, a RandomBlock, or a ScriptBlock if
  // the user added one via the unified "+ Adicionar Bloco" menu without a
  // dedicated Condition step. resolveLeaf() handles all of these, exactly
  // like it does for any other branch's own target.
  const actionEntry = flow.blocks.find(b => b.type === 'action');
  if (!actionEntry) return null;
  return resolveLeaf(actionEntry.data as BranchTarget, element, variables);
}

/**
 * Resolves a ConditionBlock down to the single leaf ActionBlock that
 * matches (or null if nothing matches and there's no elseBranch).
 */
export async function resolveBranchTarget(condition: { rules: ConditionRule[]; elseBranch?: BranchTarget }, element: HTMLElement | null | undefined, variables: Variable[]): Promise<ActionBlock | null> {
  const rules = condition.rules as ConditionRule[];
  const hostname = window.location.hostname;
  const now = new Date();

  // Most-specific-first: sort a shallow copy by number of criteria
  // (descending) so rules with more conditions are evaluated before
  // less specific ones.  This prevents a generic rule (e.g. "time
  // between 08-12") from shadowing a more specific one (e.g. "time
  // between 08-12 AND weekday = Fri") just because it was created
  // first and therefore sits earlier in the persisted array.
  // The sort is stable (Array.prototype.sort is stable in all modern
  // engines / ES2019+), so rules with equal specificity keep their
  // original relative order — which means the user's creation order
  // still acts as a tiebreaker.
  const sortedRules = [...rules].sort((a, b) => {
    const scoreA = 1 + (a.criteria?.length ?? 0);
    const scoreB = 1 + (b.criteria?.length ?? 0);
    return scoreB - scoreA;
  });

  for (const rule of sortedRules) {
    let passed = evaluateCriterion(rule, hostname, now, element);

    // Additional "E"/"OU" criteria (see ConditionRule.criteria) — a
    // single AND/OR group evaluated alongside the primary criterion
    // above, all gating the same rule.action.
    if (rule.criteria && rule.criteria.length > 0) {
      const combinator = rule.combinator || 'AND';
      for (const criterion of rule.criteria) {
        const criterionPassed = evaluateCriterion(criterion, hostname, now, element);
        passed = combinator === 'OR' ? (passed || criterionPassed) : (passed && criterionPassed);
      }
    }

    if (passed && rule.action) {
      // A branch's action can be a plain leaf ActionBlock, a nested
      // ConditionBlock (further Se/Senão Se/Senão rules), a RandomBlock
      // (one of several alternatives chosen at random), or a ScriptBlock
      // (its output computed by sandboxed JS) — in every non-leaf case we
      // resolve further instead of returning it as-is.
      return resolveLeaf(rule.action, element, variables);
    }
  }

  // If no rule passed, fall back to the elseBranch — which may itself
  // be a nested condition, Random Block, or Script Block rather than a
  // plain action.
  const elseBranch = condition.elseBranch;
  if (!elseBranch) return null;
  return resolveLeaf(elseBranch, element, variables);
}

/**
 * Resolves a single branch target down to a leaf ActionBlock: recurses
 * into nested ConditionBlocks (evaluating their rules in turn); for a
 * RandomBlock picks one option at random (weighted by each option's
 * `weight`, a percentage that always sums to 100 across the set) and
 * resolves *that* option's own target; and for a ScriptBlock, runs its
 * sandboxed code (see ScriptSandbox.ts) and synthesizes a plain leaf
 * ActionBlock from whatever string it returns. Every case may itself be
 * another nested Condition/Random/Script Block, resolved recursively in
 * turn.
 */
export async function resolveLeaf(target: BranchTarget, element: HTMLElement | null | undefined, variables: Variable[]): Promise<ActionBlock | null> {
  if (isConditionBlock(target)) return resolveBranchTarget(target, element, variables);
  if (isRandomBlock(target)) {
    const chosen = pickWeightedRandom(target.options);
    if (!chosen) return null;
    return resolveLeaf(chosen.target, element, variables);
  }
  if (isScriptBlock(target)) {
    const ctx: ScriptContext = {
      variables: Object.fromEntries(variables.map((v) => [v.key, v.value])),
      hostname: window.location.hostname,
      now: new Date().toISOString(),
      fieldType: getFieldTypeCategory(element),
      fieldContent: getFieldContent(element),
    };
    const result = await runScript(target.code, ctx);
    if (!result.ok) {
      // Fail soft: a broken script expands to nothing (logged for the
      // person to notice/debug) rather than breaking the whole flow.
      console.warn(`[SOTE] Script block failed: ${result.error}`);
      return { format: 'plaintext', content: '', tokens: [] };
    }
    return { format: 'plaintext', content: result.value, tokens: [] };
  }
  return target as ActionBlock;
}

/**
 * Evaluates a single type/operator/value criterion (a rule's own
 * primary check, or one entry of its `criteria` AND/OR group) against
 * the current page/time/focused field. Shared by both so the matching
 * logic — and its legacy-format fallbacks — only lives in one place.
 */
export function evaluateCriterion(criterion: ConditionCriterion, hostname: string, now: Date, element?: HTMLElement | null): boolean {
  let passed = false;
  switch (criterion.type) {
    case 'domain': {
      // 'equals' uses the unified wildcard matcher (anchored, supports
      // *.google.com, *google*, https://site.com etc.).
      // 'contains' / 'not_contains' keep substring semantics but
      // normalise the value so pasted URLs (with protocol/port/path)
      // still work as expected.
      const normValue = normalizeHostLike(criterion.value);
      if (criterion.operator === 'equals') passed = matchesDomainPattern(hostname, criterion.value);
      else if (criterion.operator === 'contains') passed = hostname.includes(normValue);
      else if (criterion.operator === 'not_contains') passed = !hostname.includes(normValue);
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
      const content = getFieldContent(element);
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
