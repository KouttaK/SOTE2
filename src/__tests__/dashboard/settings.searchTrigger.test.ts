/**
 * Smoke tests for the new "Gatilho de Busca" section on the Settings page
 * (Part 5 — spec §5 settings + §6 reserved-prefix migration scan).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { storage } from '../../shared/storage/StorageService.js';
import { generateId } from '../../shared/storage/helpers.js';
import type { Flow } from '../../shared/types/index.js';
import SettingsPage from '../../dashboard/pages/settings.js';

function makeFlow(shortcut: string, overrides: Partial<Flow> = {}): Flow {
  return {
    id: generateId(),
    name: 'Flow ' + shortcut,
    blocks: [
      { id: 'b1', type: 'trigger', data: { shortcut, smartCase: false, forceCapitalize: false } as any },
      { id: 'b2', type: 'action', data: { format: 'plaintext', content: 'x', tokens: [] } as any },
    ],
    tags: [],
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    stats: { usageCount: 0, keysSaved: 0 },
    ...overrides,
  };
}

async function mountPage(): Promise<HTMLElement> {
  const page = new SettingsPage();
  const el = page.render();
  document.body.appendChild(el);
  await page.mount();
  // Let the async conflict scan (storage.getFlows()) resolve.
  await new Promise((r) => setTimeout(r, 0));
  return el;
}

describe('Settings — Gatilho de Busca section', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    document.body.innerHTML = '';
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  it('reflects the current settings on load', async () => {
    await storage.initialise();
    const el = await mountPage();

    expect(el.querySelector('#toggle-search-trigger')!.classList.contains('active')).toBe(true);
    expect(el.querySelector<HTMLInputElement>('#search-domain-prefix-input')!.value).toBe('//');
    expect(el.querySelector<HTMLInputElement>('#search-global-prefix-input')!.value).toBe('///');
  });

  it('toggling the master switch persists to storage', async () => {
    await storage.initialise();
    const el = await mountPage();

    el.querySelector<HTMLElement>('#toggle-search-trigger')!.click();
    await new Promise((r) => setTimeout(r, 0));

    const settings = await storage.getSettings();
    expect(settings.searchTrigger.enabled).toBe(false);
  });

  it('rejects equal prefixes and reverts the input', async () => {
    await storage.initialise();
    const el = await mountPage();

    const domainInput = el.querySelector<HTMLInputElement>('#search-domain-prefix-input')!;
    domainInput.value = '///'; // same as the global prefix
    domainInput.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));

    expect(window.alert).toHaveBeenCalled();
    expect(domainInput.value).toBe('//'); // reverted
    const settings = await storage.getSettings();
    expect(settings.searchTrigger.domainPrefix).toBe('//');
  });

  it('rejects an empty prefix', async () => {
    await storage.initialise();
    const el = await mountPage();

    const globalInput = el.querySelector<HTMLInputElement>('#search-global-prefix-input')!;
    globalInput.value = '';
    globalInput.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));

    expect(window.alert).toHaveBeenCalled();
    const settings = await storage.getSettings();
    expect(settings.searchTrigger.globalPrefix).toBe('///');
  });

  it('accepts a valid custom prefix and re-scans for conflicts', async () => {
    await storage.initialise();
    await storage.saveFlow(makeFlow('@@relatorio'));
    const el = await mountPage();

    const domainInput = el.querySelector<HTMLInputElement>('#search-domain-prefix-input')!;
    domainInput.value = '@@';
    domainInput.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));

    const settings = await storage.getSettings();
    expect(settings.searchTrigger.domainPrefix).toBe('@@');

    const conflictBox = el.querySelector<HTMLElement>('#search-trigger-conflict-box')!;
    expect(conflictBox.style.display).not.toBe('none');
    expect(conflictBox.textContent).toContain('@@relatorio');
  });

  it('shows no conflict warning when no Flow shortcuts collide', async () => {
    await storage.initialise();
    await storage.saveFlow(makeFlow('relatorio'));
    const el = await mountPage();

    const conflictBox = el.querySelector<HTMLElement>('#search-trigger-conflict-box')!;
    expect(conflictBox.style.display).toBe('none');
  });

  it('hides the conflict warning once the feature is disabled', async () => {
    await storage.initialise();
    await storage.saveFlow(makeFlow('//relatorio'));
    const el = await mountPage();

    let conflictBox = el.querySelector<HTMLElement>('#search-trigger-conflict-box')!;
    expect(conflictBox.style.display).not.toBe('none');

    el.querySelector<HTMLElement>('#toggle-search-trigger')!.click();
    await new Promise((r) => setTimeout(r, 0));

    conflictBox = el.querySelector<HTMLElement>('#search-trigger-conflict-box')!;
    expect(conflictBox.style.display).toBe('none');
  });

  it('toggling "include Flows" persists independently of the master switch', async () => {
    await storage.initialise();
    const el = await mountPage();

    el.querySelector<HTMLElement>('#toggle-search-include-flows')!.click();
    await new Promise((r) => setTimeout(r, 0));

    const settings = await storage.getSettings();
    expect(settings.searchTrigger.includeFlows).toBe(false);
    expect(settings.searchTrigger.enabled).toBe(true); // untouched
  });
});
