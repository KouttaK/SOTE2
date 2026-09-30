import { describe, it, expect, beforeEach, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { SessionStore } from './SessionStore.js';

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      sendMessage: vi.fn(),
    },
  },
}));

describe('SessionStore (Content Script Primary In-Memory Layer)', () => {
  let store: SessionStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = SessionStore.getInstance();
    store.reset();
  });

  it('provides instantaneous synchronous in-memory read and write', () => {
    store.set('ticketNumber', 'INC-999');
    store.set('counter', 15);

    expect(store.get('ticketNumber')).toBe('INC-999');
    expect(store.get('counter')).toBe(15);
    expect(store.has('ticketNumber')).toBe(true);
    expect(store.has('nonExistent')).toBe(false);
    expect(store.getAll()).toEqual({
      ticketNumber: 'INC-999',
      counter: 15,
    });
  });

  it('asynchronously notifies background when setting a value', () => {
    vi.mocked(browser.runtime.sendMessage).mockResolvedValue({ success: true });

    store.set('clientName', 'Empresa X');

    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'SET_SESSION_DATA',
      payload: { key: 'clientName', value: 'Empresa X' },
    });
  });

  it('removes keys synchronously and notifies background', () => {
    vi.mocked(browser.runtime.sendMessage).mockResolvedValue({ success: true });

    store.set('tempToken', 'xyz');
    expect(store.has('tempToken')).toBe(true);

    store.remove('tempToken');
    expect(store.has('tempToken')).toBe(false);
    expect(store.get('tempToken')).toBeUndefined();

    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'REMOVE_SESSION_DATA',
      payload: { key: 'tempToken' },
    });
  });

  it('clears memory synchronously and notifies background', () => {
    vi.mocked(browser.runtime.sendMessage).mockResolvedValue({ success: true });

    store.set('a', 1);
    store.set('b', 2);
    expect(store.getAll()).toEqual({ a: 1, b: 2 });

    store.clear();
    expect(store.getAll()).toEqual({});

    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'CLEAR_SESSION_DATA',
    });
  });

  it('hydrates in-memory session from background on initialization/reload', async () => {
    vi.mocked(browser.runtime.sendMessage).mockResolvedValue({
      restoredField: 'Hello from previous page load',
      activeOrderId: 8841,
    });

    expect(store.hydrated()).toBe(false);

    await store.hydrate();

    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'GET_SESSION_DATA',
    });
    expect(store.hydrated()).toBe(true);
    expect(store.get('restoredField')).toBe('Hello from previous page load');
    expect(store.get('activeOrderId')).toBe(8841);
  });
});
