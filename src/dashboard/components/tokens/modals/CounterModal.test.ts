/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CounterModal } from './CounterModal.js';
import { storage } from '../../../../shared/storage/StorageService.js';
import { setLanguage } from '../../../../shared/i18n/index.js';
import type { Counter } from '../../../../shared/types/index.js';

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
      },
    },
    tabs: { query: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock('../../../../shared/components/Toast.js', () => ({
  showToast: vi.fn(),
}));

describe('CounterModal (src/dashboard/components/tokens/modals/CounterModal.ts)', () => {
  let mockCounters: Counter[];

  beforeEach(() => {
    document.body.innerHTML = '';
    setLanguage('pt-BR');

    mockCounters = [
      {
        id: 'cnt_1',
        name: 'Protocolo Diário',
        format: 'PROT-{contador}',
        startValue: 1,
        currentValue: 10,
        step: 1,
        resetRule: 'day',
        scope: 'global',
      },
    ];

    vi.spyOn(storage, 'getCounters').mockImplementation(async () => [...mockCounters]);
    vi.spyOn(storage, 'saveCounter').mockImplementation(async (c) => {
      mockCounters.push(c);
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('Aba 2 (Novo): permite escolher regra de reinício (Diário) e persiste no storage', async () => {
    const onSave = vi.fn();
    const token: Token = {
      type: 'counter',
      config: {
        format: '{contador}',
      },
    };
    const modal = new CounterModal(token, onSave);
    modal.open();

    const nameInput = document.querySelector('#counter-name-new') as HTMLInputElement;
    const startInput = document.querySelector('#counter-start') as HTMLInputElement;
    const resetSelect = document.querySelector('#counter-reset-new') as HTMLSelectElement;

    expect(nameInput).not.toBeNull();
    expect(resetSelect).not.toBeNull();

    // Seleciona explicitamente a regra de reinício 'day' (Diário)
    nameInput.value = 'Contador Diário Teste';
    startInput.value = '5';
    resetSelect.value = 'day';
    resetSelect.dispatchEvent(new Event('change'));

    // Clica no botão de Salvar do modal
    const saveBtn = document.querySelector('#btn-modal-save') as HTMLButtonElement;
    expect(saveBtn).not.toBeNull();
    await (modal as any).onSave();

    // Confirma que saveCounter foi chamado com a regra 'day' persistida
    expect(storage.saveCounter).toHaveBeenCalled();
    const saved = mockCounters.find((c) => c.name === 'Contador Diário Teste');
    expect(saved).toBeDefined();
    expect(saved?.resetRule).toBe('day');
    expect(saved?.startValue).toBe(5);

    // Confirma que o callback repassou o novo ID criado
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        counterId: saved?.id,
        counterName: 'Contador Diário Teste',
      })
    );
  });

  it('Aba 1 (Existente): exibe claramente a regra de reinício do contador selecionado', async () => {
    const onSave = vi.fn();
    const token: Token = {
      type: 'counter',
      config: {
        counterId: 'cnt_1',
      },
    };
    const modal = new CounterModal(token, onSave);
    modal.open();

    // Aguarda o init() assíncrono que carrega storage.getCounters()
    await new Promise((resolve) => setTimeout(resolve, 10));

    const preview = document.querySelector('#preview-existing-val') as HTMLElement;
    expect(preview).not.toBeNull();
    // mockCounters[0] possui resetRule: 'day' -> texto deve exibir 'Diariamente'
    expect(preview.textContent).toContain('Diariamente');
  });
});
