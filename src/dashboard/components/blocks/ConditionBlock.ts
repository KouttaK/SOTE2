/**
 * src/dashboard/components/blocks/ConditionBlock.ts
 */

import type { ConditionBlock as IConditionBlock, ConditionRule } from '../../../shared/types/index.js';

const ICONS = {
  branch: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M80 104a24 24 0 1 0 0-48 24 24 0 1 0 0 48zm80-24c0 32.8-19.7 61-48 73.3v87.8c18.8-10.9 40.7-17.1 64-17.1h96c35.3 0 64-28.7 64-64v-6.7C307.7 141 288 112.8 288 80c0-44.2 35.8-80 80-80s80 35.8 80 80c0 32.8-19.7 61-48 73.3V160c0 70.7-57.3 128-128 128H176c-35.3 0-64 28.7-64 64v6.7c28.3 12.3 48 40.5 48 73.3c0 44.2-35.8 80-80 80s-80-35.8-80-80c0-32.8 19.7-61 48-73.3V352 153.3C19.7 141 0 112.8 0 80C0 35.8 35.8 0 80 0s80 35.8 80 80zm232 0a24 24 0 1 0 -48 0 24 24 0 1 0 48 0zM80 456a24 24 0 1 0 0-48 24 24 0 1 0 0 48z"/></svg>`,
  plus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z"/></svg>`,
  trash: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M170.5 51.6L151.5 80h145l-19-28.4c-1.5-2.2-4-3.6-6.7-3.6H177.1c-2.7 0-5.2 1.3-6.7 3.6zm147-26.6L354.2 80H368h48 8c13.3 0 24 10.7 24 24s-10.7 24-24 24h-8V432c0 44.2-35.8 80-80 80H112c-44.2 0-80-35.8-80-80V128H24c-13.3 0-24-10.7-24-24S10.7 80 24 80h8H80 93.8l36.7-55.1C140.9 9.4 158.4 0 177.1 0h93.7c18.7 0 36.2 9.4 46.6 24.9zM80 128V432c0 17.7 14.3 32 32 32H336c17.7 0 32-14.3 32-32V128H80zm80 64V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16zm80 0V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16zm80 0V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16z"/></svg>`,
};

export class ConditionBlock {
  private el: HTMLElement;
  public data: IConditionBlock;
  private onChange: () => void;
  private onRemove: () => void;

  constructor(data: IConditionBlock | undefined, onChange: () => void, onRemove: () => void) {
    this.data = data || { rules: [] };
    this.onChange = onChange;
    this.onRemove = onRemove;
    this.el = document.createElement('div');
    this.el.className = 'block-card';
    this.el.id = 'condition-block';
    this.render();
  }

  public getElement(): HTMLElement {
    return this.el;
  }

  public getData(): IConditionBlock {
    return this.data;
  }

  private render() {
    this.el.innerHTML = /* html */ `
      <div class="block-header">
        <div class="block-icon">${ICONS.branch}</div>
        <div class="block-title-wrap">
          <p class="block-step">Step 2</p>
          <h2 class="block-title">Condition: If context matches</h2>
        </div>
        <span class="block-badge">Filter</span>
        <button class="btn-remove-block" style="background:transparent; border:none; color:#737373; cursor:pointer;" title="Remove Condition">
          ${ICONS.trash}
        </button>
      </div>
      <div class="block-body" id="rules-container">
        <!-- Rules injected here -->
      </div>
    `;

    this.el.querySelector('.btn-remove-block')!.addEventListener('click', () => {
      if (confirm('Remove this condition block?')) {
        this.onRemove();
      }
    });

    this.renderRules();
  }

