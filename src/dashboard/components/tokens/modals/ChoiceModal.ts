/**
 * src/dashboard/components/tokens/modals/ChoiceModal.ts
 */

import { BaseModal } from './BaseModal.js';
import type { Token, Variable } from '../../../../shared/types/index.js';
import { t } from '../../../../shared/i18n/index.js';
import { storage } from '../../../../shared/storage/StorageService.js';
import { escapeHtml } from '../../../../shared/utils/dom.js';
import { showToast } from '../../../../shared/components/Toast.js';

const ICON_VARIABLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M448 80v48c0 44.2-100.3 80-224 80S0 172.2 0 128V80C0 35.8 100.3 0 224 0S448 35.8 448 80zM393.2 214.7c20.8-7.4 39.2-16.9 54.8-28.6V288c0 44.2-100.3 80-224 80S0 332.2 0 288V186.1c15.6 11.7 34 21.2 54.8 28.6C111.8 236.6 165 240 224 240s112.2-3.4 169.2-25.3zM0 346.1c15.6 11.7 34 21.2 54.8 28.6C111.8 396.6 165 400 224 400s112.2-3.4 169.2-25.3c20.8-7.4 39.2-16.9 54.8-28.6V432c0 44.2-100.3 80-224 80S0 476.2 0 432V346.1z"/></svg>`;
const ICON_TRASH = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M135.2 17.7C140.6 6.8 151.7 0 163.8 0H284.2c12.1 0 23.2 6.8 28.6 17.7L320 32h96c17.7 0 32 14.3 32 32s-14.3 32-32 32H32C14.3 96 0 81.7 0 64S14.3 32 32 32h96l7.2-14.3zM32 128H416V448c0 35.3-28.7 64-64 64H96c-35.3 0-64-28.7-64-64V128zm96 64c-8.8 0-16 7.2-16 16V416c0 8.8 7.2 16 16 16s16-7.2 16-16V208c0-8.8-7.2-16-16-16zm96 0c-8.8 0-16 7.2-16 16V416c0 8.8 7.2 16 16 16s16-7.2 16-16V208c0-8.8-7.2-16-16-16zm96 0c-8.8 0-16 7.2-16 16V416c0 8.8 7.2 16 16 16s16-7.2 16-16V208c0-8.8-7.2-16-16-16z"/></svg>`;

export class ChoiceModal extends BaseModal {
  private options: string[];
  private onSaveCallback: (newConfig: { options: string[], label?: string }) => void;
  private openVarMenu: HTMLElement | null = null;
  private docMouseDownHandler: (e: MouseEvent) => void;

  constructor(token: Token, onSave: (newConfig: { options: string[], label?: string }) => void) {
    super(t('token.modal.configure_choice'));
    this.onSaveCallback = onSave;
    
    // Config defaults
    const config = token.config || {};
    this.options = (config.options as string[]) || [t('token.choice.option_placeholder', { n: 1 }), t('token.choice.option_placeholder', { n: 2 })];

    // Closes whichever "insert variable" dropdown is open when the user
    // clicks anywhere outside of it (matches the pattern used by
    // ActionBlock's own variable menu).
    this.docMouseDownHandler = (e: MouseEvent) => {
      if (this.openVarMenu && !this.openVarMenu.contains(e.target as Node)) {
        this.closeVarMenu();
      }
    };
    document.addEventListener('mousedown', this.docMouseDownHandler);

    this.renderBody();
  }

  public close() {
    document.removeEventListener('mousedown', this.docMouseDownHandler);
    super.close();
  }

  private closeVarMenu() {
    if (this.openVarMenu) {
      this.openVarMenu.style.display = 'none';
      this.openVarMenu = null;
    }
  }

