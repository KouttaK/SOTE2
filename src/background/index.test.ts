import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as any).defineBackground = vi.fn((fn: any) => fn);
});

import { updateIcon } from './index.js';
import { storage } from '../shared/storage/StorageService.js';
import { browser } from 'wxt/browser';

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
      sync: { get: vi.fn(), set: vi.fn(), remove: vi.fn() }
    },
    tabs: { query: vi.fn() },
    action: { setBadgeText: vi.fn(), setBadgeBackgroundColor: vi.fn() }
  }
}));

describe('Background updateIcon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles "No SW" context invalidation gracefully without throwing', async () => {
    // Mock tabs.query to throw
    (browser.tabs.query as any).mockRejectedValueOnce(new Error('Extension context invalidated'));

    const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(updateIcon()).resolves.toBeUndefined();

    expect(consoleDebugSpy).toHaveBeenCalledWith(
      expect.stringContaining('Aborted due to context invalidation'),
      'Extension context invalidated'
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleDebugSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});
