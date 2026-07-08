import { describe, it, expect } from 'vitest';
import { TriggerBlock } from '../../dashboard/components/blocks/TriggerBlock.js';
import type { Settings } from '../../shared/types/index.js';
import { DEFAULT_SETTINGS } from '../../shared/storage/defaults.js';

function makeSettings(overrides: Partial<Settings['searchTrigger']> = {}): Settings {
  return { ...DEFAULT_SETTINGS, searchTrigger: { ...DEFAULT_SETTINGS.searchTrigger, ...overrides } };
}

describe('TriggerBlock — reserved prefix warning (spec §6)', () => {
  it('shows no warning for an ordinary shortcut', () => {
    const block = new TriggerBlock({ shortcut: 'relatorio', smartCase: true, forceCapitalize: false }, () => {}, makeSettings());
    const warning = block.getElement().querySelector<HTMLElement>('#trigger-reserved-warning')!;
    expect(warning.style.display).toBe('none');
  });

  it('shows a warning when the initial shortcut already conflicts', () => {
    const block = new TriggerBlock({ shortcut: '//relatorio', smartCase: true, forceCapitalize: false }, () => {}, makeSettings());
    const warning = block.getElement().querySelector<HTMLElement>('#trigger-reserved-warning')!;
    expect(warning.style.display).toBe('block');
    expect(warning.textContent).toContain('//');
  });

  it('updates the warning live as the user types', () => {
    const block = new TriggerBlock({ shortcut: '', smartCase: true, forceCapitalize: false }, () => {}, makeSettings());
    const input = block.getElement().querySelector<HTMLInputElement>('#trigger-shortcut')!;
    const warning = block.getElement().querySelector<HTMLElement>('#trigger-reserved-warning')!;

    input.value = '///report';
    input.dispatchEvent(new Event('input'));
    expect(warning.style.display).toBe('block');

    input.value = 'report';
    input.dispatchEvent(new Event('input'));
    expect(warning.style.display).toBe('none');
  });

  it('never warns while the search trigger is disabled', () => {
    const block = new TriggerBlock(
      { shortcut: '//relatorio', smartCase: true, forceCapitalize: false },
      () => {},
      makeSettings({ enabled: false }),
    );
    const warning = block.getElement().querySelector<HTMLElement>('#trigger-reserved-warning')!;
    expect(warning.style.display).toBe('none');
  });

  it('never warns when settings are not provided at all', () => {
    const block = new TriggerBlock({ shortcut: '//relatorio', smartCase: true, forceCapitalize: false }, () => {});
    const warning = block.getElement().querySelector<HTMLElement>('#trigger-reserved-warning')!;
    expect(warning.style.display).toBe('none');
  });
});
