/**
 * Regression test: removing the only (first) condition rule did not
 * actually remove the condition block from the flow's data. renderFlow()
 * re-derives hasCondition/conditionData by looking up a 'condition'-type
 * block in currentFlow.blocks — since removeConditionEntirely() never
 * filtered that block out, the condition section reappeared immediately
 * after re-render, making the remove button look completely broken.
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

describe('FlowEditorPage — remove only/first condition rule', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    document.body.innerHTML = '';
  });

  it('actually removes the condition block from currentFlow.blocks, not just the in-memory flags', async () => {
    const flow = makeFlowWithCondition();
    await storage.saveFlow(flow);

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const page = new FlowEditorPage();
    const el = page.render();
    document.body.appendChild(el);
    await page.mount({ id: flow.id });

    // Sanity check: the condition card is present before removal.
    expect(el.querySelector('.branch-fanout')).toBeTruthy();
    expect((page as any).currentFlow.blocks.some((b: any) => b.type === 'condition')).toBe(true);

    // Click the (only) menu item on the rule card — "Remove rule".
    const removeBtn = el.querySelector('.branch-fanout .block-menu-item.danger') as HTMLElement;
    expect(removeBtn).toBeTruthy();
    removeBtn.click();

    // The condition block must be gone from the underlying data...
    expect((page as any).currentFlow.blocks.some((b: any) => b.type === 'condition')).toBe(false);
    // ...and the condition section must not have reappeared in the DOM.
    expect(el.querySelector('.branch-fanout')).toBeFalsy();

    vi.restoreAllMocks();
  });
});
