/**
 * src/content/engine/TriggerDetector.ts
 */

import type { Flow, Settings, TriggerBlock, ActionBlock } from '../../shared/types/index.js';
import { domainMatchesAny } from '../../shared/storage/helpers.js';
import type { ConditionResolverContext } from './ConditionResolver.js';
import { resolveFlowActionBlock, getFlowConditionMatchScore } from './ConditionResolver.js';

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
   * Ranks candidates by condition specificity and recency.
   */
  public detectTriggerMode(buffer: string, element?: HTMLElement | null): TriggerMatch | null {
    if (!this.canTrigger()) return null;
    if (this.settings.triggerMode !== 'trigger') return null;

    // Extract word before cursor. \S does not treat U+00A0 (non-breaking
    // space) as a separator, but editors like Gmail/Outlook use &nbsp; between
    // words. Use a negated class that also excludes U+00A0.
    const match = buffer.match(/([^\s\u00A0]+)$/);
    if (!match) return null;
    const word = match[1];

    interface CandidateMatch {
      flow: Flow;
      shortcutTyped: string;
      score: number;
      updatedAt: number;
    }

    const candidates: CandidateMatch[] = [];

    for (const flow of this.flows) {
      if (!flow.enabled) continue;
      
      const trigger = this.getTriggerBlock(flow);
      if (!trigger || !trigger.shortcut) continue;

      if (this.matchesShortcut(word, trigger.shortcut, trigger.smartCase)) {
        const score = getFlowConditionMatchScore(flow, element, word);
        if (score !== null) {
          candidates.push({
            flow,
            shortcutTyped: word,
            score,
            updatedAt: flow.updatedAt || flow.createdAt || 0,
          });
        }
      }
    }

    if (candidates.length === 0) return null;

    // Highest condition specificity score wins; break ties with most recently updated flow
    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.updatedAt - a.updatedAt;
    });

    const best = candidates[0];
    return {
      flow: best.flow,
      shortcutTyped: best.shortcutTyped,
      isExactMatch: false,
    };
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
   * Evaluates all matching candidate flows, filtering out flows whose
   * conditions fail in the current context. Candidates are ranked:
   * 1. Longest typed shortcut (more specific prefix typed by user).
   * 2. Highest condition specificity (matching domain condition > other condition > else > unrestricted).
   * 3. Most recently updated flow (recency tie-breaker).
   */
  public detectExactMatchMode(buffer: string, element?: HTMLElement | null): TriggerMatch | null {
    if (!this.canTrigger()) return null;
    if (this.settings.triggerMode !== 'exact_match') return null;

    interface CandidateMatch {
      flow: Flow;
      shortcutTyped: string;
      length: number;
      score: number;
      updatedAt: number;
    }

    const candidates: CandidateMatch[] = [];

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

      if (this.matchesShortcut(tail, expected, trigger.smartCase)) {
        const score = getFlowConditionMatchScore(flow, element, tail);
        if (score !== null) {
          candidates.push({
            flow,
            shortcutTyped: tail,
            length: expected.length,
            score,
            updatedAt: flow.updatedAt || flow.createdAt || 0,
          });
        }
      }
    }

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => {
      if (b.length !== a.length) return b.length - a.length;
      if (b.score !== a.score) return b.score - a.score;
      return b.updatedAt - a.updatedAt;
    });

    const best = candidates[0];
    return {
      flow: best.flow,
      shortcutTyped: best.shortcutTyped,
      isExactMatch: true,
    };
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

  private checkConditions(flow: Flow, element?: HTMLElement | null): boolean {
    return getFlowConditionMatchScore(flow, element) !== null;
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
