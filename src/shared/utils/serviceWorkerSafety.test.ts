import { describe, it, expect, vi } from 'vitest';
import { safeContextCall, onContextInvalidated } from './serviceWorkerSafety.js';

describe('serviceWorkerSafety - safeContextCall', () => {
  it('absorbs "No SW" and logs as debug, returning fallback', async () => {
    const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const rejectingFn = async () => { throw new Error('No SW error occurred'); };

    const result = await safeContextCall(rejectingFn, 'fallback_value');
    
    expect(result).toBe('fallback_value');
    expect(consoleDebugSpy).toHaveBeenCalledWith(
      expect.stringContaining('context invalidation'),
      'No SW error occurred'
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleDebugSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('absorbs "Extension context invalidated" without fallback, returning undefined', async () => {
    const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    
    const rejectingFn = async () => { throw new Error('Extension context invalidated'); };

    const result = await safeContextCall(rejectingFn);
    
    expect(result).toBeUndefined();
    expect(consoleDebugSpy).toHaveBeenCalled();

    consoleDebugSpy.mockRestore();
  });

  it('DOES NOT absorb real errors (e.g. "Disco cheio"), logging as error and re-throwing', async () => {
    const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const rejectingFn = async () => { throw new Error('Disco cheio'); };

    await expect(safeContextCall(rejectingFn)).rejects.toThrow('Disco cheio');
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[SOTE] Unhandled error in safeContextCall:',
      expect.any(Error)
    );
    expect(consoleDebugSpy).not.toHaveBeenCalled();

    consoleDebugSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('returns the result normally if no error occurs', async () => {
    const result = await safeContextCall(async () => 'success', 'fallback');
    expect(result).toBe('success');
  });

  it('absorbs real cross-realm iframe Error where (err instanceof Error) is FALSE', async () => {
    const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    // Create a real cross-realm Error from a separate realm (iframe in DOM or vm context in Node)
    let crossRealmError: any;
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const iframe = document.createElement('iframe');
      document.body.appendChild(iframe);
      const IframeError = (iframe.contentWindow as any).Error;
      crossRealmError = new IframeError('Extension context invalidated');
      document.body.removeChild(iframe);
    } else {
      const vm = await import('node:vm');
      crossRealmError = vm.runInNewContext('new Error("Extension context invalidated")');
    }

    // PROOF: In this execution context, instanceof Error is strictly FALSE
    expect(crossRealmError instanceof Error).toBe(false);
    expect(crossRealmError.message).toBe('Extension context invalidated');

    // safeContextCall must absorb it anyway and return the fallback
    const result = await safeContextCall(async () => {
      throw crossRealmError;
    }, 'fallback_cross_realm');

    expect(result).toBe('fallback_cross_realm');
    expect(consoleDebugSpy).toHaveBeenCalledWith(
      expect.stringContaining('context invalidation'),
      'Extension context invalidated'
    );

    consoleDebugSpy.mockRestore();
  });

  it('triggers onContextInvalidated listeners when context error occurs', async () => {
    const listener = vi.fn();
    const unsubscribe = onContextInvalidated(listener);

    const rejectingFn = async () => { throw new Error('Extension context invalidated'); };
    await safeContextCall(rejectingFn);

    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });
});
