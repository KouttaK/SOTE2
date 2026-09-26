/**
 * src/dashboard/pages/variables.ts — Global Variables page
 */
import type { Page } from './index.js';
import { storage } from '../../shared/storage/StorageService.js';
import type { Variable, Flow, Block, ActionBlock } from '../../shared/types/index.js';
import { findMissingVariableKeys } from '../../shared/utils/flowVariableScanner.js';
import { t, getLanguage } from '../../shared/i18n/index.js';
import { escapeHtml } from '../../shared/utils/dom.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import { showToast } from '../../shared/components/Toast.js';
import './variables.css';

const ICONS = {
  search: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor"><path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"/></svg>`,
  plus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" aria-hidden="true" fill="currentColor"><path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z"/></svg>`,
  globe: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor"><path d="M352 256c0 22.2-1.2 43.6-3.3 64H163.3c-2.2-20.4-3.3-41.8-3.3-64s1.2-43.6 3.3-64H348.7c2.2 20.4 3.3 41.8 3.3 64zm28.8-64H503.9c5.3 20.5 8.1 41.9 8.1 64s-2.8 43.5-8.1 64H380.8c2.1-20.6 3.2-42 3.2-64s-1.1-43.4-3.2-64zm112.6-32H376.7c-10-63.9-29.8-117.4-55.3-151.6c78.3 20.7 142 77.5 171.9 151.6zm-149.1 0H167.7c6.1-36.4 15.5-68.6 27-94.7c10.5-23.6 22.2-40.7 33.5-51.5C239.4 3.2 248.7 0 256 0s16.6 3.2 27.8 13.8c11.3 10.8 23 27.9 33.5 51.5c11.6 26 20.9 58.2 27 94.7zm-209 0H18.6C48.6 85.9 112.2 29.1 190.6 8.4C165.1 42.6 145.3 96.1 135.3 160zM8.1 192H131.2c-2.1 20.6-3.2 42-3.2 64s1.1 43.4 3.2 64H8.1C2.8 299.5 0 278.1 0 256s2.8-43.5 8.1-64zM194.7 446.6c-11.6-26-20.9-58.2-27-94.6H344.3c-6.1 36.4-15.5 68.6-27 94.6c-10.5 23.6-22.2 40.7-33.5 51.5C272.6 508.8 263.3 512 256 512s-16.6-3.2-27.8-13.8c-11.3-10.8-23-27.9-33.5-51.5zM135.3 352c10 63.9 29.8 117.4 55.3 151.6C112.2 482.9 48.6 426.1 18.6 352H135.3zm358.1 0c-30 74.1-93.6 130.9-171.9 151.6c25.5-34.2 45.2-87.7 55.3-151.6H493.4z"/></svg>`,
  code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" aria-hidden="true" fill="currentColor"><path d="M392.8 1.2c-17-4.9-34.7 5-39.6 22l-128 448c-4.9 17 5 34.7 22 39.6s34.7-5 39.6-22l128-448c4.9-17-5-34.7-22-39.6zm80.6 120.1c-12.5 12.5-12.5 32.8 0 45.3L562.7 256l-89.4 89.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l112-112c12.5-12.5 12.5-32.8 0-45.3l-112-112c-12.5-12.5-32.8-12.5-45.3 0zm-306.7 0c-12.5-12.5-32.8-12.5-45.3 0l-112 112c-12.5 12.5-12.5 32.8 0 45.3l112 112c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256l89.4-89.4c12.5-12.5 12.5-32.8 0-45.3z"/></svg>`,
  pencil: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor"><path d="M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z"/></svg>`,
  trash: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" aria-hidden="true" fill="currentColor"><path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"/></svg>`,
  times: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" aria-hidden="true" fill="currentColor"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></svg>`,
  check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" aria-hidden="true" fill="currentColor"><path d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/></svg>`,
  database: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" aria-hidden="true" fill="currentColor"><path d="M448 80v48c0 44.2-100.3 80-224 80S0 172.2 0 128V80C0 35.8 100.3 0 224 0S448 35.8 448 80zM393.2 214.7c20.8-7.4 39.2-16.9 54.8-28.6V288c0 44.2-100.3 80-224 80S0 332.2 0 288V186.1c15.6 11.7 34 21.2 54.8 28.6C111.8 236.6 165 240 224 240s112.2-3.4 169.2-25.3zM0 346.1c15.6 11.7 34 21.2 54.8 28.6C111.8 396.6 165 400 224 400s112.2-3.4 169.2-25.3c20.8-7.4 39.2-16.9 54.8-28.6V432c0 44.2-100.3 80-224 80S0 476.2 0 432V346.1z"/></svg>`,
  network: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" aria-hidden="true" fill="currentColor"><path d="M312 32c-13.3 0-24 10.7-24 24s10.7 24 24 24h16c61.9 0 112 50.1 112 112v16H344c-13.3 0-24 10.7-24 24v128c0 13.3 10.7 24 24 24h96c13.3 0 24-10.7 24-24V232c0-13.3-10.7-24-24-24h-96v-16c0-44.2-35.8-80-80-80h-16c-13.3 0-24-10.7-24-24s10.7-24 24-24h16c79.5 0 144 64.5 144 144v16h24c13.3 0 24 10.7 24 24v128c0 13.3-10.7 24-24 24H344c-13.3 0-24-10.7-24-24V232c0-13.3 10.7-24 24-24h24v-16c0-61.9-50.1-112-112-112h-16zm-88 0c-13.3 0-24 10.7-24 24s10.7 24 24 24h16c61.9 0 112 50.1 112 112v16h-96c-13.3 0-24 10.7-24 24v128c0 13.3 10.7 24 24 24h96c13.3 0 24-10.7 24-24V232c0-13.3-10.7-24-24-24h-96v-16c0-44.2 35.8-80 80-80h16c13.3 0 24-10.7 24-24s-10.7-24-24-24h-16C156.5 32 92 96.5 92 176v16H68c-13.3 0-24 10.7-24 24v128c0 13.3 10.7 24 24 24h96c13.3 0 24-10.7 24-24V232c0-13.3-10.7-24-24-24H140v-16c0-61.9 50.1-112 112-112h16z"/></svg>`,
};

