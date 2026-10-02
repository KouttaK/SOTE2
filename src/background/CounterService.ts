import { browser } from 'wxt/browser';
import type { StorageSchema, Counter } from '../shared/types/index.js';
import { Mutex } from 'async-mutex';

interface CounterReservation {
  counterId: string;
  reservedValue: number;
}

export function isSameCivilDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function isSameCivilMonth(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth()
  );
}

export function isSameCivilYear(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear();
}

/**
 * Checks if a counter needs to be reset based on its resetRule and lastUsedAt timestamp.
 * Resets occur when the current date has advanced to a new civil period (day, month, or year)
 * in the local timezone compared to the last used date.
 * If the clock was moved backwards in time (now < lastUsed), it does NOT trigger a reset,
 * preventing unexpected resets when returning to an already-used civil period.
 */
export function checkCounterNeedsReset(
  resetRule: 'never' | 'day' | 'month' | 'year',
  lastUsedAt?: number,
  now: Date = new Date()
): boolean {
  if (resetRule === 'never' || !lastUsedAt) {
    return false;
  }

  const lastUsed = new Date(lastUsedAt);

  // Se o relógio do sistema retrocedeu no tempo (now < lastUsed),
  // não reseta (protege contra reversão de teste de data, ajuste de fuso ou NTP).
  if (now.getTime() < lastUsed.getTime()) {
    return false;
  }

  if (resetRule === 'day') {
    return !isSameCivilDay(now, lastUsed);
  }
  if (resetRule === 'month') {
    return !isSameCivilMonth(now, lastUsed);
  }
  if (resetRule === 'year') {
    return !isSameCivilYear(now, lastUsed);
  }

  return false;
}

export class CounterService {
  private static instance: CounterService;
  private storageKey = 'counters';
  // Centralized mutex to serialize storage reads/writes for counters globally
  private mutex = new Mutex();

  private constructor() {}

  static getInstance(): CounterService {
    if (!this.instance) {
      this.instance = new CounterService();
    }
    return this.instance;
  }

  /**
   * Reserves a counter value.
   * Increments the `currentValue` in storage if required by rules.
   * Returns the value that was reserved (or current if not incrementing).
   */
  async reserveCounter(
    counterId: string,
    incrementMode: 'always' | 'visible_only',
    displayMode: 'visible' | 'silent',
    isSimulation?: boolean
  ): Promise<{ reservedValue: number | null, counter: Counter | null }> {
    return this.mutex.runExclusive(async () => {
      const data = await browser.storage.local.get(this.storageKey);
      const counters: Counter[] = data[this.storageKey] || [];
      const counterIndex = counters.findIndex((c) => c.id === counterId);

      if (counterIndex === -1) {
        console.warn(`[SOTE] Counter not found: ${counterId}`);
        return { reservedValue: null, counter: null };
      }

      const counter = counters[counterIndex];
      const shouldIncrement = !isSimulation && (incrementMode === 'always' || displayMode === 'visible');
      
      let reservedValue = counter.currentValue;

      if (shouldIncrement) {
        // Evaluate the reset rule before incrementing
        const now = new Date();
        const needsReset = checkCounterNeedsReset(counter.resetRule, counter.lastUsedAt, now);

        if (needsReset) {
          // If a reset rule applies, we restart from the defined startValue
          reservedValue = counter.startValue;
        } else {
          reservedValue = counter.currentValue;
        }

        // Apply reservation to storage immediately: advance currentValue by step for subsequent reservations
        counter.currentValue = reservedValue + counter.step;
        counter.lastUsedAt = now.getTime();
        
        await browser.storage.local.set({ [this.storageKey]: counters });
      }

      return { reservedValue, counter };
    });
  }

  /**
   * Confirms reservations.
   * Currently just updates history to keep track of the last N generated numbers.
   */
  async confirmCounters(reservations: CounterReservation[]): Promise<void> {
    if (!reservations || reservations.length === 0) return;

    await this.mutex.runExclusive(async () => {
      const data = await browser.storage.local.get(this.storageKey);
      const counters: Counter[] = data[this.storageKey] || [];
      let changed = false;

      for (const res of reservations) {
        const counter = counters.find((c) => c.id === res.counterId);
        if (counter) {
          if (!counter.history) counter.history = [];
          counter.history.unshift(res.reservedValue);
          if (counter.history.length > 10) {
            counter.history = counter.history.slice(0, 10);
          }
          changed = true;
        }
      }

      if (changed) {
        await browser.storage.local.set({ [this.storageKey]: counters });
      }
    });
  }

  /**
   * Releases reservations if the injection was canceled.
   * Only reverts the currentValue if the counter hasn't been incremented further by another tab.
   * This leaves a permanent gap if another flow used it in the meantime.
   */
  async releaseCounters(reservations: CounterReservation[]): Promise<void> {
    if (!reservations || reservations.length === 0) return;

    await this.mutex.runExclusive(async () => {
      const data = await browser.storage.local.get(this.storageKey);
      const counters: Counter[] = data[this.storageKey] || [];
      let changed = false;

      // Sort reservations in descending order (LIFO) so newest is processed first
      const sortedReservations = [...reservations].sort((a, b) => b.reservedValue - a.reservedValue);

      for (const res of sortedReservations) {
        const counter = counters.find((c) => c.id === res.counterId);
        if (counter && counter.currentValue === res.reservedValue + counter.step) {
          // Revert because nobody else used it yet in the meantime
          counter.currentValue = res.reservedValue;
          changed = true;
        }
      }

      if (changed) {
        await browser.storage.local.set({ [this.storageKey]: counters });
      }
    });
  }
}

