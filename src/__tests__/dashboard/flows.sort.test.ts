/**
 * Regression test for "Sort By" appearing to do nothing on the Flows page.
 *
 * Root cause: renderList() sorted `filtered` in place, and whenever no
 * folder/search filter was active `filtered` was literally the same array
 * reference as `this.allFlows` — plus every comparator only had a
 * meaningful branch for values that *differed*. Brand-new flows (all with
 * usageCount === 0, all Uncategorised) tie on every field Sort By used, so
 * a stable sort left them in their original order and Sort By looked
 * completely broken.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { generateId } from '../../shared/storage/helpers.js';
import { storage } from '../../shared/storage/StorageService.js';
import type { Flow } from '../../shared/types/index.js';
import FlowsPage from '../../dashboard/pages/flows.js';

function makeFlow(name: string, shortcut: string): Flow {
  return {
    id: generateId(),
    name,
    blocks: [
      { id: generateId(), type: 'trigger', data: { shortcut, smartCase: false, forceCapitalize: false } as any },
      { id: generateId(), type: 'action', data: { format: 'plaintext', content: name, tokens: [] } as any },
    ],
    tags: [],
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    // All flows tie on usage (0) and folder (none) — exactly the real-world
    // "just created a batch of flows, never used them yet" scenario.
    stats: { usageCount: 0, keysSaved: 0 },
  };
}

async function readVisibleShortcuts(page: FlowsPage): Promise<string[]> {
  const el = page.render();
  document.body.appendChild(el);
  await page.mount();
  const rows = Array.from(el.querySelectorAll('.row-shortcut'));
  return rows.map(r => (r.textContent || '').replace(/^\//, '').trim());
}

describe('FlowsPage — Sort By', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    document.body.innerHTML = '';
  });

  it('Name sort reorders flows alphabetically even when they tie on usage/folder', async () => {
    // Inserted intentionally out of alphabetical order.
    await storage.saveFlow(makeFlow('Zebra', 'zebra'));
    await storage.saveFlow(makeFlow('Apple', 'apple'));
    await storage.saveFlow(makeFlow('Mango', 'mango'));

    const page = new FlowsPage();
    (page as any).currentSort = 'Name';
    const shortcuts = await readVisibleShortcuts(page);

    expect(shortcuts).toEqual(['apple', 'mango', 'zebra']);
  });

  it('Usage sort still falls back to name (deterministic order) when every flow has 0 uses', async () => {
    await storage.saveFlow(makeFlow('Zebra', 'zebra'));
    await storage.saveFlow(makeFlow('Apple', 'apple'));
    await storage.saveFlow(makeFlow('Mango', 'mango'));

    const page = new FlowsPage();
    (page as any).currentSort = 'Usage';
    const shortcuts = await readVisibleShortcuts(page);

    // Before the fix this stayed in insertion order (zebra, apple, mango)
    // because a stable sort with an all-zero comparator is a no-op.
    expect(shortcuts).toEqual(['apple', 'mango', 'zebra']);
  });

  it('Category sort does not mutate the underlying allFlows array', async () => {
    await storage.saveFlow(makeFlow('Zebra', 'zebra'));
    await storage.saveFlow(makeFlow('Apple', 'apple'));

    const page = new FlowsPage();
    const el = page.render();
    document.body.appendChild(el);
    await page.mount();

    const before = (page as any).allFlows.map((f: Flow) => f.name);
    (page as any).renderList();
    const after = (page as any).allFlows.map((f: Flow) => f.name);

    // The master data array's order must be unaffected by a display sort.
    expect(after).toEqual(before);
  });
});
