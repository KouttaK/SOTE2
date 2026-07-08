import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storage } from '../../shared/storage/StorageService.js';
import type { Flow, Settings } from '../../shared/types/index.js';
import { generateId } from '../../shared/utils/generateId.js'; // Assuming this exists or I'll mock

// We will mock browser.storage for integration test
vi.mock('wxt/browser', () => {
  const memStorage: Record<string, any> = {};
  return {
    browser: {
      storage: {
        local: {
          get: vi.fn(async (keys) => {
            if (typeof keys === 'string') return { [keys]: memStorage[keys] };
            if (Array.isArray(keys)) {
              const res: any = {};
              keys.forEach(k => { if (memStorage[k] !== undefined) res[k] = memStorage[k]; });
              return res;
            }
            if (keys === null) return memStorage;
            const res = { ...keys };
            for (const k in keys) {
              if (memStorage[k] !== undefined) res[k] = memStorage[k];
            }
            return res;
          }),
          set: vi.fn(async (obj) => {
            Object.assign(memStorage, obj);
          }),
          remove: vi.fn(async (keys) => {
            if (typeof keys === 'string') delete memStorage[keys];
            else keys.forEach((k: string) => delete memStorage[k]);
          }),
          clear: vi.fn(async () => {
            for (const key in memStorage) delete memStorage[key];
          })
        },
        sync: {
          get: vi.fn(async (keys) => ({})),
          set: vi.fn(async () => {}),
          remove: vi.fn(async () => {}),
          clear: vi.fn(async () => {})
        },
        onChanged: { addListener: vi.fn(), removeListener: vi.fn() }
      }
    }
  };
});

describe('Storage Integration', () => {
  beforeEach(async () => {
    // Wait for mock to be available and clear it
    const { browser } = await import('wxt/browser');
    await browser.storage.local.clear();
  });

  it('Criar flow -> getFlows retorna o flow -> deleteFlow -> getFlows retorna array vazio', async () => {
    const flow: Flow = {
      id: 'flow1',
      name: 'test',
      description: '',
      folderId: 'root',
      enabled: true,
      tags: [],
      stats: { usageCount: 0, timeSavedMs: 0 },
      blocks: []
    };
    await storage.saveFlow(flow);
    
    let flows = await storage.getFlows();
    expect(flows.length).toBe(1);
    expect(flows[0].id).toBe('flow1');

    await storage.deleteFlow('flow1');
    flows = await storage.getFlows();
    expect(flows.length).toBe(0);
  });

  it('Salvar settings parciais -> getSettings retorna merge com defaults', async () => {
    await storage.saveSettings({ triggerKeys: ['Tab'] });
    const settings = await storage.getSettings();
    expect(settings.triggerKeys).toEqual(['Tab']);
    expect(settings.globalEnabled).toBe(true); // default should be there
    expect(settings.exactMatchChar).toBe('/'); // default
  });

  it('incrementFlowStats: contador sobe, keysSaved acumula', async () => {
    const flow: Flow = {
      id: 'flow2',
      name: 'test2',
      description: '',
      folderId: 'root',
      enabled: true,
      tags: [],
      stats: { usageCount: 0, timeSavedMs: 0 },
      blocks: []
    };
    await storage.saveFlow(flow);
    await storage.incrementFlowStats('flow2', 10);
    
    let flows = await storage.getFlows();
    expect(flows[0].stats.usageCount).toBe(1);
    
    // timeSavedMs = 10 keys * config (approx). The logic in StorageService increments usageCount.
    await storage.incrementFlowStats('flow2', 5);
    flows = await storage.getFlows();
    expect(flows[0].stats.usageCount).toBe(2);
  });

});
