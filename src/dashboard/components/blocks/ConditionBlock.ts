/**
 * src/dashboard/components/blocks/ConditionBlock.ts
 *
 * Each condition (Se / Senão Se) and the optional Senão (Else) is rendered
 * as its OWN separate visual card — not grouped inside a single shared
 * "Condition" block. editor.ts places one ConditionRuleBlock (or the single
 * ConditionElseBlock) per branch/column in the flow canvas, each followed
 * by its own dedicated Action block.
 *
 * Visual style matches the reference design (ref_pages/SOTE/craicao.htm):
 * pill-style dropdowns/inputs with leading icons, a single "Condition Rule"
 * row per card, and a "..." overflow menu in the header instead of an X
 * button. The overflow menu is also where new branches are added
 * ("+ Adicionar Senão Se" / "+ Adicionar Senão (Else)") and existing ones
 * are removed.
 */

import type { ConditionRule } from '../../../shared/types/index.js';
import { t } from '../../../shared/i18n/index.js';

/**
 * Produces a short human-readable summary of a condition rule, used as the
 * label on the branch that comes out of the condition block in the flow
 * canvas (e.g. "SE · Domínio contém gmail.com").
 */
export function describeConditionRule(rule: ConditionRule): string {
  const typeLabels: Record<string, string> = {
    domain: t('condition.domain'),
    time: t('condition.time'),
    weekday: t('condition.weekday'),
    date: t('condition.date'),
  };
  const opLabels: Record<string, string> = {
    contains: t('condition.op.contains'),
    equals: t('condition.op.equals'),
    not_contains: t('condition.op.not_contains'),
  };
  const typeLabel = typeLabels[rule.type] || rule.type;

  if (rule.type === 'time') {
    try {
      const p = JSON.parse(rule.value || '{}');
      if (p.op === 'between') return t('condition.preview.time_between', { from: p.from || '--:--', to: p.to || '--:--' });
      if (p.op === 'before') return t('condition.preview.time_before', { at: p.at || '--:--' });
      if (p.op === 'after') return t('condition.preview.time_after', { at: p.at || '--:--' });
    } catch { /* fallthrough */ }
    return typeLabel;
  }

  if (rule.type === 'weekday') {
    try {
      const p = JSON.parse(rule.value || '{}');
      const dayKeyToLabel: Record<string, string> = {
        Mon: t('weekday.mon'), Tue: t('weekday.tue'), Wed: t('weekday.wed'),
        Thu: t('weekday.thu'), Fri: t('weekday.fri'), Sat: t('weekday.sat'), Sun: t('weekday.sun'),
      };
      const days = Array.isArray(p.days) ? p.days.map((d: string) => dayKeyToLabel[d] || d).join(', ') : '';
      const key = p.op === 'is_not' ? 'condition.preview.weekday_is_not' : 'condition.preview.weekday_is';
      return t(key, { days: days || t('condition.preview.weekday_none') });
    } catch { /* fallthrough */ }
    return typeLabel;
  }

  if (rule.type === 'date') {
    return t('condition.preview.date_is', { value: rule.value || '...' });
  }

  return `${typeLabel} ${opLabels[rule.operator] || rule.operator} "${rule.value || '...'}"`;
}

