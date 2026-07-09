/**
 * src/dashboard/pages/forms.ts — "Formulários" page
 *
 * Catalog of per-site fill-in profiles (see spec §1-2, §8). A Form groups a
 * set of sites with a list of named fields; each field's value is a full
 * ActionBlock, reusing the exact same editor/engine as a Flow's action —
 * nothing new happens at execution time, this page just organises content
 * that already exists differently (per-site instead of per-shortcut).
 */
import type { Page } from './index.js';
import { storage } from '../../shared/storage/StorageService.js';
import { generateId } from '../../shared/storage/helpers.js';
import type { Form, FormField, FormFieldType } from '../../shared/types/index.js';
import { ActionBlock } from '../components/blocks/ActionBlock.js';
import { t } from '../../shared/i18n/index.js';
// ActionBlock's own styling lives in editor.css/tokens.css (it has no CSS
// of its own) — imported here too so the field-value modal renders
// correctly even if the user never visited the Flow editor page first.
import './editor.css';
import './tokens.css';
import './forms.css';

const ICONS = {
  plus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" aria-hidden="true" fill="currentColor"><path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z"/></svg>`,
  save: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" aria-hidden="true" fill="currentColor"><path d="M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V173.3c0-17-6.7-33.3-18.7-45.3L352 50.7C340 38.7 323.7 32 306.7 32H64zm0 96c0-17.7 14.3-32 32-32H288c17.7 0 32 14.3 32 32v64c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V128zM224 288a64 64 0 1 1 0 128 64 64 0 1 1 0-128z"/></svg>`,
  trash: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" aria-hidden="true" fill="currentColor"><path d="M170.5 51.6L151.5 80h145l-19-28.4c-1.5-2.2-4-3.6-6.7-3.6H177.1c-2.7 0-5.2 1.3-6.7 3.6zm147-26.6L354.2 80H368h48 8c13.3 0 24 10.7 24 24s-10.7 24-24 24h-8V432c0 44.2-35.8 80-80 80H112c-44.2 0-80-35.8-80-80V128H24c-13.3 0-24-10.7-24-24S10.7 80 24 80h8H80 93.8l36.7-55.1C140.9 9.4 158.4 0 177.1 0h93.7c18.7 0 36.2 9.4 46.6 24.9zM80 128V432c0 17.7 14.3 32 32 32H336c17.7 0 32-14.3 32-32V128H80zm80 64V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16zm80 0V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16zm80 0V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16z"/></svg>`,
  globe: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor"><path d="M352 256c0 22.2-1.2 43.6-3.3 64H163.3c-2.2-20.4-3.3-41.8-3.3-64s1.2-43.6 3.3-64H348.7c2.2 20.4 3.3 41.8 3.3 64zm28.8-64H503.9c5.3 20.5 8.1 41.9 8.1 64s-2.8 43.5-8.1 64H380.8c2.1-20.6 3.2-42 3.2-64s-1.1-43.4-3.2-64zm112.6-32H376.7c-10-63.9-29.8-117.4-55.3-151.6c78.3 20.7 142 77.5 171.9 151.6zm-149.1 0H167.7c6.1-36.4 15.5-68.6 27-94.7c10.5-23.6 22.2-40.7 33.5-51.5C239.4 3.2 248.7 0 256 0s16.6 3.2 27.8 13.8c11.3 10.8 23 27.9 33.5 51.5c11.6 26 20.9 58.2 27 94.7zm-209 0H18.6C48.6 85.9 112.2 29.1 190.6 8.4C165.1 42.6 145.3 96.1 135.3 160zM8.1 192H131.2c-2.1 20.6-3.2 42-3.2 64s1.1 43.4 3.2 64H8.1C2.8 299.5 0 278.1 0 256s2.8-43.5 8.1-64zM194.7 446.6c-11.6-26-20.9-58.2-27-94.6H344.3c-6.1 36.4-15.5 68.6-27 94.6c-10.5 23.6-22.2 40.7-33.5 51.5C272.6 508.8 263.3 512 256 512s-16.6-3.2-27.8-13.8c-11.3-10.8-23-27.9-33.5-51.5zM135.3 352c10 63.9 29.8 117.4 55.3 151.6C112.2 482.9 48.6 426.1 18.6 352H135.3zm358.1 0c-30 74.1-93.6 130.9-171.9 151.6c25.5-34.2 45.2-87.7 55.3-151.6H493.4z"/></svg>`,
  grip: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" aria-hidden="true" fill="currentColor"><path d="M40 352a40 40 0 1 0 0 80 40 40 0 1 0 0-80zm0-160a40 40 0 1 0 0 80 40 40 0 1 0 0-80zM80 72A40 40 0 1 0 0 72a40 40 0 1 0 80 0zM280 352a40 40 0 1 0 0 80 40 40 0 1 0 0-80zm40-120a40 40 0 1 0 -80 0 40 40 0 1 0 80 0zM280 32a40 40 0 1 0 0 80 40 40 0 1 0 0-80z"/></svg>`,
  pencil: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor"><path d="M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z"/></svg>`,
  code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" aria-hidden="true" fill="currentColor"><path d="M392.8 1.2c-17-4.9-34.7 5-39.6 22l-128 448c-4.9 17 5 34.7 22 39.6s34.7-5 39.6-22l128-448c4.9-17-5-34.7-22-39.6zm80.6 120.1c-12.5 12.5-12.5 32.8 0 45.3L562.7 256l-89.4 89.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l112-112c12.5-12.5 12.5-32.8 0-45.3l-112-112c-12.5-12.5-32.8-12.5-45.3 0zm-306.7 0c-12.5-12.5-32.8-12.5-45.3 0l-112 112c-12.5 12.5-12.5 32.8 0 45.3l112 112c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256l89.4-89.4c12.5-12.5 12.5-32.8 0-45.3z"/></svg>`,
};

