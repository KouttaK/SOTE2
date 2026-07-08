/**
 * src/dashboard/components/tokens/modals/ClipboardModal.ts
 */

import { BaseModal } from './BaseModal.js';
import type { Token } from '../../../../shared/types/index.js';
import { t } from '../../../../shared/i18n/index.js';

export class ClipboardModal extends BaseModal {
  private onSaveCallback: (newConfig: { index: number }) => void;
  private inputEl!: HTMLInputElement;

  constructor(token: Token, onSave: (newConfig: { index: number }) => void) {
    super(t('token.modal.configure_clipboard'));
    this.onSaveCallback = onSave;
    
    const config = token.config || {};
    const index = (config.index as number) || 1;

    this.body.innerHTML = `
      <div class="field-group">
        <label>${t('token.clipboard.index_label')}</label>
        <p class="text-sm text-gray" style="margin-bottom:0.5rem">${t('token.clipboard.index_hint')}</p>
        <input type="number" min="1" max="50" class="form-input" id="clipboard-index" value="${index}">
      </div>
    `;

    this.inputEl = this.body.querySelector('#clipboard-index') as HTMLInputElement;
  }

  protected onSave(): void {
    const val = parseInt(this.inputEl.value, 10);
    if (isNaN(val) || val < 1) {
      alert(t('token.clipboard.invalid_alert'));
      return;
    }
    this.onSaveCallback({ index: val });
    this.close();
  }
}