const ICONS = {
  branch: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M80 104a24 24 0 1 0 0-48 24 24 0 1 0 0 48zm80-24c0 32.8-19.7 61-48 73.3v87.8c18.8-10.9 40.7-17.1 64-17.1h96c35.3 0 64-28.7 64-64v-6.7C307.7 141 288 112.8 288 80c0-44.2 35.8-80 80-80s80 35.8 80 80c0 32.8-19.7 61-48 73.3V160c0 70.7-57.3 128-128 128H176c-35.3 0-64 28.7-64 64v6.7c28.3 12.3 48 40.5 48 73.3c0 44.2-35.8 80-80 80s-80-35.8-80-80c0-32.8 19.7-61 48-73.3V352 153.3C19.7 141 0 112.8 0 80C0 35.8 35.8 0 80 0s80 35.8 80 80zm232 0a24 24 0 1 0 -48 0 24 24 0 1 0 48 0zM80 456a24 24 0 1 0 0-48 24 24 0 1 0 0 48z"/></svg>`,
  arrowsSplit: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" fill="currentColor"><path d="M320 96c0-10.6 6.3-20.2 16-24.5s21-2.4 28.7 4.7l96 88c6.5 6 10.2 14.5 10.2 23.3s-3.7 17.3-10.2 23.3l-96 88c-7.7 7-18.9 8.9-28.7 4.7s-16-13.9-16-24.5V240H243.6c-25.5 0-49.5 12-64.8 32.4L96.5 388.3l6.4-.3h96c19.4 0 37.9 8.6 50.5 23.4l30.1 35.4c4.7 5.5 11.6 8.7 18.8 8.7H384c17.7 0 32 14.3 32 32s-14.3 32-32 32H298.3c-25.5 0-49.6-11.1-66.1-30.5l-30.1-35.4c-2.5-3-6.3-4.7-10.2-4.7h-96C43.2 448 0 404.8 0 351.5v-.3c0-21.3 6.7-42 19.1-59.3l89.6-124.7C132.9 132.1 176.2 112 222.4 112H320V96zM32 128a32 32 0 1 1 0-64 32 32 0 1 1 0 64z"/></svg>`,
  plus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z"/></svg>`,
  trash: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M170.5 51.6L151.5 80h145l-19-28.4c-1.5-2.2-4-3.6-6.7-3.6H177.1c-2.7 0-5.2 1.3-6.7 3.6zm147-26.6L354.2 80H368h48 8c13.3 0 24 10.7 24 24s-10.7 24-24 24h-8V432c0 44.2-35.8 80-80 80H112c-44.2 0-80-35.8-80-80V128H24c-13.3 0-24-10.7-24-24S10.7 80 24 80h8H80 93.8l36.7-55.1C140.9 9.4 158.4 0 177.1 0h93.7c18.7 0 36.2 9.4 46.6 24.9zM80 128V432c0 17.7 14.3 32 32 32H336c17.7 0 32-14.3 32-32V128H80zm80 64V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16zm80 0V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16zm80 0V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16z"/></svg>`,
  ellipsis: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 512" fill="currentColor"><path d="M64 360a56 56 0 1 0 0 112 56 56 0 1 0 0-112zm0-160a56 56 0 1 0 0 112 56 56 0 1 0 0-112zM120 96A56 56 0 1 0 8 96a56 56 0 1 0 112 0z"/></svg>`,
  globe: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M352 256c0 22.2-1.2 43.6-3.3 64H163.3c-2.2-20.4-3.3-41.8-3.3-64s1.2-43.6 3.3-64H348.7c2.2 20.4 3.3 41.8 3.3 64zm28.8-64H503.9c5.3 20.5 8.1 41.9 8.1 64s-2.8 43.5-8.1 64H380.8c2.1-20.6 3.2-42 3.2-64s-1.1-43.4-3.2-64zm112.6-32H376.7c-10-63.9-29.8-117.4-55.3-151.6c78.3 20.7 142 77.5 171.9 151.6zm-149.1 0H167.7c6.1-36.4 15.5-68.6 27-94.7c10.5-23.6 22.2-40.7 33.5-51.5C239.4 3.2 248.7 0 256 0s16.6 3.2 27.8 13.8c11.3 10.8 23 27.9 33.5 51.5c11.6 26 20.9 58.2 27 94.7zm-209 0H18.6C48.6 85.9 112.2 29.1 190.6 8.4C165.1 42.6 145.3 96.1 135.3 160zM8.1 192H131.2c-2.1 20.6-3.2 42-3.2 64s1.1 43.4 3.2 64H8.1C2.8 299.5 0 278.1 0 256s2.8-43.5 8.1-64zM194.7 446.6c-11.6-26-20.9-58.2-27-94.6H344.3c-6.1 36.4-15.5 68.6-27 94.6c-10.5 23.6-22.2 40.7-33.5 51.5C272.6 508.8 263.3 512 256 512s-16.6-3.2-27.8-13.8c-11.3-10.8-23-27.9-33.5-51.5zM135.3 352c10 63.9 29.8 117.4 55.3 151.6C112.2 482.9 48.6 426.1 18.6 352H135.3zm358.1 0c-30 74.1-93.6 130.9-171.9 151.6c25.5-34.2 45.2-87.7 55.3-151.6H493.4z"/></svg>`,
  clock: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M256 0a256 256 0 1 1 0 512A256 256 0 1 1 256 0zM232 120V256c0 8 4 15.5 10.7 20l96 64c11 7.4 25.9 4.4 33.3-6.7s4.4-25.9-6.7-33.3L280 243.2V120c0-13.3-10.7-24-24-24s-24 10.7-24 24z"/></svg>`,
  calendar: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M152 24c0-13.3-10.7-24-24-24s-24 10.7-24 24V64H64C28.7 64 0 92.7 0 128v16 48V448c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V192 144 128c0-35.3-28.7-64-64-64H344V24c0-13.3-10.7-24-24-24s-24 10.7-24 24V64H152V24zM48 192H400V448c0 8.8-7.2 16-16 16H64c-8.8 0-16-7.2-16-16V192z"/></svg>`,
};

