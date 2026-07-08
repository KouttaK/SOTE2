import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TextInjector } from '../../content/engine/TextInjector';
import contentScript from '../../content';

// Auto-imports for wxt
(globalThis as any).defineContentScript = (config: any) => config;

vi.mock('../../shared/messaging/client.js', () => ({
  sendMessage: vi.fn((msg) => {
    if (msg.type === 'GET_FLOWS') {
      return Promise.resolve([{ 
        id: 'flow1', 
        shortcut: 'test', 
        blocks: [{ type: 'action', data: { text: 'expanded', tokens: [] } }] 
      }]);
    }
    if (msg.type === 'GET_SETTINGS') return Promise.resolve({ exactMatchDelay: 200, triggerMode: 'exact_match' });
    if (msg.type === 'GET_CLIPBOARD_HISTORY') return Promise.resolve([]);
    return Promise.resolve();
  }),
  onMessage: vi.fn(),
}));

let capturedExactMatchCallback: any = null;

vi.mock('../../content/engine/TextMonitor.js', () => ({
  TextMonitor: class {
    buffer = 'test';
    constructor(exactMatchCb: any, triggerCb: any) {
      capturedExactMatchCallback = exactMatchCb;
    }
    start() {}
    getBuffer() { return this.buffer; }
    pause() {}
    resume() {}
  }
}));

vi.mock('../../content/engine/TriggerDetector.js', () => ({
  TriggerDetector: class {
    detectExactMatchMode() {
      return { 
        flow: { 
          id: 'flow1', 
          blocks: [{ type: 'action', data: { text: 'expanded', tokens: [] } }] 
        }, 
        shortcutTyped: 'test' 
      };
    }
    updateData() {}
    resolveActionBlock() {
      return { format: 'plaintext', content: 'expanded', tokens: [] };
    }
  }
}));

vi.mock('../../content/engine/TextInjector.js', () => ({
  TextInjector: {
    inject: vi.fn()
  }
}));

describe('Exact Match Delay in content.ts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should wait for exactMatchDelay before injecting', async () => {
    await (contentScript as any).main();
    
    expect(capturedExactMatchCallback).toBeDefined();

    const fakeElement = document.createElement('div');
    Object.defineProperty(document, 'activeElement', { value: fakeElement, configurable: true });

    // Simulate typing that matches
    capturedExactMatchCallback({} as any, 'test', fakeElement);

    // Should not inject yet
    expect(TextInjector.inject).not.toHaveBeenCalled();

    // Advance time by 100ms. Using the *Async variant because handleTrigger
    // now awaits the extracted resolveActionBlockContent() pipeline
    // (ActionContentResolver.ts) — even with zero tokens to resolve,
    // awaiting an async function call always yields at least one
    // microtask, so the timer callback's continuation needs a flush that
    // plain advanceTimersByTime() (sync) doesn't provide.
    await vi.advanceTimersByTimeAsync(100);
    expect(TextInjector.inject).not.toHaveBeenCalled();

    // Advance remaining time
    await vi.advanceTimersByTimeAsync(100);

    // Now it should have injected
    expect(TextInjector.inject).toHaveBeenCalled();
  });
});
