/**
 * Nested conditions were redesigned: instead of converting a rule
 * branch's Action block into a whole separate nested Se/Senão Se/Senão
 * tree just to test more than one thing, a rule now gets an inline
 * "E"/"OU" (AND/OR) criteria group that leads to the same single action —
 * much easier to read than a nested branch-in-branch tree.
 *
 * The Else branch has no rule of its own to attach criteria to, so it
 * still supports the old "convert into a nested condition" affordance —
 * and old saved flows that already used a nested ConditionBlock as a
 * rule's action keep loading/editing/saving correctly via the same
 * recursive BranchTarget machinery.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { generateId } from '../../shared/storage/helpers.js';
import { storage } from '../../shared/storage/StorageService.js';
import type { Flow } from '../../shared/types/index.js';
import FlowEditorPage from '../../dashboard/pages/editor.js';

function makeFlowWithCondition(): Flow {
  return {
    id: generateId(),
    name: 'Test flow with condition',
    blocks: [
      { id: generateId(), type: 'trigger', data: { shortcut: 'abc', smartCase: false, forceCapitalize: false } as any },
      {
        id: generateId(),
        type: 'condition',
        data: {
          rules: [
            { type: 'domain', operator: 'contains', value: 'gmail.com', action: { format: 'plaintext', content: 'rule content', tokens: [] } },
          ],
        } as any,
      },
    ],
    tags: [],
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    stats: { usageCount: 0, keysSaved: 0 },
  };
}

/** Same as makeFlowWithCondition, but with an Else branch too. */
function makeFlowWithConditionAndElse(): Flow {
  const flow = makeFlowWithCondition();
  const condBlock = flow.blocks.find((b) => b.type === 'condition')!;
  (condBlock.data as any).elseBranch = { format: 'plaintext', content: 'else content', tokens: [] };
  return flow;
}

describe('FlowEditorPage — AND/OR condition criteria (rule branches)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    document.body.innerHTML = '';
  });

  it('adds an AND criterion to a rule and persists the AND/OR shape on save', async () => {
    const flow = makeFlowWithCondition();
    await storage.saveFlow(flow);

    const page = new FlowEditorPage();
    const el = page.render();
    document.body.appendChild(el);
    await page.mount({ id: flow.id });

    // Rule branches no longer offer the old "convert to nested condition"
    // button — AND/OR criteria live inside the rule card itself.
    expect(el.querySelector('.branch-col .add-nested-condition-btn')).toBeFalsy();
    expect(el.querySelector('.add-criterion-btn')).toBeTruthy();
    expect(el.querySelector('.cond-combinator-row')).toBeFalsy(); // no criteria yet → no toggle shown

    (el.querySelector('.add-criterion-btn') as HTMLElement).click();

    // A combinator toggle (defaulting to AND) and one extra criterion row
    // should now be rendered, still inside the same rule card — no nested
    // fan-out anywhere.
    expect(el.querySelector('.cond-combinator-row')).toBeTruthy();
    expect(el.querySelector('.cond-combinator-btn.active')?.getAttribute('data-c')).toBe('AND');
    expect(el.querySelector('.cond-extra-row')).toBeTruthy();
    expect(el.querySelector('.branch-nested-wrap')).toBeFalsy();

    const condData: any = (page as any).conditionData;
    expect(Array.isArray(condData.rules[0].criteria)).toBe(true);
    expect(condData.rules[0].criteria.length).toBe(1);
    expect(condData.rules[0].combinator).toBe('AND');

    // Fill in the extra criterion's value.
    const extraValueInput = el.querySelector('.cond-extra-row .rule-value') as HTMLInputElement;
    extraValueInput.value = 'example.com';
    extraValueInput.dispatchEvent(new Event('input', { bubbles: true }));
    expect(condData.rules[0].criteria[0].value).toBe('example.com');

    // Switch the combinator to OR.
    const orBtn = Array.from(el.querySelectorAll('.cond-combinator-btn')).find(
      (b) => (b as HTMLElement).dataset.c === 'OR'
    ) as HTMLElement;
    orBtn.click();
    expect(condData.rules[0].combinator).toBe('OR');

    await page.saveFlow();
    const saved = await storage.getFlow(flow.id);
    const savedCond: any = saved!.blocks.find((b) => b.type === 'condition')!.data;
    expect(savedCond.rules[0].combinator).toBe('OR');
    expect(savedCond.rules[0].criteria[0].value).toBe('example.com');
    // Same single action for the whole rule — no branch-in-branch tree.
    expect(savedCond.rules[0].action.content).toBe('rule content');
  });

  it('removes an AND/OR criterion, clearing criteria/combinator once empty', async () => {
    const flow = makeFlowWithCondition();
    await storage.saveFlow(flow);

    const page = new FlowEditorPage();
    const el = page.render();
    document.body.appendChild(el);
    await page.mount({ id: flow.id });

    (el.querySelector('.add-criterion-btn') as HTMLElement).click();
    const condData: any = (page as any).conditionData;
    expect(condData.rules[0].criteria.length).toBe(1);

    (el.querySelector('.cond-remove-criterion-btn') as HTMLElement).click();

    expect(condData.rules[0].criteria).toBeUndefined();
    expect(condData.rules[0].combinator).toBeUndefined();
    expect(el.querySelector('.cond-extra-row')).toBeFalsy();
    expect(el.querySelector('.cond-combinator-row')).toBeFalsy();
  });
});

