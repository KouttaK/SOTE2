import { browser } from 'wxt/browser';
import type { StorageSchema, Counter } from '../shared/types/index.js';
import { Mutex } from 'async-mutex';

interface CounterReservation {
  counterId: string;
  reservedValue: number;
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
        const lastUsed = counter.lastUsedAt ? new Date(counter.lastUsedAt) : null;
        let needsReset = false;

        if (counter.resetRule !== 'never' && lastUsed) {
          if (counter.resetRule === 'day') {
            needsReset = now.toDateString() !== lastUsed.toDateString();
          } else if (counter.resetRule === 'month') {
            needsReset = now.getMonth() !== lastUsed.getMonth() || now.getFullYear() !== lastUsed.getFullYear();
          } else if (counter.resetRule === 'year') {
            needsReset = now.getFullYear() !== lastUsed.getFullYear();
          }
        }

        if (needsReset) {
          // If a reset rule applies, we restart from the defined startValue
          reservedValue = counter.startValue;
        } else {
          reservedValue = counter.currentValue + counter.step;
        }

        // Apply reservation to storage immediately
        counter.currentValue = reservedValue;
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

      for (const res of reservations) {
        const counter = counters.find((c) => c.id === res.counterId);
        if (counter && counter.currentValue === res.reservedValue) {
          // Revert by one step because nobody else used it yet
          counter.currentValue = counter.currentValue - counter.step;
          changed = true;
        }
      }

      if (changed) {
        await browser.storage.local.set({ [this.storageKey]: counters });
      }
    });
  }
}

