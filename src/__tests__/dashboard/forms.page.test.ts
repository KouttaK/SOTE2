/**
 * Smoke tests for the "Formulários" dashboard page (Part 3 — UI): create a
 * Form with a field, edit its valid sites, and delete it — all through the
 * same DOM interactions a user would perform, backed by fakeBrowser storage.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { storage } from '../../shared/storage/StorageService.js';
import { generateId } from '../../shared/storage/helpers.js';
import type { Form } from '../../shared/types/index.js';
import FormsPage from '../../dashboard/pages/forms.js';

function makeForm(overrides: Partial<Form> = {}): Form {
  return {
    id: generateId(),
    name: 'Envio de Currículo',
    sites: ['mail.google.com'],
    fields: [
      {
        id: generateId(),
        name: 'Assunto',
        type: 'text',
        value: { format: 'plaintext', content: 'Candidatura', tokens: [] },
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    stats: { usageCount: 0 },
    ...overrides,
  };
}

async function mountPage(): Promise<{ page: FormsPage; el: HTMLElement }> {
  const page = new FormsPage();
  const el = page.render();
  document.body.appendChild(el);
  await page.mount();
  return { page, el };
}

describe('FormsPage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    document.body.innerHTML = '';
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  it('renders existing forms in the sidebar', async () => {
    await storage.saveForm(makeForm({ name: 'Abertura de Protocolo' }));
    const { el } = await mountPage();

    const titles = Array.from(el.querySelectorAll('.frm-card-title')).map((n) => n.textContent);
    expect(titles).toContain('Abertura de Protocolo');
  });

  it('creating a new form with a field persists it via storage.saveForm', async () => {
    const { page, el } = await mountPage();

    el.querySelector<HTMLButtonElement>('#btn-create-form')!.click();

    const nameInput = el.querySelector<HTMLInputElement>('#frm-name')!;
    nameInput.value = 'Envio de Currículo';

    el.querySelector<HTMLButtonElement>('#btn-add-field')!.click();
    const fieldNameInput = el.querySelector<HTMLInputElement>('.frm-field-name-input')!;
    fieldNameInput.value = 'Assunto';

    el.querySelector<HTMLButtonElement>('#btn-save-form')!.click();
    // saveForm() is async; let its microtasks flush.
    await new Promise((r) => setTimeout(r, 0));

    const saved = await storage.getForms();
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('Envio de Currículo');
    expect(saved[0].fields).toHaveLength(1);
    expect(saved[0].fields[0].name).toBe('Assunto');

    // The newly-saved form must also show up in the sidebar list, not just in storage.
    const titles = Array.from(el.querySelectorAll('.frm-card-title')).map((n) => n.textContent);
    expect(titles).toContain('Envio de Currículo');

    void page; // keep reference alive for clarity
  });

  it('refuses to save a form without a name', async () => {
    const { el } = await mountPage();
    el.querySelector<HTMLButtonElement>('#btn-create-form')!.click();

    el.querySelector<HTMLButtonElement>('#btn-save-form')!.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(window.alert).toHaveBeenCalled();
    expect(await storage.getForms()).toHaveLength(0);
  });

  it('adds and removes a site chip in the editor', async () => {
    const form = makeForm({ sites: [] });
    await storage.saveForm(form);
    const { el } = await mountPage();

    const siteInput = el.querySelector<HTMLInputElement>('#frm-site-input')!;
    siteInput.value = '*.Outlook.com';
    el.querySelector<HTMLButtonElement>('#btn-add-site')!.click();

    let chips = Array.from(el.querySelectorAll('.frm-chip')).map((c) => c.getAttribute('data-site'));
    // Domains are lower-cased on add, same convention as the Blocklist.
    expect(chips).toEqual(['*.outlook.com']);

    el.querySelector<HTMLButtonElement>('.frm-chip-remove')!.click();
    chips = Array.from(el.querySelectorAll('.frm-chip')).map((c) => c.getAttribute('data-site'));
    expect(chips).toHaveLength(0);

    // Save and confirm the empty sites list round-trips correctly.
    el.querySelector<HTMLButtonElement>('#btn-save-form')!.click();
    await new Promise((r) => setTimeout(r, 0));
    const saved = await storage.getForm(form.id);
    expect(saved!.sites).toEqual([]);
  });

  it('deletes a form after confirming the modal', async () => {
    const form = makeForm();
    await storage.saveForm(form);
    const { el } = await mountPage();

    el.querySelector<HTMLButtonElement>('#btn-delete-form')!.click();
    document.querySelector<HTMLButtonElement>('#modal-confirm')!.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(await storage.getForms()).toHaveLength(0);
  });

  it('onCreateClick() (shared header CTA) opens the new-form editor', async () => {
    const { page, el } = await mountPage();
    page.onCreateClick!();

    expect(el.querySelector('#frm-name')).not.toBeNull();
    expect(el.querySelector('.frm-form-header h2')!.textContent).toBe('Criar Formulário');
  });
});
