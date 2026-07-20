/**
 * src/content/engine/TriggerDetector.ts
 */

import type { Flow, Settings, TriggerBlock, ActionBlock, Variable } from '../../shared/types/index.js';
import { domainMatchesAny } from '../../shared/storage/helpers.js';
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
   * `action` (or the `elseBranch`) is itself a nested ConditionBlock,
   * RandomBlock, or ScriptBlock rather than a plain ActionBlock, it's
   * resolved further — recursing to arbitrary depth — until a leaf
   * ActionBlock is reached. `element` is the field the user was typing in
   * when the shortcut fired — needed to evaluate `field_type`/
   * `field_content` criteria and to build a Script block's `ctx`.
   * `variables` is likewise needed for that same `ctx`. Async because
   * resolving a Script block means round-tripping to the sandboxed
   * extension page (see ScriptSandbox.ts).
   *
   * The actual resolution logic lives in ConditionResolver.ts, shared with
   * ActionContentResolver.ts's `flow_ref` ("Incluir Fluxo") handling, so an
   * included flow's own condition rules are honored exactly the same way
   * they would be if that flow had been triggered directly.
   */
  public async resolveActionBlock(flow: Flow, element: HTMLElement | null | undefined, variables: Variable[]): Promise<ActionBlock | null> {
    return resolveFlowActionBlock(flow, element, variables);
  }
}
