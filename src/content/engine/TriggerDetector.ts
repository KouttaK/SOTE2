/**
 * src/content/engine/TriggerDetector.ts
 */

import type { Flow, Settings, TriggerBlock, ConditionRule } from '../../shared/types/index.js';

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

    // Extract word before cursor (basic implementation: characters since last space/newline)
    const match = buffer.match(/(\S+)$/);
    if (!match) return null;
    const word = match[1];

    for (const flow of this.flows) {
      if (!flow.enabled) continue;
      
      const trigger = this.getTriggerBlock(flow);
      if (!trigger || trigger.mode !== 'trigger') continue;

      // Check case-insensitive if smartCase is on, else exact
      const isMatch = trigger.smartCase
        ? word.toLowerCase() === trigger.shortcut.toLowerCase()
        : word === trigger.shortcut;

      if (isMatch && this.checkConditions(flow)) {
        return { flow, shortcutTyped: word, isExactMatch: false };
      }
    }

    return null;
  }

  /**
   * Called on every printable character typed.
   * Checks for exact match shortcuts (exactMatchChar + shortcut).
   */
  public detectExactMatchMode(buffer: string): TriggerMatch | null {
    if (!this.canTrigger()) return null;

    for (const flow of this.flows) {
      if (!flow.enabled) continue;
      
      const trigger = this.getTriggerBlock(flow);
      if (!trigger || trigger.mode !== 'exact_match') continue;

      const prefix = trigger.exactMatchChar || this.settings.exactMatchChar;
      const expected = prefix + trigger.shortcut;

      if (buffer.length < expected.length) continue;
      const tail = buffer.slice(-expected.length);

      const isMatch = trigger.smartCase
        ? tail.toLowerCase() === expected.toLowerCase()
        : tail === expected;

      if (isMatch && this.checkConditions(flow)) {
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

    // Check Blocklist (Global)
    const hostname = window.location.hostname;
    for (const blocked of this.settings.blocklist) {
      if (hostname.includes(blocked)) return false;
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
   * Evaluates rules to find which ActionBlock to execute.
   */
  public resolveActionBlock(flow: Flow): any {
    const conditionBlock = flow.blocks.find(b => b.type === 'condition');
    if (!conditionBlock) {
      return flow.blocks.find(b => b.type === 'action')?.data;
    }

    const rules = (conditionBlock.data as any).rules as ConditionRule[];
    const hostname = window.location.hostname;
    const now = new Date();

    for (const rule of rules) {
      let passed = false;
      switch (rule.type) {
        case 'domain':
          if (rule.operator === 'equals') passed = hostname === rule.value;
          else if (rule.operator === 'contains') passed = hostname.includes(rule.value);
          break;
        case 'weekday':
          // value expected as comma separated days "1,3,5"
          passed = rule.value.split(',').includes(now.getDay().toString());
          break;
        case 'time':
          // value expected as "08:00,18:00"
          const [startStr, endStr] = rule.value.split(',');
          if (startStr && endStr) {
            const startMins = parseInt(startStr.split(':')[0]) * 60 + parseInt(startStr.split(':')[1]);
            const endMins = parseInt(endStr.split(':')[0]) * 60 + parseInt(endStr.split(':')[1]);
            const nowMins = now.getHours() * 60 + now.getMinutes();
            if (startMins <= endMins) {
              passed = nowMins >= startMins && nowMins <= endMins;
            } else {
              passed = nowMins >= startMins || nowMins <= endMins;
            }
          }
          break;
        case 'date':
          // value expected as "2024-12-25"
          const todayDate = now.toISOString().split('T')[0];
          passed = todayDate === rule.value;
          break;
        default:
          passed = true; // Fallback for unimplemented types
      }

      if (passed && rule.action) {
        return rule.action;
      }
    }

    // If no rule passed, return elseBranch
    return (conditionBlock.data as any).elseBranch || null;
  }
}
