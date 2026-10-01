/**
 * src/dashboard/pages/counters.ts — Counters Management Page
 */

import type { Page } from './index.js';
import { storage } from '../../shared/storage/StorageService.js';
import type { Counter, Flow } from '../../shared/types/index.js';
import { walkFlowActionBlocks } from '../../shared/storage/MigrationService.js';
import { t } from '../../shared/i18n/index.js';
import { escapeHtml } from '../../shared/utils/dom.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import { showToast } from '../../shared/components/Toast.js';
import './counters.css';

const ICONS = {
  search: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor"><path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"/></svg>`,
  plus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" aria-hidden="true" fill="currentColor"><path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z"/></svg>`,
  pencil: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor"><path d="M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z"/></svg>`,
  trash: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" aria-hidden="true" fill="currentColor"><path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"/></svg>`,
  refresh: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor"><path d="M386.3 160H352c-17.7 0-32 14.3-32 32s14.3 32 32 32H478.3c17.7 0 32-14.3 32-32V64c0-17.7-14.3-32-32-32s-32 14.3-32 32v35.2L414.4 97.6c-87.5-87.5-229.3-87.5-316.8 0C73.2 122 55.6 150.7 44.8 181.4c-5.9 16.7 2.9 34.9 19.5 40.8s34.9-2.9 40.8-19.5c7.7-21.8 20.2-42.3 37.8-59.8c62.5-62.5 163.8-62.5 226.3 0zM125.7 352H33.7C16 352 1.7 366.3 1.7 384v96c0 17.7 14.3 32 32 32s32-14.3 32-32V444.8l17.9 17.9c87.5 87.5 229.3 87.5 316.8 0c24.5-24.5 42.1-53.2 52.9-83.8c5.9-16.7-2.9-34.9-19.5-40.8s-34.9 2.9-40.8 19.5c-7.7 21.8-20.2 42.3-37.8 59.8c-62.5 62.5-163.8 62.5-226.3 0L97.6 384h28.1c17.7 0 32-14.3 32-32s-14.3-32-32-32z"/></svg>`,
  counter: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M8 12h8"/></svg>`,
  chevronRight: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" fill="currentColor"><path d="M310.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256 73.4 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z"/></svg>`,
};

function formatCounterPreview(c: Counter): string {
  const val = String(c.currentValue).padStart(c.padLength || 0, '0');
  const fmt = c.format || '{contador}';
  return fmt.replace('{contador}', val);
}