// CSS injected once into document
const COND_BLOCK_CSS = `
.condition-rule-label {
  display: block;
  font-size: 0.75rem;
  color: #737373;
  margin-bottom: 0.375rem;
}

/* The branch column card is narrow (23rem), so cramming
   [type select][operator][value] into a single row never had enough
   room. Squeezing the operator+value container down to fit alongside
   the type select (via its min-width:0) didn't force a clean wrap —
   it forced an internal wrap *inside* that squeezed container, which
   then got vertically centered against the type select by
   align-items:center, producing a scrambled, misaligned card.
   Stacking the type select on its own full-width row (matching the
   label + full-width field pattern used elsewhere in the extension,
   e.g. .form-label + .input-field) removes the fight for space:
   the row below then has the full card width for operator + value. */
.condition-rule-stack { display: flex; flex-direction: column; gap: 0.5rem; }
.condition-rule-stack > .pill-select-wrap { width: 100%; }
.condition-rule-stack > .pill-select-wrap .pill-select { width: 100%; }

.condition-rule-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

/* min-width (not a fixed width) keeps every dropdown in a condition row
   visually anchored to the same baseline size — matching the reference
   design's fixed-width "Domain" / operator pills — while still letting
   longer Portuguese labels ("Dia da Semana", "Não é nenhum dos dias")
   grow past it instead of being clipped. Without this, switching the
   rule type made the whole row jump/reflow depending on label length. */
.pill-select-wrap { position: relative; flex-shrink: 0; }
.pill-select {
  appearance: none;
  -webkit-appearance: none;
  background-color: #0a0a0a;
  color: #d4d4d4;
  border: 1px solid #404040;
  border-radius: 0.5rem;
  padding: 0.625rem 1.75rem 0.625rem 0.75rem;
  font-size: 0.8125rem;
  cursor: pointer;
  font-family: inherit;
  box-sizing: border-box;
  min-width: 9rem;
}
.pill-select-wrap--op .pill-select { min-width: 6rem; }
.pill-select:hover { border-color: #525252; }
.pill-select:focus { outline: none; border-color: #737373; }
.pill-select-wrap::after {
  content: '';
  position: absolute;
  right: 0.75rem;
  top: 50%;
  width: 0.375rem;
  height: 0.375rem;
  border-right: 1.5px solid #737373;
  border-bottom: 1.5px solid #737373;
  transform: translateY(-65%) rotate(45deg);
  pointer-events: none;
}

.pill-value {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background-color: #0a0a0a;
  border: 1px solid #404040;
  border-radius: 0.5rem;
  padding: 0.625rem 0.75rem;
  flex: 1;
  min-width: 8rem;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.pill-value:focus-within { border-color: #737373; }
.pill-value svg { width: 0.75rem; height: 0.75rem; color: #525252; flex-shrink: 0; }
.pill-value input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  color: #fff;
  font-size: 0.8125rem;
  outline: none;
  font-family: inherit;
}

/* Two-field rows (e.g. "Entre {hora} e {hora}") should split the space
   evenly and stay vertically centered on the "e" connector, instead of
   each field sizing independently to its own min-width. */
.pill-value-pair {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}
.pill-value-pair .pill-value { flex: 1 1 0; min-width: 6rem; }
.pill-value-pair .pill-pair-sep {
  flex-shrink: 0;
  font-size: 0.75rem;
  color: #737373;
}

.day-buttons { display: flex; gap: 0.375rem; flex-wrap: wrap; }
.day-btn {
  padding: 0.375rem 0.625rem;
  border-radius: 0.375rem;
  border: 1px solid #404040;
  background: #0a0a0a;
  color: #737373;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}
.day-btn:hover { border-color: #525252; color: #d4d4d4; }
.day-btn.active { background: #ffffff; border-color: #ffffff; color: #171717; }

.else-card-body {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  color: #a3a3a3;
  font-size: 0.8125rem;
}
.else-card-body svg { width: 1rem; height: 1rem; color: #525252; flex-shrink: 0; }
`;

