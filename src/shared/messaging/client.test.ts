import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendMessage, onMessage } from './client.js';
import { browser } from 'wxt/browser';

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      sendMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  },
}));

describe('client.ts - sendMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns response data on successful message dispatch', async () => {
    (browser.runtime.sendMessage as any).mockResolvedValueOnce({ success: true, count: 42 });

    const result = await sendMessage({ type: 'GET_FLOWS' });
    expect(result).toEqual({ success: true, count: 42 });
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({ type: 'GET_FLOWS' });
  });

  it('absorbs "Extension context invalidated" gracefully and returns undefined', async () => {
    (browser.runtime.sendMessage as any).mockRejectedValueOnce(new Error('Extension context invalidated'));
    const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await sendMessage({ type: 'GET_FLOWS' });

    expect(result).toBeUndefined();
    expect(consoleDebugSpy).toHaveBeenCalledWith(
      expect.stringContaining('Aborted due to context invalidation'),
      'Extension context invalidated'
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleDebugSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('absorbs "No SW" rejection and returns undefined without throwing', async () => {
    (browser.runtime.sendMessage as any).mockRejectedValueOnce(new Error('Error: No SW'));
    const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await sendMessage({ type: 'GET_SETTINGS' });

    expect(result).toBeUndefined();
    expect(consoleDebugSpy).toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleDebugSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('absorbs "Could not establish connection. Receiving end does not exist." rejection', async () => {
    (browser.runtime.sendMessage as any).mockRejectedValueOnce(
      new Error('Could not establish connection. Receiving end does not exist.')
    );
    const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await sendMessage({ type: 'FLOW_USED', payload: { flowId: '123', keysSaved: 5 } });

    expect(result).toBeUndefined();
    expect(consoleDebugSpy).toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleDebugSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('re-throws and logs real unexpected errors', async () => {
    (browser.runtime.sendMessage as any).mockRejectedValueOnce(new Error('Out of memory or internal browser crash'));
    const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(sendMessage({ type: 'GET_FLOWS' })).rejects.toThrow(
      'Out of memory or internal browser crash'
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[SOTE] Unhandled error in safeContextCall:',
      expect.any(Error)
    );
    expect(consoleDebugSpy).not.toHaveBeenCalled();

    consoleDebugSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('re-throws errors returned from background script payload', async () => {
    (browser.runtime.sendMessage as any).mockResolvedValueOnce({
      __error: true,
      message: 'Invalid flow payload',
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(sendMessage({ type: 'FLOW_USED', payload: { flowId: 'x', keysSaved: 1 } })).rejects.toThrow(
      'Invalid flow payload'
    );

    consoleErrorSpy.mockRestore();
  });
});
