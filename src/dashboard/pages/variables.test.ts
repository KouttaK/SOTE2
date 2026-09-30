/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import VariablesPage from './variables.js';
import { storage } from '../../shared/storage/StorageService.js';
import { setLanguage } from '../../shared/i18n/index.js';

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

vi.mock('../../shared/storage/StorageService.js', () => ({
  storage: {
    getVariables: vi.fn().mockResolvedValue([
      { key: 'TESTE_VAR', value: 'Valor de teste', description: 'Desc', createdAt: 1000, updatedAt: 2000 },
    ]),
    getFlows: vi.fn().mockResolvedValue([]),
    saveVariables: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('VariablesPage Container Stability', () => {
  let page: VariablesPage;
  let container: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id=app></div>';
    container = document.querySelector('#app') as HTMLDivElement;
    setLanguage('pt-BR');
    page = new VariablesPage();
    container.appendChild(page.render());
  });

  afterEach(() => {
    page.unmount();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('maintains fixed container structure and width classes when banner is dismissed', async () => {
    await page.mount();

    const rootEl = container.querySelector('#page-variables') as HTMLElement;
    expect(rootEl).not.toBeNull();

    const pageInner = container.querySelector('.dash-page-inner') as HTMLElement;
    expect(pageInner).not.toBeNull();

    // 1. Initial state: Banner is present inside dash-page-inner
    const banner = container.querySelector('#vars-banner') as HTMLElement;
    expect(banner).not.toBeNull();
    expect(pageInner.contains(banner)).toBe(true);

    const tableWrap = container.querySelector('.vars-table-wrap') as HTMLElement;
    expect(tableWrap).not.toBeNull();
    expect(pageInner.contains(tableWrap)).toBe(true);

    // Record container classes and children before dismiss
    const classNameBefore = pageInner.className;
    const parentBefore = pageInner.parentElement;

    // 2. Dismiss banner
    const btnClose = container.querySelector('#btn-close-banner') as HTMLButtonElement;
    expect(btnClose).not.toBeNull();
    btnClose.click();

    // Banner is removed
    expect(container.querySelector('#vars-banner')).toBeNull();

    // 3. Verify container structure after dismiss:
    // Container element, classes and parent remain completely unchanged
    expect(pageInner.className).toBe(classNameBefore);
    expect(pageInner.parentElement).toBe(parentBefore);
    expect(pageInner.contains(tableWrap)).toBe(true);

    // Title row and table continue to occupy the unified dash-page-inner
    const titleRow = container.querySelector('.vars-title-row') as HTMLElement;
    expect(titleRow).not.toBeNull();
    expect(pageInner.contains(titleRow)).toBe(true);
  });

  it('renders stable container even in empty state (0 variables)', async () => {
    (storage.getVariables as any).mockResolvedValueOnce([]);

    const emptyPage = new VariablesPage();
    const emptyContainer = document.createElement('div');
    emptyContainer.appendChild(emptyPage.render());
    await emptyPage.mount();

    const pageInner = emptyContainer.querySelector('.dash-page-inner') as HTMLElement;
    expect(pageInner).not.toBeNull();

    const emptyMsg = emptyContainer.querySelector('.vars-empty') as HTMLElement;
    expect(emptyMsg).not.toBeNull();
    expect(pageInner.contains(emptyMsg)).toBe(true);

    emptyPage.unmount();
  });
});
