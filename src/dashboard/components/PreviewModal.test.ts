/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PreviewModal, simulateBranchContent, formatSeparator, openFlowPreviewModal } from './PreviewModal.js';
import { resolveLeaf } from '../../content/engine/ConditionResolver.js';
import { resolveActionBlockContent } from '../../content/engine/ActionContentResolver.js';
import { resetCounterState } from '../../content/engine/tokenExpander.js';
import { setLanguage } from '../../shared/i18n/index.js';
import type {
  ActionBlock as IActionBlock,
  RepeatBlock as IRepeatBlock,
  RandomBlock as IRandomBlock,
  ConditionBlock as IConditionBlock,
  Variable,
  Settings,
  TriggerBlock as ITriggerBlock,
  Flow,
} from '../../shared/types/index.js';

describe('PreviewModal & simulateBranchContent (2-Column Layout)', () => {
  beforeEach(() => {
    setLanguage('pt-BR');
    resetCounterState();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  const baseSettings: Settings = {
    triggerMode: 'exact_match',
    exactMatchChar: '/',
    theme: 'dark',
    language: 'pt-BR',
  } as Settings;

  const baseTrigger: ITriggerBlock = {
    shortcut: 'qq3',
  };

  it('formatSeparator displays whitespace characters legibly', () => {
    expect(formatSeparator('\n')).toBe('\\n');
    expect(formatSeparator('\r\n')).toBe('\\r\\n');
    expect(formatSeparator('\t')).toBe('\\t');
    expect(formatSeparator(' ')).toBe('[espaço]');
    expect(formatSeparator(', ')).toBe(', ');
    expect(formatSeparator('')).toBe('(nenhum)');
  });

  it('resolves RepeatBlock + counter + math + variable fallback byte-for-byte identical to real engine', async () => {
    const actionBlock: IActionBlock = {
      format: 'richtext',
      content:
        '<p><span class="token-pill token-counter" data-token-id="tok_counter" data-token-config="{&quot;start&quot;:1,&quot;step&quot;:1}">Contador</span> - <span class="token-pill token-math" data-token-id="tok_math" data-token-config="{&quot;expression&quot;:&quot;10*9/10*3&quot;}">Math</span> - {{TESTE|lucasa}}</p>',
      tokens: [
        {
          id: 'tok_counter',
          type: 'counter',
          config: { start: 1, step: 1 },
        },
        {
          id: 'tok_math',
          type: 'math',
          config: { expression: '10*9/10*3' },
        },
      ],
    };

    const repeatBlock: IRepeatBlock = {
      type: 'repeat',
      count: 2,
      separator: '\n',
      target: actionBlock,
    };

    const variables: Variable[] = [
      // TESTE is intentionally omitted to verify the fallback '|lucasa'
    ];

    // 1. Simulate using PreviewModal's simulateBranchContent
    const simulated = await simulateBranchContent(repeatBlock, variables);

    // 2. Resolve using real production engine pipeline
    resetCounterState();
    const dummyEl = document.createElement('div');
    const dummyChoicePopup = {
      showForToken: vi.fn().mockResolvedValue(''),
    } as any;

    const resolvedLeaf = resolveLeaf(repeatBlock, dummyEl, undefined, { variables });
    expect(resolvedLeaf).not.toBeNull();

    const realResult = await resolveActionBlockContent(resolvedLeaf!, dummyEl, {
      choicePopup: dummyChoicePopup,
      variables,
      context: {
        tabUrl: 'https://example.com',
        tabTitle: 'Page Title',
        clipboardHistory: ['Exemplo Clipboard'],
      },
    });

    expect(realResult).not.toBeNull();

    // Verify byte-for-byte exact equality between simulated preview and real engine output
    expect(simulated).toBe(realResult!.content);

    // Verify repetition 1 resolved: counter = 1, math = 27, var fallback = lucasa
    expect(simulated).toContain('<p>1 - 27 - lucasa</p>');

    // Verify repetition 2 resolved: counter = 2 (incremented!), math = 27, var fallback = lucasa
    expect(simulated).toContain('<p>2 - 27 - lucasa</p>');

    // Verify both repetitions appear in order separated by newline
    expect(simulated).toBe('<p>1 - 27 - lucasa</p>\n<p>2 - 27 - lucasa</p>');
  });

  it('renders 2-column side-by-side layout with Block Tree cards and Rendered Preview', async () => {
    const actionBlock: IActionBlock = {
      format: 'richtext',
      content:
        '<p><span class="token-pill token-counter" data-token-id="tok_c" data-token-config="{&quot;start&quot;:1,&quot;step&quot;:1}">Contador</span></p>',
      tokens: [
        {
          id: 'tok_c',
          type: 'counter',
          config: { start: 1, step: 1 },
        },
      ],
    };

    const repeatBlock: IRepeatBlock = {
      type: 'repeat',
      count: 2,
      separator: '\n',
      target: actionBlock,
    };

    const modal = new PreviewModal({
      trigger: baseTrigger,
      settings: baseSettings,
      branches: [
        {
          tag: 'SE',
          ruleDescription: 'Domínio é igual a gmail.com',
          action: actionBlock,
          repeatBlock,
          target: repeatBlock,
        },
      ],
      variables: [],
    });

    await modal.init();
    modal.open();

    const backdrop = document.querySelector('.modal-backdrop');
    expect(backdrop).not.toBeNull();

    // Container check
    const container = backdrop!.querySelector('.modal-container--preview');
    expect(container).not.toBeNull();

    // Header check
    const headerTitle = backdrop!.querySelector('.preview-header-title');
    expect(headerTitle?.textContent).toBe('/qq3');
    const badge = backdrop!.querySelector('.preview-header-badge');
    expect(badge?.textContent).toBe('Bloco raiz');

    // 2-Columns Body check
    const treeCol = backdrop!.querySelector('.preview-tree-col');
    const renderCol = backdrop!.querySelector('.preview-render-col');
    expect(treeCol).not.toBeNull();
    expect(renderCol).not.toBeNull();

    // Left Column: Árvore de Blocos
    const treeTitle = treeCol!.querySelector('.preview-tree-title');
    expect(treeTitle?.textContent).toBe('Árvore de Blocos');

    // Condition card in tree
    const condCard = treeCol!.querySelector('.preview-card--condition');
    expect(condCard).not.toBeNull();
    expect(condCard?.textContent).toContain('ConditionBlock');
    expect(condCard?.textContent).toContain('SE');

    // Repeat card in tree
    const repeatCard = treeCol!.querySelector('.preview-card--repeat');
    expect(repeatCard).not.toBeNull();
    expect(repeatCard?.textContent).toContain('RepeatBlock');
    expect(repeatCard?.textContent).toContain('Repetir 2×');

    // Legend at bottom of left column
    const legend = treeCol!.querySelector('.preview-tree-legend');
    expect(legend).not.toBeNull();
    expect(legend?.textContent).toContain('ConditionBlock');
    expect(legend?.textContent).toContain('RandomBlock');
    expect(legend?.textContent).toContain('RepeatBlock');
    expect(legend?.textContent).toContain('ActionBlock');

    // Right Column: Preview Renderizado
    const renderTitle = renderCol!.querySelector('.preview-render-title');
    expect(renderTitle?.textContent).toBe('Preview Renderizado');

    // Rendered output with pills
    const renderOutput = renderCol!.querySelector('.preview-render-output');
    expect(renderOutput).not.toBeNull();

    // Counter pills present and incremented (1 and 2)
    const counterPills = renderOutput!.querySelectorAll('.preview-pill--counter');
    expect(counterPills.length).toBe(2);
    expect(counterPills[0]?.textContent).toBe('1');
    expect(counterPills[1]?.textContent).toBe('2');

    // Footer with copy button
    const copyBtn = renderCol!.querySelector('.preview-copy-all-btn');
    expect(copyBtn).not.toBeNull();
    expect(copyBtn?.textContent).toContain('Copiar resultado');

    // Close modal
    modal.close();
    expect(document.querySelector('.modal-backdrop')).toBeNull();
  });

  it('renders all token badges with correct styling and metadata in Rendered Preview', async () => {
    const actionBlock: IActionBlock = {
      format: 'richtext',
      content: `
        <p>
          Olá {{CLIENTE}},
          <span class="token-pill token-counter" data-token-id="t_counter" data-token-config="{&quot;start&quot;:1,&quot;step&quot;:1}">Contador</span>
          <span class="token-pill token-math" data-token-id="t_math" data-token-config="{&quot;expression&quot;:&quot;50*2&quot;}">Math</span>
          {{STATUS|pendente}}
          <span class="token-pill token-choice" data-token-id="t_choice" data-token-config="{&quot;options&quot;:[&quot;Sim&quot;,&quot;Não&quot;]}">Escolha</span>
          <span class="token-pill token-input" data-token-id="t_input" data-token-config="{&quot;label&quot;:&quot;Obs&quot;}">Input</span>
          <span class="token-pill token-date" data-token-id="t_date" data-token-config="{&quot;format&quot;:&quot;DD/MM/YYYY&quot;}">Data</span>
          <span class="token-pill token-clipboard" data-token-id="t_clip" data-token-config="{&quot;index&quot;:1}">Clip</span>
          <span class="token-pill token-cursor" data-token-id="t_cur">Cursor</span>
        </p>
      `,
      tokens: [
        { id: 't_counter', type: 'counter', config: { start: 1, step: 1 } },
        { id: 't_math', type: 'math', config: { expression: '50*2' } },
        { id: 't_choice', type: 'choice', config: { options: ['Sim', 'Não'] } },
        { id: 't_input', type: 'input', config: { label: 'Obs' } },
        { id: 't_date', type: 'date', config: { format: 'DD/MM/YYYY' } },
        { id: 't_clip', type: 'clipboard', config: { index: 1 } },
        { id: 't_cur', type: 'cursor', config: {} },
      ],
    };

    const variables: Variable[] = [
      { id: 'v1', key: 'CLIENTE', value: 'Lucas', createdAt: 0, updatedAt: 0 },
      // STATUS omitted to trigger fallback
    ];

    const modal = new PreviewModal({
      trigger: baseTrigger,
      settings: baseSettings,
      branches: [
        {
          action: actionBlock,
          target: actionBlock,
        },
      ],
      variables,
    });

    await modal.init();
    modal.open();

    const output = document.querySelector('.preview-render-output');
    expect(output).not.toBeNull();

    // 1. Real Variable: solid pill with real value "Lucas"
    const realVarPill = output!.querySelector('.preview-pill--var');
    expect(realVarPill).not.toBeNull();
    expect(realVarPill?.textContent).toBe('Lucas');

    // 2. Fallback Variable: dashed pill with fallback value "pendente" and "(padrão)" tag
    const fallbackPill = output!.querySelector('.preview-pill--fallback');
    expect(fallbackPill).not.toBeNull();
    expect(fallbackPill?.textContent).toContain('pendente');
    expect(fallbackPill?.textContent).toContain('(padrão)');

    // 3. Counter pill
    const counterPill = output!.querySelector('.preview-pill--counter');
    expect(counterPill).not.toBeNull();
    expect(counterPill?.textContent).toBe('1');

    // 4. Math pill with result 100, (cálculo) tag, and formula tooltip
    const mathPill = output!.querySelector('.preview-pill--math');
    expect(mathPill).not.toBeNull();
    expect(mathPill?.textContent).toBe('100');
    expect(output!.querySelector('.preview-math-tag')?.textContent).toBe('(cálculo)');
    expect(mathPill?.getAttribute('title')).toBe('Fórmula: 50*2');

    // 5. Choice pill with options summary
    const choicePill = output!.querySelector('.preview-pill--choice');
    expect(choicePill).not.toBeNull();
    expect(choicePill?.textContent).toContain('[1] Sim [2] Não');

    // 6. Input pill
    const inputPill = output!.querySelector('.preview-pill--input');
    expect(inputPill).not.toBeNull();
    expect(inputPill?.textContent).toContain('Obs');

    // 7. Date pill
    const datePill = output!.querySelector('.preview-pill--date');
    expect(datePill).not.toBeNull();
    expect(datePill?.textContent?.length).toBeGreaterThan(0);

    // 8. Clipboard pill
    const clipPill = output!.querySelector('.preview-pill--clipboard');
    expect(clipPill).not.toBeNull();

    // 9. Cursor pill
    const curPill = output!.querySelector('.preview-pill--cursor');
    expect(curPill).not.toBeNull();
    expect(curPill?.textContent).toContain('⌶ [cursor]');

    modal.close();
  });

  it('renders RandomBlock card with option weights and chosen indicator', async () => {
    const randomBlock: IRandomBlock = {
      type: 'random',
      options: [
        { id: 'opt_1', weight: 40, target: { format: 'plaintext', content: 'Texto Opção A', tokens: [] } },
        { id: 'opt_2', weight: 60, target: { format: 'plaintext', content: 'Texto Opção B', tokens: [] } },
      ],
    };

    const modal = new PreviewModal({
      trigger: baseTrigger,
      settings: baseSettings,
      branches: [
        {
          tag: 'SE',
          action: randomBlock.options[0].target as IActionBlock,
          target: randomBlock,
        },
      ],
      variables: [],
    });

    await modal.init();
    modal.open();

    const randomCard = document.querySelector('.preview-card--random');
    expect(randomCard).not.toBeNull();
    expect(randomCard?.textContent).toContain('RandomBlock');
    expect(randomCard?.textContent).toContain('2 ramos');
    expect(randomCard?.textContent).toContain('40%');
    expect(randomCard?.textContent).toContain('60%');

    // Chosen indicator
    const chosenTag = randomCard!.querySelector('.preview-card-chosen-tag');
    expect(chosenTag).not.toBeNull();
    expect(chosenTag?.textContent).toContain('escolhido');

    modal.close();
  });

  it('highlights active branch and strikes through inactive condition branch', async () => {
    const action1: IActionBlock = { format: 'plaintext', content: 'Conteúdo Ramo IF', tokens: [] };
    const action2: IActionBlock = { format: 'plaintext', content: 'Conteúdo Ramo ELSE', tokens: [] };

    const condBlock: IConditionBlock = {
      type: 'condition',
      rules: [
        {
          id: 'r1',
          type: 'domain',
          operator: 'equals',
          value: 'example.com',
          action: action1,
        },
      ],
      elseBranch: action2,
    };

    const flow: Flow = {
      id: 'f1',
      name: '/qq3',
      enabled: true,
      blocks: [
        { id: 'b_trig', type: 'trigger', data: baseTrigger },
        { id: 'b_cond', type: 'condition', data: condBlock },
      ],
      createdAt: 0,
      updatedAt: 0,
    };

    const modal = new PreviewModal({
      trigger: baseTrigger,
      settings: baseSettings,
      flow,
      branches: [
        { tag: 'SE', ruleDescription: 'Domínio é igual a example.com', action: action1, target: action1 },
        { tag: 'SENÃO', ruleDescription: '', action: action2, target: action2 },
      ],
      variables: [],
    });

    await modal.init();
    modal.open();

    const activeBranchEl = document.querySelector('.preview-branch-active');
    expect(activeBranchEl).not.toBeNull();

    const inactiveBranchEl = document.querySelector('.preview-branch-inactive');
    expect(inactiveBranchEl).not.toBeNull();
    expect(inactiveBranchEl?.textContent).toContain('[ramo SE');

    modal.close();
  });

  it('copy button copies strictly pure plain text without any pills or HTML', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const actionBlock: IActionBlock = {
      format: 'richtext',
      content:
        '<p>Olá {{NOME}}, seu número é <span class="token-pill token-counter" data-token-id="c_tok" data-token-config="{&quot;start&quot;:10,&quot;step&quot;:5}">Contador</span>.</p>',
      tokens: [{ id: 'c_tok', type: 'counter', config: { start: 10, step: 5 } }],
    };

    const variables: Variable[] = [
      { id: 'v1', key: 'NOME', value: 'Lucas', createdAt: 0, updatedAt: 0 },
    ];

    const modal = new PreviewModal({
      trigger: baseTrigger,
      settings: baseSettings,
      branches: [
        {
          action: actionBlock,
          target: actionBlock,
        },
      ],
      variables,
    });

    await modal.init();
    modal.open();

    const copyBtn = document.querySelector<HTMLButtonElement>('.preview-copy-all-btn');
    expect(copyBtn).not.toBeNull();

    copyBtn!.click();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    const copiedText = writeTextMock.mock.calls[0][0];

    // Must be clean plain text
    expect(copiedText).toBe('Olá Lucas, seu número é 10.');
    expect(copiedText).not.toContain('<p>');
    expect(copiedText).not.toContain('<span');
    expect(copiedText).not.toContain('preview-pill');

    modal.close();
  });

  it('resets counter state between modal sessions to ensure deterministic preview', async () => {
    const actionBlock: IActionBlock = {
      format: 'plaintext',
      content: '<span class="token-pill token-counter" data-token-id="c1" data-token-config="{&quot;start&quot;:5,&quot;step&quot;:2}">Contador</span>',
      tokens: [
        {
          id: 'c1',
          type: 'counter',
          config: { start: 5, step: 2 },
        },
      ],
    };

    const repeatBlock: IRepeatBlock = {
      type: 'repeat',
      count: 2,
      separator: ' -> ',
      target: actionBlock,
    };

    // First simulation
    const firstRun = await simulateBranchContent(repeatBlock);
    expect(firstRun).toBe('5 -&gt; 7');

    // Second simulation without external reset — simulateBranchContent internally resets counterState
    const secondRun = await simulateBranchContent(repeatBlock);
    expect(secondRun).toBe('5 -&gt; 7');
  });

  it('renders layout structure correctly and maintains 2-column elements with single simple RepeatBlock (/qq3 scenario)', async () => {
    const actionBlock: IActionBlock = {
      format: 'plaintext',
      content: 'bloco',
      tokens: [],
    };

    const repeatBlock: IRepeatBlock = {
      type: 'repeat',
      count: 2,
      separator: '\n',
      target: actionBlock,
    };

    const modal = new PreviewModal({
      trigger: { shortcut: 'qq3' },
      settings: baseSettings,
      branches: [
        {
          tag: 'REPETIÇÃO',
          action: actionBlock,
          repeatBlock,
          target: repeatBlock,
        },
      ],
      variables: [],
    });

    await modal.init();
    modal.open();

    const backdrop = document.querySelector('.modal-backdrop');
    expect(backdrop).not.toBeNull();

    const container = backdrop!.querySelector('.modal-container.modal-container--preview');
    expect(container).not.toBeNull();

    const columnsContainer = backdrop!.querySelector('.preview-body-columns');
    expect(columnsContainer).not.toBeNull();

    const treeCol = backdrop!.querySelector('.preview-tree-col');
    expect(treeCol).not.toBeNull();
    const repeatCard = treeCol!.querySelector('.preview-card--repeat');
    expect(repeatCard).not.toBeNull();
    expect(repeatCard?.textContent).toContain('Repetir 2×');

    const renderCol = backdrop!.querySelector('.preview-render-col');
    expect(renderCol).not.toBeNull();
    const renderBody = renderCol!.querySelector('.preview-render-body');
    expect(renderBody).not.toBeNull();
    const renderOutput = renderCol!.querySelector('.preview-render-output');
    expect(renderOutput).not.toBeNull();
    expect(renderOutput?.textContent).toContain('bloco');

    modal.close();
  });

  it('openFlowPreviewModal removes any existing modal backdrops to prevent backdrop accumulation', async () => {
    const flow: Flow = {
      id: 'f1',
      name: '/test',
      enabled: true,
      tags: [],
      createdAt: 0,
      updatedAt: 0,
      blocks: [
        {
          id: 'b1',
          type: 'action',
          data: {
            format: 'plaintext',
            content: 'Hello world',
            tokens: [],
          },
        },
      ],
    };

    // Open first time
    const modal1 = await openFlowPreviewModal(flow, baseSettings);
    expect(document.querySelectorAll('.modal-backdrop').length).toBe(1);

    // Open second time (e.g. user clicked multiple times on flows table)
    const modal2 = await openFlowPreviewModal(flow, baseSettings);
    expect(document.querySelectorAll('.modal-backdrop').length).toBe(1);

    modal2.close();
    expect(document.querySelectorAll('.modal-backdrop').length).toBe(0);
  });
});
