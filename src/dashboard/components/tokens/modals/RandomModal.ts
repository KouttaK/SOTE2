/**
 * src/dashboard/components/tokens/modals/RandomModal.ts
 *
 * Configures a 'random' token: 2+ short phrases, each with a percentage
 * chance of being picked (always summing to 100% across the set) every
 * time the shortcut expands. Mirrors ChoiceModal's layout (options list +
 * per-option "insert variable" menu), but replaces the user-facing picker
 * with an automatic weighted pick — see tokenExpander.ts's 'random' case.
 */

import { BaseModal } from './BaseModal.js';
import type { RandomTokenOption, Token, Variable } from '../../../../shared/types/index.js';
import { t } from '../../../../shared/i18n/index.js';
import { storage } from '../../../../shared/storage/StorageService.js';
import { evenWeights, rebalanceWeights, removeAndRebalance } from '../../../../shared/utils/randomWeights.js';

const ICON_VARIABLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M448 80v48c0 44.2-100.3 80-224 80S0 172.2 0 128V80C0 35.8 100.3 0 224 0S448 35.8 448 80zM393.2 214.7c20.8-7.4 39.2-16.9 54.8-28.6V288c0 44.2-100.3 80-224 80S0 332.2 0 288V186.1c15.6 11.7 34 21.2 54.8 28.6C111.8 236.6 165 240 224 240s112.2-3.4 169.2-25.3zM0 346.1c15.6 11.7 34 21.2 54.8 28.6C111.8 396.6 165 400 224 400s112.2-3.4 169.2-25.3c20.8-7.4 39.2-16.9 54.8-28.6V432c0 44.2-100.3 80-224 80S0 476.2 0 432V346.1z"/></svg>`;

/** Escapes HTML-significant characters before interpolating user-controlled
 * strings (Global Variable keys/values) into innerHTML. */
