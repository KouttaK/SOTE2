/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FlowEditorPage from './editor.js';
import type { ConditionBlock } from '../../shared/types/index.js';
import { t } from '../../shared/i18n/index.js';
import * as toastModule from '../../shared/components/Toast.js';

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
    },
    tabs: { query: vi.fn().mockResolvedValue([]) },
  },
}));

describe('editor.ts renderConditionCard Switch Mode (Fase 3.3)', () => {
  let editor: FlowEditorPage;

  beforeEach(() => {
    editor = new FlowEditorPage();
    // Initialize properties needed by renderDetachedBranchTarget and floating nodes
    (editor as any).floatingNodes = [];
    (editor as any).connections = [];
    (editor as any).branchActionInsts = [];
    (editor as any).currentFlow = { id: 'test-flow', blocks: [] };
    (editor as any).el = document.createElement('div');
    const container = document.createElement('div');
    container.id = 'node-flow-container';
    (editor as any).el.appendChild(container);
    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'flow-canvas-wrap';
    (editor as any).headerEl = document.createElement('div');
    const saveBtn = document.createElement('button');
    saveBtn.id = 'btn-save-flow';
    (editor as any).headerEl.appendChild(saveBtn);
  });

  it('renders in Classic mode by default when displayMode is not set', () => {
    const condData: ConditionBlock = {
      rules: [
        { type: 'variable_value', operator: 'equals', value: JSON.stringify({ key: 'tipo', val: 'A' }), action: { format: 'plaintext', content: '', tokens: [] } },
        { type: 'variable_value', operator: 'equals', value: JSON.stringify({ key: 'tipo', val: 'B' }), action: { format: 'plaintext', content: '', tokens: [] } },
      ],
      elseBranch: { format: 'plaintext', content: '', tokens: [] },
    };

    let rebuilt = false;
    const card = (editor as any).renderConditionCard(condData, () => { rebuilt = true; }, () => {});

    expect(card.classList.contains('is-switch-mode')).toBe(false);
    const classicBtn = card.querySelector('.cond-mode-btn[data-mode="classic"]') as HTMLButtonElement;
    const switchBtn = card.querySelector('.cond-mode-btn[data-mode="switch"]') as HTMLButtonElement;

    expect(classicBtn).not.toBeNull();
    expect(switchBtn).not.toBeNull();
    expect(classicBtn.classList.contains('active')).toBe(true);
    expect(switchBtn.classList.contains('active')).toBe(false);
    expect(switchBtn.classList.contains('is-disabled')).toBe(false);

    // Tags should match current locale (IF / ELSE IF / ELSE or SE / SENÃO SE / SENÃO)
    const tags = Array.from(card.querySelectorAll('.branch-tag')).map(el => el.textContent?.trim());
    expect(tags[0]).toBe(t('condition.tag.if'));
    expect(tags[1]).toBe(t('condition.tag.elseif'));
    expect(tags[2]).toBe(t('condition.tag.else'));

    // Clicking switch button toggles displayMode and triggers rebuild
    switchBtn.click();
    expect(condData.displayMode).toBe('switch');
    expect(rebuilt).toBe(true);
  });

  it('renders in Switch mode when displayMode is switch and block is eligible', () => {
    const condData: ConditionBlock = {
      displayMode: 'switch',
      rules: [
        { type: 'variable_value', operator: 'equals', value: JSON.stringify({ key: 'tipo', val: 'A' }), action: { format: 'plaintext', content: '', tokens: [] } },
        { type: 'variable_value', operator: 'equals', value: JSON.stringify({ key: 'tipo', val: 'B' }), action: { format: 'plaintext', content: '', tokens: [] } },
      ],
      elseBranch: { format: 'plaintext', content: '', tokens: [] },
    };

    let rebuilt = false;
    const card = (editor as any).renderConditionCard(condData, () => { rebuilt = true; }, () => {});

    expect(card.classList.contains('is-switch-mode')).toBe(true);
    const switchBtn = card.querySelector('.cond-mode-btn[data-mode="switch"]') as HTMLButtonElement;
    const classicBtn = card.querySelector('.cond-mode-btn[data-mode="classic"]') as HTMLButtonElement;
    expect(switchBtn.classList.contains('active')).toBe(true);
    expect(classicBtn.classList.contains('active')).toBe(false);

    // Target header should display evaluating variable "tipo"
    const targetBadge = card.querySelector('.switch-target-badge');
    expect(targetBadge).not.toBeNull();
    expect(targetBadge?.textContent).toContain('tipo');

    // Tags should be CASE / CASE / DEFAULT
    const tags = Array.from(card.querySelectorAll('.branch-tag')).map(el => el.textContent?.trim());
    expect(tags[0]).toBe(t('condition.tag.case'));
    expect(tags[1]).toBe(t('condition.tag.case'));
    expect(tags[2]).toBe(t('condition.tag.default'));

    // Cases should render switch case row with switch-val-input
    const caseInputs = Array.from(card.querySelectorAll('.switch-val-input')) as HTMLInputElement[];
    expect(caseInputs.length).toBe(2);
    expect(caseInputs[0].value).toBe('A');
    expect(caseInputs[1].value).toBe('B');

    // Add case button
    const addCaseBtn = card.querySelector('.add-branch-btn') as HTMLButtonElement;
    expect(addCaseBtn.textContent).toContain(t('condition.switch.add_case'));
    addCaseBtn.click();
    expect(rebuilt).toBe(true);
    expect(condData.rules.length).toBe(3);
    expect(condData.rules[2].type).toBe('variable_value');
    expect(condData.rules[2].operator).toBe('equals');

    // Clicking classic button toggles back without losing rules
    rebuilt = false;
    classicBtn.click();
    expect(condData.displayMode).toBe('classic');
    expect(rebuilt).toBe(true);
    expect(condData.rules.length).toBe(3);
  });

  it('disables Switch mode button and shows warning if block is not eligible', () => {
    const showToastSpy = vi.spyOn(toastModule, 'showToast').mockImplementation(() => {});

    // Ineligible block: rules have different operators
    const condData: ConditionBlock = {
      displayMode: 'classic',
      rules: [
        { type: 'domain', operator: 'equals', value: 'gmail.com', action: { format: 'plaintext', content: '', tokens: [] } },
        { type: 'domain', operator: 'contains', value: 'mail', action: { format: 'plaintext', content: '', tokens: [] } },
      ],
    };

    let rebuilt = false;
    const card = (editor as any).renderConditionCard(condData, () => { rebuilt = true; }, () => {});

    const switchBtn = card.querySelector('.cond-mode-btn[data-mode="switch"]') as HTMLButtonElement;
    expect(switchBtn.classList.contains('is-disabled')).toBe(true);
    expect(switchBtn.getAttribute('title')).toBe(t('condition.switch.ineligible_tooltip'));

    // Clicking ineligible button does not trigger rebuild and shows toast warning
    switchBtn.click();
    expect(rebuilt).toBe(false);
    expect(condData.displayMode).toBe('classic');
    expect(showToastSpy).toHaveBeenCalled();

    showToastSpy.mockRestore();
  });

  it('falls back to Classic mode if displayMode was switch but data became ineligible', () => {
    const condData: ConditionBlock = {
      displayMode: 'switch',
      rules: [
        { type: 'domain', operator: 'contains', value: 'google.com', action: { format: 'plaintext', content: '', tokens: [] } },
      ],
    };

    const card = (editor as any).renderConditionCard(condData, () => {}, () => {});
    // Fallback: should render as classic because contains != equals
    expect(card.classList.contains('is-switch-mode')).toBe(false);
    const switchBtn = card.querySelector('.cond-mode-btn[data-mode="switch"]') as HTMLButtonElement;
    expect(switchBtn.classList.contains('is-disabled')).toBe(true);
  });
});
