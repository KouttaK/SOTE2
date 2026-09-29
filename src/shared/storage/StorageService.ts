/**
 * StorageService — singleton that wraps the WebExtensions Storage API.
 *
 * Defaults to browser.storage.local.
 * Call enableSync() to migrate data to browser.storage.sync (with
 * automatic chunking to stay within the 8 KB-per-item limit).
 * Call disableSync() to migrate back to local.
 *
 * All methods are safe to call on an empty storage: they return sane
 * defaults and never throw uncaught exceptions.
 */

import { browser } from 'wxt/browser';
import { localDateKey } from '../utils/localDate.js';
import type {
  Flow,
  Variable,
  Folder,
  Form,
  Settings,
  StorageSchema,
  ClipboardEntry,
} from '../types/index.js';
import {
  DEFAULT_SETTINGS,
  SYNC_ENABLED_KEY,
  SYNC_ITEM_MAX_BYTES,
  DEFAULT_CLIPBOARD_HISTORY_MAX,
  MAX_CLIPBOARD_HISTORY_LIMIT,
  buildDefaultForms,
} from './defaults.js';
import { safeContextCall } from '../utils/serviceWorkerSafety.js';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type StorageArea = typeof browser.storage.local;

/** Keys used in the storage area. */
const KEYS = {
  flows: 'flows',
  variables: 'variables',
  folders: 'folders',
  forms: 'forms',
  settings: 'settings',
  clipboardHistory: 'clipboardHistory',
} as const;

// ---------------------------------------------------------------------------
// Chunking helpers (for sync mode, 8 KB limit)
// ---------------------------------------------------------------------------