function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export class RandomModal extends BaseModal {
  private options: RandomTokenOption[];
  private onSaveCallback: (newConfig: { options: RandomTokenOption[] }) => void;
  private openVarMenu: HTMLElement | null = null;
  private docMouseDownHandler: (e: MouseEvent) => void;

  constructor(token: Token, onSave: (newConfig: { options: RandomTokenOption[] }) => void) {
    super(t('token.modal.configure_random'));
    this.onSaveCallback = onSave;

    // Config defaults: two empty options splitting 50%/50%.
    const config = token.config || {};
    const savedOptions = config.options as RandomTokenOption[] | undefined;
    this.options = (savedOptions && savedOptions.length > 0)
      ? savedOptions.map((o) => ({ id: o.id || crypto.randomUUID(), text: o.text || '', weight: Number.isFinite(o.weight) ? o.weight : 0 }))
      : [
        { id: crypto.randomUUID(), text: '', weight: 50 },
        { id: crypto.randomUUID(), text: '', weight: 50 },
      ];

    // Closes whichever "insert variable" dropdown is open when the user
    // clicks anywhere outside of it (matches ChoiceModal's own pattern).
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
        <label>${t('token.random.options_label')}</label>
        <p class="text-sm text-gray" style="margin-bottom:0.5rem">${t('token.random.hint')}</p>
        <div class="choice-list" id="random-list-container"></div>
        <button class="btn-add-choice">+ ${t('token.random.add_option')}</button>
      </div>
    `;

    this.renderList();

    this.body.querySelector('.btn-add-choice')!.addEventListener('click', () => {
      const weights = evenWeights(this.options.length + 1);
      this.options.forEach((o, i) => { o.weight = weights[i]; });
      this.options.push({ id: crypto.randomUUID(), text: '', weight: weights[weights.length - 1] });
      this.renderList();
    });
  }

  /** Inserts `text` at the current caret position of `input`, keeping focus
   * and placing the caret right after the inserted text. */
  private insertAtCursor(input: HTMLInputElement, text: string, index: number) {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const newValue = input.value.slice(0, start) + text + input.value.slice(end);
    input.value = newValue;
    this.options[index].text = newValue;
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

  /** Updates every weight input's displayed value from `this.options`,
   * skipping whichever one currently has focus (so the number the user is
   * actively typing is never overwritten mid-edit). */
  private syncWeightInputs(listEl: Element) {
    listEl.querySelectorAll<HTMLInputElement>('.random-weight-input').forEach((input, i) => {
      if (document.activeElement === input) return;
      input.value = String(Math.round(this.options[i].weight));
    });
  }

  private renderList() {
    const listEl = this.body.querySelector('#random-list-container')!;
    listEl.innerHTML = '';

    this.options.forEach((opt, index) => {
      const row = document.createElement('div');
      row.className = 'choice-item random-option-item';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-input';
      input.value = opt.text;
      input.placeholder = t('token.random.option_placeholder', { n: index + 1 });
      input.addEventListener('input', (e) => {
        this.options[index].text = (e.target as HTMLInputElement).value;
      });

      const weightWrap = document.createElement('div');
      weightWrap.className = 'random-weight-wrap';
      weightWrap.innerHTML = `
        <input type="number" class="random-weight-input" min="0" max="100" step="1" value="${Math.round(opt.weight)}">
        <span class="random-weight-pct">%</span>
      `;
      const weightInput = weightWrap.querySelector('input') as HTMLInputElement;
      weightInput.addEventListener('input', () => {
        const raw = parseFloat(weightInput.value);
        const newWeight = Number.isFinite(raw) ? raw : 0;
        const weights = this.options.map((o) => o.weight);
        const rebalanced = rebalanceWeights(weights, index, newWeight);
        this.options.forEach((o, i) => { o.weight = rebalanced[i]; });
        this.syncWeightInputs(listEl);
      });

      // Wrapper so the dropdown can float under the button without
      // disturbing the row's flex layout.
      const varWrap = document.createElement('div');
      varWrap.className = 'choice-var-wrap';

      const varBtn = document.createElement('button');
      varBtn.type = 'button';
      varBtn.className = 'btn-icon';
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
      delBtn.className = 'btn-icon';
      delBtn.innerHTML = '&times;';
      delBtn.style.color = '#ef4444';
      delBtn.style.fontSize = '1.25rem';
      delBtn.addEventListener('click', () => {
        if (this.options.length > 2) {
          const weights = this.options.map((o) => o.weight);
          const rebalanced = removeAndRebalance(weights, index);
          this.options.splice(index, 1);
          this.options.forEach((o, i) => { o.weight = rebalanced[i]; });
          this.renderList();
        } else {
          alert(t('token.random.min_options_alert'));
        }
      });

      row.appendChild(input);
      row.appendChild(weightWrap);
      row.appendChild(varWrap);
      row.appendChild(delBtn);
      listEl.appendChild(row);
    });
  }

  protected onSave(): void {
    const validOptions = this.options.filter((o) => o.text.trim().length > 0);
    if (validOptions.length < 2) {
      alert(t('token.random.min_valid_alert'));
      return;
    }
    // Re-normalize weights across just the valid (non-empty) options, in
    // case an empty placeholder row was carrying a chunk of the 100%.
    const total = validOptions.reduce((s, o) => s + Math.max(0, o.weight), 0);
    const normalized = total > 0
      ? validOptions.map((o) => Math.round((Math.max(0, o.weight) / total) * 100))
      : evenWeights(validOptions.length);
    // Fix any rounding drift so the saved set always sums to exactly 100.
    const drift = 100 - normalized.reduce((s, w) => s + w, 0);
    if (drift !== 0) normalized[0] += drift;

    const finalOptions = validOptions.map((o, i) => ({ id: o.id, text: o.text.trim(), weight: normalized[i] }));
    this.onSaveCallback({ options: finalOptions });
    this.close();
  }
}
