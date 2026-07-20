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
  const chunks: string[] = [];
  let offset = 0;

  while (offset < str.length) {
    // Each UTF-16 code unit can be up to 3 bytes in UTF-8; be conservative.
    let end = offset + Math.floor(maxBytes / 3);
    if (end >= str.length) end = str.length;
    chunks.push(str.slice(offset, end));
    offset = end;
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
    try {
      // Restore sync preference from local storage.
      const localRaw = await browser.storage.local.get(SYNC_ENABLED_KEY);
      if (localRaw[SYNC_ENABLED_KEY] === true) {
        this.syncEnabled = true;
      }

      const area = await this.getArea();
      const data = await area.get([KEYS.settings, KEYS.forms]);

      if (!data[KEYS.settings]) {
        await area.set({ [KEYS.settings]: DEFAULT_SETTINGS });
      }

      // First run only: seed onboarding example Forms. Keyed off the
      // `forms` storage key itself being entirely absent (never
      // initialised) rather than an empty array, so a user who deletes
      // every Form afterwards doesn't get them silently repopulated.
      if (data[KEYS.forms] === undefined) {
        await area.set({ [KEYS.forms]: buildDefaultForms() });
      }
    } catch (err) {
      console.error('[SOTE] StorageService.initialise failed:', err);
    }
  }

  // -------------------------------------------------------------------------
  // Generic read / write helpers
  // -------------------------------------------------------------------------

  private async readList<T>(key: string): Promise<T[]> {
    try {
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
    } catch (err) {
      console.error(`[SOTE] readList(${key}) failed:`, err);
      return [];
    }
  }

  private async writeList<T>(key: string, list: T[]): Promise<void> {
    try {
      const area = await this.getArea();
      const json = JSON.stringify(list);

      if (this.syncEnabled && browser.storage.sync) {
        // Remove old chunks first.
        const oldMeta = await browser.storage.sync.get(`${key}__chunks`);
        const oldCount: number = oldMeta[`${key}__chunks`] ?? 0;
        if (oldCount > 0) {
          const oldKeys = Array.from({ length: oldCount }, (_, i) => `${key}__chunk_${i}`);
          await browser.storage.sync.remove([`${key}__chunks`, ...oldKeys]);
        }

        const chunks = chunkString(json, SYNC_ITEM_MAX_BYTES);

        if (chunks.length === 1 && json.length <= SYNC_ITEM_MAX_BYTES) {
          // Small enough to store directly.
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
    } catch (err) {
      console.error(`[SOTE] writeList(${key}) failed:`, err);
    }
  }

  // -------------------------------------------------------------------------
  // Flows
  // -------------------------------------------------------------------------

  async getFlows(): Promise<Flow[]> {
    return this.readList<Flow>(KEYS.flows);
  }

  async getFlow(id: string): Promise<Flow | null> {
    const flows = await this.getFlows();
    return flows.find((f) => f.id === id) ?? null;
  }

  async saveFlow(flow: Flow): Promise<void> {
    const flows = await this.getFlows();
    const idx = flows.findIndex((f) => f.id === flow.id);
    if (idx >= 0) {
      flows[idx] = flow;
    } else {
      flows.push(flow);
    }
    await this.writeList(KEYS.flows, flows);
  }

  async deleteFlow(id: string): Promise<void> {
    const flows = await this.getFlows();
    await this.writeList(
      KEYS.flows,
      flows.filter((f) => f.id !== id),
    );
  }

  async toggleFlow(id: string): Promise<void> {
    const flow = await this.getFlow(id);
    if (!flow) return;
    await this.saveFlow({ ...flow, enabled: !flow.enabled, updatedAt: Date.now() });
  }

  async incrementFlowStats(id: string, keysSaved: number): Promise<void> {
    const flow = await this.getFlow(id);
    if (!flow) return;
    await this.saveFlow({
      ...flow,
      updatedAt: Date.now(),
      stats: {
        usageCount: flow.stats.usageCount + 1,
        lastUsed: Date.now(),
        keysSaved: flow.stats.keysSaved + keysSaved,
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

  async resetStats(): Promise<void> {
    const flows = await this.getFlows();
    const updatedFlows = flows.map(f => ({
      ...f,
      stats: { usageCount: 0, keysSaved: 0 }
    }));
    await this.writeList(KEYS.flows, updatedFlows);
    await this.saveSettings({ analytics: {} });
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
    try {
      const raw = await browser.storage.local.get(KEYS.clipboardHistory);
      return (raw[KEYS.clipboardHistory] as ClipboardEntry[]) ?? [];
    } catch (err) {
      console.error('[SOTE] getClipboardHistory failed:', err);
      return [];
    }
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
    try {
      if (!text) return this.getClipboardHistory();

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
    } catch (err) {
      console.error('[SOTE] addClipboardEntry failed:', err);
      return this.getClipboardHistory();
    }
  }

  /** Re-applies the current `clipboardHistoryMax` cap to the stored history. */
  async trimClipboardHistory(): Promise<ClipboardEntry[]> {
    return this.enqueueClipboardOp(() => this._trimClipboardHistory());
  }

  private async _trimClipboardHistory(): Promise<ClipboardEntry[]> {
    try {
      const settings = await this.getSettings();
      const max = this.clampHistoryMax(settings.clipboardHistoryMax);
      const history = await this.getClipboardHistory();
      if (history.length <= max) return history;

      const capped = history.slice(0, max);
      await browser.storage.local.set({ [KEYS.clipboardHistory]: capped });
      return capped;
    } catch (err) {
      console.error('[SOTE] trimClipboardHistory failed:', err);
      return this.getClipboardHistory();
    }
  }

  async clearClipboardHistory(): Promise<void> {
    return this.enqueueClipboardOp(() => this._clearClipboardHistory());
  }

  private async _clearClipboardHistory(): Promise<void> {
    try {
      await browser.storage.local.remove(KEYS.clipboardHistory);
    } catch (err) {
      console.error('[SOTE] clearClipboardHistory failed:', err);
    }
  }

  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------

  async getSettings(): Promise<Settings> {
    try {
      const area = await this.getArea();
      const raw = await area.get(KEYS.settings);
      const stored = raw ? (raw[KEYS.settings] as Partial<Settings> | undefined) : undefined;

      // Deep-merge stored settings with defaults so new keys always have a value.
      return stored ? { ...DEFAULT_SETTINGS, ...stored } : { ...DEFAULT_SETTINGS };
    } catch (err) {
      console.error('[SOTE] getSettings failed:', err);
      return { ...DEFAULT_SETTINGS };
    }
  }

  async saveSettings(partial: Partial<Settings>): Promise<void> {
    try {
      const current = await this.getSettings();
      const merged: Settings = { ...current, ...partial };
      const area = await this.getArea();
      await area.set({ [KEYS.settings]: merged });
    } catch (err) {
      console.error('[SOTE] saveSettings failed:', err);
    }
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

    try {
      // Read everything from local.
      const local = await browser.storage.local.get(null);
      const data = local as Record<string, unknown>;

      // Write each key to sync (chunking handled by writeList).
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

      // Persist preference.
      await browser.storage.local.set({ [SYNC_ENABLED_KEY]: true });
    } catch (err) {
      this.syncEnabled = false;
      console.error('[SOTE] enableSync failed:', err);
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

    try {
      const area = browser.storage.sync;
      const syncData = await area.get(null);

      // Disable BEFORE writing so writeList targets local.
      this.syncEnabled = false;

      const listKeys: (keyof StorageSchema)[] = ['flows', 'variables', 'folders', 'forms'];
      for (const key of listKeys) {
        // Reassemble chunked lists from sync.
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

      // Clear sync area and local sync-preference flag.
      await area.clear();
      await browser.storage.local.remove(SYNC_ENABLED_KEY);
    } catch (err) {
      console.error('[SOTE] disableSync failed:', err);
    }
  }
}

export const storage = new StorageService();
