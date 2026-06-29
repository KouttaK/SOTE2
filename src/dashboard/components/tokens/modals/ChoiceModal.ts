/**
 * src/dashboard/components/tokens/modals/ChoiceModal.ts
 */

import { BaseModal } from './BaseModal.js';
import type { Token } from '../../../../shared/types/index.js';

export class ChoiceModal extends BaseModal {
  private options: string[];
  private onSaveCallback: (newConfig: { options: string[], label?: string }) => void;

  constructor(token: Token, onSave: (newConfig: { options: string[], label?: string }) => void) {
    super('Configure Choice');
    this.onSaveCallback = onSave;
    
    // Config defaults
    const config = token.config || {};
    this.options = (config.options as string[]) || ['Option 1', 'Option 2'];

    this.renderBody();
  }

  private renderBody() {
    this.body.innerHTML = `
      <div class="field-group">
        <label>Options (min 2, max 10)</label>
        <div class="choice-list" id="choice-list-container"></div>
        <button class="btn-add-choice">+ Add Option</button>
      </div>
    `;

    this.renderList();

    this.body.querySelector('.btn-add-choice')!.addEventListener('click', () => {
      if (this.options.length < 10) {
        this.options.push('');
        this.renderList();
      } else {
        alert('Max 10 options allowed.');
      }
    });
  }

  private renderList() {
    const listEl = this.body.querySelector('#choice-list-container')!;
    listEl.innerHTML = '';
    
    this.options.forEach((opt, index) => {
      const row = document.createElement('div');
      row.className = 'choice-item';
      
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-input';
      input.value = opt;
      input.placeholder = `Option ${index + 1}`;
      input.addEventListener('input', (e) => {
        this.options[index] = (e.target as HTMLInputElement).value;
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-icon';
      delBtn.innerHTML = '&times;';
      delBtn.style.color = '#ef4444';
      delBtn.style.fontSize = '1.25rem';
      delBtn.addEventListener('click', () => {
        if (this.options.length > 2) {
          this.options.splice(index, 1);
          this.renderList();
        } else {
          alert('Min 2 options required.');
        }
      });

      row.appendChild(input);
      row.appendChild(delBtn);
      listEl.appendChild(row);
    });
  }

  protected onSave(): void {
    const validOptions = this.options.map(o => o.trim()).filter(o => o.length > 0);
    if (validOptions.length < 2) {
      alert('Please provide at least 2 valid options.');
      return;
    }
    this.onSaveCallback({ options: validOptions });
    this.close();
  }
}
