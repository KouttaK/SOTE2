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

  it('migrates v1 flows to v2 with canonical blocks structure and cleans up old token properties', async () => {
    const oldFlow: Flow = {
      id: 'f1',
      name: 'Test Block Flow',
      shortcut: '/test',
      folderId: null,
      enabled: true,
      createdAt: 1000,
      updatedAt: 1000,
      blocks: [
        {
          id: 'b1',
          type: 'action',
          data: {
            tokens: [
              {
                id: 't1',
                type: 'counter',
                config: {
                  start: 5,
                  step: 2,
                  current: 7,
                  scope: 'global',
                  counterGroupId: 'group-A',
                },
              } as unknown as Token,
              {
                id: 't2',
                type: 'counter',
                config: {
                  start: 1,
                  step: 1,
                  current: 2,
                  scope: 'global',
                  counterGroupId: 'group-A', // Same group
                },
              } as unknown as Token,
            ],
          },
        },
      ],
    };

    const data: Partial<StorageSchema> = { flows: [oldFlow] };
    const migrated = MigrationService.migrateToV2(data);

    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.counters).toHaveLength(1);
    expect(migrated.counters![0].id).toBe('mocked-id-123');
    expect(migrated.counters![0].currentValue).toBe(7);

    const actionBlock = migrated.flows![0].blocks[0].data as any;
    expect(actionBlock.tokens[0].config.counterId).toBe('mocked-id-123');
    expect(actionBlock.tokens[1].config.counterId).toBe('mocked-id-123');
    expect(actionBlock.tokens[0].config.current).toBeUndefined();
    expect(actionBlock.tokens[0].config.start).toBeUndefined();
  });

  it('triggers self-healing migration when schemaVersion is already 2 but unmigrated counters exist in blocks', async () => {
    const brokenV2Data: Partial<StorageSchema> = {
      schemaVersion: 2,
      counters: [],
      flows: [
        {
          id: 'f-v2',
          name: 'Contador Flow',
          shortcut: '/cnt',
          folderId: null,
          enabled: true,
          createdAt: 1000,
          updatedAt: 1000,
          blocks: [
            {
              id: 'b1',
              type: 'action',
              data: {
                tokens: [
                  {
                    id: 't1',
                    type: 'counter',
                    config: {
                      start: 1,
                      current: 10,
                    },
                  } as unknown as Token,
                ],
              },
            },
          ],
        },
      ],
    };

    expect(MigrationService.hasUnmigratedCounters(brokenV2Data)).toBe(true);

    const isPending = await MigrationService.checkAndMigrate(brokenV2Data);
    expect(isPending).toBe(false);

    expect(browser.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaVersion: 2,
        counters: [
          expect.objectContaining({
            id: 'mocked-id-123',
            currentValue: 10,
          }),
        ],
      })
    );
  });

  it('detects and repairs reverse orphan counter tokens (counterId exists on token but NOT in storage.counters)', async () => {
    const orphanData: Partial<StorageSchema> = {
      schemaVersion: 2,
      counters: [
        {
          id: 'c-valid-999',
          name: 'Outro Contador',
          format: '{contador}',
          resetRule: 'never',
          startValue: 1,
          currentValue: 5,
          scope: 'global',
          step: 1,
          padLength: 0,
        },
      ],
      flows: [
        {
          id: 'f-orphan',
          name: 'Orphan Counter Flow',
          shortcut: '/orphan',
          folderId: null,
          enabled: true,
          createdAt: 1000,
          updatedAt: 1000,
          blocks: [
            {
              id: 'b1',
              type: 'action',
              data: {
                tokens: [
                  {
                    id: 't-orphan',
                    type: 'counter',
                    config: {
                      counterId: 'c-nonexistent-404', // REVERSE ORPHAN!
                      format: '{contador}',
                    },
                  } as unknown as Token,
                ],
              },
            },
          ],
        },
      ],
    };

    // 1. Must be detected as unmigrated/needing repair
    expect(MigrationService.hasUnmigratedCounters(orphanData)).toBe(true);

    // 2. Migration must synthesize a new Counter entity and re-bind token.config.counterId
    const repaired = MigrationService.migrateToV2(orphanData);
    expect(repaired.counters).toHaveLength(2); // The existing valid one + repaired one
    expect(repaired.counters!.some((c) => c.id === 'c-valid-999')).toBe(true);
    expect(repaired.counters!.some((c) => c.id === 'mocked-id-123')).toBe(true);

    const actionData = repaired.flows![0].blocks[0].data as any;
    expect(actionData.tokens[0].config.counterId).toBe('mocked-id-123');
    expect(MigrationService.hasUnmigratedCounters(repaired)).toBe(false);
  });

  it('detects and migrates counter pills embedded in action block content even when tokens array is empty', async () => {
    const rawContentFlow: Flow = {
      id: 'f-raw',
      name: 'Flow with HTML counter pill',
      shortcut: '/raw',
      folderId: null,
      enabled: true,
      createdAt: 1000,
      updatedAt: 1000,
      blocks: [
        {
          id: 'b-raw',
          type: 'action',
          data: {
            content: 'Texto antes <span class="token-pill token-counter">\n  token.counter (1, +1)\n</span> texto depois',
            format: 'richtext',
            tokens: [],
          },
        },
      ],
    };

    const data: Partial<StorageSchema> = { flows: [rawContentFlow] };
    expect(MigrationService.hasUnmigratedCounters(data)).toBe(true);

    const migrated = MigrationService.migrateToV2(data);
    expect(migrated.counters).toHaveLength(1);
    expect(migrated.counters![0].id).toBe('mocked-id-123');
    expect(migrated.counters![0].startValue).toBe(1);
    expect(migrated.counters![0].step).toBe(1);

    const actionData = migrated.flows![0].blocks[0].data as any;
    expect(actionData.tokens).toHaveLength(1);
    expect(actionData.tokens[0].config.counterId).toBe('mocked-id-123');
    expect(actionData.content).toContain('data-token-id="');
    expect(actionData.content).toContain('data-token-config="{&quot;counterId&quot;:&quot;mocked-id-123&quot;}"');
  });

  it('correctly traverses nested blocks (ConditionBlock with rules and elseBranch)', async () => {
    const conditionFlow: Flow = {
      id: 'f-cond',
      name: 'Condition Flow',
      shortcut: '/cond',
      folderId: null,
      enabled: true,
      createdAt: 1000,
      updatedAt: 1000,
      blocks: [
        {
          id: 'cond-1',
          type: 'condition',
          data: {
            rules: [
              {
                id: 'r1',
                field: 'url',
                operator: 'contains',
                value: 'google',
                action: {
                  tokens: [
                    {
                      id: 't-cond-rule',
                      type: 'counter',
                      config: { start: 1, current: 4, counterGroupId: 'cond-group' },
                    } as unknown as Token,
                  ],
                },
              },
            ],
            elseBranch: {
              tokens: [
                {
                  id: 't-cond-else',
                  type: 'counter',
                  config: { start: 10, current: 20, counterGroupId: 'cond-group' },
                } as unknown as Token,
              ],
            },
          } as any,
        },
      ],
    };

    const data: Partial<StorageSchema> = { flows: [conditionFlow] };
    expect(MigrationService.hasUnmigratedCounters(data)).toBe(true);

    const migrated = MigrationService.migrateToV2(data);
    expect(migrated.counters).toHaveLength(1); // 'mocked-id-123' generated
    const condBlock = migrated.flows![0].blocks[0].data as any;
    expect(condBlock.rules[0].action.tokens[0].config.counterId).toBe('mocked-id-123');
    expect(condBlock.elseBranch.tokens[0].config.counterId).toBe('mocked-id-123');
  });

  it('performs a flawless round-trip: V1 -> V2 -> Rollback === V1', async () => {
    // 1. Create realistic V1 data
    const originalV1Data: Partial<StorageSchema> = {
      flows: [
        {
          id: 'f1', name: 'Test', shortcut: '/test',
          blocks: [
            {
              id: 'b1',
              type: 'action',
              data: {
                tokens: [
                  { id: 't1', type: 'counter', config: { start: 10, step: 2, current: 15, scope: 'site' } } as unknown as Token
                ]
              }
            }
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