  private renderBody() {
    this.body.innerHTML = `
      <div class="field-group">
        <label>${t('token.choice.options_label')}</label>
        <p class="text-sm text-gray" style="margin-bottom:0.5rem">${t('token.choice.variable_hint')}</p>
        <div class="choice-list" id="choice-list-container"></div>
        <button class="btn-add-choice">+ ${t('token.choice.add_option')}</button>
      </div>
    `;

    this.renderList();

    this.body.querySelector('.btn-add-choice')!.addEventListener('click', () => {
      if (this.options.length < 10) {
        this.options.push('');
        this.renderList();
      } else {
        showToast(t('token.choice.max_options_alert'), 'error');
      }
    });
  }

  /** Inserts `text` at the current caret position of `input`, keeping focus
   * and placing the caret right after the inserted text. */
  private insertAtCursor(input: HTMLInputElement, text: string, index: number) {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const newValue = input.value.slice(0, start) + text + input.value.slice(end);
    input.value = newValue;
    this.options[index] = newValue;
    const newPos = start + text.length;
    input.focus();
    input.setSelectionRange(newPos, newPos);
  }

  /** Fetches Global Variables fresh (so one created moments ago on the
   * Variables page shows up immediately) and (re)renders the dropdown for
   * one option row's "insert variable" button, then opens it. */
  private async openVariableMenuFor(menu: HTMLElement, input: HTMLInputElement, index: number) {
    const variables: Variable[] = await storage.getVariables();

    menu.innerHTML = variables.length
      ? variables.map((v) => /* html */ `
          <button type="button" class="choice-var-menu-item" data-key="${escapeHtml(v.key)}">
            <span class="choice-var-menu-key">{{${escapeHtml(v.key)}}}</span>
            <span class="choice-var-menu-value">${escapeHtml((v.value || '').slice(0, 30))}</span>
          </button>
        `).join('')
      : `<p class="choice-var-menu-empty">${t('variable.none_title')}</p>`;

    menu.querySelectorAll<HTMLElement>('.choice-var-menu-item').forEach((item) => {
      item.addEventListener('mousedown', (e) => {
        e.preventDefault(); // keep the input's caret position/focus intact
        const key = item.dataset.key!;
        this.insertAtCursor(input, `{{${key}}}`, index);
        this.closeVarMenu();
      });
    });

    this.closeVarMenu();
    menu.style.display = 'block';
    this.openVarMenu = menu;
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
      input.placeholder = t('token.choice.option_placeholder', { n: index + 1 });
      input.addEventListener('input', (e) => {
        this.options[index] = (e.target as HTMLInputElement).value;
      });

      // Wrapper so the dropdown can float under the button without
      // disturbing the row's flex layout.
      const varWrap = document.createElement('div');
      varWrap.className = 'choice-var-wrap';

      const varBtn = document.createElement('button');
      varBtn.type = 'button';
      varBtn.className = 'btn-icon btn-icon-variable';
      varBtn.innerHTML = ICON_VARIABLE;
      varBtn.title = t('variable.insert_title');

      const varMenu = document.createElement('div');
      varMenu.className = 'choice-var-menu';
      varMenu.style.display = 'none';

      varBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.openVarMenu === varMenu) {
          this.closeVarMenu();
        } else {
          this.openVariableMenuFor(varMenu, input, index);
        }
      });

      varWrap.appendChild(varBtn);
      varWrap.appendChild(varMenu);

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-icon btn-icon-danger';
      delBtn.innerHTML = ICON_TRASH;
      delBtn.title = t('common.remove');
      delBtn.addEventListener('click', () => {
        if (this.options.length > 2) {
          this.options.splice(index, 1);
          this.renderList();
        } else {
          showToast(t('token.choice.min_options_alert'), 'error');
        }
      });

      row.appendChild(input);
      row.appendChild(varWrap);
      row.appendChild(delBtn);
      listEl.appendChild(row);
    });
  }

  protected onSave(): void {
    const validOptions = this.options.map(o => o.trim()).filter(o => o.length > 0);
    if (validOptions.length < 2) {
      showToast(t('token.choice.min_valid_alert'), 'error');
      return;
    }
    this.onSaveCallback({ options: validOptions });
    this.close();
  }
}
