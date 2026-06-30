/**
 * src/dashboard/components/blocks/ConditionBlock.ts
 *
 * Bugs fixed:
 *   Bug 9  — Add Rule / Add Else styled with CSS classes
 *   Bug 10 — Time: select operator (between/before/after) + dynamic fields
 *   Bug 11 — Weekday: select operator (is/is_not) + day buttons
 *   Bug 12 — Date: simple date picker only
 *   Bug 13 — Remove block button styled + functional
 */

import type { ConditionBlock as IConditionBlock, ConditionRule } from '../../../shared/types/index.js';
import { ActionBlock } from './ActionBlock.js';

const ICONS = {
  branch: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M80 104a24 24 0 1 0 0-48 24 24 0 1 0 0 48zm80-24c0 32.8-19.7 61-48 73.3v87.8c18.8-10.9 40.7-17.1 64-17.1h96c35.3 0 64-28.7 64-64v-6.7C307.7 141 288 112.8 288 80c0-44.2 35.8-80 80-80s80 35.8 80 80c0 32.8-19.7 61-48 73.3V160c0 70.7-57.3 128-128 128H176c-35.3 0-64 28.7-64 64v6.7c28.3 12.3 48 40.5 48 73.3c0 44.2-35.8 80-80 80s-80-35.8-80-80c0-32.8 19.7-61 48-73.3V352 153.3C19.7 141 0 112.8 0 80C0 35.8 35.8 0 80 0s80 35.8 80 80zm232 0a24 24 0 1 0 -48 0 24 24 0 1 0 48 0zM80 456a24 24 0 1 0 0-48 24 24 0 1 0 0 48z"/></svg>`,
  plus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z"/></svg>`,
  trash: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M170.5 51.6L151.5 80h145l-19-28.4c-1.5-2.2-4-3.6-6.7-3.6H177.1c-2.7 0-5.2 1.3-6.7 3.6zm147-26.6L354.2 80H368h48 8c13.3 0 24 10.7 24 24s-10.7 24-24 24h-8V432c0 44.2-35.8 80-80 80H112c-44.2 0-80-35.8-80-80V128H24c-13.3 0-24-10.7-24-24S10.7 80 24 80h8H80 93.8l36.7-55.1C140.9 9.4 158.4 0 177.1 0h93.7c18.7 0 36.2 9.4 46.6 24.9zM80 128V432c0 17.7 14.3 32 32 32H336c17.7 0 32-14.3 32-32V128H80zm80 64V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16zm80 0V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16zm80 0V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16z"/></svg>`,
  xmark: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></svg>`,
};

// CSS injected once into document
const COND_BLOCK_CSS = `
.btn-remove-block {
  margin-left: auto;
  background: transparent;
  border: none;
  color: #737373;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.375rem;
  display: flex;
  align-items: center;
  transition: color 0.15s, background 0.15s;
}
.btn-remove-block:hover { color: #ef4444; background: rgba(239,68,68,.1); }
.btn-remove-block svg { width: 16px; height: 16px; }

.btn-add-rule {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0;
  background: transparent;
  border: none;
  color: #737373;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: color 0.15s;
  font-family: inherit;
}
.btn-add-rule:hover { color: #d4d4d4; }
.btn-add-rule svg { width: 14px; height: 14px; }

.btn-add-else {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: transparent;
  border: 1px dashed #404040;
  border-radius: 0.5rem;
  color: #737373;
  font-size: 0.75rem;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
  font-family: inherit;
}
.btn-add-else:hover { border-color: #7c3aed; color: #7c3aed; }
.btn-add-else svg { width: 12px; height: 12px; }

.else-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.75rem;
}
.else-row::before, .else-row::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #262626;
}

.day-buttons { display: flex; gap: 0.375rem; flex-wrap: wrap; margin-top: 0.5rem; }
.day-btn {
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  border: 1px solid #404040;
  background: transparent;
  color: #737373;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}
.day-btn.active { background: #7c3aed; border-color: #7c3aed; color: #fff; }

.condition-col { display: flex; flex-direction: column; gap: 0.375rem; }
.condition-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.condition-label { font-size: 0.8125rem; color: #a3a3a3; white-space: nowrap; }
`;

let condStylesInjected = false;
function injectCondStyles() {
  if (condStylesInjected) return;
  const style = document.createElement('style');
  style.textContent = COND_BLOCK_CSS;
  document.head.appendChild(style);
  condStylesInjected = true;
}

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
    injectCondStyles();
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
        <button class="btn-remove-block" title="Remove Condition Block">
          ${ICONS.xmark}
        </button>
      </div>
      <div class="block-body" id="rules-container">
        <!-- Rules injected here -->
      </div>
    `;

    this.el.querySelector('.btn-remove-block')!.addEventListener('click', () => {
      if (confirm('Remover este bloco de condição?')) {
        this.onRemove();
      }
    });

    this.renderRules();
  }

  private renderRules() {
    const container = this.el.querySelector('#rules-container')!;
    container.innerHTML = '';

    if (this.data.rules.length === 0) {
      this.data.rules.push({
        type: 'domain',
        operator: 'contains',
        value: '',
        action: { format: 'plaintext', content: '', tokens: [] }
      });
      this.onChange();
    }

    this.data.rules.forEach((rule, idx) => {
      const row = document.createElement('div');
      row.style.marginBottom = '1rem';

      row.innerHTML = /* html */ `
        <label class="form-label">${idx === 0 ? 'Se (If)' : 'Senão Se (Else If)'}</label>
        <div style="display:flex; align-items:flex-start; gap:0.5rem; flex-wrap:wrap;">
          <select class="rule-type input-field" style="width:110px; background:#0a0a0a; color:#fff; border:1px solid #404040; padding:0.5rem; border-radius:0.5rem;">
            <option value="domain"  ${rule.type === 'domain'  ? 'selected' : ''}>Domínio</option>
            <option value="time"    ${rule.type === 'time'    ? 'selected' : ''}>Horário</option>
            <option value="weekday" ${rule.type === 'weekday' ? 'selected' : ''}>Dia da Semana</option>
            <option value="date"    ${rule.type === 'date'    ? 'selected' : ''}>Data</option>
          </select>
          <div class="rule-value-container" style="flex:1; min-width:0;"></div>
          ${this.data.rules.length > 1 ? `<button class="btn-remove-rule" style="background:transparent;border:none;color:#ef4444;cursor:pointer;padding:0.25rem;display:flex;align-items:center;flex-shrink:0;" title="Remover Regra">${ICONS.trash}</button>` : ''}
        </div>
      `;

      const valueContainer = row.querySelector('.rule-value-container') as HTMLElement;
      this.renderValueInput(rule, valueContainer);

      row.querySelector('.rule-type')!.addEventListener('change', (e) => {
        rule.type = (e.target as HTMLSelectElement).value as any;
        rule.value = '';
        this.renderValueInput(rule, valueContainer);
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

    // Bug 9: Add Rule — styled
    const addRuleBtn = document.createElement('button');
    addRuleBtn.className = 'btn-add-rule';
    addRuleBtn.innerHTML = `${ICONS.plus} ${this.data.rules.length > 0 ? 'Adicionar Senão Se' : 'Adicionar Regra'}`;
    addRuleBtn.addEventListener('click', () => {
      this.data.rules.push({ type: 'domain', operator: 'contains', value: '', action: { format: 'plaintext', content: '', tokens: [] } });
      this.renderRules();
      this.onChange();
    });
    container.appendChild(addRuleBtn);

    // Bug 9: Add Else Branch — styled
    const elseRow = document.createElement('div');
    elseRow.className = 'else-row';
    
    if (!this.data.elseBranch) {
      elseRow.innerHTML = `
        <button class="btn-add-else">
          ${ICONS.plus} Adicionar Else (Senão)
        </button>
      `;
      elseRow.querySelector('.btn-add-else')!.addEventListener('click', () => {
        this.data.elseBranch = { format: 'plaintext', content: '', tokens: [] };
        this.renderRules();
        this.onChange();
      });
      container.appendChild(elseRow);
    } else {
      elseRow.innerHTML = `
        <div style="flex: 1; margin-top: 1rem; position: relative;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <label class="form-label" style="margin: 0;">Senão (Else)</label>
            <button class="btn-remove-rule" style="background:transparent;border:none;color:#ef4444;cursor:pointer;padding:0.25rem;display:flex;align-items:center;" title="Remover Else">
              ${ICONS.trash} Remover Else
            </button>
          </div>
          <div id="else-action-container"></div>
        </div>
      `;
      elseRow.querySelector('.btn-remove-rule')!.addEventListener('click', () => {
        if (confirm('Remover o Senão (Else)?')) {
          this.data.elseBranch = undefined;
          this.renderRules();
          this.onChange();
        }
      });
      
      container.appendChild(elseRow);
      
      const elseActionContainer = elseRow.querySelector('#else-action-container')!;
      const actionBlockInst = new ActionBlock(this.data.elseBranch, () => {
        this.data.elseBranch = actionBlockInst.getData();
        this.onChange();
      });
      
      const actionEl = actionBlockInst.getElement();
      const header = actionEl.querySelector('.block-header');
      if (header) header.remove();
      actionEl.style.border = 'none';
      actionEl.style.padding = '0';
      
      elseActionContainer.appendChild(actionEl);
    }
  }

  private renderValueInput(rule: ConditionRule, container: HTMLElement) {
    container.innerHTML = '';

    if (rule.type === 'domain') {
      this.renderDomainInputs(rule, container);
    } else if (rule.type === 'time') {
      this.renderTimeInputs(rule, container);
    } else if (rule.type === 'weekday') {
      this.renderWeekdayInputs(rule, container);
    } else if (rule.type === 'date') {
      this.renderDateInputs(rule, container);
    }
  }

  private renderDomainInputs(rule: ConditionRule, container: HTMLElement) {
    const wrap = document.createElement('div');
    wrap.className = 'condition-row';
    wrap.innerHTML = `
      <select class="rule-operator input-field" style="width:110px; background:#0a0a0a; color:#fff; border:1px solid #404040; padding:0.5rem; border-radius:0.5rem;">
        <option value="contains" ${rule.operator === 'contains' ? 'selected' : ''}>Contém</option>
        <option value="equals"   ${rule.operator === 'equals'   ? 'selected' : ''}>Igual</option>
        <option value="matches"  ${rule.operator === 'matches'  ? 'selected' : ''}>Corresponde</option>
      </select>
      <input type="text" class="rule-value input-field" value="${rule.value || ''}" placeholder="ex: gmail.com" style="flex:1; background:#0a0a0a; color:#fff; border:1px solid #404040; padding:0.5rem; border-radius:0.5rem;" />
    `;
    container.appendChild(wrap);

    wrap.querySelector('.rule-operator')!.addEventListener('change', (e) => {
      rule.operator = (e.target as HTMLSelectElement).value as any;
      this.onChange();
    });
    wrap.querySelector('.rule-value')!.addEventListener('input', (e) => {
      rule.value = (e.target as HTMLInputElement).value;
      this.onChange();
    });
  }

  // Bug 10: TIME — operator select + dynamic fields
  private renderTimeInputs(rule: ConditionRule, container: HTMLElement) {
    let parsed: { op: string; from?: string; to?: string; at?: string } = { op: 'between' };
    try { parsed = JSON.parse(rule.value || '{}'); } catch { /* */ }
    if (!parsed.op) parsed.op = 'between';

    const wrap = document.createElement('div');
    wrap.className = 'condition-col';
    wrap.innerHTML = `
      <div class="condition-row">
        <select class="time-op-select input-field" style="width:130px; background:#0a0a0a; color:#fff; border:1px solid #404040; padding:0.5rem; border-radius:0.5rem;">
          <option value="between" ${parsed.op === 'between' ? 'selected' : ''}>Entre</option>
          <option value="before"  ${parsed.op === 'before'  ? 'selected' : ''}>Antes de</option>
          <option value="after"   ${parsed.op === 'after'   ? 'selected' : ''}>Após</option>
        </select>
        <div class="time-fields" style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;"></div>
      </div>
    `;
    container.appendChild(wrap);

    const select = wrap.querySelector('.time-op-select') as HTMLSelectElement;
    const timeFields = wrap.querySelector('.time-fields') as HTMLElement;

    const save = () => {
      const op = select.value;
      if (op === 'between') {
        const from = (timeFields.querySelector('.time-from') as HTMLInputElement)?.value || '';
        const to   = (timeFields.querySelector('.time-to')   as HTMLInputElement)?.value || '';
        rule.value = JSON.stringify({ op, from, to });
      } else {
        const at = (timeFields.querySelector('.time-at') as HTMLInputElement)?.value || '';
        rule.value = JSON.stringify({ op, at });
      }
      this.onChange();
    };

    const renderTimeFields = (op: string) => {
      if (op === 'between') {
        timeFields.innerHTML = `
          <span class="condition-label">de</span>
          <input type="time" class="time-from input-field" value="${parsed.from || '08:00'}" style="width:100px; background:#0a0a0a; color:#fff; border:1px solid #404040; padding:0.5rem; border-radius:0.5rem;">
          <span class="condition-label">e</span>
          <input type="time" class="time-to input-field" value="${parsed.to || '18:00'}" style="width:100px; background:#0a0a0a; color:#fff; border:1px solid #404040; padding:0.5rem; border-radius:0.5rem;">
        `;
      } else {
        timeFields.innerHTML = `
          <span class="condition-label">às</span>
          <input type="time" class="time-at input-field" value="${parsed.at || '12:00'}" style="width:100px; background:#0a0a0a; color:#fff; border:1px solid #404040; padding:0.5rem; border-radius:0.5rem;">
        `;
      }
      timeFields.querySelectorAll('input').forEach(inp => inp.addEventListener('change', save));
    };

    renderTimeFields(parsed.op);
    select.addEventListener('change', () => {
      parsed = { op: select.value };
      renderTimeFields(select.value);
    });
  }

  // Bug 11: WEEKDAY — operator select + day buttons
  private renderWeekdayInputs(rule: ConditionRule, container: HTMLElement) {
    let parsed: { op: string; days: string[] } = { op: 'is', days: [] };
    try { parsed = JSON.parse(rule.value || '{}'); } catch { /* */ }
    if (!parsed.op) parsed.op = 'is';
    if (!Array.isArray(parsed.days)) parsed.days = [];

    const dayKeys = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayLabels: Record<string, string> = { Mon: 'Seg', Tue: 'Ter', Wed: 'Qua', Thu: 'Qui', Fri: 'Sex', Sat: 'Sáb', Sun: 'Dom' };

    const wrap = document.createElement('div');
    wrap.className = 'condition-col';
    wrap.innerHTML = `
      <select class="weekday-op-select input-field" style="width:220px; background:#0a0a0a; color:#fff; border:1px solid #404040; padding:0.5rem; border-radius:0.5rem;">
        <option value="is"     ${parsed.op === 'is'     ? 'selected' : ''}>É um dos dias</option>
        <option value="is_not" ${parsed.op === 'is_not' ? 'selected' : ''}>Não é nenhum dos dias</option>
      </select>
      <div class="day-buttons">
        ${dayKeys.map(k => `
          <button type="button" class="day-btn ${parsed.days.includes(k) ? 'active' : ''}" data-day="${k}">
            ${dayLabels[k]}
          </button>
        `).join('')}
      </div>
    `;
    container.appendChild(wrap);

    const save = () => {
      const op = (wrap.querySelector('.weekday-op-select') as HTMLSelectElement).value;
      const days = Array.from(wrap.querySelectorAll('.day-btn.active')).map(b => (b as HTMLElement).dataset.day!);
      rule.value = JSON.stringify({ op, days });
      this.onChange();
    };

    wrap.querySelector('.weekday-op-select')!.addEventListener('change', save);
    wrap.querySelectorAll('.day-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        save();
      });
    });
  }

  // Bug 12: DATE — simplified to just a date picker
  private renderDateInputs(rule: ConditionRule, container: HTMLElement) {
    const wrap = document.createElement('div');
    wrap.className = 'condition-row';
    wrap.innerHTML = `
      <span class="condition-label">For a data</span>
      <input type="date" class="rule-value input-field" value="${rule.value || ''}" style="background:#0a0a0a; color:#fff; border:1px solid #404040; padding:0.5rem; border-radius:0.5rem;">
    `;
    container.appendChild(wrap);

    wrap.querySelector('.rule-value')!.addEventListener('change', (e) => {
      rule.value = (e.target as HTMLInputElement).value;
      this.onChange();
    });
  }
}
