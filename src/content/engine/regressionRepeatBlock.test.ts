/**
 * @vitest-environment jsdom
 *
 * src/content/engine/regressionRepeatBlock.test.ts
 *
 * Teste de reprodução para os Bugs A e B no RepeatBlock:
 *
 * Bug A:
 *   - Em um ActionBlock com formato 'richtext' contendo:
 *     - token counter (start=1, step=+1)
 *     - token math (expressão '10*9/10*3')
 *     - variável com fallback {{TESTE|lucasa}}
 *     - envolto em RepeatBlock (count=2, separator='\n')
 *   - Falha observada:
 *     1. Math avalia como string vazia ("") porque `sanitizeHtml` possui `ALLOW_DATA_ATTR: false`,
 *        removendo `data-token-config` e `data-token-id`.
 *     2. Counter não incrementa (produz "1" em ambas repetições) pelo mesmo motivo (perda de config/id
 *        e falta de continuidade do estado do contador entre repetições).
 *
 * Bug B:
 *   - Vazamento de UI no conteúdo do bloco (ex: nó `<span class="block-dock-toggle-label">blocos</span>`
 *     ou texto 'blocos' inserido inadvertidamente).
 *   - Falha observada:
 *     O texto de UI ('blocos') não é higienizado/removido e vaza para o conteúdo final injetado.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveFlowActionBlock } from './ConditionResolver.js';
import { resolveActionBlockContent } from './ActionContentResolver.js';
import { resetCounterState } from './tokenExpander.js';
import { TokenPill } from '../../dashboard/components/tokens/TokenPill.js';
import type { Flow, Token, RepeatBlock } from '../../shared/types/index.js';

describe('Regressão RepeatBlock: Bugs A e B', () => {
  beforeEach(() => {
    resetCounterState();
    vi.clearAllMocks();
  });

  const dummyChoicePopup: any = {
    showForToken: vi.fn().mockResolvedValue(''),
  };

  it('Bug A: Token Counter deve incrementar (+1) e Token Math deve avaliar expressão ("10*9/10*3" -> 27) em repetições de ActionBlock richtext', async () => {
    const counterToken: Token = {
      id: 'tok-counter-rep',
      type: 'counter',
      config: { start: 1, step: 1 },
    };

    const mathToken: Token = {
      id: 'tok-math-rep',
      type: 'math',
      config: { expression: '10*9/10*3' },
    };

    const counterHtml = TokenPill.createHTML(counterToken);
    const mathHtml = TokenPill.createHTML(mathToken);

    const repeatBlock: RepeatBlock = {
      type: 'repeat',
      count: 2,
      separator: '\n',
      target: {
        format: 'richtext',
        content: `<p>${counterHtml} - ${mathHtml} - {{TESTE|lucasa}}</p>`,
        tokens: [counterToken, mathToken],
      },
    };

    const flow: Flow = {
      id: 'flow-regression-bug-a',
      title: 'Fluxo Regressão Bug A',
      trigger: {
        type: 'shortcut',
        shortcut: 'rep',
        enabled: true,
      },
      blocks: [
        {
          id: 'action-repeat-a',
          type: 'action',
          data: repeatBlock as any,
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const targetElement = document.createElement('div');

    // 1. Resolução inicial do fluxo para ActionBlock consolidado
    const resolvedActionBlock = resolveFlowActionBlock(flow, targetElement, 'rep');
    expect(resolvedActionBlock).not.toBeNull();

    // 2. Resolução do conteúdo dos blocos e expansão dos tokens
    const result = await resolveActionBlockContent(resolvedActionBlock!, targetElement, {
      choicePopup: dummyChoicePopup,
      variables: [],
      context: { tabUrl: 'https://example.com', tabTitle: 'Example' },
      flows: [flow],
      shortcutTyped: 'rep',
    });

    expect(result).not.toBeNull();

    // Comportamento esperado:
    // Iteração 1: Contador = 1, Math = 27 (10*9/10*3 = 90/10*3 = 9*3 = 27), Variável fallback = lucasa
    // Iteração 2: Contador = 2, Math = 27, Variável fallback = lucasa
    // Separador: '\n'
    //
    // Falha atual (Bug A):
    // Recebido: "<p>1 -  - lucasa</p>\n<p>1 -  - lucasa</p>"
    // - Math avaliou vazio ("") devido ao sanitizeHtml remover data-token-config
    // - Counter não incrementou (ficou 1 em vez de 2)
    expect(result?.content).toContain('1 - 27 - lucasa');
    expect(result?.content).toContain('2 - 27 - lucasa');
  });

  it('Bug B: Vazamento de UI - nó de elemento de UI (<span class="block-dock-toggle-label">blocos</span>) não deve vazar para o conteúdo resolvido', async () => {
    const counterToken: Token = {
      id: 'tok-counter-leak-node',
      type: 'counter',
      config: { start: 1, step: 1 },
    };

    const mathToken: Token = {
      id: 'tok-math-leak-node',
      type: 'math',
      config: { expression: '10*9/10*3' },
    };

    const counterHtml = TokenPill.createHTML(counterToken);
    const mathHtml = TokenPill.createHTML(mathToken);

    // Simulação de nó de UI injetado no HTML do editor
    const repeatBlock: RepeatBlock = {
      type: 'repeat',
      count: 2,
      separator: '\n',
      target: {
        format: 'richtext',
        content: `<p>${counterHtml} - ${mathHtml} - {{TESTE|lucasa}} <span class="block-dock-toggle-label">blocos</span></p>`,
        tokens: [counterToken, mathToken],
      },
    };

    const flow: Flow = {
      id: 'flow-regression-bug-b-node',
      title: 'Fluxo Regressão Bug B Nó',
      trigger: {
        type: 'shortcut',
        shortcut: 'rep',
        enabled: true,
      },
      blocks: [
        {
          id: 'action-repeat-b-node',
          type: 'action',
          data: repeatBlock as any,
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const targetElement = document.createElement('div');

    const resolvedActionBlock = resolveFlowActionBlock(flow, targetElement, 'rep');
    expect(resolvedActionBlock).not.toBeNull();

    const result = await resolveActionBlockContent(resolvedActionBlock!, targetElement, {
      choicePopup: dummyChoicePopup,
      variables: [],
      context: { tabUrl: 'https://example.com', tabTitle: 'Example' },
      flows: [flow],
      shortcutTyped: 'rep',
    });

    expect(result).not.toBeNull();

    // O texto de nós de UI como "blocos" não pode vazar no resultado final
    expect(result?.content).not.toContain('blocos');
  });

  it('Bug B: Vazamento de UI - texto residual "blocos" não deve vazar para o conteúdo resolvido', async () => {
    const repeatBlock: RepeatBlock = {
      type: 'repeat',
      count: 2,
      separator: '\n',
      target: {
        format: 'richtext',
        content: `<p>Item 1 <span class="block-type-label">blocos</span></p>`,
        tokens: [],
      },
    };

    const flow: Flow = {
      id: 'flow-regression-bug-b-text',
      title: 'Fluxo Regressão Bug B Texto',
      trigger: {
        type: 'shortcut',
        shortcut: 'rep',
        enabled: true,
      },
      blocks: [
        {
          id: 'action-repeat-b-text',
          type: 'action',
          data: repeatBlock as any,
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const targetElement = document.createElement('div');

    const resolvedActionBlock = resolveFlowActionBlock(flow, targetElement, 'rep');
    expect(resolvedActionBlock).not.toBeNull();

    const result = await resolveActionBlockContent(resolvedActionBlock!, targetElement, {
      choicePopup: dummyChoicePopup,
      variables: [],
      context: { tabUrl: 'https://example.com', tabTitle: 'Example' },
      flows: [flow],
      shortcutTyped: 'rep',
    });

    expect(result).not.toBeNull();

    // Garante que o texto 'blocos' não vaza no conteúdo final
    expect(result?.content).not.toContain('blocos');
  });

  it('Cenário exato reportado: Counter (start=1, step=+1) + Math (10*9/10*3) + {{TESTE|Texto Padrão}} em RepeatBlock (2x, \\n) sem "blocos"', async () => {
    const counterToken: Token = {
      id: 'tok-counter-exact',
      type: 'counter',
      config: { start: 1, step: 1 },
    };

    const mathToken: Token = {
      id: 'tok-math-exact',
      type: 'math',
      config: { expression: '10*9/10*3' },
    };

    const counterHtml = TokenPill.createHTML(counterToken);
    const mathHtml = TokenPill.createHTML(mathToken);

    const repeatBlock: RepeatBlock = {
      type: 'repeat',
      count: 2,
      separator: '\n',
      target: {
        format: 'richtext',
        content: `<p>${counterHtml} - ${mathHtml} - {{TESTE|Texto Padrão}}</p>`,
        tokens: [counterToken, mathToken],
      },
    };

    const flow: Flow = {
      id: 'flow-regression-exact',
      title: 'Fluxo Regressão Exato',
      trigger: {
        type: 'shortcut',
        shortcut: 'rep',
        enabled: true,
      },
      blocks: [
        {
          id: 'action-repeat-exact',
          type: 'action',
          data: repeatBlock as any,
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const targetElement = document.createElement('div');

    const resolvedActionBlock = resolveFlowActionBlock(flow, targetElement, 'rep');
    expect(resolvedActionBlock).not.toBeNull();

    const result = await resolveActionBlockContent(resolvedActionBlock!, targetElement, {
      choicePopup: dummyChoicePopup,
      variables: [],
      context: { tabUrl: 'https://example.com', tabTitle: 'Example' },
      flows: [flow],
      shortcutTyped: 'rep',
    });

    expect(result).not.toBeNull();
    expect(result?.content).toContain('1 - 27 - Texto Padrão');
    expect(result?.content).toContain('2 - 27 - Texto Padrão');
    expect(result?.content).not.toContain('blocos');
  });
});
