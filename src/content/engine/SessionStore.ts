/**
 * src/content/engine/SessionStore.ts
 *
 * Primary in-memory session storage layer for the content script.
 * Provides instantaneous, synchronous reads/writes during typing/expansion
 * while asynchronously mirroring changes to the background SessionService.
 */

import { browser } from 'wxt/browser';
import type { SessionData } from '../../shared/types/index.js';

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
   * Synchronously gets a value from the primary in-memory cache.
   */
  get<T = unknown>(key: string): T | undefined {
    return this.memory[key] as T | undefined;
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

  /**
   * Testing helper to reset in-memory state.
   */
  reset(): void {
    this.memory = {};
    this.isHydrated = false;
  }
}

export const sessionStore = SessionStore.getInstance();
