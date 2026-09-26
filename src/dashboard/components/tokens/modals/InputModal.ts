/**
 * src/dashboard/components/tokens/modals/InputModal.ts
 */

import { BaseModal } from './BaseModal.js';
import type { Token } from '../../../../shared/types/index.js';
import { t } from '../../../../shared/i18n/index.js';
import { escapeHtml } from '../../../../shared/utils/dom.js';
import { showToast } from '../../../../shared/components/Toast.js';

export class InputModal extends BaseModal {
  private onSaveCallback: (newConfig: { label: string, placeholder?: string }) => void;
  private labelInput!: HTMLInputElement;
  private placeholderInput!: HTMLInputElement;

  constructor(token: Token, onSave: (newConfig: { label: string, placeholder?: string }) => void) {
    super(t('token.modal.configure_input'));
    this.onSaveCallback = onSave;
    
    const config = token.config || {};
    const label = (config.label as string) || '';
    const placeholder = (config.placeholder as string) || '';

    this.body.innerHTML = `
      <div style="display:flex; flex-direction:column; gap: var(--spacing-5)">
        <div class="field-group">
          <label>${t('token.input.field_label')}</label>
          <input type="text" class="form-input" id="input-label" value="${escapeHtml(label)}" placeholder="${t('token.input.label_example')}">
          <p class="field-hint">${t('token.input.field_hint')}</p>
        </div>
        <div class="field-group">
          <div class="field-label-row">
            <label>${t('token.input.placeholder_field')}</label>
            <span class="field-optional-badge">${t('common.optional')}</span>
          </div>
          <input type="text" class="form-input" id="input-placeholder" value="${escapeHtml(placeholder)}" placeholder="${t('token.input.placeholder_example')}">
          <p class="field-hint">${t('token.input.placeholder_hint')}</p>
        </div>
      </div>
    `;

    this.labelInput = this.body.querySelector('#input-label') as HTMLInputElement;
    this.placeholderInput = this.body.querySelector('#input-placeholder') as HTMLInputElement;
  }

  protected onSave(): void {
    const label = this.labelInput.value.trim();
    const placeholder = this.placeholderInput.value.trim();
    if (!label) {
      showToast(t('token.input.label_required_alert'), 'error');
      return;
    }
    this.onSaveCallback({ label, placeholder: placeholder || undefined });
    this.close();
  }
}
