/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { resolveBranchTarget, resolveLeaf, evaluateCriterion } from './ConditionResolver';
import type { ConditionBlock, ConditionRule, ConditionCriterion } from '../../shared/types/index';

vi.mock('dompurify', () => {
  return {
    default: {
      addHook: vi.fn(),
      sanitize: vi.fn(val => val),
    }
  };
});

describe('ConditionResolver', () => {
  describe('Multiple true conditions', () => {
    it('evaluates rules in strict array order, stopping at the first true condition', () => {
      const rule1: ConditionRule = {
        action: { type: 'action', data: { tokens: [], content: 'Result 1' } },
        type: 'domain',
        operator: 'equals',
        value: 'never-matches.com',
        criteria: []
      };
      
      const rule2: ConditionRule = {
        action: { type: 'action', data: { tokens: [], content: 'Result 2' } },
        type: 'domain',
        operator: 'equals',
        value: window.location.hostname || 'localhost', // TRUE
        criteria: []
      };

      const rule3: ConditionRule = {
        action: { type: 'action', data: { tokens: [], content: 'Result 3' } },
        type: 'domain',
        operator: 'equals',
        value: window.location.hostname || 'localhost', // TRUE
        criteria: []
      };

      const block: ConditionBlock = {
        type: 'condition',
        data: {
          rules: [rule1, rule2, rule3]
        }
      };

      const result = resolveBranchTarget(block.data, '', null);
      
      expect(result).toEqual(rule2.action);
    });

    it('executes rule2 if rule1 is false', () => {
      const rule1: ConditionRule = {
        action: { type: 'action', data: { tokens: [], content: 'Result 1' } },
        type: 'domain',
        operator: 'equals',
        value: 'never-matches.com',
        criteria: []
      };
      
      const rule2: ConditionRule = {
        action: { type: 'action', data: { tokens: [], content: 'Result 2' } },
        type: 'domain',
        operator: 'equals',
        value: window.location.hostname || 'localhost',
        criteria: []
      };

      const block: ConditionBlock = {
        type: 'condition',
        data: {
          rules: [rule1, rule2]
        }
      };

      const result = resolveBranchTarget(block.data, '', null);
      
      expect(result).toBe(rule2.action);
    });
  });

  describe('New criteria: clipboard_content', () => {
    const dummyDate = new Date();

    it('validates equals correctly', () => {
      const criterion: ConditionCriterion = {
        type: 'clipboard_content',
        operator: 'equals',
        value: 'Hello World',
      };

      expect(evaluateCriterion(criterion, 'localhost', dummyDate, null, '', { clipboardText: 'Hello World' })).toBe(true);
      expect(evaluateCriterion(criterion, 'localhost', dummyDate, null, '', { clipboardText: ' Hello World ' })).toBe(true);
      expect(evaluateCriterion(criterion, 'localhost', dummyDate, null, '', { clipboardText: 'Different' })).toBe(false);
    });

    it('validates contains and not_contains correctly', () => {
      const containsCriterion: ConditionCriterion = {
        type: 'clipboard_content',
        operator: 'contains',
        value: 'order-123',
      };
      const notContainsCriterion: ConditionCriterion = {
        type: 'clipboard_content',
        operator: 'not_contains',
        value: 'order-123',
      };

      expect(evaluateCriterion(containsCriterion, 'localhost', dummyDate, null, '', { clipboardText: 'Invoice for order-123 paid' })).toBe(true);
      expect(evaluateCriterion(containsCriterion, 'localhost', dummyDate, null, '', { clipboardText: 'Invoice for order-999 paid' })).toBe(false);

      expect(evaluateCriterion(notContainsCriterion, 'localhost', dummyDate, null, '', { clipboardText: 'Invoice for order-999 paid' })).toBe(true);
      expect(evaluateCriterion(notContainsCriterion, 'localhost', dummyDate, null, '', { clipboardText: 'Invoice for order-123 paid' })).toBe(false);
    });

    it('falls back to element._clipboardText if context.clipboardText is not provided', () => {
      const criterion: ConditionCriterion = {
        type: 'clipboard_content',
        operator: 'equals',
        value: 'Copied from element',
      };
      const element = document.createElement('div') as any;
      element._clipboardText = 'Copied from element';

      expect(evaluateCriterion(criterion, 'localhost', dummyDate, element)).toBe(true);
    });
  });

  describe('New criteria: variable_value', () => {
    const dummyDate = new Date();
    const variables = [
      { id: '1', key: 'ROLE', value: 'admin' },
      { id: '2', key: 'COMPANY', value: 'Acme Corp' },
    ];

    it('evaluates variable_value with KEY:VALOR syntax', () => {
      const equalsRule: ConditionCriterion = {
        type: 'variable_value',
        operator: 'equals',
        value: 'ROLE:admin',
      };
      const notEqualsRule: ConditionCriterion = {
        type: 'variable_value',
        operator: 'equals',
        value: 'ROLE:user',
      };
      const containsRule: ConditionCriterion = {
        type: 'variable_value',
        operator: 'contains',
        value: 'COMPANY:Acme',
      };
      const notContainsRule: ConditionCriterion = {
        type: 'variable_value',
        operator: 'not_contains',
        value: 'COMPANY:Google',
      };

      expect(evaluateCriterion(equalsRule, 'localhost', dummyDate, null, '', { variables })).toBe(true);
      expect(evaluateCriterion(notEqualsRule, 'localhost', dummyDate, null, '', { variables })).toBe(false);
      expect(evaluateCriterion(containsRule, 'localhost', dummyDate, null, '', { variables })).toBe(true);
      expect(evaluateCriterion(notContainsRule, 'localhost', dummyDate, null, '', { variables })).toBe(true);
    });

    it('evaluates variable_value with JSON { key, val } syntax', () => {
      const jsonRule: ConditionCriterion = {
        type: 'variable_value',
        operator: 'equals',
        value: JSON.stringify({ key: 'ROLE', val: 'admin' }),
      };
      const jsonMismatch: ConditionCriterion = {
        type: 'variable_value',
        operator: 'equals',
        value: JSON.stringify({ key: 'ROLE', val: 'editor' }),
      };

      expect(evaluateCriterion(jsonRule, 'localhost', dummyDate, null, '', { variables })).toBe(true);
      expect(evaluateCriterion(jsonMismatch, 'localhost', dummyDate, null, '', { variables })).toBe(false);
    });

    it('handles non-existent variables safely', () => {
      const nonExistent: ConditionCriterion = {
        type: 'variable_value',
        operator: 'equals',
        value: 'MISSING:test',
      };
      expect(evaluateCriterion(nonExistent, 'localhost', dummyDate, null, '', { variables })).toBe(false);
    });
  });

  describe('New criteria: time_since_last_expansion', () => {
    it('evaluates after and before based on elapsed minutes', () => {
      const now = new Date('2026-09-25T12:00:00Z');
      const tenMinutesAgo = new Date('2026-09-25T11:50:00Z').getTime();

      const afterFiveMin: ConditionCriterion = {
        type: 'time_since_last_expansion',
        operator: 'after',
        value: '5',
      };
      const afterFifteenMin: ConditionCriterion = {
        type: 'time_since_last_expansion',
        operator: 'after',
        value: '15',
      };
      const beforeFifteenMin: ConditionCriterion = {
        type: 'time_since_last_expansion',
        operator: 'before',
        value: '15',
      };
      const beforeFiveMin: ConditionCriterion = {
        type: 'time_since_last_expansion',
        operator: 'before',
        value: '5',
      };

      // 10 minutes elapsed:
      // > 5 min -> true
      expect(evaluateCriterion(afterFiveMin, 'localhost', now, null, '', { lastUsed: tenMinutesAgo })).toBe(true);
      // > 15 min -> false
      expect(evaluateCriterion(afterFifteenMin, 'localhost', now, null, '', { lastUsed: tenMinutesAgo })).toBe(false);
      // < 15 min -> true
      expect(evaluateCriterion(beforeFifteenMin, 'localhost', now, null, '', { lastUsed: tenMinutesAgo })).toBe(true);
      // < 5 min -> false
      expect(evaluateCriterion(beforeFiveMin, 'localhost', now, null, '', { lastUsed: tenMinutesAgo })).toBe(false);
    });

    it('handles never-expanded flow (lastUsed undefined)', () => {
      const now = new Date();
      const afterRule: ConditionCriterion = {
        type: 'time_since_last_expansion',
        operator: 'after',
        value: '10',
      };
      const beforeRule: ConditionCriterion = {
        type: 'time_since_last_expansion',
        operator: 'before',
        value: '10',
      };

      // Never expanded -> after is true, before is false
      expect(evaluateCriterion(afterRule, 'localhost', now, null, '', { lastUsed: undefined })).toBe(true);
      expect(evaluateCriterion(beforeRule, 'localhost', now, null, '', { lastUsed: undefined })).toBe(false);
    });
  });

  describe('RandomBlock avoidConsecutive in resolveLeaf', () => {
    it('avoids picking the exact same option consecutively when avoidConsecutive is true', () => {
      const actionA = { format: 'plaintext' as const, content: 'A', tokens: [] };
      const actionB = { format: 'plaintext' as const, content: 'B', tokens: [] };

      const randomBlock = {
        type: 'random' as const,
        avoidConsecutive: true,
        options: [
          { id: 'opt-A', weight: 50, target: actionA },
          { id: 'opt-B', weight: 50, target: actionB },
        ],
      };

      const firstPick = resolveLeaf(randomBlock, null, '');
      expect(firstPick).not.toBeNull();
      const secondPick = resolveLeaf(randomBlock, null, '');
      expect(secondPick).not.toBeNull();

      // Because there are 2 options and avoidConsecutive is true, second pick MUST be the other option
      expect(secondPick).not.toBe(firstPick);
    });

    it('still picks the single option if only 1 option exists', () => {
      const actionOnly = { format: 'plaintext' as const, content: 'Only', tokens: [] };
      const randomBlock = {
        type: 'random' as const,
        avoidConsecutive: true,
        options: [
          { id: 'opt-only', weight: 100, target: actionOnly },
        ],
      };

      const first = resolveLeaf(randomBlock, null, '');
      const second = resolveLeaf(randomBlock, null, '');
      expect(first).toBe(actionOnly);
      expect(second).toBe(actionOnly);
    });
  });

  describe('RepeatBlock in resolveLeaf', () => {
    it('replicates plain text content count times with separator', () => {
      const action = { format: 'plaintext' as const, content: 'Echo', tokens: [] };
      const repeatBlock = {
        type: 'repeat' as const,
        count: 3,
        separator: ', ',
        target: action,
      };

      const result = resolveLeaf(repeatBlock, null, '');
      expect(result).not.toBeNull();
      expect(result?.content).toBe('Echo, Echo, Echo');
      expect(result?.tokens).toEqual([]);
    });

    it('returns original content when count is 1', () => {
      const action = { format: 'plaintext' as const, content: 'Single', tokens: [] };
      const repeatBlock = {
        type: 'repeat' as const,
        count: 1,
        separator: ' - ',
        target: action,
      };

      const result = resolveLeaf(repeatBlock, null, '');
      expect(result?.content).toBe('Single');
    });

    it('replicates and adjusts token IDs when tokens exist', () => {
      const token1 = { id: 'tok-1', type: 'date' as const, config: { format: 'DD/MM' } };
      const action = {
        format: 'richtext' as const,
        content: '<p>Date: <span class="token-pill" data-token-id="tok-1">Date</span></p>',
        tokens: [token1],
      };
      const repeatBlock = {
        type: 'repeat' as const,
        count: 2,
        separator: '\n',
        target: action,
      };

      const result = resolveLeaf(repeatBlock, null, '');
      expect(result).not.toBeNull();
      expect(result?.tokens.length).toBe(2);
      expect(result?.tokens[0].id).toBe('tok-1');
      expect(result?.tokens[1].id).not.toBe('tok-1');
      expect(result?.content).toContain('data-token-id="tok-1"');
      expect(result?.content).toContain(`data-token-id="${result?.tokens[1].id}"`);
    });

    it('resolves nested ConditionBlock inside RepeatBlock', () => {
      const actionMatch = { format: 'plaintext' as const, content: 'Matched', tokens: [] };
      const conditionBlock = {
        rules: [
          {
            type: 'domain' as const,
            operator: 'equals' as const,
            value: window.location.hostname || 'localhost',
            action: actionMatch,
          },
        ],
      };
      const repeatBlock = {
        type: 'repeat' as const,
        count: 2,
        separator: ' | ',
        target: conditionBlock,
      };

      const result = resolveLeaf(repeatBlock, null, '');
      expect(result?.content).toBe('Matched | Matched');
    });
  });
});
