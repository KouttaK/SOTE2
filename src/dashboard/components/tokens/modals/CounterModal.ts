/**
 * src/dashboard/components/tokens/modals/CounterModal.ts
 */

import { BaseModal } from './BaseModal.js';
import type { Token, CounterConfig } from '../../../../shared/types/index.js';
import { t } from '../../../../shared/i18n/index.js';
import { showToast } from '../../../../shared/components/Toast.js';

export class CounterModal extends BaseModal {
  private onSaveCallback: (newConfig: CounterConfig) => void;
  private startInput!: HTMLInputElement;
  private stepInput!: HTMLInputElement;
  private padInput!: HTMLInputElement;
  private currentInput!: HTMLInputElement;
  private displayModeSelect!: HTMLSelectElement;
  private incrementModeSelect!: HTMLSelectElement;
  private scopeSelect!: HTMLSelectElement;

  constructor(token: Token, onSave: (newConfig: CounterConfig) => void) {
    super(t('token.modal.configure_counter'));
    this.onSaveCallback = onSave;

    const config = (token.config || {}) as Partial<CounterConfig>;
    const start = typeof config.start === 'number' ? config.start : 1;
    const step = typeof config.step === 'number' ? config.step : 1;
    const padLength = typeof config.padLength === 'number' ? config.padLength : '';
    const current = typeof config.current === 'number' ? config.current : start;
    const displayMode = config.displayMode ?? 'visible';
    const incrementMode = config.incrementMode ?? 'always';
    const scope = config.scope ?? 'global';

    this.body.innerHTML = `
      <div style="display:flex; flex-direction:column; gap: var(--spacing-4);">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-4);">
          <div class="field-group">
            <label>${t('token.counter.start_label')}</label>
            <input type="number" class="form-input" id="counter-start" value="${start}" step="1" />
            <p class="field-hint">${t('token.counter.start_hint')}</p>
          </div>
          <div class="field-group">
            <label>${t('token.counter.step_label')}</label>
            <input type="number" class="form-input" id="counter-step" value="${step}" step="1" />
            <p class="field-hint">${t('token.counter.step_hint')}</p>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-4);">
          <div class="field-group">
            <div class="field-label-row">
              <label>${t('token.counter.pad_label')}</label>
              <span class="field-optional-badge">${t('common.optional')}</span>
            </div>
            <input type="number" class="form-input" id="counter-pad" value="${padLength}" min="0" max="20" placeholder="0" />
            <p class="field-hint">${t('token.counter.pad_hint')}</p>
          </div>
          <div class="field-group">
            <div class="field-label-row">
              <label>${t('token.counter.current_label')}</label>
              <span class="field-optional-badge">${t('common.optional')}</span>
            </div>
            <input type="number" class="form-input" id="counter-current" value="${current}" step="1" />
            <p class="field-hint">${t('token.counter.current_hint')}</p>
          </div>
        </div>

        <div class="field-group">
          <label>${t('token.counter.display_mode_label')}</label>
          <select class="form-input" id="counter-display-mode">
            <option value="visible"${displayMode === 'visible' ? ' selected' : ''}>${t('token.counter.display_mode_visible')} — ${t('token.counter.display_mode_visible_desc')}</option>
            <option value="silent"${displayMode === 'silent' ? ' selected' : ''}>${t('token.counter.display_mode_silent')} — ${t('token.counter.display_mode_silent_desc')}</option>
          </select>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-4);">
          <div class="field-group">
            <label>${t('token.counter.increment_mode_label')}</label>
            <select class="form-input" id="counter-increment-mode">
              <option value="always"${incrementMode === 'always' ? ' selected' : ''}>${t('token.counter.increment_mode_always')}</option>
              <option value="visible_only"${incrementMode === 'visible_only' ? ' selected' : ''}>${t('token.counter.increment_mode_visible_only')}</option>
            </select>
          </div>
          <div class="field-group">
            <label>${t('token.counter.scope_label')}</label>
            <select class="form-input" id="counter-scope">
              <option value="global"${scope === 'global' ? ' selected' : ''}>${t('token.counter.scope_global')} (${t('token.counter.scope_global_desc')})</option>
              <option value="site"${scope === 'site' ? ' selected' : ''}>${t('token.counter.scope_site')} (${t('token.counter.scope_site_desc')})</option>
            </select>
          </div>
        </div>
      </div>
    `;

    this.startInput = this.body.querySelector('#counter-start') as HTMLInputElement;
    this.stepInput = this.body.querySelector('#counter-step') as HTMLInputElement;
    this.padInput = this.body.querySelector('#counter-pad') as HTMLInputElement;
    this.currentInput = this.body.querySelector('#counter-current') as HTMLInputElement;
    this.displayModeSelect = this.body.querySelector('#counter-display-mode') as HTMLSelectElement;
    this.incrementModeSelect = this.body.querySelector('#counter-increment-mode') as HTMLSelectElement;
    this.scopeSelect = this.body.querySelector('#counter-scope') as HTMLSelectElement;
  }

  protected onSave(): void {
    const start = parseFloat(this.startInput.value);
    const step = parseFloat(this.stepInput.value);
    const padVal = this.padInput.value.trim();
    const padLength = padVal ? parseInt(padVal, 10) : undefined;
    const currentVal = this.currentInput.value.trim();
    const current = currentVal ? parseFloat(currentVal) : start;

    if (isNaN(start)) {
      showToast(t('token.counter.invalid_start'), 'error');
      return;
    }

    if (isNaN(step) || step === 0) {
      showToast(t('token.counter.invalid_step'), 'error');
      return;
    }

    this.onSaveCallback({
      start,
      step,
      padLength: padLength && padLength > 0 ? padLength : undefined,
      current: isNaN(current) ? start : current,
      displayMode: this.displayModeSelect.value as 'visible' | 'silent',
      incrementMode: this.incrementModeSelect.value as 'always' | 'visible_only',
      scope: this.scopeSelect.value as 'global' | 'site',
    });
    this.close();
  }
}