export default class CountersPage implements Page {
  private el: HTMLElement;
  private counters: Counter[] = [];
  private filteredCounters: Counter[] = [];
  private searchQuery = '';
  private flows: Flow[] = [];
  private searchInput: HTMLInputElement | null = null;
  private searchHandler!: (e: Event) => void;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'page-counters';
  }

  render(): HTMLElement {
    this.el.innerHTML = /* html */ `
      <div class="dash-page-inner">
        <div class="counters-title-row">
          <div>
            <div class="dash-breadcrumb">
              <span>/workspace</span>${ICONS.chevronRight}<span class="is-current">${t('counters.breadcrumb')}</span>
            </div>
            <h1 class="vars-header-title">${t('counters.title')}</h1>
            <p class="vars-header-subtitle">${t('counters.subtitle')}</p>
          </div>
          <div class="counters-total-stats">
            <p class="lbl">${t('counters.title')}</p>
            <p class="val" id="counters-total-count">0</p>
          </div>
        </div>

        <div class="counters-controls-row">
          <div class="counters-search-wrap">
            <span class="counters-search-icon">${ICONS.search}</span>
            <input type="text" class="counters-search-input" id="counters-search-input" placeholder="${t('counters.search_placeholder')}" value="${escapeHtml(this.searchQuery)}">
          </div>
          <button type="button" class="counters-btn-new" id="btn-create-counter">
            ${ICONS.plus} ${t('counters.btn_new')}
          </button>
        </div>

        <div id="counters-content-area"></div>
      </div>
    `;

    return this.el;
  }

  async mount(): Promise<void> {
    this.searchInput = this.el.querySelector('#counters-search-input');
    this.searchHandler = (e: Event) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      this.filterAndRender();
    };
    this.searchInput?.addEventListener('input', this.searchHandler);

    this.el.querySelector('#btn-create-counter')?.addEventListener('click', () => {
      this.openCounterModal();
    });

    await this.loadData();
  }

  unmount(): void {
    if (this.searchInput && this.searchHandler) {
      this.searchInput.removeEventListener('input', this.searchHandler);
    }
  }

  onCreateClick(): void {
    this.openCounterModal();
  }

  private async loadData(): Promise<void> {
    this.counters = await storage.getCounters();
    this.flows = await storage.getFlows();
    this.filterAndRender();
  }

  private filterAndRender(): void {
    const q = this.searchQuery.trim().toLowerCase();
    this.filteredCounters = this.counters.filter((c) => {
      return !q || c.name.toLowerCase().includes(q) || (c.format && c.format.toLowerCase().includes(q));
    });

    const totalEl = this.el.querySelector('#counters-total-count');
    if (totalEl) totalEl.textContent = String(this.counters.length);

    const container = this.el.querySelector('#counters-content-area');
    if (!container) return;

    if (this.counters.length === 0) {
      container.innerHTML = /* html */ `
        <div class="counters-empty-state">
          <div class="counters-empty-icon">${ICONS.counter}</div>
          <h2 class="counters-empty-title">${t('counters.empty_title')}</h2>
          <p class="counters-empty-desc">${t('counters.empty_desc')}</p>
          <button type="button" class="counters-btn-new" id="btn-empty-create">
            ${ICONS.plus} ${t('counters.btn_new')}
          </button>
        </div>
      `;
      container.querySelector('#btn-empty-create')?.addEventListener('click', () => {
        this.openCounterModal();
      });
      return;
    }

    if (this.filteredCounters.length === 0) {
      container.innerHTML = /* html */ `
        <div class="counters-empty-state">
          <p class="counters-empty-desc">${t('common.no_results')}</p>
        </div>
      `;
      return;
    }

    let rowsHtml = '';
    for (const c of this.filteredCounters) {
      const scopeClass = c.scope === 'site' ? 'counter-scope-site' : 'counter-scope-global';
      const scopeLabel = c.scope === 'site' ? t('counters.scope_site') : t('counters.scope_global');
      const resetLabel = t(`counters.reset_${c.resetRule || 'never'}`);

      rowsHtml += /* html */ `
        <tr data-counter-id="${c.id}">
          <td>
            <div class="counter-name-cell">
              <span class="counter-name-title">${escapeHtml(c.name)}</span>
              <span class="counter-name-id">${escapeHtml(c.id)}</span>
            </div>
          </td>
          <td>
            <span class="counter-val-badge">${c.currentValue}</span>
          </td>
          <td>
            <code class="counter-format-code">${escapeHtml(c.format || '{contador}')}</code>
            <div style="font-size: 0.75rem; color: var(--color-mute); margin-top: 2px;">
              Ex: <strong>${escapeHtml(formatCounterPreview(c))}</strong>
            </div>
          </td>
          <td>+${c.step || 1}</td>
          <td>${escapeHtml(resetLabel)}</td>
          <td>
            <span class="counter-scope-pill ${scopeClass}">${c.scope === 'site' ? 'Site' : 'Global'}</span>
          </td>
          <td>
            <div class="counter-actions-cell">
              <button type="button" class="btn-icon-action" data-action="edit" title="${t('counters.btn_edit')}">
                ${ICONS.pencil}
              </button>
              <button type="button" class="btn-icon-action" data-action="reset" title="${t('counters.btn_reset')}">
                ${ICONS.refresh}
              </button>
              <button type="button" class="btn-icon-action danger" data-action="delete" title="${t('counters.btn_delete')}">
                ${ICONS.trash}
              </button>
            </div>
          </td>
        </tr>
      `;
    }

    container.innerHTML = /* html */ `
      <div class="counters-table-wrap">
        <table class="counters-table">
          <thead>
            <tr>
              <th>${t('counters.col_name')}</th>
              <th>${t('counters.col_current')}</th>
              <th>${t('counters.col_format')}</th>
              <th>${t('counters.col_step')}</th>
              <th>${t('counters.col_reset')}</th>
              <th>${t('counters.modal_field_scope')}</th>
              <th>${t('counters.col_actions')}</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;

    // Attach row events
    container.querySelectorAll('tr[data-counter-id]').forEach((tr) => {
      const id = tr.getAttribute('data-counter-id')!;
      const counter = this.counters.find((c) => c.id === id);
      if (!counter) return;

      tr.querySelector('[data-action="edit"]')?.addEventListener('click', () => {
        this.openCounterModal(counter);
      });

      tr.querySelector('[data-action="reset"]')?.addEventListener('click', () => {
        this.handleReset(counter);
      });

      tr.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
        this.handleDelete(counter);
      });
    });
  }

  private handleReset(counter: Counter): void {
    ConfirmModal.show({
      title: t('counters.confirm_reset_title'),
      message: t('counters.confirm_reset_msg', { name: counter.name, value: counter.startValue }),
      confirmLabel: t('counters.btn_reset'),
      danger: true,
      onConfirm: async () => {
        counter.currentValue = counter.startValue;
        await storage.saveCounter(counter);
        showToast(t('common.saved_success'), 'success');
        this.filterAndRender();
      },
    });
  }

  private handleDelete(counter: Counter): void {
    // Check if counter is used by any flow
    const flowsUsing = this.getFlowsUsingCounter(counter.id);
    if (flowsUsing.length > 0) {
      const flowNames = flowsUsing.map((f) => f.title || f.trigger?.shortcut || f.id).join(', ');
      ConfirmModal.show({
        title: t('counters.delete_blocked_title'),
        message: t('counters.delete_blocked_msg', { flows: flowNames }),
        confirmLabel: t('common.close'),
        onConfirm: () => {},
      });
      return;
    }

    ConfirmModal.show({
      title: t('counters.confirm_delete_title'),
      message: t('counters.confirm_delete_msg', { name: counter.name }),
      confirmLabel: t('counters.btn_delete'),
      danger: true,
      onConfirm: async () => {
        await storage.deleteCounter(counter.id);
        this.counters = this.counters.filter((c) => c.id !== counter.id);
        showToast(t('common.deleted_success'), 'success');
        this.filterAndRender();
      },
    });
  }

  private getFlowsUsingCounter(counterId: string): Flow[] {
    const matching: Flow[] = [];
    for (const flow of this.flows) {
      let used = false;
      walkFlowActionBlocks(flow, (actionBlock) => {
        for (const token of actionBlock.tokens || []) {
          if (token.type === 'counter' && token.config?.counterId === counterId) {
            used = true;
          }
        }
        if (actionBlock.content && actionBlock.content.includes('token-counter')) {
          if (actionBlock.content.includes(`"counterId":"${counterId}"`)) {
            used = true;
          }
        }
      });
      if (used) matching.push(flow);
    }
    return matching;
  }

  private openCounterModal(existing?: Counter): void {
    const isEdit = !!existing;
    const initialName = existing?.name || `Contador ${this.counters.length + 1}`;
    const initialFormat = existing?.format || '{contador}';
    const initialStart = existing?.startValue ?? 1;
    const initialCurrent = existing?.currentValue ?? initialStart;
    const initialStep = existing?.step ?? 1;
    const initialPad = existing?.padLength ?? 0;
    const initialReset = existing?.resetRule ?? 'never';
    const initialScope = existing?.scope ?? 'global';

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = /* html */ `
      <div class="modal-card" style="max-width: 520px; width: 100%;">
        <div class="modal-header">
          <h2 class="modal-title">${isEdit ? t('counters.modal_edit_title') : t('counters.modal_new_title')}</h2>
          <button type="button" class="modal-close" id="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body" style="padding: 1.25rem;">
          <div class="counter-form-row">
            <label>${t('counters.modal_field_name')}</label>
            <input type="text" class="counter-form-input" id="cnt-name" value="${escapeHtml(initialName)}">
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="counter-form-row">
              <label>${t('counters.modal_field_start')}</label>
              <input type="number" class="counter-form-input" id="cnt-start" value="${initialStart}">
            </div>
            ${
              isEdit
                ? /* html */ `
              <div class="counter-form-row">
                <label>${t('counters.modal_field_current')}</label>
                <input type="number" class="counter-form-input" id="cnt-current" value="${initialCurrent}">
              </div>
            `
                : ''
            }
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="counter-form-row">
              <label>${t('counters.modal_field_step')}</label>
              <input type="number" class="counter-form-input" id="cnt-step" value="${initialStep}" min="1">
            </div>
            <div class="counter-form-row">
              <label>${t('counters.modal_field_pad')}</label>
              <input type="number" class="counter-form-input" id="cnt-pad" value="${initialPad}" min="0" max="10">
            </div>
          </div>

          <div class="counter-form-row">
            <label>${t('counters.modal_field_format')}</label>
            <input type="text" class="counter-form-input" id="cnt-format" value="${escapeHtml(initialFormat)}">
            <p class="counter-form-hint">${t('counters.modal_field_format_hint')}</p>
            <div class="counter-preview-box" id="cnt-preview-box">
              Exemplo: <span id="cnt-preview-val"></span>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="counter-form-row">
              <label>${t('counters.modal_field_reset')}</label>
              <select class="counter-form-select" id="cnt-reset">
                <option value="never" ${initialReset === 'never' ? 'selected' : ''}>${t('counters.reset_never')}</option>
                <option value="day" ${initialReset === 'day' ? 'selected' : ''}>${t('counters.reset_day')}</option>
                <option value="month" ${initialReset === 'month' ? 'selected' : ''}>${t('counters.reset_month')}</option>
                <option value="year" ${initialReset === 'year' ? 'selected' : ''}>${t('counters.reset_year')}</option>
              </select>
            </div>
            <div class="counter-form-row">
              <label>${t('counters.modal_field_scope')}</label>
              <select class="counter-form-select" id="cnt-scope">
                <option value="global" ${initialScope === 'global' ? 'selected' : ''}>${t('counters.scope_global')}</option>
                <option value="site" ${initialScope === 'site' ? 'selected' : ''}>${t('counters.scope_site')}</option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem; padding: 1rem 1.25rem; border-top: 1px solid var(--color-border);">
          <button type="button" class="btn-secondary" id="modal-cancel-btn">${t('common.cancel')}</button>
          <button type="button" class="counters-btn-new" id="modal-save-btn">${t('counters.btn_save')}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const close = () => {
      document.removeEventListener('keydown', handleEsc);
      overlay.remove();
    };

    document.addEventListener('keydown', handleEsc);
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) close();
    });
    overlay.querySelector('#modal-close-btn')?.addEventListener('click', close);
    overlay.querySelector('#modal-cancel-btn')?.addEventListener('click', close);

    const nameInput = overlay.querySelector('#cnt-name') as HTMLInputElement;
    const startInput = overlay.querySelector('#cnt-start') as HTMLInputElement;
    const currentInput = overlay.querySelector('#cnt-current') as HTMLInputElement | null;
    const stepInput = overlay.querySelector('#cnt-step') as HTMLInputElement;
    const padInput = overlay.querySelector('#cnt-pad') as HTMLInputElement;
    const formatInput = overlay.querySelector('#cnt-format') as HTMLInputElement;
    const resetSelect = overlay.querySelector('#cnt-reset') as HTMLSelectElement;
    const scopeSelect = overlay.querySelector('#cnt-scope') as HTMLSelectElement;
    const previewVal = overlay.querySelector('#cnt-preview-val') as HTMLElement;

    const updatePreview = () => {
      const valNum = currentInput ? parseInt(currentInput.value, 10) || 1 : parseInt(startInput.value, 10) || 1;
      const pad = parseInt(padInput.value, 10) || 0;
      const fmt = formatInput.value || '{contador}';
      const paddedStr = String(valNum).padStart(pad, '0');
      previewVal.textContent = fmt.replace('{contador}', paddedStr);
    };

    formatInput.addEventListener('input', updatePreview);
    padInput.addEventListener('input', updatePreview);
    startInput.addEventListener('input', updatePreview);
    currentInput?.addEventListener('input', updatePreview);
    updatePreview();

    overlay.querySelector('#modal-save-btn')?.addEventListener('click', async () => {
      const name = nameInput.value.trim() || `Contador ${this.counters.length + 1}`;
      const start = parseInt(startInput.value, 10) || 1;
      const current = currentInput ? parseInt(currentInput.value, 10) || start : start;
      const step = parseInt(stepInput.value, 10) || 1;
      const pad = parseInt(padInput.value, 10) || 0;
      const format = formatInput.value.trim() || '{contador}';
      const resetRule = resetSelect.value as Counter['resetRule'];
      const scope = scopeSelect.value as Counter['scope'];

      if (isEdit && current < existing!.currentValue) {
        const proceed = confirm(
          t('counters.warn_decrease_value', {
            current: existing!.currentValue,
            value: current,
          })
        );
        if (!proceed) return;
      }

      const counter: Counter = {
        id: existing?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cnt_${Date.now()}`),
        name,
        format,
        resetRule,
        startValue: start,
        currentValue: current,
        scope,
        step,
        padLength: pad,
      };

      await storage.saveCounter(counter);
      showToast(t('common.saved_success'), 'success');
      close();
      await this.loadData();
    });
  }
}
