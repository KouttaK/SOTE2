/**
 * src/content/engine/SessionStore.ts
 *
 * Primary in-memory session storage layer for the content script.
 * Provides instantaneous, synchronous reads/writes during typing/expansion
 * while asynchronously mirroring changes to the background SessionService.
 */

import { browser } from 'wxt/browser';
import type { SessionData, SessionScope, SessionVariableEntry } from '../../shared/types/index.js';

export class SessionStore {
  private static instance: SessionStore;
  private memory: SessionData = {};
  private isHydrated = false;

  private constructor() {}

  static getInstance(): SessionStore {
    if (!this.instance) {
      this.instance = new SessionStore();
    }
    return this.instance;
  }

  /**
   * Generates a namespaced storage key based on the requested scope.
   */
  static buildKey(varName: string, scope: SessionScope = 'tab', context?: { url?: string; title?: string }): string {
    const cleanName = varName.trim().toLowerCase();
    switch (scope) {
      case 'url': {
        const rawUrl = context?.url || (typeof window !== 'undefined' ? window.location.href : '');
        // Strip query parameters and hash fragments for deterministic per-page matching
        const normalizedUrl = rawUrl.split('?')[0].split('#')[0];
        return `url_var:${normalizedUrl}:${cleanName}`;
      }
      case 'title': {
        const title = (context?.title || (typeof document !== 'undefined' ? document.title : '')).trim();
        return `title_var:${title}:${cleanName}`;
      }
      case 'global':
        return `global_var:${cleanName}`;
      case 'tab':
      default:
        return `session_var:${cleanName}`;
    }
  }

  /**
   * Lazily checks if a session variable entry has expired.
   */
  static isExpired(entry: unknown): boolean {
    if (!entry || typeof entry !== 'object') return false;
    const e = entry as SessionVariableEntry;
    if (typeof e.savedAt === 'number' && typeof e.ttlHours === 'number' && e.ttlHours > 0) {
      return Date.now() > e.savedAt + e.ttlHours * 3600 * 1000;
    }
    return false;
  }

  /**
   * Synchronously gets a value from the primary in-memory cache.
   * Lazily deletes and returns undefined if expired.
   */
  get<T = unknown>(key: string): T | undefined {
    const entry = this.memory[key];
    if (SessionStore.isExpired(entry)) {
      this.remove(key);
      return undefined;
    }
    return entry as T | undefined;
  }

  /**
   * Synchronously gets all values from the in-memory cache.
   */
  getAll(): SessionData {
    return { ...this.memory };
  }

  /**
   * Synchronously checks if a key exists in the in-memory cache.
   */
  has(key: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.memory, key);
  }

  /**
   * Sets a value in the in-memory cache and asynchronously syncs to the background.
   */
  set(key: string, value: unknown): void {
    this.memory[key] = value;
    try {
      browser.runtime.sendMessage({
        type: 'SET_SESSION_DATA',
        payload: { key, value },
      }).catch(() => {
        // Safe swallow if background or extension context is unavailable
      });
    } catch {
      // Ignored in non-extension contexts or tests without full mocks
    }
  }

  /**
   * Removes a key from the in-memory cache and asynchronously notifies the background.
   */
  remove(key: string): void {
    delete this.memory[key];
    try {
      browser.runtime.sendMessage({
        type: 'REMOVE_SESSION_DATA',
        payload: { key },
      }).catch(() => {});
    } catch {}
  }

  /**
   * Clears the in-memory cache and notifies the background.
   */
  clear(): void {
    this.memory = {};
    try {
      browser.runtime.sendMessage({
        type: 'CLEAR_SESSION_DATA',
      }).catch(() => {});
    } catch {}
  }

  /**
   * Hydrates in-memory session data from the background (e.g. on content script boot/reload).
   */
  async hydrate(): Promise<void> {
    try {
      const response = await browser.runtime.sendMessage({
        type: 'GET_SESSION_DATA',
      });
      if (response && typeof response === 'object' && !('__error' in response)) {
        this.memory = { ...(response as SessionData) };
        this.isHydrated = true;
      }
    } catch {
      // Keep memory as initialized
    }
  }

  /**
   * Checks whether the session has been hydrated from background.
   */
  hydrated(): boolean {
    return this.isHydrated;
  }

  // --- Reusable Input Session Variables ---

  /**
   * Retrieves a reusable session variable.
   * For 'global' scope, coordinates with the background script.
   * For other scopes, reads from synchronous in-memory store with lazy expiry check.
   */
  async getSessionVariable(
    varName: string,
    scope: SessionScope = 'tab',
    context?: { url?: string; title?: string }
  ): Promise<string | undefined> {
    const key = SessionStore.buildKey(varName, scope, context);

    if (scope === 'global') {
      try {
        const res = await browser.runtime.sendMessage({
          type: 'GET_GLOBAL_SESSION_VAR',
          payload: { key },
        });
        const entry = res?.entry;
        if (entry && !SessionStore.isExpired(entry)) {
          return typeof entry === 'string' ? entry : entry.value;
        }
        return undefined;
      } catch {
        // Fallback to local memory if background communication fails
        const entry = this.memory[key];
        if (entry && !SessionStore.isExpired(entry)) {
          return typeof entry === 'string' ? entry : (entry as SessionVariableEntry).value;
        }
        return undefined;
      }
    }

    const raw = this.memory[key];
    if (raw === undefined) return undefined;
    if (SessionStore.isExpired(raw)) {
      this.remove(key);
      return undefined;
    }
    if (typeof raw === 'string') return raw;
    return (raw as SessionVariableEntry).value;
  }

  /**
   * Stores a reusable session variable.
   * For 'global' scope, sends to background.
   * For other scopes, updates in-memory cache and mirrors to background tab session.
   */
  async setSessionVariable(
    varName: string,
    value: string,
    scope: SessionScope = 'tab',
    context?: { url?: string; title?: string },
    ttlHours?: number
  ): Promise<void> {
    const key = SessionStore.buildKey(varName, scope, context);
    const entry: SessionVariableEntry = {
      value,
      savedAt: Date.now(),
      ...(ttlHours && ttlHours > 0 ? { ttlHours } : {}),
    };

    if (scope === 'global') {
      this.memory[key] = entry;
      try {
        await browser.runtime.sendMessage({
          type: 'SET_GLOBAL_SESSION_VAR',
          payload: { key, value: entry },
        });
      } catch {}
    } else {
      this.set(key, entry);
    }
  }

  /**
   * Removes a reusable session variable.
   */
  async removeSessionVariable(
    varName: string,
    scope: SessionScope = 'tab',
    context?: { url?: string; title?: string }
  ): Promise<void> {
    const key = SessionStore.buildKey(varName, scope, context);
    if (scope === 'global') {
      delete this.memory[key];
      try {
        await browser.runtime.sendMessage({
          type: 'REMOVE_GLOBAL_SESSION_VAR',
          payload: { key },
        });
      } catch {}
    } else {
      this.remove(key);
    }
  }

  /**
   * Testing helper to reset in-memory state.
   */
  reset(): void {
    this.memory = {};
    this.isHydrated = false;
  }
}

export const sessionStore = SessionStore.getInstance();
