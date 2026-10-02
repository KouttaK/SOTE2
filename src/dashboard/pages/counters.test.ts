/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CountersPage from './counters.js';
import { storage } from '../../shared/storage/StorageService.js';
import { setLanguage } from '../../shared/i18n/index.js';
import type { Counter, Flow } from '../../shared/types/index.js';

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
    },
    tabs: { query: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock('../../shared/components/Toast.js', () => ({
  showToast: vi.fn(),
}));

describe('CountersPage (src/dashboard/pages/counters.ts)', () => {
  let page: CountersPage;
  let container: HTMLDivElement;
  let mockCounters: Counter[];
  let mockFlows: Flow[];

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    container = document.querySelector('#app') as HTMLDivElement;
    setLanguage('pt-BR');

    mockCounters = [
      {
        id: 'c1',
        name: 'Contador 1',
        format: '{contador}',
        startValue: 1,
        currentValue: 5,
        step: 1,
        resetRule: 'day',
        scope: 'global',
      },
      {
        id: 'c2',
        name: 'Nota Fiscal',
        format: 'NF-{contador}',
        startValue: 100,
        currentValue: 150,
        step: 2,
        padLength: 4,
        resetRule: 'never',
        scope: 'site',
      },
    ];

    mockFlows = [
      {
        id: 'flow-1',
        title: 'Fluxo com Contador',
        trigger: { type: 'shortcut', shortcut: '/c1', enabled: true },
        blocks: [
          {
            id: 'b1',
            type: 'action',
            data: {
              format: 'plaintext',
              content: '<span class="token-pill token-counter" data-token-id="t1" data-token-config=\'{"counterId":"c1"}\'></span>',
              tokens: [
                { id: 't1', type: 'counter', config: { counterId: 'c1' } },
              ],
            },
          },
        ],
        createdAt: 1000,
        updatedAt: 1000,
      },
    ];

    vi.spyOn(storage, 'getCounters').mockImplementation(async () => [...mockCounters]);
    vi.spyOn(storage, 'getFlows').mockImplementation(async () => [...mockFlows]);
    vi.spyOn(storage, 'saveCounter').mockImplementation(async (c) => {
      const idx = mockCounters.findIndex((item) => item.id === c.id);
      if (idx >= 0) mockCounters[idx] = c;
      else mockCounters.push(c);
    });
    vi.spyOn(storage, 'deleteCounter').mockImplementation(async (id) => {
      mockCounters = mockCounters.filter((item) => item.id !== id);
    });

    page = new CountersPage();
    container.appendChild(page.render());
  });

  afterEach(() => {
    page.unmount();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('renderiza tabela de contadores com dados e estatísticas', async () => {
    await page.mount();

    expect(container.querySelector('#page-counters')).not.toBeNull();
    const totalCountEl = container.querySelector('#counters-total-count');
    expect(totalCountEl?.textContent).toBe('2');

    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);

    expect(rows[0].querySelector('.counter-name-title')?.textContent).toBe('Contador 1');
    expect(rows[0].querySelector('.counter-val-badge')?.textContent).toBe('5');
    expect(rows[0].textContent).toContain('Diariamente');

    expect(rows[1].querySelector('.counter-name-title')?.textContent).toBe('Nota Fiscal');
    expect(rows[1].querySelector('.counter-val-badge')?.textContent).toBe('150');
    expect(rows[1].textContent).toContain('Nunca');
  });

  it('filtra contadores pelo campo de busca', async () => {
    await page.mount();

    const searchInput = container.querySelector('#counters-search-input') as HTMLInputElement;
    expect(searchInput).not.toBeNull();

    searchInput.value = 'Fiscal';
    searchInput.dispatchEvent(new Event('input'));

    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(1);
    expect(rows[0].querySelector('.counter-name-title')?.textContent).toBe('Nota Fiscal');
  });

  it('abre modal de criação ao clicar em Novo Contador e salva novo contador', async () => {
    await page.mount();

    const btnNew = container.querySelector('#btn-create-counter') as HTMLButtonElement;
    expect(btnNew).not.toBeNull();
    btnNew.click();

    const overlay = document.querySelector('.modal-overlay') as HTMLElement;
    expect(overlay).not.toBeNull();

    const nameInput = overlay.querySelector('#cnt-name') as HTMLInputElement;
    const startInput = overlay.querySelector('#cnt-start') as HTMLInputElement;
    const formatInput = overlay.querySelector('#cnt-format') as HTMLInputElement;
    const resetSelect = overlay.querySelector('#cnt-reset') as HTMLSelectElement;

    nameInput.value = 'Novo Pedido';
    startInput.value = '10';
    formatInput.value = 'PED-{contador}';
    resetSelect.value = 'month';

    const saveBtn = overlay.querySelector('#modal-save-btn') as HTMLButtonElement;
    await saveBtn.click();

    expect(storage.saveCounter).toHaveBeenCalled();
    expect(mockCounters.some((c) => c.name === 'Novo Pedido' && c.resetRule === 'month')).toBe(true);

    // Modal fechado
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  it('onCreateClick abre o modal de criação (chamado pelo Shell)', async () => {
    await page.mount();
    page.onCreateClick();

    const overlay = document.querySelector('.modal-overlay');
    expect(overlay).not.toBeNull();
    overlay?.remove();
  });

  it('abre modal de edição ao clicar em Editar e atualiza contador existente', async () => {
    await page.mount();

    const editBtn = container.querySelector('tr[data-counter-id="c1"] [data-action="edit"]') as HTMLButtonElement;
    expect(editBtn).not.toBeNull();
    editBtn.click();

    const overlay = document.querySelector('.modal-overlay') as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay.querySelectorAll('.counter-modal-section').length).toBe(3);

    const nameInput = overlay.querySelector('#cnt-name') as HTMLInputElement;
    const resetSelect = overlay.querySelector('.counter-modal-section:first-child #cnt-reset') as HTMLSelectElement;
    expect(nameInput.value).toBe('Contador 1');
    expect(resetSelect).not.toBeNull();
    expect(resetSelect.value).toBe('day'); // c1 tinha resetRule: 'day'

    nameInput.value = 'Contador Editado';
    resetSelect.value = 'year'; // Altera a regra de reinício de diário para anual
    const saveBtn = overlay.querySelector('#modal-save-btn') as HTMLButtonElement;
    await saveBtn.click();

    expect(storage.saveCounter).toHaveBeenCalled();
    const updatedCounter = mockCounters.find((c) => c.id === 'c1');
    expect(updatedCounter?.name).toBe('Contador Editado');
    expect(updatedCounter?.resetRule).toBe('year'); // Persistido com sucesso no storage
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  it('zera contador ao valor inicial ao confirmar no modal de confirmação', async () => {
    await page.mount();

    const resetBtn = container.querySelector('tr[data-counter-id="c1"] [data-action="reset"]') as HTMLButtonElement;
    expect(resetBtn).not.toBeNull();
    resetBtn.click();

    // ConfirmModal aberto
    const confirmOverlay = document.querySelector('.confirm-modal-overlay') as HTMLElement;
    expect(confirmOverlay).not.toBeNull();

    const confirmBtn = confirmOverlay.querySelector('#confirm-modal-confirm') as HTMLButtonElement;
    confirmBtn.click();
    await new Promise((r) => setTimeout(r, 10));

    expect(storage.saveCounter).toHaveBeenCalled();
    expect(mockCounters.find((c) => c.id === 'c1')?.currentValue).toBe(1); // startValue era 1
    expect(document.querySelector('.confirm-modal-overlay')).toBeNull();
  });

  it('bloqueia exclusão de contador quando este está em uso por fluxos', async () => {
    await page.mount();

    const deleteBtn = container.querySelector('tr[data-counter-id="c1"] [data-action="delete"]') as HTMLButtonElement;
    expect(deleteBtn).not.toBeNull();
    deleteBtn.click();

    // Como c1 está no flow-1, deve exibir o modal de bloqueio (e NÃO o de confirmação de exclusão)
    const overlay = document.querySelector('.confirm-modal-overlay') as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay.textContent).toContain('Fluxo com Contador');
    expect(storage.deleteCounter).not.toHaveBeenCalled();

    const closeBtn = overlay.querySelector('#confirm-modal-cancel, #confirm-modal-confirm') as HTMLButtonElement;
    closeBtn.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(document.querySelector('.confirm-modal-overlay')).toBeNull();
  });

  it('permite exclusão de contador quando não está em uso por nenhum fluxo', async () => {
    await page.mount();

    const deleteBtn = container.querySelector('tr[data-counter-id="c2"] [data-action="delete"]') as HTMLButtonElement;
    expect(deleteBtn).not.toBeNull();
    deleteBtn.click();

    // c2 não está em nenhum fluxo, deve abrir modal de confirmação
    const overlay = document.querySelector('.confirm-modal-overlay') as HTMLElement;
    expect(overlay).not.toBeNull();

    const confirmBtn = overlay.querySelector('#confirm-modal-confirm') as HTMLButtonElement;
    confirmBtn.click();
    await new Promise((r) => setTimeout(r, 10));

    expect(storage.deleteCounter).toHaveBeenCalledWith('c2');
    expect(mockCounters.some((c) => c.id === 'c2')).toBe(false);
    expect(document.querySelector('.confirm-modal-overlay')).toBeNull();
  });
});
