/**
 * src/content/engine/TriggerDetector.ts
 */

import type { Flow, Settings, TriggerBlock, ActionBlock } from '../../shared/types/index.js';
import { domainMatchesAny } from '../../shared/storage/helpers.js';
import type { ConditionResolverContext } from './ConditionResolver.js';
import { resolveFlowActionBlock } from './ConditionResolver.js';

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

    // Extract word before cursor. \S does not treat U+00A0 (non-breaking
    // space) as a separator, but editors like Gmail/Outlook use &nbsp; between
    // words. Use a negated class that also excludes U+00A0.
    const match = buffer.match(/([^\s\u00A0]+)$/);
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
   * Checks whether the character preceding the shortcut match represents a word boundary.
   */
  private isAtWordBoundary(buffer: string, matchLength: number): boolean {
    if (buffer.length <= matchLength) return true;
    const charBefore = buffer[buffer.length - matchLength - 1];
    // Word boundary: whitespace, non-breaking space, or punctuation / start of string
    return /[\s\u00A0\p{P}\p{S}]/u.test(charBefore);
  }

  /**
   * Called on every printable character typed.
   * Checks for exact match shortcuts (exactMatchChar + shortcut).
   *
   * Picks the LONGEST matching shortcut among all candidates, not just the
   * first one found — matching only checks the tail of the buffer, so a
   * shorter shortcut that happens to be a suffix of a longer one (e.g.
   * "f1" is a suffix of "pf1") would otherwise "match" too and could win
   * purely by being earlier in `this.flows`, even though the longer,
   * more specific shortcut is what was actually typed.
   */
  public detectExactMatchMode(buffer: string): TriggerMatch | null {
    if (!this.canTrigger()) return null;
    if (this.settings.triggerMode !== 'exact_match') return null;

    let best: TriggerMatch | null = null;
    let bestLength = -1;

    for (const flow of this.flows) {
      if (!flow.enabled) continue;
      
      const trigger = this.getTriggerBlock(flow);
      if (!trigger || !trigger.shortcut) continue;

      const prefix = this.settings.exactMatchChar || '';
      const expected = prefix + trigger.shortcut;

      if (buffer.length < expected.length) continue;
      const tail = buffer.slice(-expected.length);

      // Word boundary check: when trigger.wordBoundary is true (or undefined and default is true)
      const requiresWordBoundary = trigger.wordBoundary !== false && (this.settings.wordBoundaryDefault !== false);
      if (requiresWordBoundary && !this.isAtWordBoundary(buffer, expected.length)) {
        continue;
      }

      if (expected.length > bestLength && this.matchesShortcut(tail, expected, trigger.smartCase) && this.checkConditions(flow)) {
        best = { flow, shortcutTyped: tail, isExactMatch: true };
        bestLength = expected.length;
      }
    }

    return best;
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
   * `action` (or the `elseBranch`) is itself a nested ConditionBlock or
   * RandomBlock rather than a plain ActionBlock, it's resolved further —
   * recursing to arbitrary depth — until a leaf ActionBlock is reached.
   * `element` is the field the user was typing in when the shortcut fired
   * — needed to evaluate `field_type`/`field_content` criteria.
   * `shortcutTyped` lets `field_content` exclude the shortcut itself,
   * which is still sitting in the field at this point.
   *
   * The actual resolution logic lives in ConditionResolver.ts, shared with
   * ActionContentResolver.ts's `flow_ref` ("Incluir Fluxo") handling, so an
   * included flow's own condition rules are honored exactly the same way
   * they would be if that flow had been triggered directly.
   */
  public resolveActionBlock(flow: Flow, element: HTMLElement | null | undefined, shortcutTyped?: string, context?: ConditionResolverContext): ActionBlock | null {
    return resolveFlowActionBlock(flow, element, shortcutTyped, context);
  }
}
