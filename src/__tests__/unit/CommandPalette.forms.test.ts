/**
 * CommandPalette (§7 — Palette): same search/ranking as the Gatilho de
 * Busca, but as a floating overlay rather than anchored to the cursor.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandPalette } from '../../content/palette/CommandPalette.js';
import type { Form, Flow } from '../../shared/types/index.js';

vi.mock('../../content/palette/CommandPalette.css?inline', () => ({ default: '' }));

function makeForm(overrides: Partial<Form> = {}): Form {
  return {
    id: 'form-1',
    name: 'Envio de Currículo',
    sites: ['mail.google.com'],
    fields: [
      { id: 'f1', name: 'Assunto', type: 'text', value: { format: 'plaintext', content: 'Candidatura', tokens: [] } },
      { id: 'f2', name: 'Destinatário', type: 'email', value: { format: 'plaintext', content: 'rh@empresa.com', tokens: [] } },
    ],
    createdAt: 0,
    updatedAt: 0,
    stats: { usageCount: 0 },
    ...overrides,
  };
}

function makeFlow(overrides: Partial<Flow> = {}): Flow {
  return {
    id: 'flow-1',
    name: 'Saudação',
    blocks: [
      { id: 'b1', type: 'trigger', data: { shortcut: 'oi', smartCase: true, forceCapitalize: false } },
      { id: 'b2', type: 'action', data: { format: 'plaintext', content: 'Bom dia!', tokens: [] } },
    ],
    tags: [],
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
    stats: { usageCount: 0, keysSaved: 0 },
    ...overrides,
  };
}

function shadowOf(palette: CommandPalette): ShadowRoot {
  return (palette as any).host.shadowRoot as ShadowRoot;
}

function openPalette(palette: CommandPalette, hostname: string, forms: Form[], flows: Flow[]) {
  palette.updateForms(forms);
  palette.updateFlows(flows);
  palette.updateContext(hostname, true);
  const onSelect = vi.fn();
  const onClose = vi.fn();
  palette.open(onSelect, onClose);
  return { onSelect, onClose };
}

function typeQuery(palette: CommandPalette, query: string) {
  const input = shadowOf(palette).querySelector<HTMLInputElement>('.search-input')!;
  input.value = query;
  input.dispatchEvent(new Event('input'));
}

describe('CommandPalette — Forms + Flows search', () => {
  let palette: CommandPalette;

  beforeEach(() => {
    document.body.innerHTML = '';
    palette = new CommandPalette();
  });

  it('browse mode (empty query) shows both the Form and the Flow', () => {
    openPalette(palette, 'mail.google.com', [makeForm()], [makeFlow()]);
    const items = shadowOf(palette).querySelectorAll('.result-item');
    expect(items.length).toBe(2);
  });

  it('scopes to the current site by default — a Form for another site is hidden', () => {
    const { onSelect } = openPalette(palette, 'outlook.com', [makeForm()], []); // form sites: mail.google.com
    const items = shadowOf(palette).querySelectorAll('.result-item');
    expect(items.length).toBe(0);
    expect(shadowOf(palette).querySelector('.palette-footer-suggestion')).not.toBeNull();
    void onSelect;
  });

  it('clicking the footer suggestion broadens results to all sites', () => {
    openPalette(palette, 'outlook.com', [makeForm()], []);
    const suggestion = shadowOf(palette).querySelector<HTMLElement>('.palette-footer-suggestion')!;
    suggestion.click();
    const items = shadowOf(palette).querySelectorAll('.result-item');
    expect(items.length).toBe(1);
  });

  it('typing a field name selects that field directly on Enter', () => {
    const { onSelect } = openPalette(palette, 'mail.google.com', [makeForm()], []);
    typeQuery(palette, 'assunto');

    const input = shadowOf(palette).querySelector<HTMLInputElement>('.search-input')!;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));

    return new Promise((resolve) => {
      setTimeout(() => {
        expect(onSelect).toHaveBeenCalledWith({ kind: 'form-field', form: expect.any(Object), field: expect.objectContaining({ name: 'Assunto' }) });
        resolve(undefined);
      }, 20);
    });
  });

  it('typing only the Form name drills into a fields submenu instead of selecting immediately', () => {
    const { onSelect } = openPalette(palette, 'mail.google.com', [makeForm()], []);
    typeQuery(palette, 'currículo');

    const input = shadowOf(palette).querySelector<HTMLInputElement>('.search-input')!;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));

    // Still open, now showing the submenu breadcrumb + this Form's fields.
    expect(onSelect).not.toHaveBeenCalled();
    const breadcrumb = shadowOf(palette).querySelector('.palette-breadcrumb');
    expect(breadcrumb?.textContent).toBe('Envio de Currículo');
    const items = shadowOf(palette).querySelectorAll('.result-item');
    expect(items.length).toBe(2); // Assunto, Destinatário
  });

  it('selecting a field from the submenu fires onSelect with that field', async () => {
    const { onSelect } = openPalette(palette, 'mail.google.com', [makeForm()], []);
    typeQuery(palette, 'currículo');
    const input = shadowOf(palette).querySelector<HTMLInputElement>('.search-input')!;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true })); // drill into submenu

    const firstField = shadowOf(palette).querySelectorAll('.result-item')[0] as HTMLElement;
    firstField.click();

    await new Promise((r) => setTimeout(r, 20));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'form-field', field: expect.objectContaining({ name: 'Assunto' }) }),
    );
  });

  it('Flows are always included regardless of scope, unlike Forms', () => {
    openPalette(palette, 'totally-unrelated.com', [], [makeFlow()]);
    const items = shadowOf(palette).querySelectorAll('.result-item');
    expect(items.length).toBe(1);
    expect(shadowOf(palette).querySelector('.palette-type-badge.flow')).not.toBeNull();
  });

  it('respects includeFlows=false from Settings', () => {
    palette.updateForms([]);
    palette.updateFlows([makeFlow()]);
    palette.updateContext('x.com', false);
    palette.open(vi.fn(), vi.fn());
    const items = shadowOf(palette).querySelectorAll('.result-item');
    expect(items.length).toBe(0);
  });

  it('Escape closes without selecting', () => {
    const { onSelect, onClose } = openPalette(palette, 'mail.google.com', [makeForm()], []);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