let condStylesInjected = false;
function injectCondStyles() {
  if (condStylesInjected) return;
  const style = document.createElement('style');
  style.textContent = COND_BLOCK_CSS;
  document.head.appendChild(style);
  condStylesInjected = true;
}

/** Shared header menu wiring for both card types below. */
function bindHeaderMenu(el: HTMLElement, items: { label: string; icon: string; danger?: boolean; onClick: () => void }[]) {
  const menuBtn = el.querySelector('.block-menu-btn') as HTMLElement;
  const menu = el.querySelector('.block-menu') as HTMLElement;
  menu.innerHTML = items.map((item, i) => `
    <button class="block-menu-item ${item.danger ? 'danger' : ''}" data-idx="${i}">
      ${item.icon} ${item.label}
    </button>
  `).join('');

  const closeMenu = () => { menu.style.display = 'none'; };
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  });
  document.addEventListener('click', closeMenu);

  menu.querySelectorAll('.block-menu-item').forEach((btn, i) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMenu();
      items[i].onClick();
    });
  });
}

export interface ConditionRuleBlockOptions {
  label: string; // 'SE' | 'SENÃO SE'
  onChange: () => void;
  /** Removes just this rule (or the whole condition step, if it's the only branch). */
  onRemove: () => void;
  /** Present only on the last rule card — appends a new "Senão Se" branch. */
  onAddSenaoSe?: () => void;
  /** Present only on the last rule card when no Else exists yet. */
  onAddElse?: () => void;
}

/**
 * A single condition (Se / Senão Se) rendered as its own standalone block.
 */
export class ConditionRuleBlock {
  private el: HTMLElement;
  public data: ConditionRule;
  private opts: ConditionRuleBlockOptions;

  constructor(data: ConditionRule, opts: ConditionRuleBlockOptions) {
    this.data = data;
    this.opts = opts;
    this.el = document.createElement('div');
    this.el.className = 'block-card';
    injectCondStyles();
    this.render();
  }

  public getElement(): HTMLElement {
    return this.el;
  }

  public getData(): ConditionRule {
    return this.data;
  }

