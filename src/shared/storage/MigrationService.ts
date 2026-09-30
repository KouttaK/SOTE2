import { browser } from 'wxt/browser';
import type { StorageSchema, Flow, Token, Counter } from '../types/index.js';
import { generateId } from './helpers.js';

export const CURRENT_SCHEMA_VERSION = 2;

/**
 * Executes idempotent migrations based on schemaVersion.
 */
export const MigrationService = {
  /**
   * Checks the schema version and migrates if necessary.
   * Returns true if migration is pending due to quota issues.
   */
  async checkAndMigrate(data: Partial<StorageSchema>): Promise<boolean> {
    const currentVersion = data.schemaVersion || 1;
    
    if (currentVersion >= CURRENT_SCHEMA_VERSION) {
      return false; // Up to date
    }

    // Try to take a backup first
    try {
      await browser.storage.local.set({ ['backup_schema_v' + currentVersion]: data });
    } catch (e: any) {
      if (e.name === 'QuotaExceededError' || e.message?.toLowerCase().includes('quota') || e.message?.includes('QuotaExceededError')) {
        // Soft lock: UI will prompt for manual export
        return true;
      }
      console.warn('[SOTE] Failed to create backup before migration:', e);
    }

    await this.runMigrations(data, currentVersion);
    return false;
  },

  /**
   * Forces the migration to run (used after user manually exports backup).
   */
  async forceMigrate(data: Partial<StorageSchema>): Promise<void> {
    const currentVersion = data.schemaVersion || 1;
    if (currentVersion >= CURRENT_SCHEMA_VERSION) return;
    await this.runMigrations(data, currentVersion);
  },

  async runMigrations(data: Partial<StorageSchema>, fromVersion: number): Promise<void> {
    let migratedData = { ...data };

    if (fromVersion < 2) {
      migratedData = this.migrateToV2(migratedData);
    }

    // Finally, save the migrated data
    migratedData.schemaVersion = CURRENT_SCHEMA_VERSION;
    await browser.storage.local.set(migratedData);
  },

  migrateToV2(data: Partial<StorageSchema>): Partial<StorageSchema> {
    const flows = data.flows || [];
    const counters: Counter[] = data.counters || [];
    const newFlows: Flow[] = JSON.parse(JSON.stringify(flows));
    
    // Track extracted counters to avoid creating duplicates for shared counterGroupIds
    const counterMap = new Map<string, Counter>();

    for (const flow of newFlows) {
      for (const token of flow.tokens || []) {
        if (token.type === 'counter') {
          const cfg = token.config || {};
          
          // Identifier used previously for grouped counters
          const groupId = cfg.counterGroupId || token.id;
          
          let counter: Counter;
          if (counterMap.has(groupId)) {
            counter = counterMap.get(groupId)!;
          } else {
            // Create a new counter entity
            counter = {
              id: generateId(),
              name: `Contador ${counterMap.size + 1}`,
              format: '{contador}', // Base format for simple counters
              resetRule: 'never',
              startValue: typeof cfg.start === 'number' ? cfg.start : 1,
              currentValue: typeof cfg.current === 'number' ? cfg.current : (typeof cfg.start === 'number' ? cfg.start : 1),
              scope: cfg.scope === 'site' ? 'site' : 'global',
              step: typeof cfg.step === 'number' ? cfg.step : 1,
              padLength: typeof cfg.padLength === 'number' ? cfg.padLength : 0,
            };
            counterMap.set(groupId, counter);
            counters.push(counter);
          }

          // Update token to point to the new counter entity
          token.config = {
            ...cfg,
            counterId: counter.id,
          };
          
          // Clean up old properties that moved to Counter
          delete token.config.current;
          delete token.config.start;
          delete token.config.step;
          delete token.config.padLength;
          delete token.config.scope;
        }
      }
    }

    return {
      ...data,
      flows: newFlows,
      counters,
      schemaVersion: 2,
    };
  },

  /**
   * Reverts the database to the exact state stored in the V1 backup.
   * Removes V2-specific keys to prevent hybrid corruption.
   */
  async rollbackToV1(): Promise<boolean> {
    const backupWrapper = await browser.storage.local.get('backup_schema_v1');
    const backupData = backupWrapper['backup_schema_v1'] as Partial<StorageSchema>;

    if (!backupData) {
      console.warn('[SOTE] No V1 backup found to restore.');
      return false;
    }

    // Identify current root keys
    const currentStorage = await browser.storage.local.get(null);
    const keysToRemove: string[] = [];

    // Any key present now that is NOT in the backup must be removed 
    // to avoid hybrid corruption (e.g., 'counters', 'schemaVersion').
    for (const key of Object.keys(currentStorage)) {
      if (key !== 'backup_schema_v1' && backupData[key as keyof StorageSchema] === undefined) {
        keysToRemove.push(key);
      }
    }

    if (keysToRemove.length > 0) {
      await browser.storage.local.remove(keysToRemove);
    }

    // Overwrite existing valid keys with their exact V1 backup values
    await browser.storage.local.set(backupData);
    
    return true;
  }
};

