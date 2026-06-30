import type { Settings } from '../types/index.js';

export const DEFAULT_SETTINGS: Settings = {
  triggerMode: 'trigger',
  triggerKeys: ['Space', 'Tab', 'Enter'],
  exactMatchChar: '/',
  exactMatchDelay: 0,
  globalEnabled: true,
  snoozeUntil: undefined,
  blocklist: [],
  commandPaletteShortcut: 'Ctrl+Shift+Space',
  analytics: {},
};

/**
 * Storage key that persists the user's choice to use sync vs local.
 * Stored in local so it survives sync being disabled.
 */
export const SYNC_ENABLED_KEY = '__sote_sync_enabled__';

/**
 * Maximum bytes per browser.storage.sync item (8 KB).
 * We leave a small buffer for key overhead.
 */
export const SYNC_ITEM_MAX_BYTES = 7800;
