import { describe, it, expect, vi, beforeEach } from 'vitest';
import { browser } from 'wxt/browser';
import { MigrationService, CURRENT_SCHEMA_VERSION } from './MigrationService.js';
import type { StorageSchema, Flow, Token } from '../types/index.js';

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        set: vi.fn(),
        get: vi.fn(),
        remove: vi.fn(),
      },
    },
  },
}));

vi.mock('./helpers.js', () => ({
  generateId: () => 'mocked-id-123',
}));

describe('MigrationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing if already up to date', async () => {
    const isPending = await MigrationService.checkAndMigrate({ schemaVersion: CURRENT_SCHEMA_VERSION } as Partial<StorageSchema>);
    expect(isPending).toBe(false);
    expect(browser.storage.local.set).not.toHaveBeenCalled();
  });

  it('backs up data, migrates, and returns false when quota is fine', async () => {
    const data: Partial<StorageSchema> = { flows: [] };
    const isPending = await MigrationService.checkAndMigrate(data);
    
    expect(isPending).toBe(false);
    expect(browser.storage.local.set).toHaveBeenCalledWith({ backup_schema_v1: data });
    // Second call should be the migration save
    expect(browser.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      flows: [],
      counters: []
    }));
  });

  it('catches QuotaExceededError and returns true without migrating', async () => {
    const data: Partial<StorageSchema> = { flows: [] };
    vi.mocked(browser.storage.local.set).mockRejectedValueOnce(new Error('QuotaExceededError'));

    const isPending = await MigrationService.checkAndMigrate(data);
    
    expect(isPending).toBe(true);
    // Should NOT have run migrations
    expect(browser.storage.local.set).toHaveBeenCalledTimes(1); // Only the backup attempt
  });

  it('forceMigrate forces migration directly without backup', async () => {
    const data: Partial<StorageSchema> = { flows: [] };
    await MigrationService.forceMigrate(data);
    
    expect(browser.storage.local.set).toHaveBeenCalledTimes(1);
    expect(browser.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      flows: [],
      counters: []
    }));
  });

  it('migrates v1 flows to v2 by extracting inline counter configs to Counter entities', async () => {
    const oldFlow: Flow = {
      id: 'f1', name: 'Test', shortcut: '/test',
      tokens: [
        {
          id: 't1', type: 'counter', config: {
            start: 5, step: 2, current: 7, scope: 'global', counterGroupId: 'group-A'
          }
        } as unknown as Token,
        {
          id: 't2', type: 'counter', config: {
            start: 1, step: 1, current: 2, scope: 'global', counterGroupId: 'group-A' // Same group
          }
        } as unknown as Token
      ]
    } as Flow;

    const data: Partial<StorageSchema> = { flows: [oldFlow] };
    const migrated = MigrationService.migrateToV2(data);

    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.counters).toHaveLength(1); // Only 1 counter should be created for group-A
    expect(migrated.counters![0].id).toBe('mocked-id-123');
    expect(migrated.counters![0].currentValue).toBe(7); // Used the first token's current value

    const newTokens = migrated.flows![0].tokens!;
    expect(newTokens[0].config!.counterId).toBe('mocked-id-123');
    expect(newTokens[1].config!.counterId).toBe('mocked-id-123');
    
    // Ensure old properties are gone
    expect(newTokens[0].config!.current).toBeUndefined();
    expect(newTokens[0].config!.start).toBeUndefined();
  });

  it('performs a flawless round-trip: V1 -> V2 -> Rollback === V1', async () => {
    // 1. Create realistic V1 data
    const originalV1Data: Partial<StorageSchema> = {
      flows: [
        {
          id: 'f1', name: 'Test', shortcut: '/test',
          tokens: [
            { id: 't1', type: 'counter', config: { start: 10, step: 2, current: 15, scope: 'site' } } as unknown as Token
          ]
        } as Flow
      ],
      variables: [{ id: 'v1', name: 'Var', value: '1' }],
      folders: [],
    };

    // Prepare mock storage map
    const storageMap = new Map<string, any>();
    
    // Give our initial data to storage
    for (const [k, v] of Object.entries(originalV1Data)) {
      storageMap.set(k, v);
    }

    vi.mocked(browser.storage.local.get).mockImplementation(async (keys?: string | string[] | Record<string, any> | null) => {
      if (keys === null) return Object.fromEntries(storageMap.entries());
      if (typeof keys === 'string') return { [keys]: storageMap.get(keys) };
      return {};
    });

    vi.mocked(browser.storage.local.set).mockImplementation(async (items: Record<string, any>) => {
      for (const [k, v] of Object.entries(items)) {
        storageMap.set(k, v);
      }
    });

    vi.mocked(browser.storage.local.remove).mockImplementation(async (keys: string | string[]) => {
      const arr = Array.isArray(keys) ? keys : [keys];
      for (const k of arr) {
        storageMap.delete(k);
      }
    });

    // 2. Run Migration (V1 -> V2)
    // First, verify checkAndMigrate handles it and updates our storageMap.
    const isPending = await MigrationService.checkAndMigrate(Object.fromEntries(storageMap.entries()));
    expect(isPending).toBe(false);

    // Assert V2 State
    expect(storageMap.get('schemaVersion')).toBe(2);
    expect(storageMap.has('counters')).toBe(true);
    expect(storageMap.get('counters')).toHaveLength(1);
    
    // 3. Rollback (V2 -> V1)
    const success = await MigrationService.rollbackToV1();
    expect(success).toBe(true);

    // 4. Validate exact match
    // Filter out the backup key itself since it lives forever as an artifact
    storageMap.delete('backup_schema_v1');
    const finalState = Object.fromEntries(storageMap.entries());

    expect(finalState).toEqual(originalV1Data);
    expect(storageMap.has('schemaVersion')).toBe(false); // Schema version removed
    expect(storageMap.has('counters')).toBe(false); // Counters entity completely removed
  });
});