  private render() {
    const rule = this.data;
    this.el.innerHTML = /* html */ `
      <div class="block-header">
        <div class="block-icon">${ICONS.branch}</div>
        <div class="block-title-wrap">
          <p class="block-step">${this.opts.label}</p>
          <h2 class="block-title">${t('condition.rule.title')}</h2>
        </div>
        <span class="block-badge">${t('condition.rule.badge')}</span>
        <div class="block-menu-wrap">
          <button class="block-menu-btn" title="${t('common.more_options')}">${ICONS.ellipsis}</button>
          <div class="block-menu" style="display:none;"></div>
        </div>
      </div>
      <div class="block-body">
        <label class="condition-rule-label">${t('editor.condition.rule_label')}</label>
        <div class="condition-rule-stack">
          <div class="pill-select-wrap">
            <select class="pill-select rule-type">
              <option value="domain"  ${rule.type === 'domain'  ? 'selected' : ''}>${t('condition.domain')}</option>
              <option value="time"    ${rule.type === 'time'    ? 'selected' : ''}>${t('condition.time')}</option>
              <option value="weekday" ${rule.type === 'weekday' ? 'selected' : ''}>${t('condition.weekday')}</option>
              <option value="date"    ${rule.type === 'date'    ? 'selected' : ''}>${t('condition.date')}</option>
            </select>
          </div>
          <div class="rule-value-container condition-rule-row"></div>
        </div>
      </div>
    `;

    const valueContainer = this.el.querySelector('.rule-value-container') as HTMLElement;
    this.renderValueInput(rule, valueContainer);

    this.el.querySelector('.rule-type')!.addEventListener('change', (e) => {
      rule.type = (e.target as HTMLSelectElement).value as any;
      rule.value = '';
      this.renderValueInput(rule, valueContainer);
      this.opts.onChange();
    });

    const menuItems: { label: string; icon: string; danger?: boolean; onClick: () => void }[] = [];
    if (this.opts.onAddSenaoSe) {
      menuItems.push({ label: t('condition.menu.add_elseif'), icon: ICONS.plus, onClick: this.opts.onAddSenaoSe });
    }
    if (this.opts.onAddElse) {
      menuItems.push({ label: t('editor.condition.add_else'), icon: ICONS.plus, onClick: this.opts.onAddElse });
    }
    menuItems.push({
      label: t('editor.condition.remove_rule'), icon: ICONS.trash, danger: true, onClick: () => {
        if (confirm(t('condition.confirm.remove_rule'))) this.opts.onRemove();
      }
    });
    bindHeaderMenu(this.el, menuItems);
  }

  private renderValueInput(rule: ConditionRule, container: HTMLElement) {
    container.innerHTML = '';
    if (rule.type === 'domain') this.renderDomainInputs(rule, container);
    else if (rule.type === 'time') this.renderTimeInputs(rule, container);
    else if (rule.type === 'weekday') this.renderWeekdayInputs(rule, container);
    else if (rule.type === 'date') this.renderDateInputs(rule, container);
  }

  private renderDomainInputs(rule: ConditionRule, container: HTMLElement) {
    const opWrap = document.createElement('div');
    opWrap.className = 'pill-select-wrap pill-select-wrap--op';
    opWrap.innerHTML = `
      <select class="pill-select rule-operator">
        <option value="contains"     ${rule.operator === 'contains'     ? 'selected' : ''}>${t('condition.op.contains')}</option>
        <option value="equals"       ${rule.operator === 'equals'       ? 'selected' : ''}>${t('condition.op.equals')}</option>
        <option value="not_contains" ${rule.operator === 'not_contains' ? 'selected' : ''}>${t('condition.op.not_contains')}</option>
      </select>
    `;

    const valueWrap = document.createElement('div');
    valueWrap.className = 'pill-value';
    valueWrap.innerHTML = `
      ${ICONS.globe}
      <input type="text" class="rule-value" value="${rule.value || ''}" placeholder="${t('condition.domain.placeholder')}" />
    `;

    container.appendChild(opWrap);
    container.appendChild(valueWrap);

    opWrap.querySelector('.rule-operator')!.addEventListener('change', (e) => {
      rule.operator = (e.target as HTMLSelectElement).value as any;
      this.opts.onChange();
    });
    valueWrap.querySelector('.rule-value')!.addEventListener('input', (e) => {
      rule.value = (e.target as HTMLInputElement).value;
      this.opts.onChange();
    });
  }

