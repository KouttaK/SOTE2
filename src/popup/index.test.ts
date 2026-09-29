/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { storage } from '../shared/storage/StorageService.js';
import * as helpers from '../shared/storage/helpers.js';
import { buildSearchResults } from '../content/engine/SearchTriggerDetector.js';

import { sendMessage } from '../shared/messaging/client.js';

vi.mock('../shared/messaging/client.js', () => ({
  sendMessage: vi.fn(),
}));

vi.mock('../shared/storage/StorageService.js', () => ({
  storage: {
    getSettings: vi.fn(),
    getFlows: vi.fn(),
    getVariables: vi.fn(),
    saveSettings: vi.fn(),
    saveVariable: vi.fn(),
  }
}));

vi.mock('../shared/storage/helpers.js', () => ({
  isSnoozeActive: vi.fn(),
  domainMatchesAny: vi.fn(),
  isExtensionActive: vi.fn(),
  matchesDomainPattern: vi.fn(),
  normalizeHostLike: vi.fn(),
}));

vi.mock('../content/engine/SearchTriggerDetector.js', () => ({
  buildSearchResults: vi.fn(),
}));

vi.mock('../shared/i18n/index.js', () => ({
  initI18n: vi.fn().mockResolvedValue(true),
  getLanguage: vi.fn().mockReturnValue('en'),
  t: (key: string, vars?: any) => {
    if (key === 'popup.page.status_domain' && vars?.domain) {
      return `on ${vars.domain}`;
    }
    if (key === 'popup.page.status_globally') {
      return 'Globally';
    }
    if (key === 'popup.page.snooze_remaining.h' && vars?.h) {
      return `${vars.h}h more`;
    }
    if (key === 'popup.page.banner_paused' && vars?.time) {
      return `Paused for ${vars.time}`;
    }
    if (key === 'popup.page.banner_blocked' && vars?.domain) {
      return `Blocked on ${vars.domain}`;
    }
    if (key === 'popup.page.banner_cancel') {
      return 'Cancel';
    }
    return key;
  },
}));

vi.mock('wxt/browser', () => ({
  browser: {
    tabs: {
      query: vi.fn().mockResolvedValue([{ id: 101, url: 'https://github.com/foo' }]),
      sendMessage: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 999 }),
    },
    storage: {
      local: {
        set: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue({}),
        remove: vi.fn().mockResolvedValue(undefined),
      },
    },
    runtime: {
      getURL: vi.fn().mockImplementation((path: string) => `mocked_url${path}`),
    }
  }
}));

import { browser } from 'wxt/browser';
import { PENDING_SELECTION_KEY } from '../shared/storage/defaults.js';
import type { Variable } from '../shared/types/index.js';

import * as fs from 'fs';
import * as path from 'path';

const rawHtml = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf8');
const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
const realBodyContent = bodyMatch ? bodyMatch[1] : rawHtml;

