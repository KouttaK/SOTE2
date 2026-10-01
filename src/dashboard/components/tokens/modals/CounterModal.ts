/**
 * src/dashboard/components/tokens/modals/CounterModal.ts
 */

import { BaseModal } from './BaseModal.js';
import type { Token, CounterConfig, Counter } from '../../../../shared/types/index.js';
import { storage } from '../../../../shared/storage/StorageService.js';
import { t } from '../../../../shared/i18n/index.js';
import { escapeHtml } from '../../../../shared/utils/dom.js';
import { showToast } from '../../../../shared/components/Toast.js';

function formatCounterPreview(c: { currentValue: number; padLength?: number; format?: string }): string {
  const val = String(c.currentValue).padStart(c.padLength || 0, '0');
  const fmt = c.format || '{contador}';
  return fmt.replace('{contador}', val);
}

export class CounterModal extends BaseModal {
  private onSaveCallback: (newConfig: CounterConfig) => void;
  private token: Token;
  private activeTab: 'existing' | 'new' = 'existing';
  private counters: Counter[] = [];

  // Tab 1 Elements
  private counterSelect!: HTMLSelectElement;
  private previewExistingVal!: HTMLElement;
  private existingDetailsBox!: HTMLElement;
  private displayModeSelectExisting!: HTMLSelectElement;
  private incrementModeSelectExisting!: HTMLSelectElement;

  // Tab 2 Elements
  private nameInputNew!: HTMLInputElement;
  private startInputNew!: HTMLInputElement;
  private stepInputNew!: HTMLInputElement;
  private padInputNew!: HTMLInputElement;
  private formatInputNew!: HTMLInputElement;
  private resetSelectNew!: HTMLSelectElement;
  private scopeSelectNew!: HTMLSelectElement;
  private previewNewVal!: HTMLElement;
  private displayModeSelectNew!: HTMLSelectElement;
  private incrementModeSelectNew!: HTMLSelectElement;

  constructor(token: Token, onSave: (newConfig: CounterConfig) => void) {
    super(t('token.modal.configure_counter'));
    this.token = token;
    this.onSaveCallback = onSave;

    // Render immediately with defaults so DOM elements are available synchronously
    const config = (this.token.config || {}) as Partial<CounterConfig>;
    if (!config.counterId) {
      this.activeTab = 'new';
    }
    this.renderTabsAndForms();

    this.init();
  }

  private async init(): Promise<void> {
    try {
      this.counters = (await storage.getCounters()) || [];
    } catch {
      this.counters = [];
    }
    const config = (this.token.config || {}) as Partial<CounterConfig>;
    const currentCounterId = config.counterId;

    if (this.counters.length === 0) {
      this.activeTab = 'new';
    } else if (currentCounterId && this.counters.some((c) => c.id === currentCounterId)) {
      this.activeTab = 'existing';
    } else {
      this.activeTab = 'existing';
    }

    this.renderTabsAndForms();
  }

