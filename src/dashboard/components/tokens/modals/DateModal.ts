/**
 * src/dashboard/components/tokens/modals/DateModal.ts
 */

import { BaseModal } from './BaseModal.js';
import type { Token } from '../../../../shared/types/index.js';

export class DateModal extends BaseModal {
  private onSaveCallback: (newConfig: { format: string }) => void;
  private inputEl!: HTMLInputElement;

  constructor(token: Token, onSave: (newConfig: { format: string }) => void) {
    super('Configure Date/Time');
    this.onSaveCallback = onSave;
    
    const config = token.config || {};
    const format = (config.format as string) || 'DD/MM/YYYY';

    this.body.innerHTML = `
      <div class="field-group">
        <label>Date Format</label>
        <p class="text-sm text-gray" style="margin-bottom:0.5rem">
          Available tokens: DD, MM, YYYY, HH, mm, ss<br>
          Examples: <code>DD/MM/YYYY</code> or <code>YYYY-MM-DD HH:mm</code>
        </p>
        <input type="text" class="form-input" id="date-format" value="${format}">
      </div>
    `;

    this.inputEl = this.body.querySelector('#date-format') as HTMLInputElement;
  }

  protected onSave(): void {
    const format = this.inputEl.value.trim();
    if (!format) {
      alert('Format cannot be empty.');
      return;
    }
    this.onSaveCallback({ format });
    this.close();
  }
}