  private renderRules() {
    const container = this.el.querySelector('#rules-container')!;
    container.innerHTML = '';

    if (this.data.rules.length === 0) {
      // Add a default rule if empty just to show UI
      this.data.rules.push({
        type: 'domain',
        operator: 'contains',
        value: '',
        action: { format: 'plaintext', content: '', tokens: [] } // the action is ignored in visual, it uses Step 3
      });
      this.onChange();
    }

    this.data.rules.forEach((rule, idx) => {
      const row = document.createElement('div');
      row.style.marginBottom = '1rem';
      row.innerHTML = /* html */ `
        <label class="form-label">Condition Rule ${idx + 1}</label>
        <div class="input-wrap">
          <select class="rule-type input-field" style="width: 100px; background:#0a0a0a; color:#fff; border:1px solid #404040; padding:0.5rem; border-radius:0.5rem;">
            <option value="domain" ${rule.type === 'domain' ? 'selected' : ''}>Domain</option>
            <option value="time" ${rule.type === 'time' ? 'selected' : ''}>Time</option>
            <option value="weekday" ${rule.type === 'weekday' ? 'selected' : ''}>Weekday</option>
            <option value="date" ${rule.type === 'date' ? 'selected' : ''}>Date</option>
          </select>
          <select class="rule-operator input-field" style="width: 100px; background:#0a0a0a; color:#fff; border:1px solid #404040; padding:0.5rem; border-radius:0.5rem;">
            <option value="contains" ${rule.operator === 'contains' ? 'selected' : ''}>Contains</option>
            <option value="equals" ${rule.operator === 'equals' ? 'selected' : ''}>Equals</option>
            <option value="matches" ${rule.operator === 'matches' ? 'selected' : ''}>Matches</option>
          </select>
          <input type="text" class="rule-value input-field" value="${rule.value}" placeholder="e.g. gmail.com" style="flex:1;" />
          ${this.data.rules.length > 1 ? `<button class="btn-remove-rule" style="background:transparent; border:none; color:#ef4444; cursor:pointer;" title="Remove Rule">${ICONS.trash}</button>` : ''}
        </div>
      `;

      // Events
      row.querySelector('.rule-type')!.addEventListener('change', (e) => {
        rule.type = (e.target as HTMLSelectElement).value as any;
        this.onChange();
      });
      row.querySelector('.rule-operator')!.addEventListener('change', (e) => {
        rule.operator = (e.target as HTMLSelectElement).value as any;
        this.onChange();
      });
      row.querySelector('.rule-value')!.addEventListener('input', (e) => {
        rule.value = (e.target as HTMLInputElement).value;
        this.onChange();
      });
      const removeBtn = row.querySelector('.btn-remove-rule');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          this.data.rules.splice(idx, 1);
          this.renderRules();
          this.onChange();
        });
      }

      container.appendChild(row);
    });

    // Add rule button
    const addRuleBtn = document.createElement('button');
    addRuleBtn.innerHTML = `${ICONS.plus} Add Rule`;
    addRuleBtn.style.cssText = 'display:flex; align-items:center; gap:0.5rem; padding:0.5rem 0; color:#a3a3a3; background:transparent; border:none; cursor:pointer; font-size:0.75rem;';
    addRuleBtn.addEventListener('click', () => {
      this.data.rules.push({ type: 'domain', operator: 'contains', value: '', action: { format: 'plaintext', content: '', tokens: [] } });
      this.renderRules();
      this.onChange();
    });
    container.appendChild(addRuleBtn);

    // Else branch (visual only for now, since it maps to the same main action block currently or a second action block)
    const elseRow = document.createElement('div');
    elseRow.innerHTML = /* html */ `
      <div style="display:flex; align-items:center; gap:0.5rem; margin-top:1rem;">
        <div style="flex:1; height:1px; background:#262626;"></div>
        <button id="btn-add-else" style="display:flex; align-items:center; gap:0.5rem; padding:0.375rem 0.75rem; border-radius:0.5rem; border:1px dashed #404040; color:#737373; background:transparent; cursor:pointer; font-size:0.75rem;">
          ${ICONS.plus} Add Else Branch
        </button>
        <div style="flex:1; height:1px; background:#262626;"></div>
      </div>
    `;
    container.appendChild(elseRow);

    elseRow.querySelector('#btn-add-else')!.addEventListener('click', () => {
      alert('Else Branch functionality will render a secondary Action Block in a future update.');
    });
  }
}
