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

  describe('Reusable Input Session Variables', () => {
    it('builds canonical namespaced keys for each scope', () => {
      expect(SessionStore.buildKey('client_name', 'tab')).toBe('session_var:client_name');
      expect(SessionStore.buildKey('client_name', 'global')).toBe('global_var:client_name');
      expect(SessionStore.buildKey('order_id', 'url', { url: 'https://site.com/dash?page=1#top' })).toBe('url_var:https://site.com/dash:order_id');
      expect(SessionStore.buildKey('page_user', 'title', { title: 'User Profile - Admin' })).toBe('title_var:User Profile - Admin:page_user');
    });

    it('stores and retrieves session variables for tab, url and title scopes in memory', async () => {
      await store.setSessionVariable('cliente', 'João Silva', 'tab');
      expect(await store.getSessionVariable('cliente', 'tab')).toBe('João Silva');

      await store.setSessionVariable('url_token', 'SEC123', 'url', { url: 'https://test.com/app' });
      expect(await store.getSessionVariable('url_token', 'url', { url: 'https://test.com/app' })).toBe('SEC123');
      expect(await store.getSessionVariable('url_token', 'url', { url: 'https://test.com/other' })).toBeUndefined();

      await store.setSessionVariable('ctx', 'Admin', 'title', { title: 'Dashboard' });
      expect(await store.getSessionVariable('ctx', 'title', { title: 'Dashboard' })).toBe('Admin');
      expect(await store.getSessionVariable('ctx', 'title', { title: 'Settings' })).toBeUndefined();
    });

    it('coordinates with background for global scope variables', async () => {
      vi.mocked(browser.runtime.sendMessage).mockResolvedValueOnce({ success: true });
      await store.setSessionVariable('global_company', 'Acme Corp', 'global');

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'SET_GLOBAL_SESSION_VAR',
        payload: {
          key: 'global_var:global_company',
          value: expect.objectContaining({ value: 'Acme Corp' }),
        },
      });

      vi.mocked(browser.runtime.sendMessage).mockResolvedValueOnce({
        entry: { value: 'Acme Corp', savedAt: Date.now() },
      });
      const res = await store.getSessionVariable('global_company', 'global');
      expect(res).toBe('Acme Corp');
    });

    it('lazily expires session variables when TTL has passed', async () => {
      const twoHoursAgo = Date.now() - 2 * 3600 * 1000 - 1000;
      // Inject expired entry directly into memory
      (store as any).memory['session_var:expired_item'] = {
        value: 'Old',
        savedAt: twoHoursAgo,
        ttlHours: 1,
      };

      const val = await store.getSessionVariable('expired_item', 'tab');
      expect(val).toBeUndefined();
      expect(store.has('session_var:expired_item')).toBe(false);
    });

    it('removes session variables correctly', async () => {
      await store.setSessionVariable('temp', 'to_delete', 'tab');
      expect(await store.getSessionVariable('temp', 'tab')).toBe('to_delete');

      await store.removeSessionVariable('temp', 'tab');
      expect(await store.getSessionVariable('temp', 'tab')).toBeUndefined();
    });
  });
});
