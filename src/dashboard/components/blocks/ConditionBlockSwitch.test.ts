/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import {
  checkSwitchEligibility,
  extractVariableKey,
  extractVariableVal,
  getSwitchTargetLabel,
  SwitchCaseRow,
} from './ConditionBlock.js';
import { ConfirmModal } from '../ConfirmModal.js';
import type { ConditionBlock, ConditionRule, Flow } from '../../../shared/types/index.js';
import { resolveFlowActionBlock } from '../../../content/engine/ConditionResolver.js';

describe('ConditionBlock Switch Mode (Fase 3.3)', () => {
  describe('checkSwitchEligibility', () => {
    it('returns false when rules array is empty', () => {
      const block: ConditionBlock = { rules: [] };
      const res = checkSwitchEligibility(block);
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe('no_rules');
    });

    it('returns false for unsupported dynamic types (time, weekday, time_since_last_expansion)', () => {
      const timeBlock: ConditionBlock = {
        rules: [{ type: 'time', operator: 'equals' as any, value: '{"op":"between"}', action: { format: 'plaintext', content: '', tokens: [] } }],
      };
      expect(checkSwitchEligibility(timeBlock).eligible).toBe(false);
      expect(checkSwitchEligibility(timeBlock).reason).toBe('unsupported_type');

      const weekdayBlock: ConditionBlock = {
        rules: [{ type: 'weekday', operator: 'equals' as any, value: '{"days":["Mon"]}', action: { format: 'plaintext', content: '', tokens: [] } }],
      };
      expect(checkSwitchEligibility(weekdayBlock).eligible).toBe(false);

      const timeSinceBlock: ConditionBlock = {
        rules: [{ type: 'time_since_last_expansion', operator: 'equals' as any, value: '10', action: { format: 'plaintext', content: '', tokens: [] } }],
      };
      expect(checkSwitchEligibility(timeSinceBlock).eligible).toBe(false);
    });

    it('returns false if any rule uses an operator other than equals', () => {
      const block: ConditionBlock = {
        rules: [
          { type: 'domain', operator: 'equals', value: 'google.com', action: { format: 'plaintext', content: '', tokens: [] } },
          { type: 'domain', operator: 'contains', value: 'github.com', action: { format: 'plaintext', content: '', tokens: [] } },
        ],
      };
      const res = checkSwitchEligibility(block);
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe('operator_not_equals');
    });

    it('returns false if any rule has extra criteria (AND/OR compound criteria)', () => {
      const block: ConditionBlock = {
        rules: [
          {
            type: 'domain',
            operator: 'equals',
            value: 'google.com',
            action: { format: 'plaintext', content: '', tokens: [] },
            criteria: [{ type: 'date', operator: 'equals', value: '2026-10-04' }],
          },
        ],
      };
      const res = checkSwitchEligibility(block);
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe('has_extra_criteria');
    });

    it('returns false if rules target different types', () => {
      const block: ConditionBlock = {
        rules: [
          { type: 'domain', operator: 'equals', value: 'google.com', action: { format: 'plaintext', content: '', tokens: [] } },
          { type: 'field_type', operator: 'equals', value: 'email', action: { format: 'plaintext', content: '', tokens: [] } },
        ],
      };
      const res = checkSwitchEligibility(block);
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe('mismatched_target_type');
    });

    it('returns false for variable_value if variable key is empty', () => {
      const block: ConditionBlock = {
        rules: [
          { type: 'variable_value', operator: 'equals', value: JSON.stringify({ key: '', val: 'foo' }), action: { format: 'plaintext', content: '', tokens: [] } },
        ],
      };
      const res = checkSwitchEligibility(block);
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe('missing_variable_key');
    });

    it('returns false for variable_value if rules test different variable keys', () => {
      const block: ConditionBlock = {
        rules: [
          { type: 'variable_value', operator: 'equals', value: JSON.stringify({ key: 'role', val: 'admin' }), action: { format: 'plaintext', content: '', tokens: [] } },
          { type: 'variable_value', operator: 'equals', value: JSON.stringify({ key: 'dept', val: 'sales' }), action: { format: 'plaintext', content: '', tokens: [] } },
        ],
      };
      const res = checkSwitchEligibility(block);
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe('mismatched_variable_key');
    });

    it('returns eligible: true for variable_value when all rules test the same key with equals', () => {
      const block: ConditionBlock = {
        rules: [
          { type: 'variable_value', operator: 'equals', value: JSON.stringify({ key: 'role', val: 'admin' }), action: { format: 'plaintext', content: 'ADM', tokens: [] } },
          { type: 'variable_value', operator: 'equals', value: JSON.stringify({ key: 'role', val: 'user' }), action: { format: 'plaintext', content: 'USR', tokens: [] } },
          { type: 'variable_value', operator: 'equals', value: JSON.stringify({ key: 'role', val: 'guest' }), action: { format: 'plaintext', content: 'GST', tokens: [] } },
        ],
        elseBranch: { format: 'plaintext', content: 'OTHER', tokens: [] },
      };
      const res = checkSwitchEligibility(block);
      expect(res.eligible).toBe(true);
      expect(res.targetType).toBe('variable_value');
      expect(res.targetKey).toBe('role');
    });

    it('returns eligible: true for domain equality cases', () => {
      const block: ConditionBlock = {
        rules: [
          { type: 'domain', operator: 'equals', value: 'github.com', action: { format: 'plaintext', content: '', tokens: [] } },
          { type: 'domain', operator: 'equals', value: 'gitlab.com', action: { format: 'plaintext', content: '', tokens: [] } },
        ],
      };
      const res = checkSwitchEligibility(block);
      expect(res.eligible).toBe(true);
      expect(res.targetType).toBe('domain');
    });

    it('returns eligible: true for field_type equality cases', () => {
      const block: ConditionBlock = {
        rules: [
          { type: 'field_type', operator: 'equals', value: 'email', action: { format: 'plaintext', content: '', tokens: [] } },
          { type: 'field_type', operator: 'equals', value: 'password', action: { format: 'plaintext', content: '', tokens: [] } },
        ],
      };
      const res = checkSwitchEligibility(block);
      expect(res.eligible).toBe(true);
      expect(res.targetType).toBe('field_type');
    });
  });

  describe('extractVariableKey and extractVariableVal', () => {
    it('correctly parses JSON formatted variable criterion values', () => {
      const raw = JSON.stringify({ key: 'client_type', val: 'VIP' });
      expect(extractVariableKey(raw)).toBe('client_type');
      expect(extractVariableVal(raw)).toBe('VIP');
    });

    it('handles legacy colon-separated variable values', () => {
      const raw = 'status:pending:extra';
      expect(extractVariableKey(raw)).toBe('status');
      expect(extractVariableVal(raw)).toBe('pending:extra');
    });

    it('handles empty or malformed input without throwing', () => {
      expect(extractVariableKey('')).toBe('');
      expect(extractVariableVal('')).toBe('');
      expect(extractVariableKey('{invalid json')).toBe('{invalid json');
    });
  });

  describe('getSwitchTargetLabel', () => {
    it('returns human-readable target labels for each criterion type', () => {
      expect(getSwitchTargetLabel('variable_value', 'departamento')).toContain('departamento');
      expect(getSwitchTargetLabel('domain')).toBeDefined();
      expect(getSwitchTargetLabel('field_type')).toBeDefined();
      expect(getSwitchTargetLabel('field_content')).toBeDefined();
      expect(getSwitchTargetLabel('clipboard_content')).toBeDefined();
      expect(getSwitchTargetLabel('date')).toBeDefined();
    });
  });

  describe('Data Preservation and Runtime Execution', () => {
    it('switching displayMode between classic and switch does not alter underlying rules or actions', () => {
      const originalBlock: ConditionBlock = {
        displayMode: 'classic',
        rules: [
          { type: 'variable_value', operator: 'equals', value: JSON.stringify({ key: 'plano', val: 'pro' }), action: { format: 'plaintext', content: 'Plano PRO', tokens: [] } },
          { type: 'variable_value', operator: 'equals', value: JSON.stringify({ key: 'plano', val: 'free' }), action: { format: 'plaintext', content: 'Plano Grátis', tokens: [] } },
        ],
        elseBranch: { format: 'plaintext', content: 'Plano Desconhecido', tokens: [] },
      };

      // Toggle to switch
      originalBlock.displayMode = 'switch';
      expect(checkSwitchEligibility(originalBlock).eligible).toBe(true);
      expect(originalBlock.rules.length).toBe(2);
      expect(originalBlock.rules[0].action.content).toBe('Plano PRO');
      expect(originalBlock.elseBranch?.content).toBe('Plano Desconhecido');

      // Toggle back to classic
      originalBlock.displayMode = 'classic';
      expect(originalBlock.rules.length).toBe(2);
      expect(originalBlock.rules[0].operator).toBe('equals');
      expect(originalBlock.rules[1].action.content).toBe('Plano Grátis');
    });

    it('ConditionResolver evaluates Switch-mode flows seamlessly without runtime divergence', () => {
      const flow: Flow = {
        id: 'flow-switch-test',
        name: 'Teste Switch',
        category: 'test',
        tags: [],
        enabled: true,
        usageCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        blocks: [
          {
            type: 'trigger',
            data: { shortcut: 'swtest', smartCase: false, forceCapitalize: false },
          },
          {
            type: 'condition',
            data: {
              displayMode: 'switch',
              rules: [
                {
                  type: 'variable_value',
                  operator: 'equals',
                  value: JSON.stringify({ key: 'status', val: 'aprovado' }),
                  action: { format: 'plaintext', content: 'STATUS OK', tokens: [] },
                },
                {
                  type: 'variable_value',
                  operator: 'equals',
                  value: JSON.stringify({ key: 'status', val: 'rejeitado' }),
                  action: { format: 'plaintext', content: 'STATUS RECUSADO', tokens: [] },
                },
              ],
              elseBranch: { format: 'plaintext', content: 'STATUS PENDENTE', tokens: [] },
            } as ConditionBlock,
          },
        ],
      };

      // Case 1: matches first rule
      const resAprovado = resolveFlowActionBlock(flow, null, undefined, {
        variables: [{ key: 'status', value: 'aprovado', scope: 'global' }],
      });
      expect(resAprovado).not.toBeNull();
      expect(resAprovado?.content).toBe('STATUS OK');

      // Case 2: matches second rule
      const resRejeitado = resolveFlowActionBlock(flow, null, undefined, {
        variables: [{ key: 'status', value: 'rejeitado', scope: 'global' }],
      });
      expect(resRejeitado).not.toBeNull();
      expect(resRejeitado?.content).toBe('STATUS RECUSADO');

      // Case 3: matches fallback default branch
      const resOutro = resolveFlowActionBlock(flow, null, undefined, {
        variables: [{ key: 'status', value: 'outro' }],
      });
      expect(resOutro).not.toBeNull();
      expect(resOutro?.content).toBe('STATUS PENDENTE');
    });
  });

  describe('SwitchCaseRow Component', () => {
    it('renders variable_value input and updates rule.value on input', () => {
      const rule: ConditionRule = {
        type: 'variable_value',
        operator: 'equals',
        value: JSON.stringify({ key: 'departamento', val: 'financeiro' }),
        action: { format: 'plaintext', content: '', tokens: [] },
      };
      let changed = false;
      const row = new SwitchCaseRow(rule, {
        targetType: 'variable_value',
        targetKey: 'departamento',
        onChange: () => { changed = true; },
        onRemove: () => {},
      });

      const el = row.getElement();
      const input = el.querySelector('.switch-val-input') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.value).toBe('financeiro');

      // Edit value
      input.value = 'juridico';
      input.dispatchEvent(new Event('input'));
      expect(changed).toBe(true);
      expect(rule.value).toBe(JSON.stringify({ key: 'departamento', val: 'juridico' }));
    });

    it('renders domain input and updates rule.value on input', () => {
      const rule: ConditionRule = {
        type: 'domain',
        operator: 'equals',
        value: 'github.com',
        action: { format: 'plaintext', content: '', tokens: [] },
      };
      let changed = false;
      const row = new SwitchCaseRow(rule, {
        targetType: 'domain',
        onChange: () => { changed = true; },
        onRemove: () => {},
      });

      const el = row.getElement();
      const input = el.querySelector('.rule-value') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.value).toBe('github.com');

      input.value = 'gitlab.com';
      input.dispatchEvent(new Event('input'));
      expect(changed).toBe(true);
      expect(rule.value).toBe('gitlab.com');
    });

    it('renders field_type select and updates rule.value on change', () => {
      const rule: ConditionRule = {
        type: 'field_type',
        operator: 'equals',
        value: 'email',
        action: { format: 'plaintext', content: '', tokens: [] },
      };
      let changed = false;
      const row = new SwitchCaseRow(rule, {
        targetType: 'field_type',
        onChange: () => { changed = true; },
        onRemove: () => {},
      });

      const el = row.getElement();
      const select = el.querySelector('.field-type-value') as HTMLSelectElement;
      expect(select).not.toBeNull();
      expect(select.value).toBe('email');

      select.value = 'textarea';
      select.dispatchEvent(new Event('change'));
      expect(changed).toBe(true);
      expect(rule.value).toBe('textarea');
    });

    it('renders field_content input and updates rule.value on input', () => {
      const rule: ConditionRule = {
        type: 'field_content',
        operator: 'equals',
        value: 'CONFIRMADO',
        action: { format: 'plaintext', content: '', tokens: [] },
      };
      let changed = false;
      const row = new SwitchCaseRow(rule, {
        targetType: 'field_content',
        onChange: () => { changed = true; },
        onRemove: () => {},
      });

      const el = row.getElement();
      const input = el.querySelector('.rule-value') as HTMLInputElement;
      expect(input.value).toBe('CONFIRMADO');

      input.value = 'CANCELADO';
      input.dispatchEvent(new Event('input'));
      expect(changed).toBe(true);
      expect(rule.value).toBe('CANCELADO');
    });

    it('triggers ConfirmModal and calls onRemove when remove button is clicked', () => {
      const showSpy = vi.spyOn(ConfirmModal, 'show').mockImplementation((opts: any) => {
        opts.onConfirm();
      });

      const rule: ConditionRule = {
        type: 'domain',
        operator: 'equals',
        value: 'test.com',
        action: { format: 'plaintext', content: '', tokens: [] },
      };
      let removed = false;
      const row = new SwitchCaseRow(rule, {
        targetType: 'domain',
        onChange: () => {},
        onRemove: () => { removed = true; },
      });

      const removeBtn = row.getElement().querySelector('.branch-rule-remove-btn') as HTMLButtonElement;
      expect(removeBtn).not.toBeNull();
      removeBtn.click();

      expect(showSpy).toHaveBeenCalled();
      expect(removed).toBe(true);
      showSpy.mockRestore();
    });
  });
});
