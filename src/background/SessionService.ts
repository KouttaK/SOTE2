/**
 * src/background/SessionService.ts
 *
 * Background fallback and multi-tab isolation layer for ephemeral session storage.
 * Stores data in a Map<tabId, SessionData>, automatically cleaned up on tabs.onRemoved.
 */

import type { SessionData } from '../shared/types/index.js';

export class SessionService {
  private static instance: SessionService;
  private sessions = new Map<number, SessionData>();
  private globalSession: SessionData = {};

  private constructor() {}

  static getInstance(): SessionService {
    if (!this.instance) {
      this.instance = new SessionService();
    }
    return this.instance;
  }

  /**
   * Checks whether a session entry has expired based on savedAt and ttlHours.
   * Pure lazy verification — no background timer is run.
   */
  private isEntryExpired(entry: unknown): boolean {
    if (!entry || typeof entry !== 'object') return false;
    const e = entry as { savedAt?: number; ttlHours?: number };
    if (typeof e.savedAt === 'number' && typeof e.ttlHours === 'number' && e.ttlHours > 0) {
      return Date.now() > e.savedAt + e.ttlHours * 3600 * 1000;
    }
    return false;
  }

  /**
   * Retrieves the SessionData for a given tabId.
   * Returns a copy of the dictionary with expired entries lazily pruned.
   */
  getSession(tabId: number): SessionData {
    if (!this.sessions.has(tabId)) {
      this.sessions.set(tabId, {});
    }
    const session = this.sessions.get(tabId)!;
    // Lazy purge expired entries
    for (const [key, val] of Object.entries(session)) {
      if (this.isEntryExpired(val)) {
        delete session[key];
      }
    }
    return { ...session };
  }

  /**
   * Sets a key-value pair for a specific tabId.
   */
  setSessionValue(tabId: number, key: string, value: unknown): void {
    if (!this.sessions.has(tabId)) {
      this.sessions.set(tabId, {});
    }
    const session = this.sessions.get(tabId)!;
    session[key] = value;
  }

  /**
   * Retrieves a specific key from the session of a tabId.
   */
  getSessionValue<T = unknown>(tabId: number, key: string): T | undefined {
    const session = this.sessions.get(tabId);
    if (!session) return undefined;
    const entry = session[key];
    if (this.isEntryExpired(entry)) {
      delete session[key];
      return undefined;
    }
    return entry as T | undefined;
  }

  /**
   * Removes a specific key from the session of a tabId.
   */
  removeSessionValue(tabId: number, key: string): void {
    const session = this.sessions.get(tabId);
    if (session) {
      delete session[key];
    }
  }

  /**
   * Clears the entire session for a tabId.
   */
  clearSession(tabId: number): void {
    this.sessions.delete(tabId);
  }

  /**
   * Triggered when a tab is closed via browser.tabs.onRemoved.
   */
  handleTabRemoved(tabId: number): void {
    this.sessions.delete(tabId);
  }

  /**
   * Checks if an active session exists for tabId.
   */
  hasSession(tabId: number): boolean {
    return this.sessions.has(tabId);
  }

  // --- Global (All Tabs) Ephemeral Session Methods ---

  /**
   * Retrieves a global session variable across all tabs.
   * Lazily drops expired entries.
   */
  getGlobalValue<T = unknown>(key: string): T | undefined {
    const entry = this.globalSession[key];
    if (this.isEntryExpired(entry)) {
      delete this.globalSession[key];
      return undefined;
    }
    return entry as T | undefined;
  }

  /**
   * Sets a global session variable across all tabs.
   * Lives strictly in background memory until browser process termination.
   */
  setGlobalValue(key: string, value: unknown): void {
    this.globalSession[key] = value;
  }

  /**
   * Removes a global session variable.
   */
  removeGlobalValue(key: string): void {
    delete this.globalSession[key];
  }

  /**
   * Clears all global session variables.
   */
  clearGlobalSession(): void {
    this.globalSession = {};
  }

  /**
   * Resets all sessions across all tabs and global session (for test teardowns).
   */
  resetAll(): void {
    this.sessions.clear();
    this.globalSession = {};
  }
}

export const sessionService = SessionService.getInstance();
