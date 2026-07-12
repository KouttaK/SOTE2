/**
 * src/dashboard/components/tokens/modals/DateModal.ts
 */

import { BaseModal } from './BaseModal.js';
import type { Token } from '../../../../shared/types/index.js';
import { t } from '../../../../shared/i18n/index.js';

/** Escapes HTML-significant characters before interpolating an existing
 * (user-typed) config value into an innerHTML attribute. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class DateModal extends BaseModal {
  private onSaveCallback: (newConfig: { format: string }) => void;
  private inputEl!: HTMLInputElement;

  constructor(token: Token, onSave: (newConfig: { format: string }) => void) {
    super(t('token.modal.configure_date'));
    this.onSaveCallback = onSave;
    
    const config = token.config || {};
    const format = (config.format as string) || 'DD/MM/YYYY';

    this.body.innerHTML = `
      <div class="field-group">
        <label>${t('token.date.format_label')}</label>
        <p class="text-sm text-gray" style="margin-bottom:0.5rem">
          ${t('token.date.format_available')}<br>
          ${t('token.date.format_examples')} <code>DD/MM/YYYY</code> ${t('common.or')} <code>YYYY-MM-DD HH:mm</code>
        </p>
        <input type="text" class="form-input" id="date-format" value="${escapeHtml(format)}">
      </div>
    `;

    this.inputEl = this.body.querySelector('#date-format') as HTMLInputElement;
  }

  protected onSave(): void {
    const format = this.inputEl.value.trim();
    if (!format) {
      alert(t('token.date.format_required_alert'));
      return;
    }
    this.onSaveCallback({ format });
    this.close();
  }
}