  // TIME — operator select + dynamic fields
  private renderTimeInputs(rule: ConditionRule, container: HTMLElement) {
    let parsed: { op: string; from?: string; to?: string; at?: string } = { op: 'between' };
    try { parsed = JSON.parse(rule.value || '{}'); } catch { /* */ }
    if (!parsed.op) parsed.op = 'between';

    const opWrap = document.createElement('div');
    opWrap.className = 'pill-select-wrap pill-select-wrap--op';
    opWrap.innerHTML = `
      <select class="pill-select time-op-select">
        <option value="between" ${parsed.op === 'between' ? 'selected' : ''}>${t('condition.time.between')}</option>
        <option value="before"  ${parsed.op === 'before'  ? 'selected' : ''}>${t('condition.time.before')}</option>
        <option value="after"   ${parsed.op === 'after'   ? 'selected' : ''}>${t('condition.time.after')}</option>
      </select>
    `;

    const timeFields = document.createElement('div');
    timeFields.className = 'condition-rule-row time-fields';
    // Always its own full-width row, whether it holds one field ("Antes"/
    // "Após") or two ("Entre") — this keeps the card's expansion consistent
    // across operators instead of the fields being squeezed inline next to
    // the operator select and only "expanding" for the 2-field case.
    timeFields.style.flexBasis = '100%';
    timeFields.style.width = '100%';
    timeFields.style.marginTop = '0.5rem';

    container.appendChild(opWrap);
    container.appendChild(timeFields);

    const select = opWrap.querySelector('.time-op-select') as HTMLSelectElement;

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
      this.opts.onChange();
    };

    const renderTimeFields = (op: string) => {
      if (op === 'between') {
        // Both "de" and "até" fields get the clock icon and share the row
        // evenly (.pill-value-pair) so the "e" connector sits centered
        // between two equally-sized pills, matching the rest of the
        // condition block's aligned pill layout.
        timeFields.innerHTML = `
          <div class="pill-value-pair">
            <div class="pill-value">${ICONS.clock}<input type="time" class="time-from" value="${parsed.from || '08:00'}"></div>
            <span class="pill-pair-sep">${t('condition.time.to')}</span>
            <div class="pill-value">${ICONS.clock}<input type="time" class="time-to" value="${parsed.to || '18:00'}"></div>
          </div>
        `;
      } else {
        timeFields.innerHTML = `
          <div class="pill-value" style="flex:0 1 auto; min-width:7rem;">${ICONS.clock}<input type="time" class="time-at" value="${parsed.at || '12:00'}"></div>
        `;
      }
      timeFields.querySelectorAll('input').forEach(inp => inp.addEventListener('change', save));
    };

