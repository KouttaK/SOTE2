/**
 * src/dashboard/components/tokens/modals/InputModal.ts
 */

import { BaseModal } from './BaseModal.js';
import type { Token } from '../../../../shared/types/index.js';
import { t } from '../../../../shared/i18n/index.js';

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
      <div class="field-group" style="margin-bottom:1rem">
        <label>${t('token.input.field_label')}</label>
        <input type="text" class="form-input" id="input-label" value="${label}" placeholder="${t('token.input.label_example')}">
      </div>
      <div class="field-group">
        <label>${t('token.input.placeholder_optional')}</label>
        <input type="text" class="form-input" id="input-placeholder" value="${placeholder}" placeholder="${t('token.input.placeholder_example')}">
      </div>
    `;

    this.labelInput = this.body.querySelector('#input-label') as HTMLInputElement;
    this.placeholderInput = this.body.querySelector('#input-placeholder') as HTMLInputElement;
  }

  protected onSave(): void {
    const label = this.labelInput.value.trim();
    const placeholder = this.placeholderInput.value.trim();
    if (!label) {
      alert(t('token.input.label_required_alert'));
      return;
    }
    this.onSaveCallback({ label, placeholder: placeholder || undefined });
    this.close();
  }
}