  private renderTabsAndForms(): void {
    const config = (this.token.config || {}) as Partial<CounterConfig>;
    const currentCounterId = config.counterId;
    const displayMode = config.displayMode ?? 'visible';
    const incrementMode = config.incrementMode ?? 'always';

    this.body.innerHTML = `
      <div style="display:flex; flex-direction:column; gap: var(--spacing-4);">
        <!-- Tabs -->
        <div style="display:flex; gap: 0.5rem; border-bottom: 1px solid var(--color-border); padding-bottom: 0.5rem;">
          <button type="button" class="btn-tab ${this.activeTab === 'existing' ? 'is-active' : ''}" id="tab-btn-existing" style="padding: 0.5rem 1rem; border: none; background: ${this.activeTab === 'existing' ? 'var(--color-panel-header, rgba(255,255,255,0.08))' : 'transparent'}; color: ${this.activeTab === 'existing' ? 'var(--color-cyan, #06b6d4)' : 'var(--color-mute)'}; border-radius: var(--radius-md); font-weight: 600; cursor: pointer;">
            ${t('token.counter.tab_existing')} (${this.counters.length})
          </button>
          <button type="button" class="btn-tab ${this.activeTab === 'new' ? 'is-active' : ''}" id="tab-btn-new" style="padding: 0.5rem 1rem; border: none; background: ${this.activeTab === 'new' ? 'var(--color-panel-header, rgba(255,255,255,0.08))' : 'transparent'}; color: ${this.activeTab === 'new' ? 'var(--color-cyan, #06b6d4)' : 'var(--color-mute)'}; border-radius: var(--radius-md); font-weight: 600; cursor: pointer;">
            + ${t('token.counter.tab_new')}
          </button>
        </div>

        <!-- Tab 1: Existing Counter -->
        <div id="tab-content-existing" style="display: ${this.activeTab === 'existing' ? 'flex' : 'none'}; flex-direction: column; gap: var(--spacing-4);">
          ${
            this.counters.length === 0
              ? `<p class="field-hint" style="color: var(--color-mute);">${t('token.counter.no_counters_yet')}</p>`
              : `
            <div class="field-group">
              <label>${t('token.counter.select_counter')}</label>
              <select class="form-input" id="counter-select-existing">
                ${this.counters
                  .map(
                    (c) =>
                      `<option value="${c.id}" ${c.id === currentCounterId ? 'selected' : ''}>${escapeHtml(c.name)} (Atual: ${c.currentValue}, ${escapeHtml(c.format)})</option>`
                  )
                  .join('')}
              </select>
            </div>

            <div id="counter-existing-details" style="background: var(--color-panel, rgba(0,0,0,0.2)); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 1rem;">
              <div style="font-size: 0.8125rem; color: var(--color-mute); margin-bottom: 0.5rem;">${t('token.counter.next_preview')}:</div>
              <div id="preview-existing-val" style="font-family: var(--font-family-mono); font-size: 1.125rem; font-weight: 700; color: var(--color-cyan, #06b6d4);"></div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-4);">
              <div class="field-group">
                <label>${t('token.counter.display_mode_label')}</label>
                <select class="form-input" id="counter-display-mode-existing">
                  <option value="visible"${displayMode === 'visible' ? ' selected' : ''}>${t('token.counter.display_mode_visible')}</option>
                  <option value="silent"${displayMode === 'silent' ? ' selected' : ''}>${t('token.counter.display_mode_silent')}</option>
                </select>
              </div>
              <div class="field-group">
                <label>${t('token.counter.increment_mode_label')}</label>
                <select class="form-input" id="counter-increment-mode-existing">
                  <option value="always"${incrementMode === 'always' ? ' selected' : ''}>${t('token.counter.increment_mode_always')}</option>
                  <option value="visible_only"${incrementMode === 'visible_only' ? ' selected' : ''}>${t('token.counter.increment_mode_visible_only')}</option>
                </select>
              </div>
            </div>
          `
          }
        </div>

        <!-- Tab 2: New Counter -->
        <div id="tab-content-new" style="display: ${this.activeTab === 'new' ? 'flex' : 'none'}; flex-direction: column; gap: var(--spacing-4);">
          <div class="field-group">
            <label>${t('counters.modal_field_name')}</label>
            <input type="text" class="form-input" id="counter-name-new" value="Contador ${this.counters.length + 1}" />
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-4);">
            <div class="field-group">
              <label>${t('counters.modal_field_start')}</label>
              <input type="number" class="form-input" id="counter-start" value="1" step="1" />
            </div>
            <div class="field-group">
              <label>${t('counters.modal_field_step')}</label>
              <input type="number" class="form-input" id="counter-step-new" value="1" step="1" min="1" />
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-4);">
            <div class="field-group">
              <label>${t('counters.modal_field_pad')}</label>
              <input type="number" class="form-input" id="counter-pad-new" value="0" min="0" max="10" />
            </div>
            <div class="field-group">
              <label>${t('counters.modal_field_format')}</label>
              <input type="text" class="form-input" id="counter-format-new" value="{contador}" />
              <p class="field-hint" style="font-size: 0.75rem; color: var(--color-mute);">${t('counters.modal_field_format_hint')}</p>
            </div>
          </div>

          <div style="background: var(--color-panel, rgba(0,0,0,0.2)); border: 1px dashed var(--color-border); border-radius: var(--radius-lg); padding: 0.75rem; text-align: center;">
            <span style="font-size: 0.75rem; color: var(--color-mute);">${t('token.counter.next_preview')}: </span>
            <span id="preview-new-val" style="font-family: var(--font-family-mono); font-size: 1rem; font-weight: 700; color: var(--color-cyan, #06b6d4);">{contador}</span>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-4);">
            <div class="field-group">
              <label>${t('counters.modal_field_reset')}</label>
              <select class="form-input" id="counter-reset-new">
                <option value="never">${t('counters.reset_never')}</option>
                <option value="day">${t('counters.reset_day')}</option>
                <option value="month">${t('counters.reset_month')}</option>
                <option value="year">${t('counters.reset_year')}</option>
              </select>
            </div>
            <div class="field-group">
              <label>${t('counters.modal_field_scope')}</label>
              <select class="form-input" id="counter-scope-new">
                <option value="global">${t('counters.scope_global')}</option>
                <option value="site">${t('counters.scope_site')}</option>
              </select>
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-4);">
            <div class="field-group">
              <label>${t('token.counter.display_mode_label')}</label>
              <select class="form-input" id="counter-display-mode-new">
                <option value="visible"${displayMode === 'visible' ? ' selected' : ''}>${t('token.counter.display_mode_visible')}</option>
                <option value="silent"${displayMode === 'silent' ? ' selected' : ''}>${t('token.counter.display_mode_silent')}</option>
              </select>
            </div>
            <div class="field-group">
              <label>${t('token.counter.increment_mode_label')}</label>
              <select class="form-input" id="counter-increment-mode-new">
                <option value="always"${incrementMode === 'always' ? ' selected' : ''}>${t('token.counter.increment_mode_always')}</option>
                <option value="visible_only"${incrementMode === 'visible_only' ? ' selected' : ''}>${t('token.counter.increment_mode_visible_only')}</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    `;

