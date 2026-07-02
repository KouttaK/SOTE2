/**
 * Manual / integration tests for StorageService.
 *
 * Run with:  npm test -- storage
 *
 * The WxtVitest plugin automatically wires up fakeBrowser so that
 * `browser.storage.local` is a fully-functional in-memory store.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import type { Flow, Settings } from '../../types/index.js';
import { DEFAULT_SETTINGS } from '../defaults.js';
import {
  generateId,
  isBlocklisted,
  isSnoozeActive,
  getActiveDomain,
} from '../helpers.js';

// StorageService is a singleton module; we re-import after each reset.
// Because vitest re-uses module instances within a suite we need to obtain
// a fresh reference. The simplest approach is to re-import StorageService
// after each fakeBrowser.reset() because the underlying storage is cleared.
import { storage } from '../StorageService.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFlow(overrides: Partial<Flow> = {}): Flow {
  return {
    id: generateId(),
    name: 'Test flow',
    blocks: [],
    tags: [],
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    stats: { usageCount: 0, keysSaved: 0 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('helpers', () => {
  it('generateId() returns a unique UUID each call', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it('generateId() matches UUID v4 format', () => {
    const id = generateId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  describe('isBlocklisted', () => {
    it('returns true for wildcard subdomain match', () => {
      expect(isBlocklisted('app.banco.com', ['*.banco.com'])).toBe(true);
    });

    it('returns true for deep subdomain', () => {
      expect(isBlocklisted('sub.app.banco.com', ['*.banco.com'])).toBe(true);
    });

    it('returns false for sibling TLD (banco.com.br)', () => {
      expect(isBlocklisted('banco.com.br', ['*.banco.com'])).toBe(false);
    });

    it('returns true for exact match', () => {
      expect(isBlocklisted('example.com', ['example.com'])).toBe(true);
    });

    it('returns false for non-matching domain', () => {
      expect(isBlocklisted('other.com', ['*.banco.com', 'example.com'])).toBe(false);
    });
  });

  describe('isSnoozeActive', () => {
    it('returns false when snoozeUntil is undefined', () => {
      const settings: Settings = { ...DEFAULT_SETTINGS };
      expect(isSnoozeActive(settings)).toBe(false);
    });

    it('returns true when snooze is in the future', () => {
      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        snoozeUntil: Date.now() + 60_000,
      };
      expect(isSnoozeActive(settings)).toBe(true);
    });

    it('returns false when snooze has expired', () => {
      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        snoozeUntil: Date.now() - 1,
      };
      expect(isSnoozeActive(settings)).toBe(false);
    });
  });

  describe('getActiveDomain', () => {
    it('extracts hostname from https URL', () => {
      expect(getActiveDomain('https://app.banco.com/path?q=1')).toBe('app.banco.com');
    });

    it('returns empty string for invalid URL', () => {
      expect(getActiveDomain('not a url')).toBe('');
    });
  });
});

// ---------------------------------------------------------------------------
// StorageService integration tests (using fakeBrowser)
// ---------------------------------------------------------------------------

describe('StorageService', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  // ---- Flows ---------------------------------------------------------------

  describe('flows', () => {
    it('getFlows() returns [] on empty storage', async () => {
      const flows = await storage.getFlows();
      expect(flows).toEqual([]);
    });

    it('getFlow() returns null for unknown id', async () => {
      const flow = await storage.getFlow('does-not-exist');
      expect(flow).toBeNull();
    });

    it('create, retrieve, and delete a flow', async () => {
      const flow = makeFlow({ name: 'My flow' });

      await storage.saveFlow(flow);

      const retrieved = await storage.getFlow(flow.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.name).toBe('My flow');

      const all = await storage.getFlows();
      expect(all).toHaveLength(1);

      await storage.deleteFlow(flow.id);
      const afterDelete = await storage.getFlows();
      expect(afterDelete).toHaveLength(0);
    });

    it('saveFlow() updates an existing flow', async () => {
      const flow = makeFlow({ name: 'Original' });
      await storage.saveFlow(flow);

      await storage.saveFlow({ ...flow, name: 'Updated' });
      const flows = await storage.getFlows();
      expect(flows).toHaveLength(1);
      expect(flows[0].name).toBe('Updated');
    });

    it('toggleFlow() flips enabled flag', async () => {
      const flow = makeFlow({ enabled: true });
      await storage.saveFlow(flow);

      await storage.toggleFlow(flow.id);
      const toggled = await storage.getFlow(flow.id);
      expect(toggled!.enabled).toBe(false);

      await storage.toggleFlow(flow.id);
      const toggledBack = await storage.getFlow(flow.id);
      expect(toggledBack!.enabled).toBe(true);
    });

    it('toggleFlow() is a no-op for unknown id', async () => {
      await expect(storage.toggleFlow('ghost')).resolves.not.toThrow();
    });

    it('incrementFlowStats() accumulates correctly', async () => {
      const flow = makeFlow();
      await storage.saveFlow(flow);

      await storage.incrementFlowStats(flow.id, 10);
      await storage.incrementFlowStats(flow.id, 5);

      const updated = await storage.getFlow(flow.id);
      expect(updated!.stats.usageCount).toBe(2);
      expect(updated!.stats.keysSaved).toBe(15);
      expect(updated!.stats.lastUsed).toBeTypeOf('number');
    });

    it('incrementFlowStats() is a no-op for unknown id', async () => {
      await expect(storage.incrementFlowStats('ghost', 10)).resolves.not.toThrow();
    });
  });

  // ---- Settings ------------------------------------------------------------

  describe('settings', () => {
    it('getSettings() returns DEFAULT_SETTINGS on first run', async () => {
      const settings = await storage.getSettings();
      expect(settings).toMatchObject(DEFAULT_SETTINGS);
    });

    it('saveSettings() does a partial merge with existing settings', async () => {
      await storage.saveSettings({ globalEnabled: false });
      const settings = await storage.getSettings();

      expect(settings.globalEnabled).toBe(false);
      // Other defaults must be preserved.
      expect(settings.triggerKeys).toEqual(DEFAULT_SETTINGS.triggerKeys);
      expect(settings.exactMatchChar).toBe(DEFAULT_SETTINGS.exactMatchChar);
      expect(settings.commandPaletteShortcut).toBe(DEFAULT_SETTINGS.commandPaletteShortcut);
    });

    it('saveSettings() can update triggerKeys', async () => {
      await storage.saveSettings({ triggerKeys: ['Tab'] });
      const settings = await storage.getSettings();
      expect(settings.triggerKeys).toEqual(['Tab']);
    });
  });

  // ---- Variables -----------------------------------------------------------

  describe('variables / resolveVariables', () => {
    it('resolves {{key}} in text', async () => {
      await storage.saveVariable({ id: '1', key: 'name', value: 'World' });
      const result = await storage.resolveVariables('Hello {{name}}!');
      expect(result).toBe('Hello World!');
    });

    it('leaves unknown {{key}} untouched', async () => {
      const result = await storage.resolveVariables('Hello {{unknown}}!');
      expect(result).toBe('Hello {{unknown}}!');
    });

    it('resolves multiple variables in one pass', async () => {
      await storage.saveVariable({ id: '1', key: 'a', value: 'AAA' });
      await storage.saveVariable({ id: '2', key: 'b', value: 'BBB' });
      const result = await storage.resolveVariables('{{a}} and {{b}}');
      expect(result).toBe('AAA and BBB');
    });
  });

  // ---- Templates -----------------------------------------------------------

  describe('templates / resolveTemplates', () => {
    it('resolves {{modelo:tag}} in text', async () => {
      await storage.saveTemplate({
        id: '1',
        name: 'Greeting',
        tag: 'greet',
        content: 'Hello there',
        format: 'plaintext',
      });
      const result = await storage.resolveTemplates('{{modelo:greet}}, friend!');
      expect(result).toBe('Hello there, friend!');
    });

    it('leaves unknown {{modelo:tag}} untouched', async () => {
      const result = await storage.resolveTemplates('{{modelo:missing}}');
      expect(result).toBe('{{modelo:missing}}');
    });
  });

  // ---- Chaining resolveVariables + resolveTemplates -----------------------

  describe('chained resolution', () => {
    it('resolveTemplates then resolveVariables expand in sequence', async () => {
      await storage.saveTemplate({
        id: 't1',
        name: 'Sig',
        tag: 'sig',
        content: 'Best, {{author}}',
        format: 'plaintext',
      });
      await storage.saveVariable({ id: 'v1', key: 'author', value: 'Lucas' });

      // First expand the template, then expand the variable inside it.
      const step1 = await storage.resolveTemplates('{{modelo:sig}}');
      const step2 = await storage.resolveVariables(step1);

      expect(step2).toBe('Best, Lucas');
    });
  });

  // ---- Folders -------------------------------------------------------------

  describe('folders', () => {
    it('getFolders() returns [] on empty storage', async () => {
      expect(await storage.getFolders()).toEqual([]);
    });

    it('saves and retrieves a folder', async () => {
      await storage.saveFolder({ id: 'f1', name: 'Work', color: '#fff', order: 0 });
      const folders = await storage.getFolders();
      expect(folders).toHaveLength(1);
      expect(folders[0].name).toBe('Work');
    });

    it('deletes a folder', async () => {
      await storage.saveFolder({ id: 'f1', name: 'Work', color: '#fff', order: 0 });
      await storage.deleteFolder('f1');
      expect(await storage.getFolders()).toHaveLength(0);
    });
  });

  // ---- Clipboard History ----------------------------------------------------

  describe('clipboard history', () => {
    it('getClipboardHistory() returns [] on empty storage', async () => {
      expect(await storage.getClipboardHistory()).toEqual([]);
    });

    it('addClipboardEntry() puts the newest copy at index 0 ("Clipboard 1")', async () => {
      await storage.addClipboardEntry('primeiro');
      await storage.addClipboardEntry('segundo');
      const history = await storage.getClipboardHistory();
      expect(history.map((h) => h.text)).toEqual(['segundo', 'primeiro']);
    });

    it('caps history at DEFAULT_SETTINGS.clipboardHistoryMax (10) by default', async () => {
      for (let i = 1; i <= 12; i++) {
        await storage.addClipboardEntry(`item-${i}`);
      }
      const history = await storage.getClipboardHistory();
      expect(history).toHaveLength(10);
      // Newest 10 kept, oldest 2 dropped.
      expect(history[0].text).toBe('item-12');
      expect(history[9].text).toBe('item-3');
    });

    it('respects a custom clipboardHistoryMax from settings', async () => {
      await storage.saveSettings({ clipboardHistoryMax: 3 });
      for (let i = 1; i <= 5; i++) {
        await storage.addClipboardEntry(`item-${i}`);
      }
      const history = await storage.getClipboardHistory();
      expect(history).toHaveLength(3);
      expect(history.map((h) => h.text)).toEqual(['item-5', 'item-4', 'item-3']);
    });

    it('clamps clipboardHistoryMax to the 1-50 range', async () => {
      await storage.saveSettings({ clipboardHistoryMax: 999 });
      for (let i = 1; i <= 55; i++) {
        await storage.addClipboardEntry(`item-${i}`);
      }
      const history = await storage.getClipboardHistory();
      expect(history).toHaveLength(50);
    });

    it('does not duplicate consecutive identical copies, just refreshes the timestamp', async () => {
      await storage.addClipboardEntry('repetido');
      await storage.addClipboardEntry('repetido');
      const history = await storage.getClipboardHistory();
      expect(history).toHaveLength(1);
      expect(history[0].text).toBe('repetido');
    });

    it('ignores empty string copies', async () => {
      await storage.addClipboardEntry('');
      expect(await storage.getClipboardHistory()).toEqual([]);
    });

    it('trimClipboardHistory() re-applies a lowered cap to existing history', async () => {
      for (let i = 1; i <= 5; i++) {
        await storage.addClipboardEntry(`item-${i}`);
      }
      await storage.saveSettings({ clipboardHistoryMax: 2 });
      const trimmed = await storage.trimClipboardHistory();
      expect(trimmed.map((h) => h.text)).toEqual(['item-5', 'item-4']);
      expect(await storage.getClipboardHistory()).toHaveLength(2);
    });

    it('clearClipboardHistory() empties the history', async () => {
      await storage.addClipboardEntry('algo');
      await storage.clearClipboardHistory();
      expect(await storage.getClipboardHistory()).toEqual([]);
    });
  });
});
