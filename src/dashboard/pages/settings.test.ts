/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SettingsPage from './settings.js';
import { storage } from '../../shared/storage/StorageService.js';
import { browser } from 'wxt/browser';
import { t, setLanguage } from '../../shared/i18n/index.js';

let storageChangedCallback: ((changes: any, areaName: string) => void) | null = null;

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
      onChanged: {
        addListener: vi.fn((cb) => {
          storageChangedCallback = cb;
        }),
        removeListener: vi.fn((cb) => {
          if (storageChangedCallback === cb) {
            storageChangedCallback = null;
          }
        }),
      },
    },
    tabs: { query: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock('../../shared/storage/StorageService.js', () => ({
  storage: {
    getSettings: vi.fn().mockResolvedValue({
      blocklist: ['*.example.com', 'exactdomain.com'],
      clipboardHistoryMax: 10,
      language: 'pt-BR',
      commandPaletteShortcut: 'Ctrl+Shift+Space',
      triggerMode: 'auto',
      triggerKeys: [' '],
      contextMenuEnabled: true,
    }),
    saveSettings: vi.fn().mockResolvedValue(undefined),
    getClipboardHistory: vi.fn().mockResolvedValue([
      { text: 'Texto Copiado 1', timestamp: Date.now() },
    ]),
    clearClipboardHistory: vi.fn().mockResolvedValue(undefined),
    trimClipboardHistory: vi.fn().mockResolvedValue(undefined),
    getFolders: vi.fn().mockResolvedValue([]),
    getFlows: vi.fn().mockResolvedValue([]),
    getForms: vi.fn().mockResolvedValue([]),
    getVariables: vi.fn().mockResolvedValue([]),
    enableSync: vi.fn().mockResolvedValue(undefined),
    disableSync: vi.fn().mockResolvedValue(undefined),
    importData: vi.fn().mockResolvedValue({ flowsCount: 0, varsCount: 0 }),
  },
}));

describe('SettingsPage', () => {
  let page: SettingsPage;
  let container: HTMLDivElement;

  beforeEach(async () => {
    document.body.innerHTML = '<div id="app"></div>';
    container = document.querySelector('#app') as HTMLDivElement;
    setLanguage('pt-BR');
    page = new SettingsPage();
    container.appendChild(page.render());
  });

  afterEach(() => {
    page.unmount();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('Blocklist i18n & Type Badges', () => {
    it('translates wildcard and exact badges correctly in pt-BR', async () => {
      setLanguage('pt-BR');
      await page.mount();

      const blocklistTypes = container.querySelectorAll('.blocklist-item-type');
      expect(blocklistTypes.length).toBe(2);
      expect(blocklistTypes[0].textContent).toBe('curinga');
      expect(blocklistTypes[1].textContent).toBe('exato');
    });

    it('translates wildcard and exact badges correctly in en', async () => {
      (storage.getSettings as any).mockResolvedValueOnce({
        blocklist: ['*.example.com', 'exactdomain.com'],
        clipboardHistoryMax: 10,
        language: 'en',
        commandPaletteShortcut: 'Ctrl+Shift+Space',
        triggerMode: 'auto',
        triggerKeys: [' '],
        contextMenuEnabled: true,
      });
      setLanguage('en');
      await page.mount();

      const blocklistTypes = container.querySelectorAll('.blocklist-item-type');
      expect(blocklistTypes.length).toBe(2);
      expect(blocklistTypes[0].textContent).toBe('wildcard');
      expect(blocklistTypes[1].textContent).toBe('exact');
    });
  });

  describe('Clipboard History Real-time Synchronization', () => {
    it('updates clipboard list in real time when storage.onChanged fires', async () => {
      await page.mount();

      // Click "Ver Histórico" to open the list
      const btnView = container.querySelector('#btn-view-clipboard') as HTMLButtonElement;
      const historyList = container.querySelector('#clipboard-history-list') as HTMLDivElement;
      expect(btnView).not.toBeNull();
      expect(historyList).not.toBeNull();

      btnView.click();
      await vi.waitFor(() => {
        expect(historyList.style.display).toBe('block');
        expect(historyList.textContent).toContain('Texto Copiado 1');
      });

      // Simulate a copy event happening in another tab (storage.local updated with new entry)
      (storage.getClipboardHistory as any).mockResolvedValueOnce([
        { text: 'Novo Texto Copiado em Tempo Real', timestamp: Date.now() },
        { text: 'Texto Copiado 1', timestamp: Date.now() - 1000 },
      ]);

      expect(storageChangedCallback).not.toBeNull();
      storageChangedCallback!(
        {
          clipboardHistory: {
            newValue: [
              { text: 'Novo Texto Copiado em Tempo Real' },
              { text: 'Texto Copiado 1' },
            ],
            oldValue: [{ text: 'Texto Copiado 1' }],
          },
        },
        'local'
      );

      await vi.waitFor(() => {
        expect(historyList.textContent).toContain('Novo Texto Copiado em Tempo Real');
        expect(historyList.textContent).toContain('Texto Copiado 1');
      });
    });

    it('cleans up storage.onChanged listener on unmount', async () => {
      await page.mount();
      expect(browser.storage.onChanged.addListener).toHaveBeenCalled();

      page.unmount();
      expect(browser.storage.onChanged.removeListener).toHaveBeenCalled();
    });

    it('reflects text copied from a dashboard field in the Settings clipboard history', async () => {
      await page.mount();

      const btnView = container.querySelector('#btn-view-clipboard') as HTMLButtonElement;
      const historyList = container.querySelector('#clipboard-history-list') as HTMLDivElement;
      btnView.click();

      await vi.waitFor(() => {
        expect(historyList.style.display).toBe('block');
        expect(historyList.textContent).toContain('Texto Copiado 1');
      });

      // Simulate text copied from an input field in the dashboard (e.g. Variables)
      const copiedTextFromVariables = '{{minha_variavel_chave}}';
      (storage.getClipboardHistory as any).mockResolvedValueOnce([
        { text: copiedTextFromVariables, timestamp: Date.now() },
        { text: 'Texto Copiado 1', timestamp: Date.now() - 5000 },
      ]);

      // Storage fires onChanged when addClipboardEntry completes
      storageChangedCallback!(
        {
          clipboardHistory: {
            newValue: [{ text: copiedTextFromVariables }, { text: 'Texto Copiado 1' }],
          },
        },
        'local'
      );

      await vi.waitFor(() => {
        expect(historyList.textContent).toContain('{{minha_variavel_chave}}');
      });
    });
  });

  describe('Exact Match Trigger & Layout Configuration', () => {
    it('persists empty string when exact-char-input is cleared and does not revert to slash', async () => {
      (storage.getSettings as any).mockResolvedValueOnce({
        blocklist: [],
        clipboardHistoryMax: 10,
        language: 'pt-BR',
        commandPaletteShortcut: 'Ctrl+Shift+Space',
        triggerMode: 'exact_match',
        exactMatchChar: '/',
        contextMenuEnabled: true,
      });

      await page.mount();

      const exactCharInput = container.querySelector<HTMLInputElement>('#exact-char-input');
      expect(exactCharInput).not.toBeNull();
      expect(exactCharInput!.value).toBe('/');
      expect(exactCharInput!.getAttribute('placeholder')).toBe('/');

      // User erases the character
      exactCharInput!.value = '';
      exactCharInput!.dispatchEvent(new Event('input'));

      expect(storage.saveSettings).toHaveBeenCalledWith({ exactMatchChar: '' });

      // Simulate re-mounting or re-rendering with exactMatchChar set to empty string
      const newPage = new SettingsPage();
      (storage.getSettings as any).mockResolvedValueOnce({
        blocklist: [],
        clipboardHistoryMax: 10,
        language: 'pt-BR',
        commandPaletteShortcut: 'Ctrl+Shift+Space',
        triggerMode: 'exact_match',
        exactMatchChar: '',
        contextMenuEnabled: true,
      });

      const newContainer = document.createElement('div');
      newContainer.appendChild(newPage.render());
      await newPage.mount();

      const newExactInput = newContainer.querySelector<HTMLInputElement>('#exact-char-input');
      expect(newExactInput!.value).toBe('');
      expect(newExactInput!.getAttribute('placeholder')).toBe('/');
      newPage.unmount();
    });

    it('renders export and import buttons with sized SVG icons inside data-management-actions', async () => {
      await page.mount();

      const actions = container.querySelector('.data-management-actions');
      expect(actions).not.toBeNull();

      const btnExport = container.querySelector('#btn-export');
      const btnImport = container.querySelector('#btn-import');
      expect(btnExport).not.toBeNull();
      expect(btnImport).not.toBeNull();

      const exportSvg = btnExport!.querySelector('svg');
      const importSvg = btnImport!.querySelector('svg');
      expect(exportSvg).not.toBeNull();
      expect(importSvg).not.toBeNull();

      expect(exportSvg!.getAttribute('width')).toBe('14');
      expect(exportSvg!.getAttribute('height')).toBe('14');
      expect(importSvg!.getAttribute('width')).toBe('14');
      expect(importSvg!.getAttribute('height')).toBe('14');
    });

    it('wraps main settings within dash-page-inner matching other dashboard pages', () => {
      const pageInner = container.querySelector('.dash-page-inner');
      expect(pageInner).not.toBeNull();

      const settingsContainer = container.querySelector('.settings-container');
      expect(settingsContainer).not.toBeNull();
      expect(pageInner!.contains(settingsContainer)).toBe(true);
    });

    it('renders undo expansion controls and updates settings on change', async () => {
      vi.mocked(storage.getSettings).mockResolvedValueOnce({
        blocklist: [],
        undoEnabled: true,
        undoWindowSeconds: 5,
        undoTrigger: 'both',
      } as any);

      await page.mount();

      const toggleUndo = container.querySelector<HTMLElement>('#toggle-undo-enabled')!;
      const inputWindow = container.querySelector<HTMLInputElement>('#undo-window-input')!;
      const selectTrigger = container.querySelector<HTMLSelectElement>('#undo-trigger-select')!;

      expect(toggleUndo).not.toBeNull();
      expect(toggleUndo.classList.contains('active')).toBe(true);
      expect(inputWindow.value).toBe('5');
      expect(selectTrigger.value).toBe('both');

      // Toggle off
      toggleUndo.click();
      expect(toggleUndo.classList.contains('active')).toBe(false);
      expect(storage.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ undoEnabled: false }));

      // Change window duration
      inputWindow.value = '8';
      inputWindow.dispatchEvent(new Event('change'));
      expect(storage.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ undoWindowSeconds: 8 }));

      // Change trigger key
      selectTrigger.value = 'ctrl_z';
      selectTrigger.dispatchEvent(new Event('change'));
      expect(storage.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ undoTrigger: 'ctrl_z' }));
    });
  });
});

