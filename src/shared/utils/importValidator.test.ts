// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateImport, validateToken, validateBlock } from './importValidator.js';
import { storage } from '../storage/StorageService.js';
import type { StorageSchema, Flow } from '../types/index.js';

const mockLocalStorage: Record<string, any> = {};

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn(async (keys?: string | string[]) => {
          if (!keys) return { ...mockLocalStorage };
          if (typeof keys === 'string') return { [keys]: mockLocalStorage[keys] };
          const res: Record<string, any> = {};
          for (const k of keys) res[k] = mockLocalStorage[k];
          return res;
        }),
        set: vi.fn(async (items: Record<string, any>) => {
          Object.assign(mockLocalStorage, items);
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          const arr = Array.isArray(keys) ? keys : [keys];
          for (const k of arr) delete mockLocalStorage[k];
        }),
        clear: vi.fn(async () => {
          for (const k in mockLocalStorage) delete mockLocalStorage[k];
        }),
      },
      sync: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
      },
    },
  },
}));

describe('Import Validator', () => {
  beforeEach(() => {
    for (const k in mockLocalStorage) delete mockLocalStorage[k];
    vi.clearAllMocks();
  });
  const createValidFlow = (): Flow => ({
    id: 'test-flow',
    name: 'Test Flow',
    enabled: true,
    tags: ['test'],
    createdAt: 12345,
    updatedAt: 12345,
    stats: { usageCount: 0, keysSaved: 0, failureCount: 0 },
    blocks: [
      {
        id: 'block-1',
        trigger: { type: 'keyword', value: 'test', matchMode: 'exact' } as any,
        action: { format: 'richtext', content: '<p>Hello</p>', tokens: [] }
      }
    ]
  });

  const createValidSchema = (): StorageSchema => ({
    flows: [createValidFlow()],
    variables: [],
    folders: [],
    forms: [],
    settings: {} as any
  });

  it('Test 1: Legitimate export imports 100% correctly', () => {
    const raw = JSON.stringify(createValidSchema());
    const res = validateImport(raw);
    
    expect(res.valid).toBe(true);
    expect(res.acceptedFlowsCount).toBe(1);
    expect(res.rejectedFlowsCount).toBe(0);
    expect(res.errors).toHaveLength(0);
    expect(res.data?.flows?.[0].name).toBe('Test Flow');
  });

  it('Test 2: Sanitizes HTML content on import (Defense in depth)', () => {
    const schema = createValidSchema();
    // Inject malicious payload
    (schema.flows[0].blocks[0].action as any).content = '<img src=x onerror="alert(1)">';
    
    const res = validateImport(JSON.stringify(schema));
    expect(res.valid).toBe(true);
    // Should be stripped to <img src="x"> (onerror is dropped)
    expect((res.data?.flows?.[0].blocks[0].action as any).content).toBe('<img src="x">');
  });

  it('Test 3: Rejects Prototype Pollution payloads (__proto__)', () => {
    const schema = createValidSchema();
    (schema as any).__proto__ = { polluted: true };
    const raw = JSON.stringify(schema);
    
    // Simulate JSON parsing a polluted object (though JSON.parse usually drops __proto__, 
    // let's manually inject the string for the test)
    const rawWithProto = raw.replace('"flows":', '"__proto__": {"polluted": true}, "flows":');
    
    const res = validateImport(rawWithProto);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toMatch(/Prototype Pollution/i);
  });

  it('Test 4: Discards unexpected/unknown fields', () => {
    const schema = createValidSchema();
    (schema.flows[0] as any).isAdmin = true; // unknown field
    (schema.flows[0].blocks[0].action as any).unknownActionKey = 'hack';
    
    const res = validateImport(JSON.stringify(schema));
    expect(res.valid).toBe(true);
    expect((res.data?.flows?.[0] as any).isAdmin).toBeUndefined();
    expect((res.data?.flows?.[0].blocks[0].action as any).unknownActionKey).toBeUndefined();
  });

  it('Test 5: Partial success (imports valid, skips invalid)', () => {
    const schema = createValidSchema();
    const brokenFlow: any = createValidFlow();
    delete brokenFlow.name; // Missing mandatory field
    schema.flows.push(brokenFlow);
    schema.flows.push(createValidFlow());
    
    const res = validateImport(JSON.stringify(schema));
    expect(res.valid).toBe(true);
    expect(res.acceptedFlowsCount).toBe(2);
    expect(res.rejectedFlowsCount).toBe(1);
    expect(res.data?.flows?.length).toBe(2);
  });

  it('Test 6: Handles totally invalid JSON gracefully', () => {
    const res = validateImport('not even json { [ ] }');
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toMatch(/JSON/i);
  });

  it('Test 7: Enforces sanity limits (e.g., extremely large strings or too many flows)', () => {
    const schema = createValidSchema();
    // Too many flows
    for (let i = 0; i < 1005; i++) {
      schema.flows.push(createValidFlow());
    }
    const resTooMany = validateImport(JSON.stringify(schema));
    expect(resTooMany.valid).toBe(false);
    expect(resTooMany.errors[0]).toMatch(/1000 flows/i);

    // Too large content block
    const schemaLarge = createValidSchema();
    (schemaLarge.flows[0].blocks[0].action as any).content = 'a'.repeat(600000); // 600kb
    const resLarge = validateImport(JSON.stringify(schemaLarge));
    // The action fails validation, which fails the block, which fails the flow
    expect(resLarge.valid).toBe(true);
    expect(resLarge.acceptedFlowsCount).toBe(0);
    expect(resLarge.rejectedFlowsCount).toBe(1);
  });

  it('Test 8: Type Confusion (Array/Object/String mixups)', () => {
    // JSON com "flows": "não sou um array"
    const schema1 = { flows: 'não sou um array' };
    expect(validateImport(JSON.stringify(schema1)).valid).toBe(false);

    // JSON com "flows": { "0": {...} } (objeto disfarçado de array)
    const schema2 = { flows: { '0': createValidFlow() } };
    expect(validateImport(JSON.stringify(schema2)).valid).toBe(false);

    // JSON com "flows": null
    const schema3 = { flows: null };
    expect(validateImport(JSON.stringify(schema3)).valid).toBe(false);

    // JSON com "variables": 12345
    const schema4 = createValidSchema();
    (schema4 as any).variables = 12345;
    const res4 = validateImport(JSON.stringify(schema4));
    expect(res4.valid).toBe(true);
    expect(res4.data?.variables).toEqual([]);

    // JSON com content = {}
    const schema5 = createValidSchema();
    (schema5.flows[0].blocks[0].action as any).content = { malicious: true };
    const res5 = validateImport(JSON.stringify(schema5));
    // Should fallback to empty string and sanitize it
    expect((res5.data?.flows?.[0].blocks[0].action as any).content).toBe('');
  });

  it('Test 9: Real Depth Limit (30 levels nested)', () => {
    const schema = createValidSchema();
    
    // Build a deeply nested structure manually
    let currentBlock: any = {
      type: 'random',
      options: [
        { id: '1', weight: 100, target: null }
      ]
    };
    const rootBlock = currentBlock;

    for (let i = 0; i < 30; i++) {
      currentBlock.options[0].target = {
        type: 'random',
        options: [
          { id: 'nest', weight: 100, target: null }
        ]
      };
      currentBlock = currentBlock.options[0].target;
    }
    // Finally attach a leaf
    currentBlock.options[0].target = { format: 'plaintext', content: 'deep', tokens: [] };
    
    (schema.flows[0].blocks[0].action as any) = rootBlock;

    const res = validateImport(JSON.stringify(schema));
    expect(res.valid).toBe(true);
    // Since depth limit is 20, the deeply nested target will return null, causing the parent to have 0 options,
    // which cascades up returning null all the way to the root action, so the flow is rejected.
    expect(res.acceptedFlowsCount).toBe(0);
    expect(res.rejectedFlowsCount).toBe(1);
  });

  it('Test 10: ID Collision / Generation Behavior', () => {
    // 1. Valid IDs should be preserved by default (needed for Merge mode to overwrite existing flows)
    const schema = createValidSchema();
    schema.flows[0].id = 'my-existing-id';
    const res1 = validateImport(JSON.stringify(schema));
    expect(res1.data?.flows?.[0].id).toBe('my-existing-id');

    // 2. We can force generate new IDs
    const res2 = validateImport(JSON.stringify(schema), true); // forceNewIds = true
    expect(res2.data?.flows?.[0].id).not.toBe('my-existing-id');
    expect(typeof res2.data?.flows?.[0].id).toBe('string');
    expect(res2.data?.flows?.[0].id?.length).toBeGreaterThan(10); // crypto.randomUUID
  });

  it('Test 11: isSafeObject generic depth limit (prevents deep structure call stack DoS)', () => {
    // Generate an object nested 10,000 levels deep.
    // E.g., { a: { a: { a: ... } } }
    let deepObject: any = {};
    let current = deepObject;
    for (let i = 0; i < 10000; i++) {
      current.a = {};
      current = current.a;
    }
    
    // We expect the validation to NOT throw a "Maximum call stack size exceeded" error.
    // Instead, it should gracefully reject the JSON.
    expect(() => {
      const res = validateImport(JSON.stringify(deepObject));
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toMatch(/Prototype Pollution/i); // isSafeObject returning false triggers this error message.
    }).not.toThrow();
  });

  it('Test 12: Strict settings explicit allowlist discards analytics backdoor', () => {
    const schema = createValidSchema();
    (schema.settings as any) = {
      triggerMode: 'keyword',
      analytics: {
        '__whatever__': 'x'.repeat(1000),
        '2024-05-12': 10
      },
      unknownRootKey: true
    };
    
    const res = validateImport(JSON.stringify(schema));
    expect(res.valid).toBe(true);
    
    // The settings object should exist
    expect(res.data?.settings).toBeDefined();
    
    // Valid allowed keys should be preserved
    expect(res.data?.settings?.triggerMode).toBe('keyword');
    
    // Unknown keys at the root should be discarded
    expect((res.data?.settings as any).unknownRootKey).toBeUndefined();
    
    // Analytics MUST be entirely discarded
    expect((res.data?.settings as any).analytics).toBeUndefined();
  });

  it('Test 13: Canonical SOTE 2 flow ({ id, type, data }) imports successfully', () => {
    const canonicalFlow: Flow = {
      id: 'canonical-flow-1',
      name: '/teste',
      enabled: true,
      tags: ['macros', 'suporte'],
      createdAt: 1000,
      updatedAt: 2000,
      stats: { usageCount: 5, keysSaved: 25, failureCount: 0 },
      blocks: [
        {
          id: 'b-trig-1',
          type: 'trigger',
          data: { shortcut: 'teste', smartCase: true, forceCapitalize: false }
        },
        {
          id: 'b-act-1',
          type: 'action',
          data: {
            format: 'richtext',
            content: '<p>Olá <b>Mundo</b></p>',
            tokens: []
          }
        }
      ]
    };

    const schema: StorageSchema = {
      flows: [canonicalFlow],
      variables: [],
      folders: [],
      forms: [],
      settings: {} as any
    };

    const res = validateImport(JSON.stringify(schema));
    expect(res.valid).toBe(true);
    expect(res.acceptedFlowsCount).toBe(1);
    expect(res.rejectedFlowsCount).toBe(0);
    expect(res.data?.flows?.[0].blocks).toHaveLength(2);
    expect(res.data?.flows?.[0].blocks[0].type).toBe('trigger');
    expect((res.data?.flows?.[0].blocks[0].data as any).shortcut).toBe('teste');
    expect(res.data?.flows?.[0].blocks[1].type).toBe('action');
    expect((res.data?.flows?.[0].blocks[1].data as any).content).toBe('<p>Olá <b>Mundo</b></p>');
  });

  it('Test 14: Canonical flow with <img src=x onerror="alert(1)"> is sanitized and stored securely in storage', async () => {
    const maliciousFlow: Flow = {
      id: 'malicious-flow-1',
      name: '/xss',
      enabled: true,
      tags: ['xss'],
      createdAt: 1000,
      updatedAt: 2000,
      stats: { usageCount: 0, keysSaved: 0, failureCount: 0 },
      blocks: [
        {
          id: 'b-trig-xss',
          type: 'trigger',
          data: { shortcut: 'xss', smartCase: true, forceCapitalize: false }
        },
        {
          id: 'b-act-xss',
          type: 'action',
          data: {
            format: 'richtext',
            content: '<p>Payload: <img src=x onerror="alert(1)"></p>',
            tokens: []
          }
        }
      ]
    };

    const schema = {
      flows: [maliciousFlow],
      variables: [
        { id: 'v1', key: 'VAR_TEST', value: '<b onclick="alert(2)">bold</b>' }
      ]
    };

    const validation = validateImport(JSON.stringify(schema));
    expect(validation.valid).toBe(true);
    expect(validation.acceptedFlowsCount).toBe(1);

    // Save to storage using StorageService
    await storage.importData(validation.data!, 'replace');

    // Retrieve directly from storage to verify what is physically persisted
    const storedFlows = await storage.getFlows();
    expect(storedFlows).toHaveLength(1);
    const storedAction = storedFlows[0].blocks.find(b => b.type === 'action')?.data as any;
    expect(storedAction.content).not.toContain('onerror');
    expect(storedAction.content).not.toContain('alert(1)');
    expect(storedAction.content).toBe('<p>Payload: <img src="x"></p>');

    const storedVars = await storage.getVariables();
    expect(storedVars).toHaveLength(1);
    expect(storedVars[0].value).not.toContain('onclick');
    expect(storedVars[0].value).toBe('<b>bold</b>');
  });

  it('Test 15: Rejects malicious payload with __proto__ in JSON parse reviver without crashing', () => {
    const maliciousJson = '{"flows":[],"__proto__":{"polluted":"yes"},"variables":[]}';
    const res = validateImport(maliciousJson);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toMatch(/Prototype Pollution/i);
    expect(({} as any).polluted).toBeUndefined();
  });

  it('Test 16: Discards malicious and unrecognized fields without breaking the application', () => {
    const schemaWithExtra: any = {
      flows: [
        {
          id: 'flow-extra',
          name: 'Extra Fields Flow',
          blocks: [
            {
              id: 'b-trig',
              type: 'trigger',
              data: { shortcut: 'extra', smartCase: true, forceCapitalize: false, evilField: 'bad' },
              maliciousBlockProp: 'hack'
            },
            {
              id: 'b-act',
              type: 'action',
              data: { format: 'plaintext', content: 'Normal content', tokens: [], badActionData: 666 },
              anotherBadProp: [1, 2, 3]
            }
          ],
          tags: ['test'],
          unknownFlowField: 'should_be_stripped',
          __exploit: { run: true }
        }
      ],
      variables: [],
      maliciousRootField: 'exploit'
    };

    const res = validateImport(JSON.stringify(schemaWithExtra));
    expect(res.valid).toBe(true);
    expect(res.acceptedFlowsCount).toBe(1);

    const flow = res.data?.flows?.[0] as any;
    expect(flow.unknownFlowField).toBeUndefined();
    expect(flow.__exploit).toBeUndefined();
    expect(flow.blocks[0].maliciousBlockProp).toBeUndefined();
    expect(flow.blocks[1].anotherBadProp).toBeUndefined();
    expect(flow.blocks[1].data.badActionData).toBeUndefined();
    expect(flow.blocks[1].data.content).toBe('Normal content');
  });

  it('Test 17: Legitimate full backup generated by the extension imports 100% without data loss', async () => {
    // Generate realistic storage data as exported by Settings #btn-export
    const fullBackup: StorageSchema = {
      flows: [
        {
          id: 'flow-greeting',
          name: '/oi',
          enabled: true,
          tags: ['atendimento'],
          createdAt: 1700000000000,
          updatedAt: 1700000001000,
          stats: { usageCount: 42, keysSaved: 500, failureCount: 1, lastUsed: 1700000002000 },
          blocks: [
            {
              id: 'trig-1',
              type: 'trigger',
              data: { shortcut: 'oi', smartCase: true, forceCapitalize: true }
            },
            {
              id: 'act-1',
              type: 'action',
              data: {
                format: 'richtext',
                content: '<p>Olá {{CLIENTE}}, como posso ajudar hoje?</p>',
                tokens: []
              }
            }
          ]
        },
        {
          id: 'flow-condition',
          name: '/horario',
          enabled: true,
          tags: [],
          createdAt: 1700000000000,
          updatedAt: 1700000001000,
          stats: { usageCount: 10, keysSaved: 100, failureCount: 0 },
          blocks: [
            {
              id: 'trig-2',
              type: 'trigger',
              data: { shortcut: 'horario', smartCase: true, forceCapitalize: false }
            },
            {
              id: 'cond-1',
              type: 'condition',
              data: {
                rules: [
                  {
                    id: 'rule-1',
                    type: 'domain',
                    operator: 'contains',
                    value: 'empresa.com',
                    action: {
                      format: 'plaintext',
                      content: 'Horário comercial: 8h às 18h',
                      tokens: []
                    }
                  }
                ],
                elseBranch: {
                  format: 'plaintext',
                  content: 'Atendimento geral: 24/7',
                  tokens: []
                }
              }
            }
          ]
        }
      ],
      variables: [
        { id: 'v-1', key: 'CLIENTE', value: 'Fulano', description: 'Nome do cliente', updatedAt: 1700000000000 }
      ],
      folders: [
        { id: 'f-1', name: 'Suporte', color: '#10b981', order: 1 }
      ],
      forms: [],
      settings: {
        triggerMode: 'trigger',
        triggerKeys: ['Space', 'Tab'],
        exactMatchChar: '/',
        globalEnabled: true,
        blocklist: ['*.internal.net'],
        commandPaletteShortcut: 'Ctrl+Shift+P',
        analytics: {},
        analyticsFailures: {},
        searchTrigger: {
          enabled: true,
          includeFlows: true,
          domainPrefix: '//',
          globalPrefix: '///'
        }
      }
    };

    const res = validateImport(JSON.stringify(fullBackup));
    expect(res.valid).toBe(true);
    expect(res.acceptedFlowsCount).toBe(2);
    expect(res.rejectedFlowsCount).toBe(0);
    expect(res.errors).toHaveLength(0);

    // Save and check storage preservation
    await storage.importData(res.data!, 'replace');
    const flows = await storage.getFlows();
    expect(flows).toHaveLength(2);
    expect(flows[0].name).toBe('/oi');
    expect(flows[0].stats.usageCount).toBe(42);
    expect(flows[1].name).toBe('/horario');
    const condBlock = flows[1].blocks.find(b => b.type === 'condition')?.data as any;
    expect(condBlock.rules[0].action.content).toBe('Horário comercial: 8h às 18h');
    expect(condBlock.elseBranch.content).toBe('Atendimento geral: 24/7');
  });

  it('Test 18: Partial failure skips corrupted flow and imports valid flows with correct counters', () => {
    const mixedSchema = {
      flows: [
        {
          id: 'valid-flow-1',
          name: '/valido1',
          blocks: [
            { id: 'b1', type: 'trigger', data: { shortcut: 'v1', smartCase: true, forceCapitalize: false } },
            { id: 'b2', type: 'action', data: { format: 'plaintext', content: 'Ok 1', tokens: [] } }
          ]
        },
        {
          id: 'corrupted-flow-missing-name',
          // name missing!
          blocks: [
            { id: 'b3', type: 'trigger', data: { shortcut: 'v2', smartCase: true, forceCapitalize: false } },
            { id: 'b4', type: 'action', data: { format: 'plaintext', content: 'Ok 2', tokens: [] } }
          ]
        },
        {
          id: 'corrupted-flow-empty-blocks',
          name: '/vazio',
          blocks: [] // no blocks!
        },
        {
          id: 'valid-flow-2',
          name: '/valido2',
          blocks: [
            { id: 'b5', type: 'trigger', data: { shortcut: 'v3', smartCase: true, forceCapitalize: false } },
            { id: 'b6', type: 'action', data: { format: 'plaintext', content: 'Ok 3', tokens: [] } }
          ]
        }
      ]
    };

    const res = validateImport(JSON.stringify(mixedSchema));
    expect(res.valid).toBe(true);
    expect(res.acceptedFlowsCount).toBe(2);
    expect(res.rejectedFlowsCount).toBe(2);
    expect(res.data?.flows).toHaveLength(2);
    expect(res.data?.flows?.[0].name).toBe('/valido1');
    expect(res.data?.flows?.[1].name).toBe('/valido2');
  });

  it('Test 19: validateToken sanitizes XSS in choice/random options, default values, labels, and strips unknown keys', () => {
    // 1. Choice token with XSS strings and objects in options
    const rawChoiceToken = {
      id: 'tok-choice-<script>',
      type: 'choice',
      config: {
        label: '<b>Escolha</b>',
        placeholder: '<img src=x onerror=alert("ph")>',
        options: [
          '<img src=x onerror=alert("opt1")> Opção 1',
          {
            id: 'opt-<svg onload=alert(1)>',
            text: '<script>alert("text")</script><b>Texto</b>',
            value: '<img src=x onerror=alert("val")>Valor',
            label: '<span onclick=alert("lbl")>Rótulo</span>',
            weight: 50,
            maliciousOptionProp: 'injected',
          },
          12345 // invalid option type
        ],
        maliciousTokenProp: 'hack',
      },
    };

    const validatedChoice = validateToken(rawChoiceToken);
    expect(validatedChoice).not.toBeNull();
    expect(validatedChoice?.id).toBe('tok-choice-&lt;script&gt;');
    expect(validatedChoice?.type).toBe('choice');
    expect(validatedChoice?.config.label).toBe('&lt;b&gt;Escolha&lt;/b&gt;');
    expect(validatedChoice?.config.placeholder).toBe('&lt;img src=x onerror=alert(&quot;ph&quot;)&gt;');
    
    // Check options sanitization
    const options = validatedChoice?.config.options as any[];
    expect(options).toHaveLength(3);
    // String option has onerror stripped by DOMPurify
    expect(options[0]).toBe('<img src="x"> Opção 1');
    // Object option has text and value sanitized, label and id escaped, weight preserved
    expect(options[1].text).not.toContain('<script>');
    expect(options[1].text).toBe('<b>Texto</b>');
    expect(options[1].value).toBe('<img src="x">Valor');
    expect(options[1].label).toBe('&lt;span onclick=alert(&quot;lbl&quot;)&gt;Rótulo&lt;/span&gt;');
    expect(options[1].id).toBe('opt-&lt;svg onload=alert(1)&gt;');
    expect(options[1].weight).toBe(50);
    expect(options[1].maliciousOptionProp).toBeUndefined();

    // Unknown property at config level is discarded
    expect((validatedChoice?.config as any).maliciousTokenProp).toBeUndefined();

    // 2. Input token with defaultValue XSS
    const rawInputToken = {
      id: 'tok-input-1',
      type: 'input',
      config: {
        defaultValue: '<p>Default <img src=x onerror=alert(2)></p>',
        label: 'Normal Label',
        format: 'YYYY-MM-DD',
        multiline: true,
      },
    };

    const validatedInput = validateToken(rawInputToken);
    expect(validatedInput).not.toBeNull();
    expect(validatedInput?.config.defaultValue).toBe('<p>Default <img src="x"></p>');
    expect(validatedInput?.config.label).toBe('Normal Label');
    expect(validatedInput?.config.format).toBe('YYYY-MM-DD');
    expect(validatedInput?.config.multiline).toBe(true);

    // 3. Null / invalid tokens return null
    expect(validateToken(null)).toBeNull();
    expect(validateToken('not an object')).toBeNull();
    expect(validateToken({ id: 123, type: 'input' })).toBeNull();
  });

  it('Test 20: Legacy validateBlock format enforces parity (trigger escaping, token sanitization, 500KB and depth limits)', () => {
    // 1. Valid legacy block with XSS in trigger fields and action tokens
    const legacyBlockWithXss = {
      id: 'legacy-block-1',
      trigger: {
        type: '<script>alert("type")</script>',
        value: 'test" onfocus="alert(1)',
        matchMode: 'exact<script>',
        shortcut: 'sc<alert>',
        unknownTriggerProp: 'bad'
      },
      action: {
        format: 'richtext',
        content: '<p>Legacy Content <img src=x onerror=alert(3)></p>',
        tokens: [
          {
            id: 'tok-leg-1',
            type: 'choice',
            config: {
              options: ['<b onclick="alert(4)">Opção</b>']
            }
          }
        ]
      }
    };

    const validatedLegacy = validateBlock(legacyBlockWithXss);
    expect(validatedLegacy).not.toBeNull();
    expect(validatedLegacy.id).toBe('legacy-block-1');
    
    // Trigger fields are properly escaped and unknown properties discarded
    expect(validatedLegacy.trigger.type).toBe('&lt;script&gt;alert(&quot;type&quot;)&lt;/script&gt;');
    expect(validatedLegacy.trigger.value).toBe('test&quot; onfocus=&quot;alert(1)');
    expect(validatedLegacy.trigger.matchMode).toBe('exact&lt;script&gt;');
    expect(validatedLegacy.trigger.shortcut).toBe('sc&lt;alert&gt;');
    expect(validatedLegacy.trigger.unknownTriggerProp).toBeUndefined();

    // Action content and tokens are sanitized identically to canonical blocks
    expect(validatedLegacy.action.content).toBe('<p>Legacy Content <img src="x"></p>');
    expect(validatedLegacy.action.tokens).toHaveLength(1);
    expect(validatedLegacy.action.tokens[0].config.options[0]).toBe('<b>Opção</b>');

    // 2. Legacy block exceeding 500KB content limit is rejected (returns null)
    const legacyBlockTooLarge = {
      id: 'legacy-large',
      trigger: { type: 'keyword', value: 'big' },
      action: {
        format: 'plaintext',
        content: 'x'.repeat(600000),
        tokens: []
      }
    };
    expect(validateBlock(legacyBlockTooLarge)).toBeNull();

    // 3. Legacy block exceeding recursion depth limit (20 levels) is rejected (returns null)
    let deepTarget: any = { type: 'random', options: [{ id: '1', weight: 100, target: null }] };
    const rootTarget = deepTarget;
    for (let i = 0; i < 25; i++) {
      deepTarget.options[0].target = { type: 'random', options: [{ id: `d-${i}`, weight: 100, target: null }] };
      deepTarget = deepTarget.options[0].target;
    }
    deepTarget.options[0].target = { format: 'plaintext', content: 'Leaf', tokens: [] };

    const legacyDeepBlock = {
      id: 'legacy-deep',
      trigger: { type: 'keyword', value: 'deep' },
      action: rootTarget
    };
    expect(validateBlock(legacyDeepBlock)).toBeNull();
  });

  it('Test 21: Full validateImport parses legacy format flows and sanitizes them completely before saving to storage', async () => {
    const legacyFlowPayload = {
      flows: [
        {
          id: 'flow-legacy-xss',
          name: 'Legacy Flow <script>',
          enabled: true,
          blocks: [
            {
              id: 'b-leg',
              trigger: {
                type: 'keyword',
                value: 'hello" onerror="alert(1)',
                matchMode: 'exact'
              },
              action: {
                format: 'richtext',
                content: '<p>Oi <svg onload=alert(5)></svg></p>',
                tokens: [
                  {
                    id: 'tok-1',
                    type: 'choice',
                    config: {
                      options: [
                        { text: '<a href="javascript:alert(1)">Opção 1</a>', weight: 100 }
                      ]
                    }
                  }
                ]
              }
            }
          ]
        }
      ]
    };

    const res = validateImport(JSON.stringify(legacyFlowPayload));
    expect(res.valid).toBe(true);
    expect(res.acceptedFlowsCount).toBe(1);

    // Save to storage using StorageService
    const importRes = await storage.importData(res.data!, 'replace');
    expect(importRes.flowsCount).toBe(1);

    const savedFlows = await storage.getFlows();
    expect(savedFlows).toHaveLength(1);
    expect(savedFlows[0].name).toBe('Legacy Flow &lt;script&gt;');
    
    const block = savedFlows[0].blocks[0] as any;
    expect(block.trigger.value).toBe('hello&quot; onerror=&quot;alert(1)');
    expect(block.action.content).toBe('<p>Oi </p>');
    expect(block.action.tokens[0].config.options[0].text).toBe('<a>Opção 1</a>');
  });
});