function chunkString(str: string, maxBytes: number): string[] {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let offset = 0;

  while (offset < str.length) {
    // Binary-search for the largest sub-string that fits within maxBytes
    // when encoded as UTF-8. A naive /3 divisor under-counts multi-byte
    // characters (emoji = 4 bytes, CJK = 3 bytes) and can still exceed
    // the sync quota limit.
    let lo = 1;
    let hi = str.length - offset;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (encoder.encode(str.slice(offset, offset + mid)).byteLength <= maxBytes) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    chunks.push(str.slice(offset, offset + lo));
    offset += lo;
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// StorageService
// ---------------------------------------------------------------------------

class StorageService {
  private syncEnabled = false;

  // -------------------------------------------------------------------------
  // Boot-strap: called lazily on first access
  // -------------------------------------------------------------------------

  private async getArea(): Promise<StorageArea> {
    if (this.syncEnabled && browser.storage.sync) {
      return browser.storage.sync;
    }
    return browser.storage.local;
  }

  /**
   * Reads the entire storage and ensures DEFAULT_SETTINGS are present if
   * this is the first run (storage is empty or settings key is missing).
   */
  async initialise(): Promise<void> {
    await safeContextCall(async () => {
      // Restore sync preference from local storage.
      const localRaw = await browser.storage.local.get(SYNC_ENABLED_KEY);
      if (localRaw[SYNC_ENABLED_KEY] === true) {
        this.syncEnabled = true;
      }

      const area = await this.getArea();
      const data = await area.get([KEYS.settings, KEYS.forms]);

      if (!data[KEYS.settings]) {
        await area.set({ [KEYS.settings]: DEFAULT_SETTINGS });
      } else {
        // Migration check: If the user previously had exactMatchDelay > 0 configured
        // before applyDelayToAllShortcuts existed, preserve legacy behaviour by setting it to true.
        const existingSettings = data[KEYS.settings] as Partial<Settings>;
        if (
          existingSettings.applyDelayToAllShortcuts === undefined &&
          typeof existingSettings.exactMatchDelay === 'number' &&
          existingSettings.exactMatchDelay > 0
        ) {
          existingSettings.applyDelayToAllShortcuts = true;
          await area.set({ [KEYS.settings]: existingSettings });
        }
      }

      // First run only: seed onboarding example Forms. Keyed off the
      // `forms` storage key itself being entirely absent (never
      // initialised) rather than an empty array, so a user who deletes
      // every Form afterwards doesn't get them silently repopulated.
      if (data[KEYS.forms] === undefined) {
        await area.set({ [KEYS.forms]: buildDefaultForms() });
      }
    });
  }

  // -------------------------------------------------------------------------
  // Generic read / write helpers
  // -------------------------------------------------------------------------

  private async readList<T>(key: string): Promise<T[]> {
    return safeContextCall(async () => {
      const area = await this.getArea();

      // If sync is enabled, reassemble possible chunks.
      if (this.syncEnabled && browser.storage.sync) {
        const chunkKeysRaw = await browser.storage.sync.get(`${key}__chunks`);
        const chunkCount: number = chunkKeysRaw[`${key}__chunks`] ?? 0;

        if (chunkCount > 0) {
          const chunkKeys = Array.from(
            { length: chunkCount },
            (_, i) => `${key}__chunk_${i}`,
          );
          const chunksRaw = await browser.storage.sync.get(chunkKeys);
          const combined = chunkKeys.map((k) => (chunksRaw[k] as string) ?? '').join('');
          return JSON.parse(combined) as T[];
        }
      }

      const raw = await area.get(key);
      return (raw[key] as T[]) ?? [];
    }, []);
  }

  private async writeList<T>(key: string, list: T[]): Promise<void> {
    await safeContextCall(async () => {
      const area = await this.getArea();
      const json = JSON.stringify(list);

      if (this.syncEnabled && browser.storage.sync) {
        // Remove old chunks (and the chunk-count key) first so no stale
        // metadata is left behind if we end up writing a non-chunked item.
        const oldMeta = await browser.storage.sync.get(`${key}__chunks`);
        const oldCount: number = oldMeta[`${key}__chunks`] ?? 0;
        if (oldCount > 0) {
          const oldKeys = Array.from({ length: oldCount }, (_, i) => `${key}__chunk_${i}`);
          await browser.storage.sync.remove([`${key}__chunks`, ...oldKeys]);
        }

        const chunks = chunkString(json, SYNC_ITEM_MAX_BYTES);

        // A-05: Verify we won't exceed the total sync quota before writing.
        const encoder = new TextEncoder();
        const newBytes = encoder.encode(json).byteLength;
        try {
          const inUse = await (browser.storage.sync as any).getBytesInUse(null);
          const existing = await (browser.storage.sync as any).getBytesInUse(key);
          const QUOTA = 102400;
          if (inUse - existing + newBytes > QUOTA) {
            throw new Error(
              `[SOTE] Sync storage quota would be exceeded saving "${key}" ` +
              `(${newBytes} bytes needed, ${QUOTA - inUse + existing} bytes available). ` +
              `Consider disabling sync or deleting unused flows.`
            );
          }
        } catch (quotaErr: any) {
          // getBytesInUse may not exist in all environments; only re-throw
          // when it's our own quota message, not a "not implemented" error.
          if (String(quotaErr.message).startsWith('[SOTE]')) throw quotaErr;
        }

        if (chunks.length === 1) {
          // Small enough to store directly (no __chunks metadata needed).
          await area.set({ [key]: list });
          return;
        }

        // Store chunks + metadata.
        const chunkEntries: Record<string, string | number> = {
          [`${key}__chunks`]: chunks.length,
        };
        chunks.forEach((chunk, i) => {
          chunkEntries[`${key}__chunk_${i}`] = chunk;
        });
        await browser.storage.sync.set(chunkEntries);
      } else {
        await area.set({ [key]: list });
      }
    });
  }
  // -------------------------------------------------------------------------
  // Write-queue for list mutations (C-02)
  //
  // saveFlow / saveVariable / saveFolder / saveForm all do a
  // read-modify-write cycle that is NOT atomic: two concurrent calls
  // (e.g. two tabs expanding flows simultaneously) can both read the same
  // stale list, each apply their mutation, and the second write silently
  // clobbers the first. The queue below serialises these operations so
  // each one completes before the next begins — same pattern already used
  // for clipboardHistory above.
  // -------------------------------------------------------------------------

  private flowsQueue: Promise<unknown> = Promise.resolve();
  private variablesQueue: Promise<unknown> = Promise.resolve();
  private foldersQueue: Promise<unknown> = Promise.resolve();
  private formsQueue: Promise<unknown> = Promise.resolve();

  private enqueueListOp<T>(
    queue: 'flows' | 'variables' | 'folders' | 'forms',
    op: () => Promise<T>,
  ): Promise<T> {
    const queueKey = `${queue}Queue` as
      | 'flowsQueue'
      | 'variablesQueue'
      | 'foldersQueue'
      | 'formsQueue';
    const result = (this[queueKey] as Promise<unknown>).then(op, op);
    this[queueKey] = result.then(
      () => undefined,
      () => undefined,
    ) as Promise<unknown>;
    return result;
  }

  // -------------------------------------------------------------------------
  // Flows
  // -------------------------------------------------------------------------


  async getFlows(): Promise<Flow[]> {
    const list = await this.readList<Flow>(KEYS.flows);
    return list.map((f) => ({
      ...f,
      tags: Array.isArray(f.tags) ? f.tags : [],
      blocks: Array.isArray(f.blocks) ? f.blocks : [],
      enabled: typeof f.enabled === 'boolean' ? f.enabled : true,
      stats: {
        usageCount: f.stats?.usageCount ?? 0,
        keysSaved: f.stats?.keysSaved ?? 0,
        failureCount: f.stats?.failureCount ?? 0,
        lastUsed: f.stats?.lastUsed,
      },
    }));
  }

  async getFlow(id: string): Promise<Flow | null> {
    const flows = await this.getFlows();
    return flows.find((f) => f.id === id) ?? null;
  }

  async saveFlow(flow: Flow): Promise<void> {
    return this.enqueueListOp('flows', async () => {
      const flows = await this.getFlows();
      const normalizedFlow: Flow = {
        ...flow,
        tags: Array.isArray(flow.tags) ? flow.tags : [],
        blocks: Array.isArray(flow.blocks) ? flow.blocks : [],
        enabled: typeof flow.enabled === 'boolean' ? flow.enabled : true,
        stats: {
          usageCount: flow.stats?.usageCount ?? 0,
          keysSaved: flow.stats?.keysSaved ?? 0,
          failureCount: flow.stats?.failureCount ?? 0,
          lastUsed: flow.stats?.lastUsed,
        },
      };
      const idx = flows.findIndex((f) => f.id === flow.id);
      if (idx >= 0) {
        flows[idx] = normalizedFlow;
      } else {
        flows.push(normalizedFlow);
      }
      await this.writeList(KEYS.flows, flows);
    });
  }

  async deleteFlow(id: string): Promise<void> {
    return this.enqueueListOp('flows', async () => {
      const flows = await this.getFlows();
      await this.writeList(
        KEYS.flows,
        flows.filter((f) => f.id !== id),
      );
    });
  }

  async toggleFlow(id: string): Promise<void> {
    return this.enqueueListOp('flows', async () => {
      const flow = await this.getFlow(id);
      if (!flow) return;
      const flows = await this.getFlows();
      const idx = flows.findIndex((f) => f.id === id);
      if (idx < 0) return;
      flows[idx] = { ...flow, enabled: !flow.enabled, updatedAt: Date.now() };
      await this.writeList(KEYS.flows, flows);
    });
  }


  async incrementFlowStats(id: string, keysSaved: number): Promise<void> {
    const flow = await this.getFlow(id);
    if (!flow) return;
    await this.saveFlow({
      ...flow,
      updatedAt: Date.now(),
      stats: {
        ...flow.stats,
        usageCount: ((flow.stats && flow.stats.usageCount) || 0) + 1,
        lastUsed: Date.now(),
        keysSaved: ((flow.stats && flow.stats.keysSaved) || 0) + keysSaved,
      },
    });

    const settings = await this.getSettings();
    // Local calendar day, not UTC — see localDate.ts. Bucketing by UTC
    // meant usage between ~21:00-23:59 (Brazil, UTC-3) was silently
    // credited to tomorrow's bar in the analytics chart / streak.
    const today = localDateKey(new Date());
    const currentCount = settings.analytics[today] || 0;
    await this.saveSettings({
      analytics: {
        ...settings.analytics,
        [today]: currentCount + 1,
      },
    });
  }

  /** Mirrors incrementFlowStats() above, but for an attempt that threw
   * *after* the trigger matched (see the `catch` around handleTrigger() in
   * content.ts) instead of completing. Doesn't touch `lastUsed` — that
   * field means "last time this flow actually finished expanding", not
   * "last time it was attempted" — nor `keysSaved`, since nothing was
   * ever injected. Powers the real (not assumed-100%) success rate shown
   * on the Analytics page. */
  async incrementFlowFailure(id: string): Promise<void> {
    const flow = await this.getFlow(id);
    if (!flow) return;
    await this.saveFlow({
      ...flow,
      updatedAt: Date.now(),
      stats: {
        ...flow.stats,
        usageCount: (flow.stats && flow.stats.usageCount) || 0,
        keysSaved: (flow.stats && flow.stats.keysSaved) || 0,
        failureCount: ((flow.stats && flow.stats.failureCount) || 0) + 1,
      },
    });

    const settings = await this.getSettings();
    const today = localDateKey(new Date());
    const currentCount = settings.analyticsFailures?.[today] || 0;
    await this.saveSettings({
      analyticsFailures: {
        ...(settings.analyticsFailures || {}),
        [today]: currentCount + 1,
      },
    });
  }

  async resetStats(): Promise<void> {
    const flows = await this.getFlows();
    const updatedFlows = flows.map(f => ({
      ...f,
      stats: { usageCount: 0, keysSaved: 0, failureCount: 0 }
    }));
    await this.writeList(KEYS.flows, updatedFlows);
    await this.saveSettings({ analytics: {}, analyticsFailures: {} });
  }

  // -------------------------------------------------------------------------
  // Variables
  // -------------------------------------------------------------------------

  async getVariables(): Promise<Variable[]> {
    return this.readList<Variable>(KEYS.variables);
  }

  async saveVariable(variable: Variable): Promise<void> {
    const variables = await this.getVariables();
    const idx = variables.findIndex((v) => v.id === variable.id);
    if (idx >= 0) {
      variables[idx] = variable;
    } else {
      variables.push(variable);
    }
    await this.writeList(KEYS.variables, variables);
  }

  async deleteVariable(id: string): Promise<void> {
    const variables = await this.getVariables();
    await this.writeList(
      KEYS.variables,
      variables.filter((v) => v.id !== id),
    );
  }

  async incrementVariablesUsage(keys: string[]): Promise<void> {
    if (!keys || keys.length === 0) return;
    return this.enqueueListOp('variables', async () => {
      const variables = await this.getVariables();
      const countPerKey = new Map<string, number>();
      for (const k of keys) {
        countPerKey.set(k, (countPerKey.get(k) || 0) + 1);
      }
      let changed = false;
      const updated = variables.map((v) => {
        const count = countPerKey.get(v.key);
        if (count !== undefined && count > 0) {
          changed = true;
          return {
            ...v,
            usageCount: (v.usageCount ?? 0) + count,
          };
        }
        return v;
      });
      if (changed) {
        await this.writeList(KEYS.variables, updated);
      }
    });
  }

  /**
   * Replaces `{{key}}` occurrences with the stored variable value.
   * Unknown keys are left untouched.
   */
  async resolveVariables(text: string): Promise<string> {
    const variables = await this.getVariables();
    const map = new Map(variables.map((v) => [v.key, v.value]));

    return text.replace(/\{\{([^}]+)\}\}/g, (match, key: string) => {
      return map.has(key) ? (map.get(key) as string) : match;
    });
  }

  // -------------------------------------------------------------------------
  // Folders
  // -------------------------------------------------------------------------

  async getFolders(): Promise<Folder[]> {
    return this.readList<Folder>(KEYS.folders);
  }

  async saveFolder(folder: Folder): Promise<void> {
    const folders = await this.getFolders();
    const idx = folders.findIndex((f) => f.id === folder.id);
    if (idx >= 0) {
      folders[idx] = folder;
    } else {
      folders.push(folder);
    }
    await this.writeList(KEYS.folders, folders);
  }

  async deleteFolder(id: string): Promise<void> {
    const folders = await this.getFolders();
    await this.writeList(
      KEYS.folders,
      folders.filter((f) => f.id !== id),
    );
  }

  // -------------------------------------------------------------------------
  // Forms ("Formulários" — per-site fill-in profiles)
  // -------------------------------------------------------------------------

  async getForms(): Promise<Form[]> {
    return this.readList<Form>(KEYS.forms);
  }

  async getForm(id: string): Promise<Form | null> {
    const forms = await this.getForms();
    return forms.find((f) => f.id === id) ?? null;
  }

  async saveForm(form: Form): Promise<void> {
    const forms = await this.getForms();
    const idx = forms.findIndex((f) => f.id === form.id);
    if (idx >= 0) {
      forms[idx] = form;
    } else {
      forms.push(form);
    }
    await this.writeList(KEYS.forms, forms);
  }

  async deleteForm(id: string): Promise<void> {
    const forms = await this.getForms();
    await this.writeList(
      KEYS.forms,
      forms.filter((f) => f.id !== id),
    );
  }

  /**
   * Records a use of a Form (a field of it was inserted via the Gatilho de
   * Busca or the Palette). Used as the recency/frequency tie-breaker in
   * search ranking (see spec §4.2) — same idea as Flow.stats.usageCount,
   * just without `keysSaved` since a Form field isn't typed as a shortcut.
   */
  async incrementFormStats(id: string): Promise<void> {
    const form = await this.getForm(id);
    if (!form) return;
    await this.saveForm({
      ...form,
      updatedAt: Date.now(),
      stats: {
        usageCount: form.stats.usageCount + 1,
        lastUsed: Date.now(),
      },
    });
  }

  // -------------------------------------------------------------------------
  // Clipboard History
  //
  // Deliberately always read/written to browser.storage.local directly
  // (bypassing getArea()/readList()/writeList()), for two reasons:
  //   1. It's ephemeral, device-specific data — syncing copied text across
  //      devices via browser.storage.sync has little value and needlessly
  //      exposes potentially sensitive clipboard content to sync storage.
  //   2. It changes far more often than flows/settings, and the sync path
  //      chunks/re-chunks on every write, which would be wasteful here.
  //
  // All mutations (add/trim/clear) are funneled through `clipboardQueue` so
  // they run strictly one at a time. Without this, two 'copy' events fired
  // in quick succession (e.g. copying two things a second apart before
  // triggering an expansion) could both read the "old" history before either
  // had written back, and the second write would silently clobber the
  // first — losing one of the two copied entries. This queue makes each
  // add/trim/clear a read-modify-write that's atomic with respect to the
  // others, regardless of how close together the calls arrive.
  // -------------------------------------------------------------------------

  private clipboardQueue: Promise<unknown> = Promise.resolve();

  private enqueueClipboardOp<T>(op: () => Promise<T>): Promise<T> {
    const result = this.clipboardQueue.then(op, op);
    // Chain the queue itself off a version that never rejects, so one
    // failed operation doesn't permanently wedge every operation after it.
    // The original error still propagates to whoever awaited `result`.
    this.clipboardQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private clampHistoryMax(max: number | undefined): number {
    return Math.max(1, Math.min(MAX_CLIPBOARD_HISTORY_LIMIT, max ?? DEFAULT_CLIPBOARD_HISTORY_MAX));
  }

  async getClipboardHistory(): Promise<ClipboardEntry[]> {
    return safeContextCall(async () => {
      const raw = await browser.storage.local.get(KEYS.clipboardHistory);
      return (raw[KEYS.clipboardHistory] as ClipboardEntry[]) ?? [];
    }, []);
  }

  /**
   * Records a newly copied text as the most recent clipboard entry
   * (index 0 / "Clipboard 1"). Consecutive duplicate copies of the exact
   * same text just refresh the timestamp instead of creating a second
   * entry. The list is capped at the user's configured
   * `settings.clipboardHistoryMax` (default 10, hard max 50).
   */
  async addClipboardEntry(text: string): Promise<ClipboardEntry[]> {
    return this.enqueueClipboardOp(() => this._addClipboardEntry(text));
  }

  private async _addClipboardEntry(text: string): Promise<ClipboardEntry[]> {
    return safeContextCall(async () => {
      if (!text) return await this.getClipboardHistory();

      const settings = await this.getSettings();
      const max = this.clampHistoryMax(settings.clipboardHistoryMax);

      const history = await this.getClipboardHistory();
      const now = Date.now();

      if (history.length > 0 && history[0].text === text) {
        history[0] = { text, timestamp: now };
      } else {
        history.unshift({ text, timestamp: now });
      }

      const capped = history.slice(0, max);
      await browser.storage.local.set({ [KEYS.clipboardHistory]: capped });
      return capped;
    }, []);
  }

  /** Re-applies the current `clipboardHistoryMax` cap to the stored history. */
  async trimClipboardHistory(): Promise<ClipboardEntry[]> {
    return this.enqueueClipboardOp(() => this._trimClipboardHistory());
  }

  private async _trimClipboardHistory(): Promise<ClipboardEntry[]> {
    return safeContextCall(async () => {
      const settings = await this.getSettings();
      const max = this.clampHistoryMax(settings.clipboardHistoryMax);
      const history = await this.getClipboardHistory();
      if (history.length <= max) return history;

      const capped = history.slice(0, max);
      await browser.storage.local.set({ [KEYS.clipboardHistory]: capped });
      return capped;
    }, []);
  }

  async clearClipboardHistory(): Promise<void> {
    return this.enqueueClipboardOp(() => this._clearClipboardHistory());
  }

  private async _clearClipboardHistory(): Promise<void> {
    await safeContextCall(async () => {
      await browser.storage.local.remove(KEYS.clipboardHistory);
    });
  }

  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------

  async getSettings(): Promise<Settings> {
    return safeContextCall(async () => {
      const area = await this.getArea();
      const raw = await area.get(KEYS.settings);
      const stored = raw ? (raw[KEYS.settings] as Partial<Settings> | undefined) : undefined;

      return stored
        ? {
            ...DEFAULT_SETTINGS,
            ...stored,
            searchTrigger: {
              ...DEFAULT_SETTINGS.searchTrigger,
              ...(stored.searchTrigger ?? {}),
            },
          }
        : { ...DEFAULT_SETTINGS };
    }, { ...DEFAULT_SETTINGS });
  }

  async saveSettings(partial: Partial<Settings>): Promise<void> {
    await safeContextCall(async () => {
      const current = await this.getSettings();
      const merged: Settings = { ...current, ...partial };
      const area = await this.getArea();
      await area.set({ [KEYS.settings]: merged });
    });
  }

  // -------------------------------------------------------------------------
  // Sync
  // -------------------------------------------------------------------------

  /**
   * Enables sync storage.  Migrates all current local data to
   * browser.storage.sync, then stores the preference in local.
   */
  async enableSync(): Promise<void> {
    if (!browser.storage.sync) {
      console.warn('[SOTE] browser.storage.sync is not available.');
      return;
    }

    const prevSyncEnabled = this.syncEnabled;
    try {
      await safeContextCall(async () => {
        // Read everything from local.
        const local = await browser.storage.local.get(null);
        const data = local as Record<string, unknown>;

        this.syncEnabled = true;

        const listKeys: (keyof StorageSchema)[] = ['flows', 'variables', 'folders', 'forms'];
        for (const key of listKeys) {
          if (Array.isArray(data[key])) {
            await this.writeList(key, data[key] as unknown[]);
          }
        }

        if (data[KEYS.settings]) {
          await browser.storage.sync.set({ [KEYS.settings]: data[KEYS.settings] });
        }

        await browser.storage.local.set({ [SYNC_ENABLED_KEY]: true });
      });
    } catch (err) {
      this.syncEnabled = prevSyncEnabled;
      throw err;
    }
  }

  /**
   * Disables sync storage.  Migrates all data back to
   * browser.storage.local, then clears sync.
   */
  async disableSync(): Promise<void> {
    if (!browser.storage.sync) {
      this.syncEnabled = false;
      return;
    }

    await safeContextCall(async () => {
      const area = browser.storage.sync;
      const syncData = await area.get(null);

      this.syncEnabled = false;

      const listKeys: (keyof StorageSchema)[] = ['flows', 'variables', 'folders', 'forms'];
      for (const key of listKeys) {
        const chunkCountRaw = syncData[`${key}__chunks`];
        if (typeof chunkCountRaw === 'number' && chunkCountRaw > 0) {
          const chunkKeys = Array.from(
            { length: chunkCountRaw },
            (_, i) => `${key}__chunk_${i}`,
          );
          const combined = chunkKeys.map((k) => (syncData[k] as string) ?? '').join('');
          const list: unknown[] = JSON.parse(combined);
          await browser.storage.local.set({ [key]: list });
        } else if (Array.isArray(syncData[key])) {
          await browser.storage.local.set({ [key]: syncData[key] });
        }
      }

      if (syncData[KEYS.settings]) {
        await browser.storage.local.set({ [KEYS.settings]: syncData[KEYS.settings] });
      }

      await area.clear();
      await browser.storage.local.remove(SYNC_ENABLED_KEY);
    });
  }

  /**
   * Imports validated and sanitized backup data into storage.
   * Mode 'replace' clears existing collections first.
   * Mode 'merge' merges or appends items by ID and updates settings.
   */
  async importData(data: Partial<StorageSchema>, mode: 'merge' | 'replace'): Promise<{ flowsCount: number; varsCount: number }> {
    return safeContextCall(async () => {
      if (mode === 'replace') {
        await browser.storage.local.clear();
        if (browser.storage.sync) {
          try {
            await browser.storage.sync.clear();
          } catch {
            // ignore if sync not supported
          }
        }
        if (data.flows) await this.writeList(KEYS.flows, data.flows);
        if (data.variables) await this.writeList(KEYS.variables, data.variables);
        if (data.folders) await this.writeList(KEYS.folders, data.folders);
        if (data.forms) await this.writeList(KEYS.forms, data.forms);
        if (data.settings) await this.saveSettings(data.settings);
      } else {
        for (const flow of data.flows || []) await this.saveFlow(flow);
        for (const v of data.variables || []) await this.saveVariable(v);
        for (const f of data.folders || []) await this.saveFolder(f);
        for (const form of data.forms || []) await this.saveForm(form);
        if (data.settings) await this.saveSettings(data.settings);
      }
      return {
        flowsCount: data.flows?.length || 0,
        varsCount: data.variables?.length || 0,
      };
    }, { flowsCount: 0, varsCount: 0 });
  }
}

export const storage = new StorageService();