const EXTRA_ICONS = {
  chevronRight: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" fill="currentColor"><path d="M310.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256 73.4 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z"/></svg>`,
  sortDesc: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor"><path d="M151.6 42.4C145.5 35.8 137 32 128 32s-17.5 3.8-23.6 10.4l-88 96c-11.9 13-11.1 33.3 2 45.2s33.3 11.1 45.2-2L96 146.3V448c0 17.7 14.3 32 32 32s32-14.3 32-32V146.3l32.4 35.4c11.9 13 32.2 13.9 45.2 2s13.9-32.2 2-45.2l-88-96zM320 480h32c17.7 0 32-14.3 32-32s-14.3-32-32-32H320c-17.7 0-32 14.3-32 32s14.3 32 32 32zm0-128h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H320c-17.7 0-32 14.3-32 32s14.3 32 32 32zm0-128H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H320c-17.7 0-32 14.3-32 32s14.3 32 32 32zm0-128H544c17.7 0 32-14.3 32-32s-14.3-32-32-32H320c-17.7 0-32 14.3-32 32s14.3 32 32 32z"/></svg>`,
  sparkle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2z"/></svg>`,
};

/** Same short relative-time label used by the Fluxos table ("2h atras" /
 * "Ontem" / "3 dias atras"), matching the reference's "ULTIMA ALTERACAO" column. */
