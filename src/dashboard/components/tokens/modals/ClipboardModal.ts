/**
 * src/dashboard/components/tokens/modals/ClipboardModal.ts
 */

import { BaseModal } from './BaseModal.js';
import type { Token } from '../../../../shared/types/index.js';

export class ClipboardModal extends BaseModal {
  private onSaveCallback: (newConfig: { index: number }) => void;
  private inputEl!: HTMLInputElement;

  constructor(token: Token, onSave: (newConfig: { index: number }) => void) {
    super('Configure Clipboard');
    this.onSaveCallback = onSave;
    
    const config = token.config || {};
    const index = (config.index as number) || 1;

    this.body.innerHTML = `
      <div class="field-group">
        <label>Clipboard History Index</label>
        <p class="text-sm text-gray" style="margin-bottom:0.5rem">1 = Most recent item, 2 = Second most recent, etc.</p>
        <input type="number" min="1" max="50" class="form-input" id="clipboard-index" value="${index}">
      </div>
    `;

    this.inputEl = this.body.querySelector('#clipboard-index') as HTMLInputElement;
  }

  protected onSave(): void {
    const val = parseInt(this.inputEl.value, 10);
    if (isNaN(val) || val < 1) {
      alert('Please enter a valid positive number.');
      return;
    }
    this.onSaveCallback({ index: val });
    this.close();
  }
}