describe('Popup Component — Variação B (Real popup.html DOM)', () => {
  let consoleErrorSpy: any;

  beforeEach(() => {
    // Mount the ACTUAL index.html into jsdom body
    document.body.innerHTML = realBodyContent;
    consoleErrorSpy = vi.spyOn(console, 'error');
    vi.clearAllMocks();
    vi.mocked(browser.tabs.query).mockResolvedValue([{ id: 101, url: 'https://github.com/foo' }]);
    vi.mocked(browser.tabs.sendMessage).mockResolvedValue({ text: '' });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    consoleErrorSpy.mockRestore();
  });

  // ── Header structure ───────────────────────────────────────────────────────

  it('renders two-line header structure (brand row + status row)', () => {
    expect(document.querySelector('.header-row-brand')).not.toBeNull();
    expect(document.querySelector('.header-row-status')).not.toBeNull();
  });

  it('renders snooze button and master toggle in the brand row', () => {
    const brandRow = document.querySelector('.header-row-brand');
    expect(brandRow?.querySelector('#btn-snooze')).not.toBeNull();
    expect(brandRow?.querySelector('#toggle-track')).not.toBeNull();
  });

  it('has btn-block-site-perm inside snooze-menu (not in header)', () => {
    const blockBtn = document.getElementById('btn-block-site-perm');
    expect(blockBtn).not.toBeNull();
    // Must be inside snooze-menu
    const snoozeMenu = document.getElementById('snooze-menu');
    expect(snoozeMenu?.contains(blockBtn)).toBe(true);
    // Must NOT be a direct child of #popup-header (only accessible via snooze menu)
    // Verify closest parent is the snooze-menu, not directly in .header-controls
    expect(blockBtn?.closest('.header-controls') === snoozeMenu?.closest('.header-controls')).toBe(true);
    expect(blockBtn?.parentElement?.id).toBe('snooze-menu');
  });

  it('renders quick-action buttons (enabled and interactive)', () => {
    const quickCapture   = document.getElementById('btn-quick-capture') as HTMLButtonElement;
    const quickVariables = document.getElementById('btn-quick-variables') as HTMLButtonElement;
    expect(quickCapture).not.toBeNull();
    expect(quickVariables).not.toBeNull();
    expect(quickCapture.disabled).toBe(false);
    expect(quickVariables.disabled).toBe(false);
  });

  // ── Active state ───────────────────────────────────────────────────────────

  it('Active state: renders status line correctly and has NO status banner in DOM', async () => {
    vi.mocked(storage.getSettings).mockResolvedValue({ globalEnabled: true, blocklist: [] } as any);
    vi.mocked(helpers.isSnoozeActive).mockReturnValue(false);
    vi.mocked(helpers.domainMatchesAny).mockReturnValue(false);
    vi.mocked(storage.getFlows).mockResolvedValue([]);
    vi.mocked(storage.getVariables).mockResolvedValue({});

    await import('./index.js?active_v2');
    await new Promise(r => setTimeout(r, 60));

    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('[SOTE Popup] init failed:'),
      expect.anything()
    );

    // Status line
    expect(document.getElementById('status-state')?.textContent).toBe('popup.page.state_active');
    expect(document.getElementById('status-domain')?.textContent).toBe('github.com');
    expect(document.getElementById('status-indicator')?.classList.contains('active')).toBe(true);
    expect(document.getElementById('toggle-track')?.classList.contains('is-on')).toBe(true);

    // Banner must NOT exist in DOM in Active state
    expect(document.getElementById('status-banner')).toBeNull();
  });

  // ── Paused / Snooze state ──────────────────────────────────────────────────

  it('Paused state: shows paused status line and amber banner with Cancel button', async () => {
    vi.mocked(storage.getSettings).mockResolvedValue({
      globalEnabled: true,
      snoozeUntil: Date.now() + 3600000,
    } as any);
    vi.mocked(helpers.isSnoozeActive).mockReturnValue(true);
    vi.mocked(helpers.domainMatchesAny).mockReturnValue(false);
    vi.mocked(storage.getFlows).mockResolvedValue([]);
    vi.mocked(storage.getVariables).mockResolvedValue({});

    await import('./index.js?paused_v2');
    await new Promise(r => setTimeout(r, 60));

    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('[SOTE Popup] init failed:'),
      expect.anything()
    );

    // Status line
    expect(document.getElementById('status-state')?.textContent).toBe('popup.page.state_paused');
    expect(document.getElementById('status-indicator')?.classList.contains('paused')).toBe(true);
    expect(document.getElementById('btn-snooze')?.classList.contains('is-active')).toBe(true);

    // Banner must exist with paused class
    const banner = document.getElementById('status-banner');
    expect(banner).not.toBeNull();
    expect(banner?.classList.contains('status-banner--paused')).toBe(true);

    // Banner must contain text and Cancel button
    expect(banner?.querySelector('.banner-text')).not.toBeNull();
    const cancelBtn = banner?.querySelector('.banner-cancel') as HTMLButtonElement | null;
    expect(cancelBtn).not.toBeNull();
    expect(cancelBtn?.textContent).toBe('Cancel');

    // Banner must be inserted before #popup-body (not inside it)
    const card = document.getElementById('popup-card');
    const children = Array.from(card?.children ?? []);
    const bannerIdx = children.indexOf(banner!);
    const bodyIdx   = children.indexOf(document.getElementById('popup-body')!);
    expect(bannerIdx).toBeGreaterThan(-1);
    expect(bannerIdx).toBeLessThan(bodyIdx);
  });

  // ── Blocked state ──────────────────────────────────────────────────────────

  it('Blocked state: shows blocked status line and coral banner (no Cancel)', async () => {
    vi.mocked(storage.getSettings).mockResolvedValue({
      globalEnabled: true,
      blocklist: ['github.com'],
    } as any);
    vi.mocked(helpers.isSnoozeActive).mockReturnValue(false);
    vi.mocked(helpers.domainMatchesAny).mockReturnValue(true);
    vi.mocked(storage.getFlows).mockResolvedValue([]);
    vi.mocked(storage.getVariables).mockResolvedValue({});

    await import('./index.js?blocked_v2');
    await new Promise(r => setTimeout(r, 60));

    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('[SOTE Popup] init failed:'),
      expect.anything()
    );

    // Status line
    expect(document.getElementById('status-state')?.textContent).toBe('popup.page.state_muted');
    expect(document.getElementById('status-domain')?.textContent).toBe('github.com');
    expect(document.getElementById('status-indicator')?.classList.contains('blocked')).toBe(true);

    // Banner must exist with blocked class
    const banner = document.getElementById('status-banner');
    expect(banner).not.toBeNull();
    expect(banner?.classList.contains('status-banner--blocked')).toBe(true);

    // Blocked banner does NOT have a Cancel button
    expect(banner?.querySelector('.banner-cancel')).toBeNull();
    expect(banner?.querySelector('.banner-text')?.textContent).toContain('github.com');
  });

  it('renders status-banner--protected when active tab has a protected field focused', async () => {
    vi.mocked(storage.getSettings).mockResolvedValue({ globalEnabled: true, blocklist: [] } as any);
    vi.mocked(helpers.isSnoozeActive).mockReturnValue(false);
    vi.mocked(helpers.domainMatchesAny).mockReturnValue(false);
    vi.mocked(storage.getFlows).mockResolvedValue([]);
    vi.mocked(storage.getVariables).mockResolvedValue({});
    vi.mocked(sendMessage).mockImplementation(async (msg: any) => {
      if (msg?.type === 'GET_ACTIVE_TAB_PROTECTION_STATUS') {
        return { isProtected: true };
      }
      return null;
    });

    await import('./index.js?protected_field_banner_test');
    await new Promise((r) => setTimeout(r, 60));

    const banner = document.getElementById('status-banner');
    expect(banner).not.toBeNull();
    expect(banner?.classList.contains('status-banner--protected')).toBe(true);
    expect(banner?.querySelector('.banner-text')?.textContent).toBe('popup.page.banner_protected');
  });

  // ── Globally Disabled state ────────────────────────────────────────────────

  it('Globally Disabled: toggle off, no banner, status dot paused', async () => {
    vi.mocked(storage.getSettings).mockResolvedValue({ globalEnabled: false, blocklist: [] } as any);
    vi.mocked(helpers.isSnoozeActive).mockReturnValue(false);
    vi.mocked(storage.getFlows).mockResolvedValue([]);
    vi.mocked(storage.getVariables).mockResolvedValue({});

    await import('./index.js?disabled_v2');
    await new Promise(r => setTimeout(r, 60));

    expect(document.getElementById('status-state')?.textContent).toBe('popup.page.state_disabled');
    expect(document.getElementById('status-domain')?.textContent).toBe('');
    expect(document.getElementById('status-domain-separator')?.style.display).toBe('none');
    expect(document.getElementById('status-indicator')?.classList.contains('paused')).toBe(true);
    expect(document.getElementById('toggle-track')?.classList.contains('is-on')).toBe(false);

    // No banner for globally disabled (toggle is just off)
    expect(document.getElementById('status-banner')).toBeNull();
  });

  // ── Snooze menu ────────────────────────────────────────────────────────────

  it('opens snooze dropdown and allows selecting custom snooze duration', async () => {
    vi.mocked(storage.getSettings).mockResolvedValue({ globalEnabled: true, blocklist: [] } as any);
    vi.mocked(helpers.isSnoozeActive).mockReturnValue(false);
    vi.mocked(helpers.domainMatchesAny).mockReturnValue(false);
    vi.mocked(storage.getFlows).mockResolvedValue([]);
    vi.mocked(storage.getVariables).mockResolvedValue({});
    vi.mocked(sendMessage).mockResolvedValue({ success: true, snoozeUntil: Date.now() + 3600000 });

    await import('./index.js?snooze_menu_v2');
    await new Promise(r => setTimeout(r, 60));

    const btnSnooze = document.getElementById('btn-snooze') as HTMLButtonElement;
    const snoozeMenu = document.getElementById('snooze-menu') as HTMLDivElement;
    const opt1h = document.getElementById('opt-snooze-1h') as HTMLButtonElement;

    expect(snoozeMenu.hidden).toBe(true);

    // Click snooze button to open menu
    btnSnooze.click();
    expect(snoozeMenu.hidden).toBe(false);

    // Click 1h option
    opt1h.click();
    await new Promise(r => setTimeout(r, 20));

    expect(sendMessage).toHaveBeenCalledWith({
      type: 'SNOOZE',
      payload: { duration: 3600000 }
    });
    expect(snoozeMenu.hidden).toBe(true);
  });

  it('snooze menu contains block-site-perm option with divider', () => {
    const snoozeMenu = document.getElementById('snooze-menu');
    expect(snoozeMenu?.querySelector('.snooze-menu-divider')).not.toBeNull();
    expect(snoozeMenu?.querySelector('#btn-block-site-perm')).not.toBeNull();
    expect(snoozeMenu?.querySelector('#btn-block-site-perm')?.classList.contains('snooze-option--block')).toBe(true);
  });

  // ── Search ─────────────────────────────────────────────────────────────────

  it('calls buildSearchResults when searching to allow flow content match', async () => {
    vi.mocked(storage.getSettings).mockResolvedValue({ globalEnabled: true });
    vi.mocked(storage.getFlows).mockResolvedValue([]);
    vi.mocked(storage.getVariables).mockResolvedValue({});
    vi.mocked(buildSearchResults).mockReturnValue({ results: [], noFormResultsForSite: false });

    await import('./index.js?search_v2');
    await new Promise(r => setTimeout(r, 60));

    const input = document.getElementById('search-input') as HTMLInputElement;
    expect(input).not.toBeNull();
    input.value = 'my flow content search';
    input.dispatchEvent(new Event('input'));

    // debounce is 150ms
    await new Promise(r => setTimeout(r, 200));

    expect(buildSearchResults).toHaveBeenCalledWith(expect.objectContaining({
      query: 'my flow content search',
      includeFlows: true
    }));
  });

  // ── Quick Capture ──────────────────────────────────────────────────────────

  it('Quick Capture with selected text ({ text } object): saves PENDING_SELECTION_KEY and opens dashboard editor', async () => {
    vi.mocked(storage.getSettings).mockResolvedValue({ globalEnabled: true, blocklist: [] } as any);
    vi.mocked(helpers.isSnoozeActive).mockReturnValue(false);
    vi.mocked(helpers.domainMatchesAny).mockReturnValue(false);
    vi.mocked(storage.getFlows).mockResolvedValue([]);
    vi.mocked(storage.getVariables).mockResolvedValue([]);
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {});

    // Mock content script responding with object selection
    vi.mocked(browser.tabs.sendMessage).mockResolvedValue({ text: 'Selected snippet text' });

    await import('./index.js?quick_capture_with_obj');
    await new Promise(r => setTimeout(r, 60));

    const btnQuickCapture = document.getElementById('btn-quick-capture') as HTMLButtonElement;
    btnQuickCapture.click();
    await new Promise(r => setTimeout(r, 40));

    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(101, { type: 'GET_SELECTION' });
    expect(browser.storage.local.set).toHaveBeenCalledWith({
      [PENDING_SELECTION_KEY]: 'Selected snippet text',
    });
    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: 'mocked_url/dashboard.html#/editor/new',
    });
    expect(closeSpy).toHaveBeenCalled();
  });

  it('Quick Capture with selected text (plain string): saves PENDING_SELECTION_KEY and opens dashboard editor', async () => {
    vi.mocked(storage.getSettings).mockResolvedValue({ globalEnabled: true, blocklist: [] } as any);
    vi.mocked(helpers.isSnoozeActive).mockReturnValue(false);
    vi.mocked(helpers.domainMatchesAny).mockReturnValue(false);
    vi.mocked(storage.getFlows).mockResolvedValue([]);
    vi.mocked(storage.getVariables).mockResolvedValue([]);
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {});

    // Mock content script responding directly with string
    vi.mocked(browser.tabs.sendMessage).mockResolvedValue('Plain string selection');

    await import('./index.js?quick_capture_with_string');
    await new Promise(r => setTimeout(r, 60));

    const btnQuickCapture = document.getElementById('btn-quick-capture') as HTMLButtonElement;
    btnQuickCapture.click();
    await new Promise(r => setTimeout(r, 40));

    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(101, { type: 'GET_SELECTION' });
    expect(browser.storage.local.set).toHaveBeenCalledWith({
      [PENDING_SELECTION_KEY]: 'Plain string selection',
    });
    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: 'mocked_url/dashboard.html#/editor/new',
    });
    expect(closeSpy).toHaveBeenCalled();
  });

  it('Quick Capture without selection: shows toast and does NOT open dashboard', async () => {
    vi.mocked(storage.getSettings).mockResolvedValue({ globalEnabled: true, blocklist: [] } as any);
    vi.mocked(helpers.isSnoozeActive).mockReturnValue(false);
    vi.mocked(helpers.domainMatchesAny).mockReturnValue(false);
    vi.mocked(storage.getFlows).mockResolvedValue([]);
    vi.mocked(storage.getVariables).mockResolvedValue([]);
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {});

    // Mock content script returning empty text
    vi.mocked(browser.tabs.sendMessage).mockResolvedValue({ text: '' });

    await import('./index.js?quick_capture_no_text');
    await new Promise(r => setTimeout(r, 60));

    const btnQuickCapture = document.getElementById('btn-quick-capture') as HTMLButtonElement;
    btnQuickCapture.click();
    await new Promise(r => setTimeout(r, 40));

    expect(browser.storage.local.set).not.toHaveBeenCalledWith(expect.objectContaining({
      [PENDING_SELECTION_KEY]: expect.anything(),
    }));
    expect(browser.tabs.create).not.toHaveBeenCalled();
    expect(closeSpy).not.toHaveBeenCalled();

    // Check toast was created
    const toast = document.querySelector('.sote-toast');
    expect(toast).not.toBeNull();
    expect(toast?.textContent).toBe('popup.page.quick_capture_no_selection');
  });

  it('Quick Capture when content script sendMessage throws: shows toast and does NOT open dashboard', async () => {
    vi.mocked(storage.getSettings).mockResolvedValue({ globalEnabled: true, blocklist: [] } as any);
    vi.mocked(helpers.isSnoozeActive).mockReturnValue(false);
    vi.mocked(helpers.domainMatchesAny).mockReturnValue(false);
    vi.mocked(storage.getFlows).mockResolvedValue([]);
    vi.mocked(storage.getVariables).mockResolvedValue([]);
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {});

    // Mock content script throwing/rejecting
    vi.mocked(browser.tabs.sendMessage).mockRejectedValue(new Error('Could not establish connection'));

    await import('./index.js?quick_capture_error');
    await new Promise(r => setTimeout(r, 60));

    const btnQuickCapture = document.getElementById('btn-quick-capture') as HTMLButtonElement;
    btnQuickCapture.click();
    await new Promise(r => setTimeout(r, 60));

    expect(browser.storage.local.set).not.toHaveBeenCalledWith(expect.objectContaining({
      [PENDING_SELECTION_KEY]: expect.anything(),
    }));
    expect(browser.tabs.create).not.toHaveBeenCalled();
    expect(closeSpy).not.toHaveBeenCalled();

    const toast = document.querySelector('.sote-toast');
    expect(toast).not.toBeNull();
    expect(toast?.textContent).toBe('popup.page.quick_capture_no_selection');
  });

  it('Quick Capture when no active tab exists: shows toast and does NOT open dashboard', async () => {
    vi.mocked(storage.getSettings).mockResolvedValue({ globalEnabled: true, blocklist: [] } as any);
    vi.mocked(helpers.isSnoozeActive).mockReturnValue(false);
    vi.mocked(helpers.domainMatchesAny).mockReturnValue(false);
    vi.mocked(storage.getFlows).mockResolvedValue([]);
    vi.mocked(storage.getVariables).mockResolvedValue([]);
    vi.mocked(browser.tabs.query).mockResolvedValue([]);
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {});

    await import('./index.js?quick_capture_no_tab');
    await new Promise(r => setTimeout(r, 60));

    vi.mocked(browser.tabs.sendMessage).mockClear();
    const btnQuickCapture = document.getElementById('btn-quick-capture') as HTMLButtonElement;
    btnQuickCapture.click();
    await new Promise(r => setTimeout(r, 60));

    expect(browser.tabs.sendMessage).not.toHaveBeenCalled();
    expect(browser.storage.local.set).not.toHaveBeenCalledWith(expect.objectContaining({
      [PENDING_SELECTION_KEY]: expect.anything(),
    }));
    expect(browser.tabs.create).not.toHaveBeenCalled();
    expect(closeSpy).not.toHaveBeenCalled();

    const toast = document.querySelector('.sote-toast');
    expect(toast).not.toBeNull();
    expect(toast?.textContent).toBe('popup.page.quick_capture_no_selection');
  });

  // ── Quick Variables ────────────────────────────────────────────────────────

  it('Navigation: switches to Variables view and returns to Main view', async () => {
    const mockVars: Variable[] = [
      { id: 'var-1', key: 'CLIENT_NAME', value: 'Alice', updatedAt: 1000 },
      { id: 'var-2', key: 'COMPANY', value: 'Acme Corp', updatedAt: 2000 },
    ];
    vi.mocked(storage.getSettings).mockResolvedValue({ globalEnabled: true, blocklist: [] } as any);
    vi.mocked(helpers.isSnoozeActive).mockReturnValue(false);
    vi.mocked(helpers.domainMatchesAny).mockReturnValue(false);
    vi.mocked(storage.getFlows).mockResolvedValue([]);
    vi.mocked(storage.getVariables).mockResolvedValue(mockVars);

    await import('./index.js?nav_vars');
    await new Promise(r => setTimeout(r, 60));

    const btnQuickVariables = document.getElementById('btn-quick-variables') as HTMLButtonElement;
    const viewVariables     = document.getElementById('view-variables') as HTMLDivElement;
    const popupHeader       = document.getElementById('popup-header') as HTMLDivElement;
    const popupBody         = document.getElementById('popup-body') as HTMLDivElement;
    const popupFooter       = document.getElementById('popup-footer') as HTMLDivElement;
    const btnVarsBack       = document.getElementById('btn-vars-back') as HTMLButtonElement;

    expect(viewVariables.hidden).toBe(true);
    expect(popupHeader.hidden).toBe(false);

    // Click "Variáveis"
    btnQuickVariables.click();

    expect(viewVariables.hidden).toBe(false);
    expect(popupHeader.hidden).toBe(true);
    expect(popupBody.hidden).toBe(true);
    expect(popupFooter.hidden).toBe(true);

    // Check that items rendered
    const items = document.querySelectorAll('.quick-var-item');
    expect(items.length).toBe(2);

    // Click Back
    btnVarsBack.click();

    expect(viewVariables.hidden).toBe(true);
    expect(popupHeader.hidden).toBe(false);
    expect(popupBody.hidden).toBe(false);
    expect(popupFooter.hidden).toBe(false);
  });

  it('Quick Variables editing: persists changes via storage.saveVariable on blur/Enter', async () => {
    const mockVars: Variable[] = [
      { id: 'var-1', key: 'NOME_CLIENTE', value: 'Valor Antigo', updatedAt: 1000 },
    ];
    vi.mocked(storage.getSettings).mockResolvedValue({ globalEnabled: true, blocklist: [] } as any);
    vi.mocked(helpers.isSnoozeActive).mockReturnValue(false);
    vi.mocked(helpers.domainMatchesAny).mockReturnValue(false);
    vi.mocked(storage.getFlows).mockResolvedValue([]);
    vi.mocked(storage.getVariables).mockResolvedValue(mockVars);
    vi.mocked(storage.saveVariable).mockResolvedValue(undefined);

    await import('./index.js?edit_var');
    await new Promise(r => setTimeout(r, 60));

    const btnQuickVariables = document.getElementById('btn-quick-variables') as HTMLButtonElement;
    btnQuickVariables.click();

    const input = document.querySelector('.quick-var-input') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('Valor Antigo');

    // Change value and blur
    input.value = 'Valor Novo';
    input.dispatchEvent(new Event('blur'));
    await new Promise(r => setTimeout(r, 20));

    expect(storage.saveVariable).toHaveBeenCalledWith(expect.objectContaining({
      id: 'var-1',
      key: 'NOME_CLIENTE',
      value: 'Valor Novo',
    }));

    const toast = document.querySelector('.sote-toast');
    expect(toast).not.toBeNull();
    expect(toast?.textContent).toBe('popup.page.var_saved');
  });

  it('Quick Variables editing: Enter key triggers blur and saves variable', async () => {
    const mockVars: Variable[] = [
      { id: 'var-enter', key: 'TEST_ENTER', value: 'Original Value', updatedAt: 1000 },
    ];
    vi.mocked(storage.getSettings).mockResolvedValue({ globalEnabled: true, blocklist: [] } as any);
    vi.mocked(helpers.isSnoozeActive).mockReturnValue(false);
    vi.mocked(helpers.domainMatchesAny).mockReturnValue(false);
    vi.mocked(storage.getFlows).mockResolvedValue([]);
    vi.mocked(storage.getVariables).mockResolvedValue(mockVars);
    vi.mocked(storage.saveVariable).mockResolvedValue(undefined);

    await import('./index.js?edit_var_enter');
    await new Promise(r => setTimeout(r, 60));

    const btnQuickVariables = document.getElementById('btn-quick-variables') as HTMLButtonElement;
    btnQuickVariables.click();

    const input = document.querySelector('.quick-var-input') as HTMLInputElement;
    expect(input).not.toBeNull();

    input.focus();
    input.value = 'Value After Enter';
    // Press Enter
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise(r => setTimeout(r, 20));

    expect(storage.saveVariable).toHaveBeenCalledWith(expect.objectContaining({
      id: 'var-enter',
      key: 'TEST_ENTER',
      value: 'Value After Enter',
    }));

    const toast = document.querySelector('.sote-toast');
    expect(toast).not.toBeNull();
    expect(toast?.textContent).toBe('popup.page.var_saved');
  });

  it('Quick Variables: does not save if value is unchanged', async () => {
    const mockVars: Variable[] = [
      { id: 'var-noop', key: 'TEST_NOOP', value: 'Same Value', updatedAt: 1000 },
    ];
    vi.mocked(storage.getSettings).mockResolvedValue({ globalEnabled: true, blocklist: [] } as any);
    vi.mocked(helpers.isSnoozeActive).mockReturnValue(false);
    vi.mocked(helpers.domainMatchesAny).mockReturnValue(false);
    vi.mocked(storage.getFlows).mockResolvedValue([]);
    vi.mocked(storage.getVariables).mockResolvedValue(mockVars);
    vi.mocked(storage.saveVariable).mockResolvedValue(undefined);

    await import('./index.js?edit_var_noop');
    await new Promise(r => setTimeout(r, 60));

    const btnQuickVariables = document.getElementById('btn-quick-variables') as HTMLButtonElement;
    btnQuickVariables.click();

    const input = document.querySelector('.quick-var-input') as HTMLInputElement;
    input.dispatchEvent(new Event('blur'));
    await new Promise(r => setTimeout(r, 20));

    expect(storage.saveVariable).not.toHaveBeenCalled();
  });

  it('Quick Variables error handling: shows error toast on save failure without crashing or blocking navigation', async () => {
    const mockVars: Variable[] = [
      { id: 'var-err', key: 'TEST_ERR', value: 'Initial', updatedAt: 1000 },
    ];
    vi.mocked(storage.getSettings).mockResolvedValue({ globalEnabled: true, blocklist: [] } as any);
    vi.mocked(helpers.isSnoozeActive).mockReturnValue(false);
    vi.mocked(helpers.domainMatchesAny).mockReturnValue(false);
    vi.mocked(storage.getFlows).mockResolvedValue([]);
    vi.mocked(storage.getVariables).mockResolvedValue(mockVars);
    vi.mocked(storage.saveVariable).mockRejectedValue(new Error('Storage quota exceeded'));

    await import('./index.js?edit_var_error');
    await new Promise(r => setTimeout(r, 60));

    const btnQuickVariables = document.getElementById('btn-quick-variables') as HTMLButtonElement;
    const viewVariables     = document.getElementById('view-variables') as HTMLDivElement;
    const btnVarsBack       = document.getElementById('btn-vars-back') as HTMLButtonElement;
    btnQuickVariables.click();

    const input = document.querySelector('.quick-var-input') as HTMLInputElement;
    input.value = 'Changed Failing Value';
    input.dispatchEvent(new Event('blur'));
    await new Promise(r => setTimeout(r, 20));

    expect(storage.saveVariable).toHaveBeenCalled();
    const errorToast = document.querySelector('.sote-toast');
    expect(errorToast).not.toBeNull();
    expect(errorToast?.textContent).toBe('popup.page.var_save_failed');

    // Navigation back must remain fully operational
    btnVarsBack.click();
    expect(viewVariables.hidden).toBe(true);
    const popupHeader = document.getElementById('popup-header') as HTMLDivElement;
    expect(popupHeader.hidden).toBe(false);
  });

  it('Quick Variables: displays empty state message when no variables exist', async () => {
    vi.mocked(storage.getSettings).mockResolvedValue({ globalEnabled: true, blocklist: [] } as any);
    vi.mocked(helpers.isSnoozeActive).mockReturnValue(false);
    vi.mocked(helpers.domainMatchesAny).mockReturnValue(false);
    vi.mocked(storage.getFlows).mockResolvedValue([]);
    vi.mocked(storage.getVariables).mockResolvedValue([]);

    await import('./index.js?vars_empty');
    await new Promise(r => setTimeout(r, 60));

    const btnQuickVariables = document.getElementById('btn-quick-variables') as HTMLButtonElement;
    btnQuickVariables.click();

    const emptyMsg = document.querySelector('.vars-empty');
    expect(emptyMsg).not.toBeNull();
    expect(emptyMsg?.textContent).toBe('popup.page.vars_empty');
  });

  it('Quick Variables: sorts by updatedAt descending and limits to 5 items', async () => {
    const { getTopQuickVariables } = await import('./index.js?test_top_vars');

    const testVars: Variable[] = [
      { id: '1', key: 'v1', value: 'val1', updatedAt: 100 },
      { id: '2', key: 'v2', value: 'val2', updatedAt: 700 },
      { id: '3', key: 'v3', value: 'val3', updatedAt: 300 },
      { id: '4', key: 'v4', value: 'val4', updatedAt: 900 },
      { id: '5', key: 'v5', value: 'val5', updatedAt: 200 },
      { id: '6', key: 'v6', value: 'val6', updatedAt: 800 },
      { id: '7', key: 'v7', value: 'val7', updatedAt: 500 },
    ];

    const top5 = getTopQuickVariables(testVars);
    expect(top5.length).toBe(5);
    expect(top5.map((v) => v.id)).toEqual(['4', '6', '2', '7', '3']);
  });

  it('Quick Variables: sorts by usageCount descending, breaking ties with updatedAt descending', async () => {
    const { getTopQuickVariables } = await import('./index.js?test_top_vars_usage');

    const testVars: Variable[] = [
      { id: '1', key: 'v1', value: 'val1', updatedAt: 500, usageCount: 2 },
      { id: '2', key: 'v2', value: 'val2', updatedAt: 100, usageCount: 10 },
      { id: '3', key: 'v3', value: 'val3', updatedAt: 800, usageCount: 5 },
      { id: '4', key: 'v4', value: 'val4', updatedAt: 900, usageCount: 5 },
      { id: '5', key: 'v5', value: 'val5', updatedAt: 950 },
      { id: '6', key: 'v6', value: 'val6', updatedAt: 200, usageCount: 0 },
    ];

    const top5 = getTopQuickVariables(testVars);
    expect(top5.length).toBe(5);
    expect(top5.map((v) => v.id)).toEqual(['2', '4', '3', '1', '5']);
  });

  it('Quick Variables: Escape key returns from variables view to main view', async () => {
    vi.mocked(storage.getSettings).mockResolvedValue({ globalEnabled: true, blocklist: [] } as any);
    vi.mocked(helpers.isSnoozeActive).mockReturnValue(false);
    vi.mocked(helpers.domainMatchesAny).mockReturnValue(false);
    vi.mocked(storage.getFlows).mockResolvedValue([]);
    vi.mocked(storage.getVariables).mockResolvedValue([]);

    await import('./index.js?vars_escape');
    await new Promise(r => setTimeout(r, 60));

    const btnQuickVariables = document.getElementById('btn-quick-variables') as HTMLButtonElement;
    const viewVariables     = document.getElementById('view-variables') as HTMLDivElement;
    const popupHeader       = document.getElementById('popup-header') as HTMLDivElement;

    btnQuickVariables.click();
    expect(viewVariables.hidden).toBe(false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(viewVariables.hidden).toBe(true);
    expect(popupHeader.hidden).toBe(false);
  });

  it('Quick Variables: Manage variables in dashboard opens tab and closes popup', async () => {
    vi.mocked(storage.getSettings).mockResolvedValue({ globalEnabled: true, blocklist: [] } as any);
    vi.mocked(helpers.isSnoozeActive).mockReturnValue(false);
    vi.mocked(helpers.domainMatchesAny).mockReturnValue(false);
    vi.mocked(storage.getFlows).mockResolvedValue([]);
    vi.mocked(storage.getVariables).mockResolvedValue([]);
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {});

    await import('./index.js?vars_open_dash');
    await new Promise(r => setTimeout(r, 60));

    const btnQuickVariables = document.getElementById('btn-quick-variables') as HTMLButtonElement;
    btnQuickVariables.click();

    const btnOpenVarsDash = document.getElementById('btn-open-variables-dash') as HTMLButtonElement;
    btnOpenVarsDash.click();

    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: 'mocked_url/dashboard.html#/variables',
    });
    expect(closeSpy).toHaveBeenCalled();
  });

  it('Keyboard Shortcuts: autofocuses searchInput on init', async () => {
    vi.mocked(storage.getSettings).mockResolvedValue({ globalEnabled: true, blocklist: [] } as any);
    vi.mocked(helpers.isSnoozeActive).mockReturnValue(false);
    vi.mocked(helpers.domainMatchesAny).mockReturnValue(false);
    vi.mocked(storage.getFlows).mockResolvedValue([]);
    vi.mocked(storage.getVariables).mockResolvedValue([]);

    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    const focusSpy = vi.spyOn(searchInput, 'focus');

    await import('./index.js?test_autofocus');
    await new Promise(r => setTimeout(r, 60));

    expect(focusSpy).toHaveBeenCalled();
  });

  it('Keyboard Shortcuts: Alt+C triggers Quick Capture click', async () => {
    vi.mocked(storage.getSettings).mockResolvedValue({ globalEnabled: true, blocklist: [] } as any);
    vi.mocked(helpers.isSnoozeActive).mockReturnValue(false);
    vi.mocked(helpers.domainMatchesAny).mockReturnValue(false);
    vi.mocked(storage.getFlows).mockResolvedValue([]);
    vi.mocked(storage.getVariables).mockResolvedValue([]);

    await import('./index.js?test_alt_c');
    await new Promise(r => setTimeout(r, 60));

    const btnQuickCapture = document.getElementById('btn-quick-capture') as HTMLButtonElement;
    const clickSpy = vi.spyOn(btnQuickCapture, 'click');

    const event = new KeyboardEvent('keydown', { key: 'c', altKey: true, bubbles: true });
    document.dispatchEvent(event);

    expect(clickSpy).toHaveBeenCalled();
  });

  it('Keyboard Shortcuts: Alt+V toggles Quick Variables view', async () => {
    vi.mocked(storage.getSettings).mockResolvedValue({ globalEnabled: true, blocklist: [] } as any);
    vi.mocked(helpers.isSnoozeActive).mockReturnValue(false);
    vi.mocked(helpers.domainMatchesAny).mockReturnValue(false);
    vi.mocked(storage.getFlows).mockResolvedValue([]);
    vi.mocked(storage.getVariables).mockResolvedValue([]);

    await import('./index.js?test_alt_v');
    await new Promise(r => setTimeout(r, 60));

    const viewVariables = document.getElementById('view-variables') as HTMLDivElement;
    expect(viewVariables.hidden).toBe(true);

    // Press Alt+V -> opens variables
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', altKey: true, bubbles: true }));
    expect(viewVariables.hidden).toBe(false);

    // Press Alt+V again -> returns to main view
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', altKey: true, bubbles: true }));
    expect(viewVariables.hidden).toBe(true);
  });

  it('Keyboard Shortcuts: / focuses searchInput when not in an editable element', async () => {
    vi.mocked(storage.getSettings).mockResolvedValue({ globalEnabled: true, blocklist: [] } as any);
    vi.mocked(helpers.isSnoozeActive).mockReturnValue(false);
    vi.mocked(helpers.domainMatchesAny).mockReturnValue(false);
    vi.mocked(storage.getFlows).mockResolvedValue([]);
    vi.mocked(storage.getVariables).mockResolvedValue([]);

    await import('./index.js?test_slash_key');
    await new Promise(r => setTimeout(r, 60));

    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    const focusSpy = vi.spyOn(searchInput, 'focus');

    // Press '/' on document body
    const event = new KeyboardEvent('keydown', { key: '/', bubbles: true });
    document.body.dispatchEvent(event);

    expect(focusSpy).toHaveBeenCalled();
  });
});
