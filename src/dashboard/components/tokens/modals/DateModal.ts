/**
 * src/dashboard/components/tokens/modals/DateModal.ts
 */

import { BaseModal } from './BaseModal.js';
import type { Token } from '../../../../shared/types/index.js';
import { t } from '../../../../shared/i18n/index.js';
import { escapeHtml } from '../../../../shared/utils/dom.js';
import { formatDate } from '../../../../shared/utils/formatDate.js';
import { showToast } from '../../../../shared/components/Toast.js';

const ICON_INFO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"/></svg>`;

const PRESETS = ['DD/MM/YYYY', 'YYYY-MM-DD HH:mm'];

export class DateModal extends BaseModal {
  private onSaveCallback: (newConfig: { format: string }) => void;
  private inputEl!: HTMLInputElement;
  private previewEl!: HTMLElement;

  constructor(token: Token, onSave: (newConfig: { format: string }) => void) {
    super(t('token.modal.configure_date'));
    this.onSaveCallback = onSave;

    const config = token.config || {};
    const format = (config.format as string) || 'DD/MM/YYYY';

    const tokenRefItem = (code: string, desc: string, isTime = false) => /* html */ `
      <div class="token-reference-item${isTime ? ' is-time' : ''}">
        <code>${code}</code>
        <span>${desc}</span>
      </div>
    `;

    this.body.innerHTML = `
      <div class="field-group">
        <label>${t('token.date.output_format_label')}</label>
        <div class="date-format-wrap">
          <input type="text" class="form-input date-format-input" id="date-format" value="${escapeHtml(format)}">
          <span class="date-format-preview" id="date-format-preview"></span>
        </div>

        <div class="token-reference-box">
          <p class="token-reference-title">${ICON_INFO}${t('token.date.tokens_available_title')}</p>
          <div class="token-reference-grid">
            ${tokenRefItem('DD', t('token.date.token_day'))}
            ${tokenRefItem('MM', t('token.date.token_month'))}
            ${tokenRefItem('YYYY', t('token.date.token_year'))}
            ${tokenRefItem('HH', t('token.date.token_hour'), true)}
            ${tokenRefItem('mm', t('token.date.token_minute'), true)}
            ${tokenRefItem('ss', t('token.date.token_second'), true)}
          </div>
        </div>
      </div>

      <div class="date-preset-grid">
        ${PRESETS.map(p => `<button type="button" class="date-preset-btn" data-preset="${escapeHtml(p)}">${escapeHtml(p)}</button>`).join('')}
      </div>
    `;

    this.inputEl = this.body.querySelector('#date-format') as HTMLInputElement;
    this.previewEl = this.body.querySelector('#date-format-preview') as HTMLElement;

    const updatePreview = () => {
      // The now-live preview reuses the exact same formatDate() the
      // runtime uses to expand {date} tokens (shared/utils/formatDate.ts)
      // — no risk of the preview drifting out of sync with what actually
      // gets typed. An unrecognized/empty format still round-trips
      // through formatDate() harmlessly (unmatched tokens are just left
      // as-is), so there's no separate error state to handle here.
      const preview = formatDate(new Date(), this.inputEl.value || '');
      this.previewEl.textContent = preview ? `${t('token.date.preview_label')}: ${preview}` : '';
    };
    this.inputEl.addEventListener('input', updatePreview);
    updatePreview();

    this.body.querySelectorAll<HTMLButtonElement>('.date-preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.inputEl.value = btn.dataset.preset || '';
        updatePreview();
        this.inputEl.focus();
      });
    });
  }

  protected onSave(): void {
    const format = this.inputEl.value.trim();
    if (!format) {
      showToast(t('token.date.format_required_alert'), 'error');
      return;
    }
    this.onSaveCallback({ format });
    this.close();
  }
}

