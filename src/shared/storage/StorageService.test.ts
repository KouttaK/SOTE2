import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storage } from './StorageService.js';
import { browser } from 'wxt/browser';

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn(),
      },
      sync: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn(),
      }
    }
  }
}));

describe('StorageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles "No SW" context invalidation gracefully during initialise without throwing', async () => {
    // Mock browser.storage.local.get to reject with "No SW" (context invalidated)
    (browser.storage.local.get as any).mockRejectedValueOnce(new Error('No SW'));

    const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // A inicialização não deve lançar exceção não tratada
    await expect(storage.initialise()).resolves.toBeUndefined();

    // Deve logar apenas como debug, e NENHUM console.error deve ser chamado
    expect(consoleDebugSpy).toHaveBeenCalledWith(
      expect.stringContaining('Aborted due to context invalidation'),
      'No SW'
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleDebugSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('handles "No SW" context invalidation gracefully during getSettings without throwing, returning defaults', async () => {
    (browser.storage.local.get as any).mockRejectedValueOnce(new Error('No SW'));

    const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await storage.getSettings();
    expect(result).toBeDefined();
    expect(result.globalEnabled).toBe(true); // default value

    expect(consoleDebugSpy).toHaveBeenCalledWith(
      expect.stringContaining('Aborted due to context invalidation'),
      'No SW'
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleDebugSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('handles "Extension context invalidated" gracefully during importData (replace mode) without throwing, returning fallback counts', async () => {
    (browser.storage.local.clear as any).mockRejectedValueOnce(new Error('Extension context invalidated.'));

    const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await storage.importData(
      {
        flows: [{ id: 'f1', name: 'Test', blocks: [] } as any],
        variables: [{ id: 'v1', key: 'K', value: 'V' }],
      },
      'replace'
    );

    expect(res).toEqual({ flowsCount: 0, varsCount: 0 });
    expect(consoleDebugSpy).toHaveBeenCalledWith(
      expect.stringContaining('Aborted due to context invalidation'),
      'Extension context invalidated.'
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleDebugSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('handles "No SW" gracefully during importData (merge mode) without throwing, returning fallback counts', async () => {
    const saveFlowSpy = vi.spyOn(storage, 'saveFlow').mockRejectedValueOnce(new Error('No SW'));

    const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await storage.importData(
      {
        flows: [{ id: 'f1', name: 'Test', blocks: [] } as any],
      },
      'merge'
    );

    expect(res).toEqual({ flowsCount: 0, varsCount: 0 });
    expect(consoleDebugSpy).toHaveBeenCalledWith(
      expect.stringContaining('Aborted due to context invalidation'),
      'No SW'
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    saveFlowSpy.mockRestore();
    consoleDebugSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('incrementVariablesUsage: increments usageCount for matching variables, initializing from 0 if undefined', async () => {
    const existingVars = [
      { id: '1', key: 'USER_NAME', value: 'Alice', updatedAt: 100 },
      { id: '2', key: 'EMAIL', value: 'a@b.com', updatedAt: 200, usageCount: 5 },
      { id: '3', key: 'COMPANY', value: 'Acme', updatedAt: 300 },
    ];

    (browser.storage.local.get as any).mockImplementation((key: string) => {
      if (key === 'variables') {
        return Promise.resolve({ variables: existingVars });
      }
      return Promise.resolve({});
    });
    (browser.storage.local.set as any).mockResolvedValue(undefined);

    await storage.incrementVariablesUsage(['USER_NAME', 'EMAIL']);

    expect(browser.storage.local.set).toHaveBeenCalledWith({
      variables: [
        { id: '1', key: 'USER_NAME', value: 'Alice', updatedAt: 100, usageCount: 1 },
        { id: '2', key: 'EMAIL', value: 'a@b.com', updatedAt: 200, usageCount: 6 },
        { id: '3', key: 'COMPANY', value: 'Acme', updatedAt: 300 },
      ],
    });
  });

  it('incrementVariablesUsage: returns early without storage write if keys is empty or no variables match', async () => {
    (browser.storage.local.get as any).mockResolvedValue({
      variables: [{ id: '1', key: 'VAR_1', value: 'Val', updatedAt: 100 }],
    });
    (browser.storage.local.set as any).mockResolvedValue(undefined);

    // Empty keys array
    await storage.incrementVariablesUsage([]);
    expect(browser.storage.local.set).not.toHaveBeenCalled();

    // No matching variables
    await storage.incrementVariablesUsage(['NON_EXISTENT']);
    expect(browser.storage.local.set).not.toHaveBeenCalled();
  });

  describe('Migration: applyDelayToAllShortcuts', () => {
    it('migrates applyDelayToAllShortcuts to true when legacy settings had exactMatchDelay > 0', async () => {
      const legacySettings = {
        exactMatchDelay: 200,
        triggerMode: 'exact_match',
      };

      (browser.storage.local.get as any).mockImplementation((keys: any) => {
        if (Array.isArray(keys)) {
          return Promise.resolve({
            settings: legacySettings,
            forms: [],
          });
        }
        return Promise.resolve({});
      });
      (browser.storage.local.set as any).mockResolvedValue(undefined);

      await storage.initialise();

      expect(browser.storage.local.set).toHaveBeenCalledWith({
        settings: expect.objectContaining({
          exactMatchDelay: 200,
          applyDelayToAllShortcuts: true,
        }),
      });
    });

    it('keeps applyDelayToAllShortcuts false for fresh installations without existing settings', async () => {
      (browser.storage.local.get as any).mockImplementation((keys: any) => {
        if (Array.isArray(keys)) {
          return Promise.resolve({}); // empty storage
        }
        return Promise.resolve({});
      });
      (browser.storage.local.set as any).mockResolvedValue(undefined);

      await storage.initialise();

      expect(browser.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({
            applyDelayToAllShortcuts: false,
          }),
        })
      );
    });
  });
});

