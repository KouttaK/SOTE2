// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storage } from './StorageService.js';
import { validateImport } from '../utils/importValidator.js';
import { resolveFlowActionBlock, resolveLeaf } from '../../content/engine/ConditionResolver.js';
import { resolveActionBlockContent } from '../../content/engine/ActionContentResolver.js';
import type { Flow, StorageSchema, ActionBlock } from '../types/index.js';

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
    tabs: {
      create: vi.fn(),
    },
    runtime: {
      getURL: vi.fn((path: string) => `chrome-extension://mock-id${path}`),
    },
  },
}));

describe('Auditoria de Retrocompatibilidade e Schemas', () => {
  beforeEach(() => {
    for (const k in mockLocalStorage) delete mockLocalStorage[k];
    vi.clearAllMocks();
  });

  const legacyFlowWithoutStatsOrRepeatOrTokens: any = {
    id: 'legacy-flow-001',
    name: 'Legacy Snippet',
    // Missing stats object
    // Missing tags
    enabled: true,
    createdAt: 1600000000000,
    updatedAt: 1600000000000,
    blocks: [
      {
        id: 'trig-1',
        type: 'trigger',
        data: {
          shortcut: 'leg',
        },
      },
      {
        id: 'act-1',
        type: 'action',
        data: {
          format: 'plaintext',
          content: 'Hello from legacy flow!',
          // Missing tokens array
        },
      },
    ],
  };

  const legacyFlowWithOldCondition: any = {
    id: 'legacy-cond-flow',
    name: 'Legacy Condition',
    enabled: true,
    blocks: [
      {
        id: 'trig-2',
        type: 'trigger',
        data: { shortcut: 'cond' },
      },
      {
        id: 'cond-1',
        type: 'condition',
        data: {
          rules: [
            {
              id: 'rule-1',
              type: 'domain',
              operator: 'equals',
              value: 'example.com',
              // Missing criteria, combinator
              action: {
                format: 'plaintext',
                content: 'Matched domain!',
              },
            },
          ],
          elseBranch: {
            format: 'plaintext',
            content: 'Fallback else content',
          },
        },
      },
    ],
  };

  it('Carrega fluxos antigos com stats ausentes e normaliza valores undefined com segurança', async () => {
    mockLocalStorage['flows'] = [legacyFlowWithoutStatsOrRepeatOrTokens];

    const flows = await storage.getFlows();
    expect(flows).toHaveLength(1);
    expect(flows[0].id).toBe('legacy-flow-001');
    expect(flows[0].stats).toBeDefined();
    expect(flows[0].stats.usageCount).toBe(0);
    expect(flows[0].stats.keysSaved).toBe(0);
    expect(flows[0].stats.failureCount).toBe(0);
    expect(flows[0].tags).toEqual([]);
    expect(flows[0].blocks).toHaveLength(2);
  });

  it('Incrementa estatísticas em fluxo antigo sem lançar erros e sem gerar NaN', async () => {
    mockLocalStorage['flows'] = [legacyFlowWithoutStatsOrRepeatOrTokens];

    await storage.incrementFlowStats('legacy-flow-001', 25);
    let updated = await storage.getFlow('legacy-flow-001');
    expect(updated?.stats.usageCount).toBe(1);
    expect(updated?.stats.keysSaved).toBe(25);
    expect(updated?.stats.failureCount).toBe(0);
    expect(Number.isNaN(updated?.stats.usageCount)).toBe(false);

    await storage.incrementFlowFailure('legacy-flow-001');
    updated = await storage.getFlow('legacy-flow-001');
    expect(updated?.stats.usageCount).toBe(1);
    expect(updated?.stats.failureCount).toBe(1);
  });

  it('Expande fluxo legado sem RepeatBlock e sem tokens sem lançar exceções', async () => {
    const leaf = resolveFlowActionBlock(legacyFlowWithoutStatsOrRepeatOrTokens, null, 'leg');
    expect(leaf).not.toBeNull();
    expect(leaf?.content).toBe('Hello from legacy flow!');

    const dummyChoicePopup: any = { showForToken: vi.fn() };
    const dummyDiv = document.createElement('div');
    const result = await resolveActionBlockContent(leaf!, dummyDiv, {
      choicePopup: dummyChoicePopup,
      variables: [],
      context: { tabUrl: 'https://example.com', tabTitle: 'Example' },
    });

    expect(result).not.toBeNull();
    expect(result?.content).toBe('Hello from legacy flow!');
  });

  it('Expande fluxo de condição legado (sem criteria/combinator) corretamente', () => {
    const matched = resolveFlowActionBlock(legacyFlowWithOldCondition, null, 'cond');
    expect(matched).not.toBeNull();
    expect(matched?.content).toBe('Fallback else content');
  });

  it('Exportação integral (StorageSchema) e exportação seletiva de fluxos funcionam em harmonia', () => {
    // 1. Simula exportação seletiva (versão 2)
    const selectiveExport = {
      version: 2,
      exportedAt: new Date().toISOString(),
      flows: [legacyFlowWithoutStatsOrRepeatOrTokens],
    };

    const resSelective = validateImport(JSON.stringify(selectiveExport));
    expect(resSelective.valid).toBe(true);
    expect(resSelective.acceptedFlowsCount).toBe(1);
    expect(resSelective.data?.flows?.[0].id).toBe('legacy-flow-001');
    expect(resSelective.data?.flows?.[0].stats.usageCount).toBe(0);

    // 2. Simula exportação integral (StorageSchema)
    const fullBackup: StorageSchema = {
      flows: [legacyFlowWithoutStatsOrRepeatOrTokens],
      variables: [{ id: 'var-1', key: 'CLIENTE', value: 'ACME', updatedAt: 12345 }],
      folders: [{ id: 'fold-1', name: 'Geral', color: '#3b82f6', order: 0 }],
      forms: [],
      settings: {
        triggerMode: 'trigger',
        triggerKeys: ['Tab'],
        exactMatchChar: '!',
        globalEnabled: true,
        blocklist: [],
        commandPaletteShortcut: 'Ctrl+Shift+P',
        analytics: {},
        searchTrigger: {
          enabled: false,
          includeFlows: true,
          domainPrefix: '//',
          globalPrefix: '///',
        },
      },
    };

    const resFull = validateImport(JSON.stringify(fullBackup));
    expect(resFull.valid).toBe(true);
    expect(resFull.acceptedFlowsCount).toBe(1);
    expect(resFull.data?.variables).toHaveLength(1);
    expect(resFull.data?.folders).toHaveLength(1);
    expect(resFull.data?.settings?.triggerMode).toBe('trigger');

    // 3. Array bruto de fluxos legado
    const rawArray = [legacyFlowWithoutStatsOrRepeatOrTokens];
    const resRaw = validateImport(JSON.stringify(rawArray));
    expect(resRaw.valid).toBe(true);
    expect(resRaw.acceptedFlowsCount).toBe(1);
  });
});

