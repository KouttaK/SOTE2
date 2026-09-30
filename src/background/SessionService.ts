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

  private constructor() {}

  static getInstance(): SessionService {
    if (!this.instance) {
      this.instance = new SessionService();
    }
    return this.instance;
  }

  /**
   * Retrieves the SessionData for a given tabId.
   * Returns a copy of the dictionary to prevent direct external mutation.
   */
  getSession(tabId: number): SessionData {
    if (!this.sessions.has(tabId)) {
      this.sessions.set(tabId, {});
    }
    return { ...this.sessions.get(tabId) };
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

  /**
   * Resets all sessions across all tabs (for test teardowns).
   */
  resetAll(): void {
    this.sessions.clear();
  }
}

export const sessionService = SessionService.getInstance();