    renderTimeFields(parsed.op);
    select.addEventListener('change', () => {
      parsed = { op: select.value };
      renderTimeFields(select.value);
      save();
    });
  }

  // WEEKDAY — operator select + day buttons
  private renderWeekdayInputs(rule: ConditionRule, container: HTMLElement) {
    let parsed: { op: string; days: string[] } = { op: 'is', days: [] };
    try { parsed = JSON.parse(rule.value || '{}'); } catch { /* */ }
    if (!parsed.op) parsed.op = 'is';
    if (!Array.isArray(parsed.days)) parsed.days = [];

    const dayKeys = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayLabels: Record<string, string> = {
      Mon: t('weekday.mon'), Tue: t('weekday.tue'), Wed: t('weekday.wed'),
      Thu: t('weekday.thu'), Fri: t('weekday.fri'), Sat: t('weekday.sat'), Sun: t('weekday.sun'),
    };

    const opWrap = document.createElement('div');
    opWrap.className = 'pill-select-wrap pill-select-wrap--op';
    opWrap.innerHTML = `
      <select class="pill-select weekday-op-select">
        <option value="is"     ${parsed.op === 'is'     ? 'selected' : ''}>${t('condition.weekday.is')}</option>
        <option value="is_not" ${parsed.op === 'is_not' ? 'selected' : ''}>${t('condition.weekday.is_not')}</option>
      </select>
    `;

    const dayButtons = document.createElement('div');
    dayButtons.className = 'day-buttons';
    dayButtons.style.flexBasis = '100%';
    dayButtons.style.width = '100%';
    dayButtons.style.marginTop = '0.5rem';
    dayButtons.innerHTML = dayKeys.map(k => `
      <button type="button" class="day-btn ${parsed.days.includes(k) ? 'active' : ''}" data-day="${k}">
        ${dayLabels[k]}
      </button>
    `).join('');

    container.appendChild(opWrap);
    container.appendChild(dayButtons);

    const save = () => {
      const op = (opWrap.querySelector('.weekday-op-select') as HTMLSelectElement).value;
      const days = Array.from(dayButtons.querySelectorAll('.day-btn.active')).map(b => (b as HTMLElement).dataset.day!);
      rule.value = JSON.stringify({ op, days });
      this.opts.onChange();
    };

    opWrap.querySelector('.weekday-op-select')!.addEventListener('change', save);
    dayButtons.querySelectorAll('.day-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        save();
      });
    });
  }

  // DATE — simple date picker
  private renderDateInputs(rule: ConditionRule, container: HTMLElement) {
    const valueWrap = document.createElement('div');
    valueWrap.className = 'pill-value';
    valueWrap.style.flex = '0 1 auto';
    valueWrap.style.minWidth = '10rem';
    valueWrap.innerHTML = `
      ${ICONS.calendar}
      <input type="date" class="rule-value" value="${rule.value || ''}">
    `;
    container.appendChild(valueWrap);

    valueWrap.querySelector('.rule-value')!.addEventListener('change', (e) => {
      rule.value = (e.target as HTMLInputElement).value;
      this.opts.onChange();
    });
  }
}

export interface ConditionElseBlockOptions {
  onRemove: () => void;
}

/**
 * The "Senão (Else)" fallback path, rendered as its own standalone block
 * with no condition editor — it always matches when no rule above did.
 */
export class ConditionElseBlock {
  private el: HTMLElement;
  private opts: ConditionElseBlockOptions;

  constructor(opts: ConditionElseBlockOptions) {
    this.opts = opts;
    this.el = document.createElement('div');
    this.el.className = 'block-card';
    injectCondStyles();
    this.render();
  }

  public getElement(): HTMLElement {
    return this.el;
  }

  private render() {
    this.el.innerHTML = /* html */ `
      <div class="block-header">
        <div class="block-icon">${ICONS.arrowsSplit}</div>
        <div class="block-title-wrap">
          <p class="block-step">${t('condition.tag.else')}</p>
          <h2 class="block-title">${t('condition.else.title')}</h2>
        </div>
        <span class="block-badge">${t('condition.else.badge')}</span>
        <div class="block-menu-wrap">
          <button class="block-menu-btn" title="${t('common.more_options')}">${ICONS.ellipsis}</button>
          <div class="block-menu" style="display:none;"></div>
        </div>
      </div>
      <div class="block-body">
        <div class="else-card-body">
          ${ICONS.arrowsSplit}
          <span>${t('condition.else.body')}</span>
        </div>
      </div>
    `;

    bindHeaderMenu(this.el, [
      {
        label: t('condition.else.menu.remove'), icon: ICONS.trash, danger: true, onClick: () => {
          if (confirm(t('condition.confirm.remove_else'))) this.opts.onRemove();
        }
      },
    ]);
  }
}