describe('Auditoria de Ergonomia Mobile e Guardas de Teclado', () => {
  it('Guardas de atalhos ignoram eventos durante IME composition de teclados virtuais', () => {
    let triggered = false;
    const clickHandler = () => { triggered = true; };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'c' || e.key === 'C')) {
        clickHandler();
      }
    };

    // Event with isComposing = true (virtual keyboard composing)
    const composingEvent = {
      key: 'c',
      altKey: true,
      ctrlKey: false,
      metaKey: false,
      isComposing: true,
    } as any;

    handleKeydown(composingEvent);
    expect(triggered).toBe(false);

    // Event with isComposing = false (normal desktop shortcut)
    const normalEvent = {
      key: 'c',
      altKey: true,
      ctrlKey: false,
      metaKey: false,
      isComposing: false,
    } as any;

    handleKeydown(normalEvent);
    expect(triggered).toBe(true);
  });

  it('Guardas de Alt+C e Alt+V não disparam com AltGr (ctrlKey + altKey) evitando conflitos internacionais', () => {
    let altC = false;
    let altV = false;

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'c' || e.key === 'C')) {
        altC = true;
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'v' || e.key === 'V')) {
        altV = true;
      }
    };

    // AltGr sets both altKey: true AND ctrlKey: true
    const altGrEvent = {
      key: 'c',
      altKey: true,
      ctrlKey: true,
      metaKey: false,
      isComposing: false,
    } as any;

    handleKeydown(altGrEvent);
    expect(altC).toBe(false);
    expect(altV).toBe(false);
  });

  it('Guarda do atalho "/" não foca busca quando o usuário está editando um campo ou usando modificadores', () => {
    let searchFocused = false;
    const focusSearch = () => { searchFocused = true; };

    const handleSlash = (e: any, target: any) => {
      if (e.isComposing) return;
      if (e.key === '/' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const isTyping =
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable);
        if (!isTyping) {
          focusSearch();
        }
      }
    };

    // Typing inside an input
    const inputEl = { tagName: 'INPUT', isContentEditable: false };
    handleSlash({ key: '/', isComposing: false }, inputEl);
    expect(searchFocused).toBe(false);

    // Typing inside a textarea
    const textareaEl = { tagName: 'TEXTAREA', isContentEditable: false };
    handleSlash({ key: '/', isComposing: false }, textareaEl);
    expect(searchFocused).toBe(false);

    // Pressing / on regular document body
    const bodyEl = { tagName: 'BODY', isContentEditable: false };
    handleSlash({ key: '/', isComposing: false }, bodyEl);
    expect(searchFocused).toBe(true);
  });
});