describe('FlowEditorPage — nested condition (Else branch only)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    document.body.innerHTML = '';
  });

  it('still supports converting the Else branch into a nested condition, and back', async () => {
    const flow = makeFlowWithConditionAndElse();
    await storage.saveFlow(flow);

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const page = new FlowEditorPage();
    const el = page.render();
    document.body.appendChild(el);
    await page.mount({ id: flow.id });

    // The Else column still has the "add nested condition" affordance,
    // since it has no rule of its own to attach AND/OR criteria to.
    const addNestedBtn = el.querySelector('.add-nested-condition-btn') as HTMLElement;
    expect(addNestedBtn).toBeTruthy();
    expect(el.querySelector('.branch-nested-wrap')).toBeFalsy();

    addNestedBtn.click();
    expect(el.querySelector('.branch-nested-wrap')).toBeTruthy();

    const condData: any = (page as any).conditionData;
    expect(condData.elseBranch).toHaveProperty('rules');

    (el.querySelector('.branch-nested-remove') as HTMLElement).click();
    expect(el.querySelector('.branch-nested-wrap')).toBeFalsy();
    expect(condData.elseBranch).not.toHaveProperty('rules');

    vi.restoreAllMocks();
  });
});

describe('FlowEditorPage — loading a flow saved with the old nested-branch shape', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    document.body.innerHTML = '';
  });

  it('still renders and resolves a pre-existing nested ConditionBlock rule action', async () => {
    const flow = makeFlowWithCondition();
    const condBlock = flow.blocks.find((b) => b.type === 'condition')!;
    // Simulate data saved by an older version of the editor, before this
    // redesign, where the only way to test a second condition was to
    // convert the branch into a nested ConditionBlock.
    (condBlock.data as any).rules[0].action = {
      rules: [
        { type: 'time', operator: 'equals', value: JSON.stringify({ op: 'between', from: '08:00', to: '18:00' }), action: { format: 'plaintext', content: 'nested content', tokens: [] } },
      ],
    };
    await storage.saveFlow(flow);

    const page = new FlowEditorPage();
    const el = page.render();
    document.body.appendChild(el);
    await page.mount({ id: flow.id });

    // Old data still renders as a nested fan-out, unchanged.
    expect(el.querySelector('.branch-nested-wrap')).toBeTruthy();
    const condData: any = (page as any).conditionData;
    expect(condData.rules[0].action).toHaveProperty('rules');
  });
});
