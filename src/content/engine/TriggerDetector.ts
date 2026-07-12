/**
 * src/content/engine/TriggerDetector.ts
 */

import type { Flow, Settings, TriggerBlock, ConditionRule, ConditionCriterion, BranchTarget, ActionBlock } from '../../shared/types/index.js';
import { isConditionBlock } from '../../shared/types/index.js';
import { domainMatchesAny, matchesDomainPattern, normalizeHostLike } from '../../shared/storage/helpers.js';

export interface TriggerMatch {
  flow: Flow;
  shortcutTyped: string;
  isExactMatch: boolean;
}

export class TriggerDetector {
  private flows: Flow[] = [];
  private settings!: Settings;

  public updateData(flows: Flow[], settings: Settings) {
    this.flows = flows;
    this.settings = settings;
  }

  /**
   * Called when a trigger key (Space/Tab/Enter) is pressed.
   * Extracts the last word from the buffer and checks trigger mode shortcuts.
   */
  public detectTriggerMode(buffer: string): TriggerMatch | null {
    if (!this.canTrigger()) return null;
    if (this.settings.triggerMode !== 'trigger') return null;

    // Extract word before cursor (basic implementation: characters since last space/newline)
    const match = buffer.match(/(\S+)$/);
    if (!match) return null;
    const word = match[1];

    for (const flow of this.flows) {
      if (!flow.enabled) continue;
      
      const trigger = this.getTriggerBlock(flow);
      if (!trigger || !trigger.shortcut) continue;

      if (this.matchesShortcut(word, trigger.shortcut, trigger.smartCase) && this.checkConditions(flow)) {
        return { flow, shortcutTyped: word, isExactMatch: false };
      }
    }

    return null;
  }

  /**
   * Compares a typed word against a flow's shortcut, respecting Smart Case.
   * `smartCase` defaults to ON (case-insensitive) when the field is missing
   * or undefined — e.g. for flows saved before this option existed — so the
   * "Matches regardless of letter casing" behaviour always applies unless
   * the user has explicitly turned it off.
   */
  private matchesShortcut(word: string, shortcut: string, smartCase: boolean | undefined): boolean {
    const typed = word.trim();
    const target = shortcut.trim();
    if (smartCase === false) {
      return typed === target;
    }
    return typed.toLowerCase() === target.toLowerCase();
  }

  /**
   * Called on every printable character typed.
   * Checks for exact match shortcuts (exactMatchChar + shortcut).
   */
  public detectExactMatchMode(buffer: string): TriggerMatch | null {
    if (!this.canTrigger()) return null;
    if (this.settings.triggerMode !== 'exact_match') return null;

    for (const flow of this.flows) {
      if (!flow.enabled) continue;
      
      const trigger = this.getTriggerBlock(flow);
      if (!trigger || !trigger.shortcut) continue;

      const prefix = this.settings.exactMatchChar;
      const expected = prefix + trigger.shortcut;

      if (buffer.length < expected.length) continue;
      const tail = buffer.slice(-expected.length);

      if (this.matchesShortcut(tail, expected, trigger.smartCase) && this.checkConditions(flow)) {
        return { flow, shortcutTyped: tail, isExactMatch: true };
      }
    }

    return null;
  }

  private canTrigger(): boolean {
    if (!this.settings || !this.settings.globalEnabled) return false;

    // Check Snooze
    if (this.settings.snoozeUntil && Date.now() < this.settings.snoozeUntil) {
      return false;
    }

    // Check Blocklist (Global) — uses the unified wildcard matcher so
    // patterns like *.google.com, *google*, https://site.com all work.
    if (domainMatchesAny(window.location.hostname, this.settings.blocklist)) {
      return false;
    }

    return true;
  }

  private getTriggerBlock(flow: Flow): TriggerBlock | null {
    const block = flow.blocks.find(b => b.type === 'trigger');
    return block ? (block.data as TriggerBlock) : null;
  }

  private checkConditions(flow: Flow): boolean {
    const conditionBlock = flow.blocks.find(b => b.type === 'condition');
    if (!conditionBlock) return true; // No conditions = always valid

    // Note: To perfectly evaluate condition rules, we would need to check all rules.
    // If we only have Action logic in rules, the conditions dictate WHICH action to run.
    // Wait, the data structure stores the ActionBlock INSIDE the ConditionRule!
    // So the TriggerDetector just confirms if AT LEAST ONE rule passes (or elseBranch exists).
    
    // In our simplified logic: we will just evaluate the first rule that passes and 
    // we'll return the flow. The orchestrator will find the correct ActionBlock.
    return true; 
  }

  /**
   * Evaluates rules to find which ActionBlock to execute. When a rule's
   * `action` (or the `elseBranch`) is itself a nested ConditionBlock
   * rather than a plain ActionBlock, its rules are evaluated in turn —
   * recursing to arbitrary depth — until a leaf ActionBlock is reached.
   */
  public resolveActionBlock(flow: Flow): any {
    const conditionBlock = flow.blocks.find(b => b.type === 'condition');
    if (!conditionBlock) {
      return flow.blocks.find(b => b.type === 'action')?.data;
    }

    return this.resolveBranchTarget(conditionBlock.data as any);
  }

  /**
   * Resolves a ConditionBlock down to the single leaf ActionBlock that
   * matches (or null if nothing matches and there's no elseBranch).
   */
  private resolveBranchTarget(condition: { rules: ConditionRule[]; elseBranch?: BranchTarget }): ActionBlock | null {
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
      let passed = this.evaluateCriterion(rule, hostname, now);

      // Additional "E"/"OU" criteria (see ConditionRule.criteria) — a
      // single AND/OR group evaluated alongside the primary criterion
      // above, all gating the same rule.action.
      if (rule.criteria && rule.criteria.length > 0) {
        const combinator = rule.combinator || 'AND';
        for (const criterion of rule.criteria) {
          const criterionPassed = this.evaluateCriterion(criterion, hostname, now);
          passed = combinator === 'OR' ? (passed || criterionPassed) : (passed && criterionPassed);
        }
      }

      if (passed && rule.action) {
        // A branch's action can either be a plain leaf ActionBlock, or a
        // nested ConditionBlock (further Se/Senão Se/Senão rules) — in
        // which case we recurse into it instead of returning it as-is.
        return isConditionBlock(rule.action) ? this.resolveBranchTarget(rule.action) : rule.action;
      }
    }

    // If no rule passed, fall back to the elseBranch — which may itself
    // be a nested condition rather than a plain action.
    const elseBranch = condition.elseBranch;
    if (!elseBranch) return null;
    return isConditionBlock(elseBranch) ? this.resolveBranchTarget(elseBranch) : elseBranch;
  }

  /**
   * Evaluates a single type/operator/value criterion (a rule's own
   * primary check, or one entry of its `criteria` AND/OR group) against
   * the current page/time. Shared by both so the matching logic — and
   * its legacy-format fallbacks — only lives in one place.
   */
  private evaluateCriterion(criterion: ConditionCriterion, hostname: string, now: Date): boolean {
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
        // value expected as "2024-12-25"
        const todayDate = now.toISOString().split('T')[0];
        passed = todayDate === criterion.value;
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
}