/** Working copy of a field while the editor is open (before Save). */
type DraftField = FormField;

export default class FormsPage implements Page {
  private el: HTMLElement;
  private forms: Form[] = [];
  private filteredForms: Form[] = [];
  private searchQuery = '';
  private activeForm: Form | null = null;
  private isEditing = false;
  private searchInput: HTMLInputElement | null = null;
  private searchHandler!: (e: Event) => void;

  // Draft state for the editor (only committed to storage on Save)
  private draftSites: string[] = [];
  private draftFields: DraftField[] = [];
  private dragFieldIndex: number | null = null;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'page-forms';
  }

  render(): HTMLElement {
    this.el.innerHTML = /* html */ `
      <header class="frm-header">
        <div>
          <h1 class="frm-header-title">${t('forms.title')}</h1>
          <p class="frm-header-subtitle">${t('forms.subtitle')}</p>
        </div>
        <div class="frm-actions" id="frm-header-actions"></div>
      </header>

      <main class="frm-main">
        <aside class="frm-sidebar">
          <div class="frm-sidebar-header">
            <span class="frm-sidebar-count" id="frm-count">0</span>
          </div>
          <div class="frm-list" id="frm-list"></div>
        </aside>

        <section class="frm-editor-area" id="frm-editor-area"></section>
      </main>
    `;
    return this.el;
  }

  async mount() {
    this.forms = await storage.getForms();
    this.applySearch();

    // Search is now driven by the shared dashboard header's input
    // (#dash-search-input), not a local one — shell._updateHeaderControls()
    // already swapped its placeholder to the forms copy before this page
    // mounted. The shared header's "Create" CTA is wired via onCreateClick().
    this.searchInput = document.getElementById('dash-search-input') as HTMLInputElement | null;
    if (this.searchInput) {
      this.searchHandler = (e: Event) => {
        this.searchQuery = (e.target as HTMLInputElement).value.trim().toLowerCase();
        this.applySearch();
      };
      this.searchInput.addEventListener('input', this.searchHandler);
      this.searchInput.value = ''; // clear whatever was typed on the previous page
    }
  }

  unmount() {
    if (this.searchInput && this.searchHandler) {
      this.searchInput.removeEventListener('input', this.searchHandler);
    }
  }

  /** Lets the shared dashboard header's "Create" CTA open a new Form here instead of navigating to /editor/new. */
  onCreateClick() {
    this.createNewForm();
  }

  // ── Search / filtering ─────────────────────────────────────────────────

  private applySearch() {
    if (!this.searchQuery) {
      this.filteredForms = [...this.forms];
    } else {
      const q = this.searchQuery;
      this.filteredForms = this.forms.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.sites.some((s) => s.toLowerCase().includes(q)) ||
          f.fields.some((field) => field.name.toLowerCase().includes(q)),
      );
    }
    this.renderSidebar();

    if (this.activeForm && !this.filteredForms.find((f) => f.id === this.activeForm?.id)) {
      this.activeForm = null;
    }

    if (!this.isEditing) {
      if (this.filteredForms.length > 0 && !this.activeForm) {
        this.selectForm(this.filteredForms[0]);
      } else if (this.filteredForms.length === 0) {
        this.renderEmptyState();
      }
    }
  }

  // ── Sidebar ─────────────────────────────────────────────────────────────

  private renderSidebar() {
    this.el.querySelector('#frm-count')!.textContent = t('forms.count', { count: this.filteredForms.length });
    const list = this.el.querySelector('#frm-list');
    if (!list) return;

    list.innerHTML = this.filteredForms
      .map((f) => {
        const isActive = this.activeForm?.id === f.id && !this.isEditing;
        const sitesBadge =
          f.sites.length > 0
            ? `<span class="frm-badge">${ICONS.globe} ${t('forms.sites_count', { count: f.sites.length })}</span>`
            : `<span class="frm-badge warn">${t('forms.no_sites_badge')}</span>`;
        const fieldsBadge = `<span class="frm-badge">${t('forms.fields_count', { count: f.fields.length })}</span>`;
        const desc = f.fields.map((field) => field.name).filter(Boolean).join(' · ');

        return /* html */ `
          <div class="frm-card ${isActive ? 'active' : ''}" data-id="${f.id}">
            <div class="frm-card-top">
              <h3 class="frm-card-title">${this.escapeHTML(f.name)}</h3>
            </div>
            <div class="frm-card-meta">${sitesBadge}${fieldsBadge}</div>
            <p class="frm-card-desc">${this.escapeHTML(desc) || '—'}</p>
          </div>
        `;
      })
      .join('');

    list.querySelectorAll('.frm-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.id;
        const form = this.forms.find((x) => x.id === id);
        if (form) {
          this.isEditing = false;
          this.selectForm(form);
        }
      });
    });
  }

  private renderEmptyState() {
    const area = this.el.querySelector('#frm-editor-area');
    if (!area) return;
    area.innerHTML = /* html */ `
      <div class="frm-empty-state">
        ${ICONS.code}
        <h3>${t('forms.empty_state.title')}</h3>
        <p>${t('forms.empty_state.desc')}</p>
      </div>
    `;
    this.clearHeaderActions();
  }

  // ── Selecting / creating ────────────────────────────────────────────────

  private createNewForm() {
    this.isEditing = true;
    this.activeForm = null;
    this.draftSites = [];
    this.draftFields = [];
    this.el.querySelectorAll('.frm-card').forEach((c) => c.classList.remove('active'));
    this.renderEditor();
  }

  private selectForm(form: Form) {
    this.activeForm = form;
    this.draftSites = [...form.sites];
    this.draftFields = JSON.parse(JSON.stringify(form.fields)) as FormField[];

    this.el.querySelectorAll('.frm-card').forEach((c) => {
      if ((c as HTMLElement).dataset.id === form.id) c.classList.add('active');
      else c.classList.remove('active');
    });

    this.renderEditor();
  }

  // ── Editor ──────────────────────────────────────────────────────────────

  private renderEditor() {
    const area = this.el.querySelector('#frm-editor-area');
    if (!area) return;

    area.innerHTML = /* html */ `
      <div class="frm-form">
        <div class="frm-form-header">
          <h2>${this.activeForm ? t('forms.editor.title.edit') : t('forms.editor.title.new')}</h2>
        </div>

        <div class="form-group">
          <label class="form-label">${t('forms.editor.name_label')}</label>
          <input type="text" id="frm-name" class="form-input" value="${this.escapeHTML(this.activeForm?.name ?? '')}" placeholder="${t('forms.editor.name_placeholder')}" />
        </div>

        <div class="form-group">
          <label class="form-label">${t('forms.editor.sites_label')}</label>
          <p class="form-hint">${t('forms.editor.sites_hint')}</p>
          <div class="frm-sites-input-row">
            <input type="text" id="frm-site-input" class="form-input" placeholder="${t('forms.editor.sites_placeholder')}" />
            <button class="btn-secondary" id="btn-add-site">${ICONS.plus} ${t('forms.editor.add_site')}</button>
          </div>
          <div class="frm-chips" id="frm-sites-chips"></div>
        </div>

        <div class="form-group">
          <label class="form-label">${t('forms.editor.fields_label')}</label>
          <p class="form-hint">${t('forms.editor.fields_hint')}</p>
          <div class="frm-fields-list" id="frm-fields-list"></div>
          <button class="btn-secondary" id="btn-add-field" style="align-self: flex-start;">
            ${ICONS.plus} ${t('forms.editor.add_field')}
          </button>
        </div>
      </div>
    `;

    this.renderSitesChips();
    this.renderFieldsList();
    this.bindEditorEvents(area as HTMLElement);
    this.renderHeaderActions();
  }

  /** Populates the save/delete buttons in the shared frm-header (moved here from the local editor sub-header). */
  private renderHeaderActions() {
    const container = this.el.querySelector('#frm-header-actions');
    if (!container) return;

    container.innerHTML = /* html */ `
      ${this.activeForm ? `<button class="btn-danger" id="btn-delete-form">${ICONS.trash} ${t('common.delete')}</button>` : ''}
      <button class="btn-primary" id="btn-save-form">${ICONS.save} ${t('forms.editor.save')}</button>
    `;

    container.querySelector('#btn-save-form')?.addEventListener('click', () => this.handleSave());
    container.querySelector('#btn-delete-form')?.addEventListener('click', () => {
      if (this.activeForm) this.openDeleteModal(this.activeForm);
    });
  }

  /** Clears the header's save/delete buttons (used when showing the empty state). */
  private clearHeaderActions() {
    const container = this.el.querySelector('#frm-header-actions');
    if (container) container.innerHTML = '';
  }

  /**
   * `Form.sites` / domainMatchesAny() only understand a bare hostname or a
   * "*.domain" wildcard (see shared/storage/helpers.ts) — but it's very easy
   * to paste a full address bar URL instead (e.g. copied straight out of the
   * browser: "https://www.google.com/?zx=..." or a Chrome-style match
   * pattern like "https://www.google.com/*"). Neither of those will ever
   * match the plain hostname the content script checks against, so the site
   * silently never triggers. Reduce anything URL-shaped down to just its
   * hostname before storing it; "*.gmail.com"-style wildcards pass through
   * unchanged since "*" is still accepted as a hostname label by the URL
   * parser.
   */
  private normalizeSitePattern(raw: string): string {
    const value = raw.trim();
    if (!value) return '';

    const candidate = value.includes('://') ? value : `https://${value}`;
    try {
      const hostname = new URL(candidate).hostname;
      if (hostname) return hostname.toLowerCase();
    } catch {
      // Not URL-parseable — fall back to the raw (trimmed/lowercased) input.
    }
    return value.toLowerCase();
  }

  private bindEditorEvents(area: HTMLElement) {
    const siteInput = area.querySelector<HTMLInputElement>('#frm-site-input')!;

    const addSite = () => {
      const domain = this.normalizeSitePattern(siteInput.value);
      if (domain && !this.draftSites.includes(domain)) {
        this.draftSites.push(domain);
        siteInput.value = '';
        this.renderSitesChips();
      }
    };

    area.querySelector('#btn-add-site')?.addEventListener('click', addSite);
    siteInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addSite();
      }
    });

    area.querySelector('#btn-add-field')?.addEventListener('click', () => {
      this.syncFieldInputsToDraft();
      this.draftFields.push({
        id: generateId(),
        name: '',
        type: 'text',
        value: { format: 'plaintext', content: '', tokens: [] },
      });
      this.renderFieldsList();
      // Focus the newly added field's name input.
      const rows = area.querySelectorAll<HTMLInputElement>('.frm-field-name-input');
      rows[rows.length - 1]?.focus();
    });

  }

  private renderSitesChips() {
    const container = this.el.querySelector('#frm-sites-chips');
    if (!container) return;

    if (this.draftSites.length === 0) {
      container.innerHTML = `<p class="form-hint">${t('forms.editor.no_sites')}</p>`;
      return;
    }

    container.innerHTML = this.draftSites
      .map(
        (site) => /* html */ `
          <span class="frm-chip" data-site="${this.escapeHTML(site)}">
            ${this.escapeHTML(site)}
            <button class="frm-chip-remove" data-site="${this.escapeHTML(site)}" title="${t('forms.editor.remove_site')}">&times;</button>
          </span>
        `,
      )
      .join('');

    container.querySelectorAll('.frm-chip-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        const site = (btn as HTMLElement).dataset.site!;
        this.draftSites = this.draftSites.filter((s) => s !== site);
        this.renderSitesChips();
      });
    });
  }

  /** Reads current name/type input values from the DOM back into draftFields, in order. */
  private syncFieldInputsToDraft() {
    const rows = this.el.querySelectorAll<HTMLElement>('.frm-field-row');
    rows.forEach((row, i) => {
      if (!this.draftFields[i]) return;
      const nameInput = row.querySelector<HTMLInputElement>('.frm-field-name-input');
      const typeSelect = row.querySelector<HTMLSelectElement>('.frm-field-type-select');
      if (nameInput) this.draftFields[i].name = nameInput.value;
      if (typeSelect) this.draftFields[i].type = typeSelect.value as FormFieldType;
    });
  }

  private renderFieldsList() {
    const container = this.el.querySelector('#frm-fields-list');
    if (!container) return;

    if (this.draftFields.length === 0) {
      container.innerHTML = `<p class="frm-empty-fields">${t('forms.editor.no_fields')}</p>`;
      return;
    }

    container.innerHTML = this.draftFields
      .map(
        (field, i) => /* html */ `
          <div class="frm-field-row" draggable="true" data-index="${i}">
            <span class="frm-field-drag-handle" title="${t('forms.editor.drag_hint')}">${ICONS.grip}</span>
            <input type="text" class="frm-field-name-input" value="${this.escapeHTML(field.name)}" placeholder="${t('forms.editor.field_name_placeholder')}" />
            <select class="frm-field-type-select">
              <option value="text" ${field.type === 'text' || !field.type ? 'selected' : ''}>${t('forms.editor.field_type.text')}</option>
              <option value="email" ${field.type === 'email' ? 'selected' : ''}>${t('forms.editor.field_type.email')}</option>
              <option value="richtext" ${field.type === 'richtext' ? 'selected' : ''}>${t('forms.editor.field_type.richtext')}</option>
            </select>
            <div class="frm-field-actions">
              <button class="frm-field-btn" data-action="edit-value" data-index="${i}" title="${t('forms.editor.edit_value')}">${ICONS.pencil}</button>
              <button class="frm-field-btn danger" data-action="remove" data-index="${i}" title="${t('forms.editor.remove_field')}">${ICONS.trash}</button>
            </div>
          </div>
        `,
      )
      .join('');

    container.querySelectorAll<HTMLElement>('.frm-field-row').forEach((row) => {
      row.querySelector('[data-action="edit-value"]')?.addEventListener('click', () => {
        this.syncFieldInputsToDraft();
        this.openFieldValueModal(Number(row.dataset.index));
      });
      row.querySelector('[data-action="remove"]')?.addEventListener('click', () => {
        this.syncFieldInputsToDraft();
        this.draftFields.splice(Number(row.dataset.index), 1);
        this.renderFieldsList();
      });

      this.bindDragEvents(row);
    });
  }

  private bindDragEvents(row: HTMLElement) {
    row.addEventListener('dragstart', () => {
      this.syncFieldInputsToDraft();
      this.dragFieldIndex = Number(row.dataset.index);
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      this.el.querySelectorAll('.frm-field-row').forEach((r) => r.classList.remove('drag-over'));
      this.dragFieldIndex = null;
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      row.classList.add('drag-over');
    });
    row.addEventListener('dragleave', () => {
      row.classList.remove('drag-over');
    });
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      row.classList.remove('drag-over');
      const targetIndex = Number(row.dataset.index);
      if (this.dragFieldIndex === null || this.dragFieldIndex === targetIndex) return;

      const [moved] = this.draftFields.splice(this.dragFieldIndex, 1);
      this.draftFields.splice(targetIndex, 0, moved);
      this.dragFieldIndex = null;
      this.renderFieldsList();
    });
  }

  // ── Field value modal (embeds the shared ActionBlock editor) ───────────

  private openFieldValueModal(index: number) {
    const field = this.draftFields[index];
    if (!field) return;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = /* html */ `
      <div class="modal-content frm-field-modal-content">
        <div class="modal-header">
          <h2 class="modal-title">${t('forms.field_modal.title', { name: field.name || '—' })}</h2>
        </div>
        <div class="frm-field-modal-body" id="frm-field-modal-body"></div>
        <div class="modal-footer">
          <button class="btn-secondary" id="field-modal-cancel">${t('forms.field_modal.cancel')}</button>
          <button class="btn-primary" id="field-modal-save">${ICONS.save} ${t('forms.field_modal.save')}</button>
        </div>
      </div>
    `;
    this.el.appendChild(modal);

    const actionBlock = new ActionBlock(field.value, () => {});
    modal.querySelector('#frm-field-modal-body')!.appendChild(actionBlock.getElement());

    const close = () => modal.remove();
    modal.querySelector('#field-modal-cancel')?.addEventListener('click', close);
    modal.querySelector('#field-modal-save')?.addEventListener('click', () => {
      this.draftFields[index].value = actionBlock.getData();
      close();
    });
  }

  // ── Save / delete ───────────────────────────────────────────────────────

  private async handleSave() {
    this.syncFieldInputsToDraft();

    const nameInput = this.el.querySelector<HTMLInputElement>('#frm-name')!;
    const name = nameInput.value.trim();

    if (!name) {
      alert(t('forms.error.name_required'));
      return;
    }
    if (this.draftFields.some((f) => !f.name.trim())) {
      alert(t('forms.error.field_name_required'));
      return;
    }

    const now = Date.now();
    const form: Form = {
      id: this.activeForm?.id ?? generateId(),
      name,
      sites: [...this.draftSites],
      fields: this.draftFields,
      createdAt: this.activeForm?.createdAt ?? now,
      updatedAt: now,
      stats: this.activeForm?.stats ?? { usageCount: 0 },
    };

    await storage.saveForm(form);

    const idx = this.forms.findIndex((f) => f.id === form.id);
    if (idx !== -1) this.forms[idx] = form;
    else this.forms.push(form);

    this.isEditing = false;
    this.applySearch();
    this.selectForm(form);
  }

  private openDeleteModal(form: Form) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = /* html */ `
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">${t('common.delete')} "${this.escapeHTML(form.name)}"?</h2>
          <p class="modal-desc">${t('forms.delete_confirm')}</p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" id="modal-cancel">${t('common.cancel')}</button>
          <button class="btn-danger-solid" id="modal-confirm">${t('common.delete')}</button>
        </div>
      </div>
    `;
    this.el.appendChild(modal);

    modal.querySelector('#modal-cancel')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#modal-confirm')?.addEventListener('click', async () => {
      await storage.deleteForm(form.id);
      this.forms = this.forms.filter((f) => f.id !== form.id);
      this.activeForm = null;
      this.applySearch();
      modal.remove();
    });
  }

  private escapeHTML(str: string): string {
    return str.replace(
      /[&<>'"]/g,
      (tag) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#39;',
          '"': '&quot;',
        }[tag] || tag),
    );
  }
}