    // Tab buttons
    const btnTabExisting = this.body.querySelector('#tab-btn-existing') as HTMLButtonElement;
    const btnTabNew = this.body.querySelector('#tab-btn-new') as HTMLButtonElement;
    const contentExisting = this.body.querySelector('#tab-content-existing') as HTMLElement;
    const contentNew = this.body.querySelector('#tab-content-new') as HTMLElement;

    btnTabExisting.addEventListener('click', () => {
      this.activeTab = 'existing';
      btnTabExisting.style.background = 'var(--color-panel-header, rgba(255,255,255,0.08))';
      btnTabExisting.style.color = 'var(--color-cyan, #06b6d4)';
      btnTabNew.style.background = 'transparent';
      btnTabNew.style.color = 'var(--color-mute)';
      contentExisting.style.display = 'flex';
      contentNew.style.display = 'none';
      this.updateExistingPreview();
    });

    btnTabNew.addEventListener('click', () => {
      this.activeTab = 'new';
      btnTabNew.style.background = 'var(--color-panel-header, rgba(255,255,255,0.08))';
      btnTabNew.style.color = 'var(--color-cyan, #06b6d4)';
      btnTabExisting.style.background = 'transparent';
      btnTabExisting.style.color = 'var(--color-mute)';
      contentNew.style.display = 'flex';
      contentExisting.style.display = 'none';
      this.updateNewPreview();
    });

    // Existing Elements
    if (this.counters.length > 0) {
      this.counterSelect = this.body.querySelector('#counter-select-existing') as HTMLSelectElement;
      this.previewExistingVal = this.body.querySelector('#preview-existing-val') as HTMLElement;
      this.displayModeSelectExisting = this.body.querySelector('#counter-display-mode-existing') as HTMLSelectElement;
      this.incrementModeSelectExisting = this.body.querySelector('#counter-increment-mode-existing') as HTMLSelectElement;

      this.counterSelect.addEventListener('change', () => this.updateExistingPreview());
      this.updateExistingPreview();
    }

