/**
 * src/content/engine/UndoManager.ts
 *
 * Manages the expansion undo window (default 5s, configurable 0-10s).
 * - Intercepts Backspace and/or Ctrl+Z within the window to restore the typed shortcut.
 * - Releases reserved counter numbers (reverting if last emitted, or permanent gap if another emitted).
 * - Cancels deferred stats (FLOW_USED, VARIABLES_USED) on undo.
 * - Flushes stats and confirms counters when the window expires or user moves/types further.
 * - Preserves native browser Ctrl+Z / Backspace outside the active window.
 */

import { sendMessage } from '../../shared/messaging/client.js';
import type { Settings } from '../../shared/types/index.js';
import { isProtected } from './SensitiveFieldGuard.js';
import { TextInjector } from './TextInjector.js';

export interface PendingExpansion {
  element: HTMLElement;
  shortcutTyped: string;
  expandedContent: string;
  isRichText: boolean;
  cursorOffset: number | null;
  shortcutStartPos?: number;
  counterReservations?: Array<{ counterId: string; reservedValue: number }>;
  stats?: {
    flowId: string;
    keysSaved: number;
    usedVarKeys: string[];
  };
  expiresAt: number;
}

export class UndoManager {
  private pending: PendingExpansion | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private recordTimestamp: number = 0;
  private getSettings: () => Settings;

  constructor(getSettings: () => Settings) {
    this.getSettings = getSettings;
  }

  /**
   * Registers a newly completed expansion into the undo window.
   * Commits any previously pending expansion first.
   */
  public recordExpansion(params: {
    element: HTMLElement;
    shortcutTyped: string;
    expandedContent: string;
    isRichText: boolean;
    cursorOffset: number | null;
    shortcutStartPos?: number;
    counterReservations?: Array<{ counterId: string; reservedValue: number }>;
    stats?: {
      flowId: string;
      keysSaved: number;
      usedVarKeys: string[];
    };
  }): void {
    // If an expansion was already pending, commit it before starting a new one
    if (this.pending) {
      this.commitPending();
    }

    const settings = this.getSettings();
    const enabled = settings.undoEnabled ?? true;
    const windowSeconds = settings.undoWindowSeconds ?? 5;

    // If undo is disabled or window is 0s, immediately commit and return
    if (!enabled || windowSeconds <= 0) {
      this.flushExpansion(params);
      return;
    }

    const durationMs = windowSeconds * 1000;
    this.recordTimestamp = Date.now();
    this.pending = {
      ...params,
      expiresAt: this.recordTimestamp + durationMs,
    };

    this.timer = setTimeout(() => {
      this.commitPending();
    }, durationMs);
  }

  /**
   * Commits the pending expansion: flushes deferred stats and confirms counters.
   */
  public commitPending(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (!this.pending) return;

    const pending = this.pending;
    this.pending = null;

    this.flushExpansion(pending);
  }

  /**
   * Helper that dispatches stats and confirms counters.
   */
  private flushExpansion(item: {
    counterReservations?: Array<{ counterId: string; reservedValue: number }>;
    stats?: {
      flowId: string;
      keysSaved: number;
      usedVarKeys: string[];
    };
  }): void {
    // 1. Confirm counters
    if (item.counterReservations && item.counterReservations.length > 0) {
      sendMessage({
        type: 'CONFIRM_COUNTERS',
        payload: { reservations: item.counterReservations },
      }).catch(() => {});
    }

    // 2. Dispatch deferred usage stats
    if (item.stats) {
      sendMessage({
        type: 'FLOW_USED',
        payload: { flowId: item.stats.flowId, keysSaved: item.stats.keysSaved },
      }).catch(() => {});

      if (item.stats.usedVarKeys && item.stats.usedVarKeys.length > 0) {
        sendMessage({
          type: 'VARIABLES_USED',
          payload: { keys: item.stats.usedVarKeys },
        }).catch(() => {});
      }
    }
  }

  /**
   * Reverts the expansion in the DOM, releases counters, and discards stats.
   * Returns true if an expansion was successfully undone.
   */
  public undo(): boolean {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (!this.pending) return false;

    // Check if element became protected between expansion and undo
    if (isProtected(this.pending.element)) {
      this.commitPending();
      return false;
    }

    // Check expiry
    if (Date.now() > this.pending.expiresAt) {
      this.commitPending();
      return false;
    }

    const pending = this.pending;
    this.pending = null;

    // 1. Restore text in the target element
    const restored = TextInjector.undo(
      pending.element,
      pending.shortcutTyped,
      pending.expandedContent,
      pending.isRichText,
      pending.shortcutStartPos
    );

    if (restored) {
      // 2. Release counter reservations (CounterService will check if last emitted)
      if (pending.counterReservations && pending.counterReservations.length > 0) {
        sendMessage({
          type: 'RELEASE_COUNTERS',
          payload: { reservations: pending.counterReservations },
        }).catch(() => {});
      }

      // 3. Stats are intentionally DISCARDED (not sent).
      // 4. SessionStore remains intact (independent by product design).
      return true;
    } else {
      // If restoration failed (e.g. text was altered by another script or DOM node removed),
      // flush stats and confirm counters so reservations are not left in limbo
      this.flushExpansion(pending);
      return false;
    }
  }

  /**
   * Evaluates keydown events. If a configured undo trigger occurs inside the active window,
   * undoes the expansion, cancels default browser behavior, and returns true.
   * If any other regular key is pressed, commits the expansion.
   */
  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.pending) return false;

    if (Date.now() > this.pending.expiresAt) {
      this.commitPending();
      return false;
    }

    const settings = this.getSettings();
    const enabled = settings.undoEnabled ?? true;
    const windowSeconds = settings.undoWindowSeconds ?? 5;
    if (!enabled || windowSeconds <= 0) {
      this.commitPending();
      return false;
    }

    const trigger = settings.undoTrigger ?? 'both';
    const isBackspace = e.key === 'Backspace' && !e.ctrlKey && !e.metaKey && !e.altKey;
    const isCtrlZ =
      ((e.key === 'z' || e.key === 'Z' || e.key === '\x1a') || e.code === 'KeyZ') &&
      (e.ctrlKey || e.metaKey) &&
      !e.altKey;

    const isMatch =
      (trigger === 'both' && (isBackspace || isCtrlZ)) ||
      (trigger === 'backspace' && isBackspace) ||
      (trigger === 'ctrl_z' && isCtrlZ);

    if (isMatch) {
      const restored = this.undo();
      if (restored) {
        e.preventDefault();
        e.stopPropagation();
        return true;
      }
      return false;
    }

    // Ignore trailing keydown events that fired in the same event loop tick / immediate window as the expansion
    if (Date.now() - this.recordTimestamp < 50) {
      return false;
    }

    // If user pressed a modifier key (Shift, Ctrl, Alt, Meta, AltGraph), keep window open
    if (['Shift', 'Control', 'Alt', 'Meta', 'AltGraph'].includes(e.key)) {
      return false;
    }

    // Any other action (typing next letter, navigating) confirms the expansion immediately
    this.commitPending();
    return false;
  }

  /**
   * Flushes any pending stats and counter confirmations (e.g. on visibilitychange).
   */
  public flush(): void {
    this.commitPending();
  }

  /**
   * Checks if an expansion is currently pending within its window.
   */
  public hasPending(): boolean {
    return !!this.pending && Date.now() <= this.pending.expiresAt;
  }

  /**
   * For testing inspection.
   */
  public getPending(): PendingExpansion | null {
    return this.pending;
  }

  /**
   * Cleans up all state without flushing (for testing resets).
   */
  public reset(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pending = null;
  }
}
