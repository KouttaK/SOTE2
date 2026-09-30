/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UndoManager } from './UndoManager.js';
import { sessionStore } from './SessionStore.js';
import { CounterService } from '../../background/CounterService.js';
import { browser } from 'wxt/browser';
import type { Settings, Counter } from '../../shared/types/index.js';

// Top-level mock for wxt/browser
vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      sendMessage: vi.fn(),
    },
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
      },
    },
  },
}));

vi.mock('../../shared/messaging/client.js', () => ({
  sendMessage: vi.fn().mockResolvedValue({ success: true }),
  onMessage: vi.fn(),
}));

describe('UndoManager (Desfazer Expansão - Etapa 2.4)', () => {
  let undoManager: UndoManager;
  let settings: Settings;
  let inputEl: HTMLInputElement;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    settings = {
      triggerMode: 'trigger',
      triggerKeys: ['Space'],
      exactMatchChar: '/',
      undoEnabled: true,
      undoWindowSeconds: 5,
      undoTrigger: 'both',
      globalEnabled: true,
      searchTrigger: { enabled: false, includeFlows: false, domainPrefix: '', globalPrefix: '' },
    };

    undoManager = new UndoManager(() => settings);
    sessionStore.reset();

    inputEl = document.createElement('input');
    inputEl.type = 'text';
    document.body.appendChild(inputEl);
  });

  afterEach(() => {
    vi.useRealTimers();
    if (inputEl.parentNode) {
      inputEl.parentNode.removeChild(inputEl);
    }
  });

  it('1. Desfazer simples sem contador: restaura o atalho digitado dentro da janela e previne ação nativa', () => {
    inputEl.value = 'Olá mundo, esta é a expansão final.';
    const shortcut = '/exp';
    const expanded = 'esta é a expansão final.';

    undoManager.recordExpansion({
      element: inputEl,
      shortcutTyped: shortcut,
      expandedContent: expanded,
      isRichText: false,
      cursorOffset: null,
      shortcutStartPos: 11,
      stats: { flowId: 'f1', keysSaved: 20, usedVarKeys: [] },
    });

    expect(undoManager.hasPending()).toBe(true);

    // Press Backspace within window (at 2s)
    vi.advanceTimersByTime(2000);
    const backspaceEvent = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
    const prevented = undoManager.handleKeyDown(backspaceEvent);

    expect(prevented).toBe(true);
    expect(backspaceEvent.defaultPrevented).toBe(true);
    // Element value was restored with shortcut!
    expect(inputEl.value).toBe('Olá mundo, /exp');
    expect(undoManager.hasPending()).toBe(false);
  });

  it('2. Desfazer com contador envolvido: devolve a reserva via RELEASE_COUNTERS', async () => {
    inputEl.value = 'Ordem 101';
    undoManager.recordExpansion({
      element: inputEl,
      shortcutTyped: '/ord',
      expandedContent: 'Ordem 101',
      isRichText: false,
      cursorOffset: null,
      shortcutStartPos: 0,
      counterReservations: [{ counterId: 'c_ord', reservedValue: 101 }],
      stats: { flowId: 'f_counter', keysSaved: 5, usedVarKeys: [] },
    });

    vi.advanceTimersByTime(1500);
    const ctrlZEvent = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true });
    const handled = undoManager.handleKeyDown(ctrlZEvent);

    expect(handled).toBe(true);
    expect(inputEl.value).toBe('/ord');

    // Confirm that RELEASE_COUNTERS was dispatched
    const { sendMessage } = await import('../../shared/messaging/client.js');
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'RELEASE_COUNTERS',
      payload: {
        reservations: [{ counterId: 'c_ord', reservedValue: 101 }],
      },
    });
  });

  it('3. CounterService: ao desfazer, devolve se for o último, mas preserva lacuna se outro avançou no meio tempo', async () => {
    const counter: Counter = {
      id: 'c_num',
      name: 'Protocolo',
      format: '{contador}',
      resetRule: 'never',
      startValue: 1,
      currentValue: 10,
      scope: 'global',
      step: 1,
      padLength: 0,
    };

    let storageState: { counters: Counter[] } = { counters: [{ ...counter }] };
    vi.mocked(browser.storage.local.get).mockImplementation(async () => storageState);
    vi.mocked(browser.storage.local.set).mockImplementation(async (data: any) => {
      storageState = { ...storageState, ...data };
    });

    const counterService = CounterService.getInstance();

    // Tab A reserves number 11
    const resA = await counterService.reserveCounter('c_num', 'always', 'visible');
    expect(resA.reservedValue).toBe(11);
    expect(storageState.counters[0].currentValue).toBe(11);

    // Scenario 3a: Tab A undoes before anyone else uses it -> reverts back to 10
    await counterService.releaseCounters([{ counterId: 'c_num', reservedValue: 11 }]);
    expect(storageState.counters[0].currentValue).toBe(10);

    // Scenario 3b: Tab A reserves 11 again
    const resA2 = await counterService.reserveCounter('c_num', 'always', 'visible');
    expect(resA2.reservedValue).toBe(11);

    // In the meantime, Tab B reserves 12
    const resB = await counterService.reserveCounter('c_num', 'always', 'visible');
    expect(resB.reservedValue).toBe(12);
    expect(storageState.counters[0].currentValue).toBe(12);

    // Tab A now undoes 11: since currentValue is 12 (not 11), it MUST NOT revert!
    await counterService.releaseCounters([{ counterId: 'c_num', reservedValue: 11 }]);
    expect(storageState.counters[0].currentValue).toBe(12); // Permanent gap preserved!
  });

  it('4. Desfazer com estatísticas pendentes: cancela o envio diferido de FLOW_USED e VARIABLES_USED', async () => {
    inputEl.value = 'Texto expandido longo';
    undoManager.recordExpansion({
      element: inputEl,
      shortcutTyped: '/txt',
      expandedContent: 'Texto expandido longo',
      isRichText: false,
      cursorOffset: null,
      shortcutStartPos: 0,
      stats: { flowId: 'flow-stats', keysSaved: 18, usedVarKeys: ['NOME_VAR'] },
    });

    const { sendMessage } = await import('../../shared/messaging/client.js');

    // While in the window, stats are NOT sent
    expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'FLOW_USED' }));
    expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'VARIABLES_USED' }));

    // User undoes
    undoManager.undo();

    // Advance time past the original window
    vi.advanceTimersByTime(10000);

    // Confirm that stats were discarded and never dispatched
    expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'FLOW_USED' }));
    expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'VARIABLES_USED' }));
  });

  it('5. Expiração da janela sem desfazer: confirma contadores e faz flush de estatísticas normalmente', async () => {
    inputEl.value = 'Relatório 505';
    undoManager.recordExpansion({
      element: inputEl,
      shortcutTyped: '/rel',
      expandedContent: 'Relatório 505',
      isRichText: false,
      cursorOffset: null,
      shortcutStartPos: 0,
      counterReservations: [{ counterId: 'c_rel', reservedValue: 505 }],
      stats: { flowId: 'f_rel', keysSaved: 9, usedVarKeys: ['DEPT'] },
    });

    const { sendMessage } = await import('../../shared/messaging/client.js');

    // Stats not sent immediately
    expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'FLOW_USED' }));

    // Window expires (5 seconds)
    vi.advanceTimersByTime(5001);

    // Now stats and confirmations were flushed
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'CONFIRM_COUNTERS',
      payload: { reservations: [{ counterId: 'c_rel', reservedValue: 505 }] },
    });
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'FLOW_USED',
      payload: { flowId: 'f_rel', keysSaved: 9 },
    });
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'VARIABLES_USED',
      payload: { keys: ['DEPT'] },
    });

    // Trying to undo after expiry does nothing and does not intercept keydown
    const backspaceEvent = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
    const handled = undoManager.handleKeyDown(backspaceEvent);
    expect(handled).toBe(false);
    expect(backspaceEvent.defaultPrevented).toBe(false);
  });

  it('6. Fluxo pausado por input/choice restaura atalho sem reabrir popup', () => {
    // Simulated choice/input popup: user completed the modal and the text was injected
    const popupMock = { showForToken: vi.fn() };

    inputEl.value = 'Prezado Dr. Silva';
    undoManager.recordExpansion({
      element: inputEl,
      shortcutTyped: '/dr',
      expandedContent: 'Prezado Dr. Silva',
      isRichText: false,
      cursorOffset: null,
      shortcutStartPos: 0,
    });

    // Undo is triggered
    const undone = undoManager.undo();
    expect(undone).toBe(true);
    expect(inputEl.value).toBe('/dr');

    // Popup was NOT re-opened
    expect(popupMock.showForToken).not.toHaveBeenCalled();
  });

  it('7. Preserva pilha nativa do navegador fora da janela configurada ou quando desativado', () => {
    // 7a: Settings with undo disabled
    settings.undoEnabled = false;
    inputEl.value = 'Texto sem undo';
    undoManager.recordExpansion({
      element: inputEl,
      shortcutTyped: '/no',
      expandedContent: 'Texto sem undo',
      isRichText: false,
      cursorOffset: null,
      shortcutStartPos: 0,
    });

    const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
    const handled = undoManager.handleKeyDown(event);
    expect(handled).toBe(false);
    expect(event.defaultPrevented).toBe(false);

    // 7b: Native Ctrl+Z passes through when no expansion is pending
    const ctrlZEvent = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true });
    const handledCtrlZ = undoManager.handleKeyDown(ctrlZEvent);
    expect(handledCtrlZ).toBe(false);
    expect(ctrlZEvent.defaultPrevented).toBe(false);
  });

  it('8. SessionStore permanece independente: desfazer expansão de texto NÃO apaga dados de sessão', () => {
    sessionStore.set('clienteAtivo', 'Hospital Central');
    expect(sessionStore.get('clienteAtivo')).toBe('Hospital Central');

    inputEl.value = 'Atendimento para Hospital Central';
    undoManager.recordExpansion({
      element: inputEl,
      shortcutTyped: '/atend',
      expandedContent: 'Atendimento para Hospital Central',
      isRichText: false,
      cursorOffset: null,
      shortcutStartPos: 0,
    });

    undoManager.undo();
    expect(inputEl.value).toBe('/atend');

    // SessionStore retains the active customer context
    expect(sessionStore.get('clienteAtivo')).toBe('Hospital Central');
  });
});
