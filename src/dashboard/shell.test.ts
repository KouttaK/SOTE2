/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Shell } from './shell.js';
import { router } from './router.js';
import { storage } from '../shared/storage/StorageService.js';
import { ConfirmModal } from './components/ConfirmModal.js';
import { PromptModal } from './components/PromptModal.js';
import { setLanguage, getLanguage, t } from '../shared/i18n/index.js';

vi.mock('../shared/storage/StorageService.js', () => ({
  storage: {
    getSettings: vi.fn().mockResolvedValue({ language: 'pt-BR' }),
    saveSettings: vi.fn().mockResolvedValue(undefined),
    getFlows: vi.fn().mockResolvedValue([]),
    getFolders: vi.fn().mockResolvedValue([]),
    getVariables: vi.fn().mockResolvedValue([]),
    getForms: vi.fn().mockResolvedValue([]),
    addClipboardEntry: vi.fn().mockResolvedValue([]),
  },
}));

describe('Dashboard Shell & Language Toggle Re-render', () => {
  let root: HTMLDivElement;
  let shell: Shell;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector('#app') as HTMLDivElement;
    setLanguage('pt-BR');
    shell = new Shell(root);
  });

  afterEach(() => {
    shell.destroy();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('re-renders Site Macros (/formularios) page instantly upon language toggle without page reload', async () => {
    setLanguage('pt-BR');
    router.navigate('/formularios');
    await shell.boot();

    // Verify initial render in pt-BR
    await vi.waitFor(() => {
      const title = root.querySelector('.frm-header-title');
      expect(title?.textContent).toBe('Macros de Sites');
      const sidebarLink = root.querySelector('a[data-pattern="/formularios"]');
      expect(sidebarLink?.textContent).toContain('Macros de Sites');
    });

    // Execute language toggle
    await shell.toggleLanguage();

    // Verify re-render in en
    expect(getLanguage()).toBe('en');
    await vi.waitFor(() => {
      const title = root.querySelector('.frm-header-title');
      expect(title?.textContent).toBe('Site Macros');
      const sidebarLink = root.querySelector('a[data-pattern="/formularios"]');
      expect(sidebarLink?.textContent).toContain('Site Macros');
    });
  });

  it('safely dismisses open modals when language toggle is triggered', async () => {
    setLanguage('pt-BR');
    router.navigate('/flows');
    await shell.boot();

    // Open a ConfirmModal without inputs
    ConfirmModal.show({
      title: 'Modal em Português',
      message: 'Texto a ser descartado',
      confirmLabel: 'Confirmar',
      onConfirm: () => {},
    });

    expect(document.querySelector('.confirm-modal-overlay')).not.toBeNull();

    // Toggle language
    await shell.toggleLanguage();

    // Modal must be cleanly dismissed, avoiding stale Portuguese modal remaining
    expect(document.querySelector('.confirm-modal-overlay')).toBeNull();
  });

  it('preserves PromptModal user input and updates its button labels when language toggle is triggered', async () => {
    setLanguage('pt-BR');
    router.navigate('/flows');
    await shell.boot();

    PromptModal.show({
      title: 'Nova Pasta',
      defaultValue: '',
      onConfirm: () => {},
    });

    const input = document.querySelector<HTMLInputElement>('#prompt-modal-input');
    expect(input).not.toBeNull();
    input!.value = 'Pasta Importante Nao Apagar';

    const cancelBtn = document.querySelector<HTMLButtonElement>('#prompt-modal-cancel');
    expect(cancelBtn?.textContent).toBe('Cancelar');

    // Toggle language to English
    await shell.toggleLanguage();

    // Verify modal is preserved and input value is intact
    expect(document.querySelector('.confirm-modal-overlay')).not.toBeNull();
    const preservedInput = document.querySelector<HTMLInputElement>('#prompt-modal-input');
    expect(preservedInput?.value).toBe('Pasta Importante Nao Apagar');

    // Verify buttons are translated to English
    const updatedCancelBtn = document.querySelector<HTMLButtonElement>('#prompt-modal-cancel');
    expect(updatedCancelBtn?.textContent).toBe('Cancel');
  });

  it('captures text copied inside the dashboard shell and adds to clipboard history', async () => {
    await shell.boot();

    // Create and select an input inside dashboard
    const testInput = document.createElement('input');
    testInput.value = 'Texto copiado no dashboard';
    root.appendChild(testInput);
    testInput.focus();
    testInput.setSelectionRange(0, testInput.value.length);

    // Fire copy event
    const copyEvent = new Event('copy', { bubbles: true, cancelable: true });
    document.dispatchEvent(copyEvent);

    expect(storage.addClipboardEntry).toHaveBeenCalledWith('Texto copiado no dashboard');
  });
});