    // New Elements
    this.nameInputNew = this.body.querySelector('#counter-name-new') as HTMLInputElement;
    this.startInputNew = this.body.querySelector('#counter-start') as HTMLInputElement;
    this.stepInputNew = this.body.querySelector('#counter-step-new') as HTMLInputElement;
    this.padInputNew = this.body.querySelector('#counter-pad-new') as HTMLInputElement;
    this.formatInputNew = this.body.querySelector('#counter-format-new') as HTMLInputElement;
    this.resetSelectNew = this.body.querySelector('#counter-reset-new') as HTMLSelectElement;
    this.scopeSelectNew = this.body.querySelector('#counter-scope-new') as HTMLSelectElement;
    this.previewNewVal = this.body.querySelector('#preview-new-val') as HTMLElement;
    this.displayModeSelectNew = this.body.querySelector('#counter-display-mode-new') as HTMLSelectElement;
    this.incrementModeSelectNew = this.body.querySelector('#counter-increment-mode-new') as HTMLSelectElement;

    this.startInputNew.addEventListener('input', () => this.updateNewPreview());
    this.stepInputNew.addEventListener('input', () => this.updateNewPreview());
    this.padInputNew.addEventListener('input', () => this.updateNewPreview());
    this.formatInputNew.addEventListener('input', () => this.updateNewPreview());
    this.updateNewPreview();
  }

  private updateExistingPreview(): void {
    if (!this.counterSelect || !this.previewExistingVal) return;
    const cid = this.counterSelect.value;
    const counter = this.counters.find((c) => c.id === cid);
    if (!counter) return;

    const stepStr = counter.step >= 0 ? `+${counter.step}` : `${counter.step}`;
    this.previewExistingVal.textContent = `${formatCounterPreview(counter)} (${t('counters.col_current')}: ${counter.currentValue} · ${t('counters.col_step')}: ${stepStr})`;
  }

  private updateNewPreview(): void {
    if (!this.previewNewVal) return;
    const start = parseInt(this.startInputNew.value, 10) || 1;
    const step = parseInt(this.stepInputNew.value, 10) || 1;
    const stepStr = step >= 0 ? `+${step}` : `${step}`;
    const pad = parseInt(this.padInputNew.value, 10) || 0;
    const fmt = this.formatInputNew.value || '{contador}';

    const formatted = formatCounterPreview({
      currentValue: start,
      padLength: pad,
      format: fmt,
    });
    this.previewNewVal.textContent = `${formatted} (${t('token.counter.start_short')}: ${start} · ${t('token.counter.step_short')}: ${stepStr})`;
  }

  protected async onSave(): Promise<void> {
    if (this.activeTab === 'existing') {
      if (this.counters.length === 0) {
        showToast(t('token.counter.no_counters_yet'), 'error');
        return;
      }
      const cid = this.counterSelect.value;
      const counter = this.counters.find((c) => c.id === cid);
      if (!counter) {
        showToast(t('token.counter.select_counter'), 'error');
        return;
      }

      this.onSaveCallback({
        counterId: counter.id,
        counterName: counter.name,
        displayMode: this.displayModeSelectExisting.value as 'visible' | 'silent',
        incrementMode: this.incrementModeSelectExisting.value as 'always' | 'visible_only',
      });
      this.close();
    } else {
      // Create new counter
      const name = this.nameInputNew.value.trim() || `Contador ${this.counters.length + 1}`;
      const start = parseInt(this.startInputNew.value, 10);
      const step = parseInt(this.stepInputNew.value, 10);
      const pad = parseInt(this.padInputNew.value, 10) || 0;
      const format = this.formatInputNew.value.trim() || '{contador}';
      const resetRule = this.resetSelectNew.value as Counter['resetRule'];
      const scope = this.scopeSelectNew.value as Counter['scope'];

      if (isNaN(start)) {
        showToast(t('token.counter.invalid_start'), 'error');
        return;
      }
      if (isNaN(step) || step <= 0) {
        showToast(t('token.counter.invalid_step'), 'error');
        return;
      }

      const newCounter: Counter = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cnt_${Date.now()}`,
        name,
        format,
        resetRule,
        startValue: start,
        currentValue: start,
        scope,
        step,
        padLength: pad,
      };

      await storage.saveCounter(newCounter);

      this.onSaveCallback({
        counterId: newCounter.id,
        counterName: newCounter.name,
        displayMode: this.displayModeSelectNew.value as 'visible' | 'silent',
        incrementMode: this.incrementModeSelectNew.value as 'always' | 'visible_only',
      });
      this.close();
    }
  }
}