function formatRelativeTime(ts: number | undefined, locale: 'pt' | 'en'): string {
  if (!ts) return '\u2014';
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (locale === 'pt') {
    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `${diffMin}min atras`;
    if (diffH < 24) return `${diffH}h atras`;
    if (diffD === 1) return 'Ontem';
    if (diffD < 30) return `${diffD} dias atras`;
    return new Date(ts).toLocaleDateString('pt-BR');
  }
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}min ago`;
  if (diffH < 24) return `${diffH}h ago`;
  if (diffD === 1) return 'Yesterday';
  if (diffD < 30) return `${diffD} days ago`;
  return new Date(ts).toLocaleDateString('en-US');
}

export default class VariablesPage implements Page {
  private el: HTMLElement;
  private variables: Variable[] = [];
  private filteredVars: Variable[] = [];
  private searchQuery = '';
  private flows: Flow[] = [];
  private searchInput: HTMLInputElement | null = null;
  private searchHandler!: (e: Event) => void;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'page-variables';
  }

  render(): HTMLElement {
    this.el.innerHTML = /* html */ `
      <div class="dash-page-inner">
        <div class="vars-title-row">
          <div>
            <div class="dash-breadcrumb">
              <span>/workspace</span>${EXTRA_ICONS.chevronRight}<span class="is-current">${t('variables.breadcrumb')}</span>
            </div>
            <h1 class="vars-header-title">${t('variables.title')}</h1>
            <p class="vars-header-subtitle">${t('variables.subtitle')}</p>
          </div>
          <div class="vars-total-uses">
            <p class="lbl">${t('variables.stats.total_uses_label')}</p>
            <p class="val" id="stat-total-uses">0</p>
          </div>
        </div>

        <!-- Banner -->
        <div class="vars-banner" id="vars-banner">
          <div class="vars-banner-icon">${EXTRA_ICONS.sparkle}</div>
          <div class="vars-banner-content">
            <p class="title">${t('variables.banner.title')}</p>
            <p class="desc">
              ${t('variables.banner.desc', { tagExample: '<span class="tag">{{YOUR_VARIABLE_KEY}}</span>' })}
            </p>
          </div>
          <button class="vars-banner-report" id="btn-report">${t('variables.banner.report')}</button>
          <button class="vars-banner-close" id="btn-close-banner">${ICONS.times}</button>
        </div>

        <!-- Table -->
        <div class="vars-table-wrap">
          <div class="vars-table-toolbar">
            <span class="vars-table-toolbar-title">${t('variables.table.title')}</span>
            <button class="dash-header-btn" id="vars-sort-btn">
              ${EXTRA_ICONS.sortDesc}<span>${t('variables.table.sort_by_key')}</span>
            </button>
          </div>
          <div class="vars-table-header">
            <span class="col-3">${t('variables.table.key')}</span>
            <span class="col-4">${t('variables.table.value')}</span>
            <span class="col-2 text-center">${t('variables.table.uses')}</span>
            <span class="col-2 text-right">${t('variables.table.last_updated')}</span>
            <span class="col-1"></span>
          </div>
          <div id="vars-table-body"><!-- Rendered list --></div>
        </div>
      </div>
    `;
    return this.el;
  }

  async mount() {
    this.variables = await storage.getVariables();
    this.flows = await storage.getFlows();
    this.applySearch();

    // Search is now driven by the shared header's input (#dash-search-input),
    // not a local one — shell._updateHeaderControls() already swapped its
    // placeholder to the variables copy before this page mounted.
    this.searchInput = document.getElementById('dash-search-input') as HTMLInputElement | null;
    if (this.searchInput) {
      this.searchHandler = (e: Event) => {
        this.searchQuery = (e.target as HTMLInputElement).value.trim().toLowerCase();
        this.applySearch();
      };
      this.searchInput.addEventListener('input', this.searchHandler);
      this.searchInput.value = ''; // clear whatever was typed on the previous page
    }

    this.el.querySelector('#btn-close-banner')?.addEventListener('click', (e) => {
      (e.currentTarget as HTMLElement).closest('.vars-banner')?.remove();
    });

    this.el.querySelector('#btn-report')?.addEventListener('click', () => this.openReportModal());
  }

  unmount() {
    if (this.searchInput && this.searchHandler) {
      this.searchInput.removeEventListener('input', this.searchHandler);
    }
  }

  /** Called by the shell when the shared header's CTA is clicked on this page. */
  onCreateClick(): void {
    this.openVarModal();
  }

  private applySearch() {
    if (!this.searchQuery) {
      this.filteredVars = [...this.variables];
    } else {
      this.filteredVars = this.variables.filter(
        (v) =>
          v.key.toLowerCase().includes(this.searchQuery) ||
          v.value.toLowerCase().includes(this.searchQuery) ||
          (v.description && v.description.toLowerCase().includes(this.searchQuery))
      );
    }
    this.renderTable();
  }

  private countVarUsage(key: string): number {
    const tokenStr = `{{${key}}}`;
    let count = 0;
    for (const flow of this.flows) {
      let flowUsed = false;
      for (const block of flow.blocks) {
        if (block.type === 'action') {
          // ActionBlock content lives at block.data.content, not
          // block.content — Block.data is the actual TriggerBlock /
          // ConditionBlock / ActionBlock union (see shared/types).
          // Reading block.content directly always returned undefined,
          // so this usage counter silently reported 0 for every variable
          // no matter how many flows actually used it.
          const content = (block.data as ActionBlock)?.content ?? '';
          if (content.includes(tokenStr)) {
            flowUsed = true;
          }
        }
      }
      if (flowUsed) count++;
    }
    return count;
  }

  private renderTable() {
    const tbody = this.el.querySelector('#vars-table-body');
    if (!tbody) return;

    let totalUses = 0;
    const locale: 'pt' | 'en' = getLanguage() === 'pt-BR' ? 'pt' : 'en';

    if (this.filteredVars.length === 0) {
      const isFilterEmpty = this.variables.length > 0 && this.searchQuery;
      tbody.innerHTML = /* html */ `
        <div class="vars-empty">
          <div class="vars-empty-icon">${ICONS.search}</div>
          <h3>${t('variables.empty.title')}</h3>
          <p>${isFilterEmpty ? t('flows.empty_desc') : t('variables.empty.desc')}</p>
          ${!isFilterEmpty ? `<button class="btn-primary-violet" id="vars-empty-cta">${ICONS.plus} ${t('variables.empty.cta')}</button>` : ''}
        </div>
      `;
      tbody.querySelector('#vars-empty-cta')?.addEventListener('click', () => this.openVarModal());
      this.el.querySelector('#stat-total-uses')!.textContent = '0';
      return;
    }

    tbody.innerHTML = this.filteredVars
      .map((v) => {
        const usageCount = this.countVarUsage(v.key);
        totalUses += usageCount;
        const relTime = formatRelativeTime(v.updatedAt, locale);

        return /* html */ `
          <div class="vars-table-row">
            <div class="col-3">
              <button class="var-key-pill" data-key="${v.key}" title="${t('variables.copy_title')}">
                ${ICONS.code}
                <span class="var-key-text">{{${v.key}}}</span>
              </button>
            </div>
            <div class="col-4">
              <p class="var-value-text">${escapeHtml(v.value)}</p>
            </div>
            <div class="col-2 text-center">
              <span class="var-used-badge ${usageCount === 0 ? 'is-zero' : ''}"><span class="dot"></span>${usageCount}</span>
            </div>
            <div class="col-2 text-right">
              <span class="var-date">${relTime}</span>
            </div>
            <div class="col-1 var-actions">
              <button class="btn-icon" data-edit="${v.id}" title="${t('variables.edit_title')}">
                ${ICONS.pencil}
              </button>
              <button class="btn-icon danger" data-delete="${v.id}" title="${t('variables.delete_title')}">
                ${ICONS.trash}
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    this.el.querySelector('#stat-total-uses')!.textContent = totalUses.toString();

    // Attach listeners
    tbody.querySelectorAll('.var-key-pill').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const key = (e.currentTarget as HTMLElement).dataset.key;
        if (key) {
          navigator.clipboard.writeText(`{{${key}}}`);
          // visual feedback
          const original = btn.innerHTML;
          btn.innerHTML = ICONS.check + `<span class="var-key-text">${t('common.copied')}</span>`;
          setTimeout(() => (btn.innerHTML = original), 1500);
        }
      });
    });

    tbody.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.edit;
        const v = this.variables.find((v) => v.id === id);
        if (v) this.openVarModal(v);
      });
    });

    tbody.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.delete;
        const v = this.variables.find((v) => v.id === id);
        if (v) this.openDeleteModal(v);
      });
    });
  }

  private openVarModal(variable?: Variable) {
    const isEdit = !!variable;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = /* html */ `
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">${isEdit ? t('variables.modal.edit_title') : t('variables.modal.create_title')}</h2>
          <p class="modal-desc">${isEdit ? t('variables.modal.edit_desc') : t('variables.modal.create_desc')}</p>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">${t('variables.modal.key_label')}</label>
            <input type="text" class="form-input uppercase" id="var-key" placeholder="${t('variables.modal.key_placeholder')}" value="${variable?.key || ''}" ${isEdit ? 'disabled' : ''} />
          </div>
          <div class="form-group">
            <label class="form-label">${t('variables.modal.value_label')}</label>
            <textarea class="form-textarea" id="var-value" placeholder="${t('variables.modal.value_placeholder')}">${variable?.value || ''}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">${t('variables.modal.desc_label')}</label>
            <input type="text" class="form-input" id="var-desc" placeholder="${t('variables.modal.desc_placeholder')}" value="${variable?.description || ''}" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" id="modal-cancel">${t('common.cancel')}</button>
          <button class="btn-primary" id="modal-save">${t('variables.modal.save')}</button>
        </div>
      </div>
    `;
    this.el.appendChild(modal);

    const inputKey = modal.querySelector<HTMLInputElement>('#var-key')!;
    const inputValue = modal.querySelector<HTMLTextAreaElement>('#var-value')!;
    const inputDesc = modal.querySelector<HTMLInputElement>('#var-desc')!;

    // Force uppercase and allowed chars for key
    inputKey.addEventListener('input', () => {
      inputKey.value = inputKey.value.toUpperCase().replace(/[^A-Z0-9_]/g, '');
    });

    modal.querySelector('#modal-cancel')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#modal-save')?.addEventListener('click', async () => {
      const key = inputKey.value.trim();
      const value = inputValue.value;
      const desc = inputDesc.value.trim();

      if (!key) {
        showToast(t('variables.modal.key_required'), 'error');
        return;
      }
      if (!value) {
        showToast(t('variables.modal.value_required'), 'error');
        return;
      }

      // Check unique key on create
      if (!isEdit && this.variables.some((v) => v.key === key)) {
        showToast(t('variables.modal.key_exists'), 'error');
        return;
      }

      const newVar: Variable = {
        id: isEdit ? variable.id : crypto.randomUUID(),
        key,
        value,
        description: desc,
        updatedAt: Date.now(),
      };

      try {
        await storage.saveVariable(newVar);
        // Remove from DOM immediately
        modal.remove();

        // Refresh local cache and list
        this.variables = await storage.getVariables();
        this.applySearch();
      } catch (err) {
        console.error('Failed to save variable:', err);
        showToast(t('variables.modal.save_error'), 'error');
      }
    });
  }

  /** "Ver Relatório" — a real dependency check computed from storage (no
   * invented numbers): which variables aren't referenced by any flow yet,
   * and which flows reference a `{{KEY}}` that has no matching Variable. */
  private openReportModal() {
    const unused = this.variables.filter((v) => this.countVarUsage(v.key) === 0);
    const flowsWithMissing = this.flows
      .map((f) => ({ flow: f, missing: findMissingVariableKeys(f, this.variables) }))
      .filter((r) => r.missing.length > 0);

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = /* html */ `
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">${t('variables.report.title')}</h2>
        </div>
        <div class="modal-body">
          ${
            unused.length === 0 && flowsWithMissing.length === 0
              ? `<p class="modal-desc">${t('variables.report.all_good')}</p>`
              : ''
          }
          ${
            unused.length > 0
              ? `<div class="report-block">
                  <p class="report-block-title">${t('variables.report.unused', { count: unused.length })}</p>
                  <div class="affected-flows-list">${unused.map((v) => `<div class="affected-flows-item report-item-neutral">{{${escapeHtml(v.key)}}}</div>`).join('')}</div>
                </div>`
              : ''
          }
          ${
            flowsWithMissing.length > 0
              ? `<div class="report-block">
                  <p class="report-block-title">${t('variables.report.missing', { count: flowsWithMissing.length })}</p>
                  <div class="affected-flows-list">${flowsWithMissing
                    .map((r) => `<div class="affected-flows-item">${escapeHtml(r.flow.name)} — {{${r.missing.map((k) => escapeHtml(k)).join('}}, {{')}}}</div>`)
                    .join('')}</div>
                </div>`
              : ''
          }
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" id="modal-cancel">${t('common.cancel')}</button>
        </div>
      </div>
    `;
    this.el.appendChild(modal);
    modal.querySelector('#modal-cancel')?.addEventListener('click', () => modal.remove());
  }

  private openDeleteModal(variable: Variable) {
    // Check usages
    const tokenStr = `{{${variable.key}}}`;
    const affectedFlows: Flow[] = [];
    for (const flow of this.flows) {
      for (const block of flow.blocks) {
        if (block.type === 'action') {
          const content = (block.data as ActionBlock)?.content ?? '';
          if (content.includes(tokenStr)) {
            affectedFlows.push(flow);
            break; // once per flow
          }
        }
      }
    }

    const extraContent = affectedFlows.length > 0
      ? /* html */ `
        <div class="confirm-modal-warning">
          <p class="confirm-modal-warning-title">
            ${t('variables.delete_modal.warning_title', { count: affectedFlows.length })}
          </p>
          <div class="affected-flows-list">
            ${affectedFlows.map(f => `<div class="affected-flows-item">${escapeHtml(f.name)}</div>`).join('')}
          </div>
          <p class="confirm-modal-warning-desc">
            ${t('variables.delete_modal.warning_desc')}
          </p>
        </div>
      `
      : undefined;

    ConfirmModal.show({
      title: t('variables.delete_modal.title'),
      message: t('variables.delete_modal.desc', { tag: `<span class="tag">{{${escapeHtml(variable.key)}}}</span>` }),
      extraContent,
      confirmLabel: t('variables.delete_modal.confirm'),
      // Deleting a variable used by other flows is the one variables.ts
      // action that can silently break things elsewhere — require typing
      // the key back to make sure that's really the intent.
      requireTypedPhrase: affectedFlows.length > 0 ? variable.key : undefined,
      onConfirm: async () => {
        await storage.deleteVariable(variable.id);
        this.variables = this.variables.filter(v => v.id !== variable.id);
        this.applySearch();
      },
    });
  }

}


