/**
 * src/dashboard/components/blocks/ConditionBlock.ts
 *
 * Every branch (Se / Senão Se / Senão) of a Condition step is rendered
 * inside ONE unified card built by editor.ts's renderConditionCard() —
 * this file just provides ConditionRuleBlock, the inline "SE"/"SENÃO SE"
 * rule-editing row (chips + AND/OR criteria group) that gets slotted into
 * each branch-row's content. It renders no card/header chrome of its own.
 *
 * Rule-row style matches the reference design (ref_pages/criadorFluxo.htm):
 * pill-style dropdowns/inputs with leading icons, one row per rule, with an
 * inline "×" button to remove just that rule (adding new branches — "+
 * Adicionar Senão Se" / "+ Adicionar Senão" — is a footer control on the
 * unified card itself, not per-rule).
 */

import type { ConditionRule, ConditionCriterion } from '../../../shared/types/index.js';
import { t } from '../../../shared/i18n/index.js';
import { escapeHtml } from '../../../shared/utils/dom.js';
import { ConfirmModal } from '../../components/ConfirmModal.js';

/**
 * Produces a short human-readable summary of a single type/operator/value
 * criterion (a rule's own primary check, or one entry of its `criteria`
 * AND/OR group).
 */
export function describeConditionCriterion(criterion: ConditionCriterion): string {
  const typeLabels: Record<string, string> = {
    domain: t('condition.domain'),
    time: t('condition.time'),
    weekday: t('condition.weekday'),
    date: t('condition.date'),
    field_type: t('condition.field_type'),
    field_content: t('condition.field_content'),
    clipboard_content: t('condition.clipboard_content'),
    variable_value: t('condition.variable_value'),
    time_since_last_expansion: t('condition.time_since_last_expansion'),
  };
  const opLabels: Record<string, string> = {
    contains: t('condition.op.contains'),
    equals: t('condition.op.equals'),
    not_contains: t('condition.op.not_contains'),
  };
  const typeLabel = typeLabels[criterion.type] || criterion.type;

  if (criterion.type === 'time') {
    try {
      const p = JSON.parse(criterion.value || '{}');
      if (p.op === 'between') return t('condition.preview.time_between', { from: p.from || '--:--', to: p.to || '--:--' });
      if (p.op === 'before') return t('condition.preview.time_before', { at: p.at || '--:--' });
      if (p.op === 'after') return t('condition.preview.time_after', { at: p.at || '--:--' });
    } catch { /* fallthrough */ }
    return typeLabel;
  }

  if (criterion.type === 'weekday') {
    try {
      const p = JSON.parse(criterion.value || '{}');
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

  if (criterion.type === 'date') {
    return t('condition.preview.date_is', { value: criterion.value || '...' });
  }

  if (criterion.type === 'field_type') {
    const fieldTypeLabels: Record<string, string> = {
      email: t('condition.field_type.email'),
      password: t('condition.field_type.password'),
      tel: t('condition.field_type.tel'),
      number: t('condition.field_type.number'),
      url: t('condition.field_type.url'),
      search: t('condition.field_type.search'),
      textarea: t('condition.field_type.textarea'),
      contenteditable: t('condition.field_type.contenteditable'),
      text: t('condition.field_type.text'),
    };
    const valueLabel = fieldTypeLabels[criterion.value] || criterion.value || '...';
    const key = criterion.operator === 'not_contains' ? 'condition.preview.field_type_is_not' : 'condition.preview.field_type_is';
    return t(key, { value: valueLabel });
  }

  if (criterion.type === 'field_content') {
    const key = criterion.operator === 'not_contains'
      ? 'condition.preview.field_content_not_contains'
      : criterion.operator === 'equals'
        ? 'condition.preview.field_content_equals'
        : 'condition.preview.field_content_contains';
    return t(key, { value: criterion.value || '...' });
  }

  if (criterion.type === 'clipboard_content') {
    const op = opLabels[criterion.operator] || criterion.operator;
    return t('condition.preview.clipboard_content', { op, value: criterion.value || '...' });
  }

  if (criterion.type === 'variable_value') {
    let key = '';
    let val = '';
    try {
      const p = JSON.parse(criterion.value || '{}');
      key = p.key || '';
      val = p.val ?? p.value ?? '';
    } catch {
      const parts = (criterion.value || '').split(':');
      key = parts[0] || '';
      val = parts.slice(1).join(':') || '';
    }
    const op = opLabels[criterion.operator] || criterion.operator;
    return t('condition.preview.variable_value', { key: key || '...', op, value: val || '...' });
  }

  if (criterion.type === 'time_since_last_expansion') {
    const mins = criterion.value || '10';
    return criterion.operator === 'before'
      ? t('condition.preview.time_since_before', { minutes: mins })
      : t('condition.preview.time_since_after', { minutes: mins });
  }

  return `${typeLabel} ${opLabels[criterion.operator] || criterion.operator} "${criterion.value || '...'}"`;
}

/**
 * Produces a short human-readable summary of a condition rule — its
 * primary criterion, plus (if present) its AND/OR `criteria` group — used
 * as the label on the branch that comes out of the condition block in the
 * flow canvas (e.g. "SE · Domínio contém gmail.com E Horário entre 08:00
 * e 18:00").
 */
export function describeConditionRule(rule: ConditionRule): string {
  const parts = [describeConditionCriterion(rule)];
  if (rule.criteria && rule.criteria.length > 0) {
    const joinWord = (rule.combinator || 'AND') === 'OR' ? t('condition.criteria.or_word') : t('condition.criteria.and_word');
    for (const criterion of rule.criteria) {
      parts.push(describeConditionCriterion(criterion));
    }
    return parts.join(` ${joinWord} `);
  }
  return parts[0];
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
  fieldType: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"></rect><line x1="6" y1="10" x2="6" y2="10"></line><line x1="10" y1="10" x2="10" y2="10"></line><line x1="14" y1="10" x2="14" y2="10"></line><line x1="18" y1="10" x2="18" y2="10"></line><line x1="7" y1="15" x2="17" y2="15"></line></svg>`,
  fieldContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"></line><line x1="4" y1="12" x2="14" y2="12"></line><line x1="4" y1="18" x2="18" y2="18"></line></svg>`,
  xmark: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></svg>`,
  pencil: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z"/></svg>`,
  alignLeft: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M288 64c0 17.7-14.3 32-32 32H32C14.3 96 0 81.7 0 64S14.3 32 32 32H256c17.7 0 32 14.3 32 32zm0 256c0 17.7-14.3 32-32 32H32c-17.7 0-32-14.3-32-32s14.3-32 32-32H256c17.7 0 32 14.3 32 32zM0 192c0-17.7 14.3-32 32-32H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H32c-17.7 0-32-14.3-32-32zM448 448c0 17.7-14.3 32-32 32H32c-17.7 0-32-14.3-32-32s14.3-32 32-32H416c17.7 0 32 14.3 32 32z"/></svg>`,
};

/*
 * Tarefa 4 (bug crítico de layout): este arquivo costumava injetar um
 * <style> próprio em document.head (ver injectCondStyles(), removida)
 * com uma cópia PARALELA e desatualizada das regras de
 * `.pill-select`, `.pill-select-wrap`, `.pill-value`, `.pill-value-pair`,
 * `.condition-rule-row` e `.branch-rule-row` — regras que `editor.css`
 * também define, já revisadas e corretas.
 *
 * Como esse <style> era inserido em tempo de execução (na primeira vez
 * que um ConditionRuleBlock era construído), ele sempre acabava depois de
 * `editor.css` no <head>, e por empate de especificidade CSS a versão
 * MAIS ANTIGA vencia a mais nova, propriedade por propriedade:
 *   - `.pill-select` no editor.css desenha a seta do dropdown com
 *     `background-image` (um SVG embutido); a versão antiga aqui desenhava
 *     OUTRA seta via `.pill-select-wrap::after` (um triângulo de borda) —
 *     como são propriedades diferentes (background-image vs. um
 *     pseudo-elemento à parte), as duas nunca se sobrescreviam: as DUAS
 *     setas apareciam ao mesmo tempo, sobrepostas.
 *   - `.pill-select-wrap` aqui forçava `flex-shrink: 0` (nunca encolhe),
 *     enquanto o editor.css pede `flex: 1 1 auto` — com a versão antiga
 *     vencendo, os campos de operador/valor não conseguiam encolher e
 *     invadiam o botão/campo vizinho.
 *   - padding/border-radius levemente diferentes entre as duas cópias
 *     faziam um campo "não bater" com o espaço que o outro estilo
 *     reservava para ele — daí "campo em cima de campo".
 *
 * A correção não é só apagar a cópia antiga: algumas regras (grupo
 * E/OU de critérios, botões de dia da semana, botão "+ Adicionar
 * critério") só existiam aqui — essas foram movidas para
 * `editor.css`, na seção "CONDITION RULE — REGRAS ÚNICAS MIGRADAS DE
 * ConditionBlock.ts", para não perder nenhum estilo. As que duplicavam
 * `editor.css` (e causavam o bug) foram simplesmente removidas — o
 * componente agora depende 100% da folha de estilos real da página,
 * nunca mais injeta a sua própria.
 */

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
  onChange: () => void;
  /** Removes just this rule (or the whole condition step, if it's the only branch). */
  onRemove: () => void;
}

/**
 * The "SE" / "SENÃO SE" rule-editing row — chips (type/operator/value) +
 * AND/OR criteria group. Rendered *inline* inside a branch-row's
 * `.branch-content` by the unified Condition card (see editor.ts's
 * renderConditionCard()) rather than as its own standalone bordered card —
 * matches the new reference, which shows every branch stacked inside one
 * card instead of each rule getting its own separate block+column.
 */
export class ConditionRuleBlock {
  private el: HTMLElement;
  public data: ConditionRule;
  private opts: ConditionRuleBlockOptions;

  constructor(data: ConditionRule, opts: ConditionRuleBlockOptions) {
    this.data = data;
    this.opts = opts;
    this.el = document.createElement('div');
    this.el.className = 'branch-rule-wrap';
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
      <div class="branch-rule-row">
        <div class="pill-select-wrap">
          <select class="pill-select rule-type">
            <option value="domain"                    ${rule.type === 'domain'                    ? 'selected' : ''}>${t('condition.domain')}</option>
            <option value="time"                      ${rule.type === 'time'                      ? 'selected' : ''}>${t('condition.time')}</option>
            <option value="weekday"                   ${rule.type === 'weekday'                   ? 'selected' : ''}>${t('condition.weekday')}</option>
            <option value="date"                      ${rule.type === 'date'                      ? 'selected' : ''}>${t('condition.date')}</option>
            <option value="field_type"                ${rule.type === 'field_type'                ? 'selected' : ''}>${t('condition.field_type')}</option>
            <option value="field_content"             ${rule.type === 'field_content'             ? 'selected' : ''}>${t('condition.field_content')}</option>
            <option value="clipboard_content"         ${rule.type === 'clipboard_content'         ? 'selected' : ''}>${t('condition.clipboard_content')}</option>
            <option value="variable_value"            ${rule.type === 'variable_value'            ? 'selected' : ''}>${t('condition.variable_value')}</option>
            <option value="time_since_last_expansion" ${rule.type === 'time_since_last_expansion' ? 'selected' : ''}>${t('condition.time_since_last_expansion')}</option>
          </select>
        </div>
        <div class="rule-value-container condition-rule-row"></div>
        <button type="button" class="branch-rule-remove-btn icon-btn" title="${t('editor.condition.remove_rule')}">${ICONS.xmark}</button>
      </div>
      <div class="rule-value-secondary"></div>
      <div class="condition-criteria-group"></div>
    `;

    // `.rule-value-container` (linha 1) só recebe o seletor de tipo/operador
    // — sempre cabe numa única linha. `.rule-value-secondary` (linha 2,
    // largura cheia, oculta via CSS `:empty` quando não usada) recebe o
    // conteúdo que só o Horário ("de"/"até") e o Dia da Semana (botões dos
    // dias) precisam — ver renderTimeInputs()/renderWeekdayInputs() logo
    // abaixo. Antes esse conteúdo secundário era injetado no MESMO
    // container da linha 1 (com `flexBasis:100%` via JS para forçar a
    // quebra), mas esse container tinha `flex-wrap: nowrap` no CSS — logo
    // o navegador nunca quebrava a linha, e o conteúdo (que não cabia)
    // estourava horizontalmente para fora do `.branch-rule-wrap`,
    // sobrepondo o botão "Inserir Texto" (`.branch-action`) ao lado. Ter
    // um container próprio, sempre de largura 100%, elimina o conflito na
    // raiz em vez de depender de flex-wrap para "salvar" o layout.
    const valueContainer = this.el.querySelector('.rule-value-container') as HTMLElement;
    const secondaryContainer = this.el.querySelector('.rule-value-secondary') as HTMLElement;
    this.renderValueInput(rule, valueContainer, () => this.opts.onChange(), secondaryContainer);

    this.el.querySelector('.rule-type')!.addEventListener('change', (e) => {
      rule.type = (e.target as HTMLSelectElement).value as any;
      rule.value = '';
      this.renderValueInput(rule, valueContainer, () => this.opts.onChange(), secondaryContainer);
      this.opts.onChange();
    });

    this.renderCriteriaGroup();

    this.el.querySelector('.branch-rule-remove-btn')!.addEventListener('click', () => {
      ConfirmModal.show({
        title: t('confirm_modal.remove_condition_title'),
        message: t('condition.confirm.remove_rule'),
        confirmLabel: t('common.remove'),
        onConfirm: () => this.opts.onRemove(),
      });
    });
  }

  /**
   * `secondaryContainer` é opcional: a regra principal (chamada acima, em
   * render()) sempre passa um, dando a Horário/Dia da Semana uma segunda
   * linha própria de largura cheia. Já as linhas de critério extra E/OU
   * (chamadas por renderCriteriaGroup() abaixo) não passam nenhum —
   * `.cond-extra-row` já usa `flex-wrap: wrap` livremente no CSS, então
   * o conteúdo secundário cai de volta para o comportamento antigo
   * (anexado ao mesmo container, com `flexBasis: 100%` via JS) sem
   * qualquer conflito, já que ali não existe o `flex-wrap: nowrap` que
   * causava o bug na linha principal.
   */
  private renderValueInput(target: ConditionCriterion, container: HTMLElement, onSave: () => void, secondaryContainer?: HTMLElement) {
    container.innerHTML = '';
    if (secondaryContainer) secondaryContainer.innerHTML = '';
    if (target.type === 'domain') this.renderDomainInputs(target, container, onSave);
    else if (target.type === 'time') this.renderTimeInputs(target, container, onSave, secondaryContainer);
    else if (target.type === 'weekday') this.renderWeekdayInputs(target, container, onSave, secondaryContainer);
    else if (target.type === 'date') this.renderDateInputs(target, container, onSave);
    else if (target.type === 'field_type') this.renderFieldTypeInputs(target, container, onSave);
    else if (target.type === 'field_content') this.renderFieldContentInputs(target, container, onSave);
    else if (target.type === 'clipboard_content') this.renderClipboardContentInputs(target, container, onSave);
    else if (target.type === 'variable_value') this.renderVariableValueInputs(target, container, onSave);
    else if (target.type === 'time_since_last_expansion') this.renderTimeSinceLastExpansionInputs(target, container, onSave);
  }

  /**
   * Renders the "E" / "OU" additional-criteria group below the primary
   * criterion — the redesigned replacement for the old "convert this
   * branch into a nested condition" affordance. All criteria here combine
   * with a single shared AND/OR operator (no mixed AND-of-ORs) and still
   * lead to this same rule's one `action`, which is what makes it far
   * easier to read than a separate nested Se/Senão Se/Senão tree.
   */
  private renderCriteriaGroup() {
    const rule = this.data;
    const groupEl = this.el.querySelector('.condition-criteria-group') as HTMLElement;
    const criteria = rule.criteria || [];

    // No extra AND/OR criteria on this rule: render nothing (matches the
    // compact reference card exactly — no floating "+ Adicionar condição"
    // button). Existing criteria from a flow saved before this redesign
    // still display and remain fully editable/removable below.
    if (criteria.length === 0) {
      groupEl.innerHTML = '';
      return;
    }

    const combinator = rule.combinator || 'AND';
    let html = `
      <div class="cond-combinator-row">
        <span class="cond-combinator-label">${t('condition.criteria.match_label')}</span>
        <div class="cond-combinator-toggle">
          <button type="button" class="cond-combinator-btn ${combinator === 'AND' ? 'active' : ''}" data-c="AND">${t('condition.criteria.and')}</button>
          <button type="button" class="cond-combinator-btn ${combinator === 'OR' ? 'active' : ''}" data-c="OR">${t('condition.criteria.or')}</button>
        </div>
      </div>
    `;
    html += `<div class="cond-extra-rows"></div>`;
    groupEl.innerHTML = html;

    groupEl.querySelectorAll('.cond-combinator-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        rule.combinator = (btn as HTMLElement).dataset.c as 'AND' | 'OR';
        this.opts.onChange();
        this.renderCriteriaGroup();
      });
    });

    const extraRowsEl = groupEl.querySelector('.cond-extra-rows') as HTMLElement;
    criteria.forEach((criterion, idx) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'cond-extra-row';
      rowEl.innerHTML = `
        <span class="cond-extra-row-connector">${(rule.combinator || 'AND') === 'OR' ? t('condition.criteria.or_word') : t('condition.criteria.and_word')}</span>
        <div class="pill-select-wrap">
          <select class="pill-select criterion-type">
            <option value="domain"                    ${criterion.type === 'domain'                    ? 'selected' : ''}>${t('condition.domain')}</option>
            <option value="time"                      ${criterion.type === 'time'                      ? 'selected' : ''}>${t('condition.time')}</option>
            <option value="weekday"                   ${criterion.type === 'weekday'                   ? 'selected' : ''}>${t('condition.weekday')}</option>
            <option value="date"                      ${criterion.type === 'date'                      ? 'selected' : ''}>${t('condition.date')}</option>
            <option value="field_type"                ${criterion.type === 'field_type'                ? 'selected' : ''}>${t('condition.field_type')}</option>
            <option value="field_content"             ${criterion.type === 'field_content'             ? 'selected' : ''}>${t('condition.field_content')}</option>
            <option value="clipboard_content"         ${criterion.type === 'clipboard_content'         ? 'selected' : ''}>${t('condition.clipboard_content')}</option>
            <option value="variable_value"            ${criterion.type === 'variable_value'            ? 'selected' : ''}>${t('condition.variable_value')}</option>
            <option value="time_since_last_expansion" ${criterion.type === 'time_since_last_expansion' ? 'selected' : ''}>${t('condition.time_since_last_expansion')}</option>
          </select>
        </div>
        <div class="criterion-value-container condition-rule-row"></div>
        <button type="button" class="cond-remove-criterion-btn" title="${t('condition.criteria.remove')}">${ICONS.trash}</button>
      `;
      extraRowsEl.appendChild(rowEl);

      const valCont = rowEl.querySelector('.criterion-value-container') as HTMLElement;
      this.renderValueInput(criterion, valCont, () => this.opts.onChange());

      rowEl.querySelector('.criterion-type')!.addEventListener('change', (e) => {
        criterion.type = (e.target as HTMLSelectElement).value as any;
        criterion.value = '';
        this.renderValueInput(criterion, valCont, () => this.opts.onChange());
        this.opts.onChange();
      });

      rowEl.querySelector('.cond-remove-criterion-btn')!.addEventListener('click', () => {
        rule.criteria!.splice(idx, 1);
        if (rule.criteria!.length === 0) {
          delete rule.criteria;
          delete rule.combinator;
        }
        this.opts.onChange();
        this.renderCriteriaGroup();
      });
    });
  }

  private renderDomainInputs(target: ConditionCriterion, container: HTMLElement, onSave: () => void) {
    const opWrap = document.createElement('div');
    opWrap.className = 'pill-select-wrap pill-select-wrap--op';
    opWrap.innerHTML = `
      <select class="pill-select rule-operator">
        <option value="contains"     ${target.operator === 'contains'     ? 'selected' : ''}>${t('condition.op.contains')}</option>
        <option value="equals"       ${target.operator === 'equals'       ? 'selected' : ''}>${t('condition.op.equals')}</option>
        <option value="not_contains" ${target.operator === 'not_contains' ? 'selected' : ''}>${t('condition.op.not_contains')}</option>
      </select>
    `;

    const valueWrap = document.createElement('div');
    valueWrap.className = 'pill-value';
    valueWrap.innerHTML = `
      ${ICONS.globe}
      <input type="text" class="rule-value" value="${escapeHtml(target.value || '')}" placeholder="${t('condition.domain.placeholder')}" />
    `;

    container.appendChild(opWrap);
    container.appendChild(valueWrap);

    opWrap.querySelector('.rule-operator')!.addEventListener('change', (e) => {
      target.operator = (e.target as HTMLSelectElement).value as any;
      onSave();
    });
    valueWrap.querySelector('.rule-value')!.addEventListener('input', (e) => {
      target.value = (e.target as HTMLInputElement).value;
      onSave();
    });
  }

  // TIME — operator select + dynamic fields
  private renderTimeInputs(target: ConditionCriterion, container: HTMLElement, onSave: () => void, secondaryContainer?: HTMLElement) {
    let parsed: { op: string; from?: string; to?: string; at?: string } = { op: 'between' };
    try { parsed = JSON.parse(target.value || '{}'); } catch { /* */ }
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
    const fieldsTarget = secondaryContainer || container;
    if (!secondaryContainer) {
      // Sem uma segunda linha dedicada (caso do critério extra E/OU — ver
      // renderValueInput()), força a quebra à moda antiga: o container ali
      // já permite `flex-wrap: wrap`, então isso funciona sem sobreposição.
      timeFields.style.flexBasis = '100%';
      timeFields.style.width = '100%';
      timeFields.style.marginTop = '0.5rem';
    }

    container.appendChild(opWrap);
    fieldsTarget.appendChild(timeFields);

    const select = opWrap.querySelector('.time-op-select') as HTMLSelectElement;

    const save = () => {
      const op = select.value;
      if (op === 'between') {
        const from = (timeFields.querySelector('.time-from') as HTMLInputElement)?.value || '';
        const to   = (timeFields.querySelector('.time-to')   as HTMLInputElement)?.value || '';
        target.value = JSON.stringify({ op, from, to });
      } else {
        const at = (timeFields.querySelector('.time-at') as HTMLInputElement)?.value || '';
        target.value = JSON.stringify({ op, at });
      }
      onSave();
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

    // Persist immediately: if this criterion was just created (or has no
    // valid from/to/at yet), the fields above already show sensible
    // defaults ("08:00"/"18:00"/"12:00") — but until now those were only
    // ever written to `target.value` by a 'change' event on one of the
    // inputs. A person who left the defaults untouched (a totally
    // reasonable thing to do — they look already filled in) got a
    // criterion whose real saved value was still `''`/`'{}'`, which the
    // runtime evaluator can't parse into a usable from/to — silently
    // never passing. Saving once here, right after the first render,
    // guarantees `target.value` always matches what's on screen.
    if (parsed.op === 'between') {
      if (!parsed.from || !parsed.to) save();
    } else if (!parsed.at) {
      save();
    }
  }

  // WEEKDAY — operator select + day buttons
  private renderWeekdayInputs(target: ConditionCriterion, container: HTMLElement, onSave: () => void, secondaryContainer?: HTMLElement) {
    let parsed: { op: string; days: string[] } = { op: 'is', days: [] };
    try { parsed = JSON.parse(target.value || '{}'); } catch { /* */ }
    if (!parsed.op) parsed.op = 'is';
    if (!Array.isArray(parsed.days)) parsed.days = [];

    const dayKeys = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayLabels: Record<string, string> = {
      Mon: t('weekday.mon'), Tue: t('weekday.tue'), Wed: t('weekday.wed'),
      Thu: t('weekday.thu'), Fri: t('weekday.fri'), Sat: t('weekday.sat'), Sun: t('weekday.sun'),
    };

    const opWrap = document.createElement('div');
    // Classe própria (não `--op`, fixa em 6rem): os rótulos deste select
    // são frases inteiras ("Não é nenhum dos dias"), não uma palavra
    // curta como "contém" — com a largura fixa de 6rem usada pelos
    // demais critérios, o texto ficava cortado. Ver regra em editor.css.
    opWrap.className = 'pill-select-wrap pill-select-wrap--op-wide';
    opWrap.innerHTML = `
      <select class="pill-select weekday-op-select">
        <option value="is"     ${parsed.op === 'is'     ? 'selected' : ''}>${t('condition.weekday.is')}</option>
        <option value="is_not" ${parsed.op === 'is_not' ? 'selected' : ''}>${t('condition.weekday.is_not')}</option>
      </select>
    `;

    const dayButtons = document.createElement('div');
    dayButtons.className = 'day-buttons';
    const daysTarget = secondaryContainer || container;
    if (!secondaryContainer) {
      // Mesmo fallback do renderTimeInputs — usado apenas pelas linhas de
      // critério extra E/OU, que já são flex-wrap por padrão.
      dayButtons.style.flexBasis = '100%';
      dayButtons.style.width = '100%';
      dayButtons.style.marginTop = '0.5rem';
    }
    dayButtons.innerHTML = dayKeys.map(k => `
      <button type="button" class="day-btn ${parsed.days.includes(k) ? 'active' : ''}" data-day="${k}">
        ${dayLabels[k]}
      </button>
    `).join('');

    container.appendChild(opWrap);
    daysTarget.appendChild(dayButtons);

    const save = () => {
      const op = (opWrap.querySelector('.weekday-op-select') as HTMLSelectElement).value;
      const days = Array.from(dayButtons.querySelectorAll('.day-btn.active')).map(b => (b as HTMLElement).dataset.day!);
      target.value = JSON.stringify({ op, days });
      onSave();
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
  private renderDateInputs(target: ConditionCriterion, container: HTMLElement, onSave: () => void) {
    const valueWrap = document.createElement('div');
    valueWrap.className = 'pill-value';
    valueWrap.style.flex = '0 1 auto';
    valueWrap.style.minWidth = '10rem';
    valueWrap.innerHTML = `
      <input type="date" class="rule-value" value="${escapeHtml(target.value || '')}">
    `;
    container.appendChild(valueWrap);

    valueWrap.querySelector('.rule-value')!.addEventListener('change', (e) => {
      target.value = (e.target as HTMLInputElement).value;
      onSave();
    });
  }

  // FIELD TYPE — É / Não é + dropdown of known field categories (email,
  // password, textarea, etc. — see getFieldTypeCategory in shared/utils/dom.ts,
  // which is what actually classifies the focused field at runtime).
  private renderFieldTypeInputs(target: ConditionCriterion, container: HTMLElement, onSave: () => void) {
    // Only 'equals' ("É") / 'not_contains' ("Não é") make sense for a
    // categorical match — normalize away any leftover operator from
    // switching from another criterion type (e.g. domain's 'contains').
    if (target.operator !== 'not_contains') target.operator = 'equals';
    if (!target.value) target.value = 'email';

    const opWrap = document.createElement('div');
    opWrap.className = 'pill-select-wrap pill-select-wrap--op';
    opWrap.innerHTML = `
      <select class="pill-select field-type-op">
        <option value="equals"       ${target.operator === 'equals'       ? 'selected' : ''}>${t('condition.field_type.is')}</option>
        <option value="not_contains" ${target.operator === 'not_contains' ? 'selected' : ''}>${t('condition.field_type.is_not')}</option>
      </select>
    `;

    const valueWrap = document.createElement('div');
    valueWrap.className = 'pill-select-wrap';
    valueWrap.innerHTML = `
      <select class="pill-select field-type-value">
        <option value="email"           ${target.value === 'email'           ? 'selected' : ''}>${t('condition.field_type.email')}</option>
        <option value="password"        ${target.value === 'password'        ? 'selected' : ''}>${t('condition.field_type.password')}</option>
        <option value="tel"             ${target.value === 'tel'             ? 'selected' : ''}>${t('condition.field_type.tel')}</option>
        <option value="number"          ${target.value === 'number'          ? 'selected' : ''}>${t('condition.field_type.number')}</option>
        <option value="url"             ${target.value === 'url'             ? 'selected' : ''}>${t('condition.field_type.url')}</option>
        <option value="search"          ${target.value === 'search'          ? 'selected' : ''}>${t('condition.field_type.search')}</option>
        <option value="textarea"        ${target.value === 'textarea'        ? 'selected' : ''}>${t('condition.field_type.textarea')}</option>
        <option value="contenteditable" ${target.value === 'contenteditable' ? 'selected' : ''}>${t('condition.field_type.contenteditable')}</option>
        <option value="text"            ${target.value === 'text'            ? 'selected' : ''}>${t('condition.field_type.text')}</option>
      </select>
    `;

    container.appendChild(opWrap);
    container.appendChild(valueWrap);

    opWrap.querySelector('.field-type-op')!.addEventListener('change', (e) => {
      target.operator = (e.target as HTMLSelectElement).value as any;
      onSave();
    });
    valueWrap.querySelector('.field-type-value')!.addEventListener('change', (e) => {
      target.value = (e.target as HTMLSelectElement).value;
      onSave();
    });
  }

  // FIELD CONTENT — operator (contains/not/equals) + free-text value,
  // checked at runtime against what's already typed in the focused field
  // (see getFieldContent in shared/utils/dom.ts).
  private renderFieldContentInputs(target: ConditionCriterion, container: HTMLElement, onSave: () => void) {
    const opWrap = document.createElement('div');
    opWrap.className = 'pill-select-wrap pill-select-wrap--op';
    opWrap.innerHTML = `
      <select class="pill-select rule-operator">
        <option value="contains"     ${target.operator === 'contains'     ? 'selected' : ''}>${t('condition.op.contains')}</option>
        <option value="not_contains" ${target.operator === 'not_contains' ? 'selected' : ''}>${t('condition.op.not_contains')}</option>
        <option value="equals"       ${target.operator === 'equals'       ? 'selected' : ''}>${t('condition.op.equals')}</option>
      </select>
    `;

    const valueWrap = document.createElement('div');
    // Tarefa 4.1: `.pill-value--wide` dá a este campo um `flex-grow` maior
    // e um `min-width` bem mais generoso que o padrão de `.pill-value`
    // (4rem) — o texto livre digitado aqui costuma ser bem mais longo que
    // um domínio ou um valor de data, então o campo precisava de mais
    // espaço para ficar legível/usável (ver regra em editor.css).
    valueWrap.className = 'pill-value pill-value--wide';
    valueWrap.innerHTML = `
      ${ICONS.fieldContent}
      <input type="text" class="rule-value" value="${escapeHtml(target.value || '')}" placeholder="${t('condition.field_content.placeholder')}" />
    `;

    container.appendChild(opWrap);
    container.appendChild(valueWrap);

    opWrap.querySelector('.rule-operator')!.addEventListener('change', (e) => {
      target.operator = (e.target as HTMLSelectElement).value as any;
      onSave();
    });
    valueWrap.querySelector('.rule-value')!.addEventListener('input', (e) => {
      target.value = (e.target as HTMLInputElement).value;
      onSave();
    });
  }

  private renderClipboardContentInputs(target: ConditionCriterion, container: HTMLElement, onSave: () => void) {
    if (target.operator !== 'contains' && target.operator !== 'equals' && target.operator !== 'not_contains') {
      target.operator = 'contains';
    }
    const opWrap = document.createElement('div');
    opWrap.className = 'pill-select-wrap pill-select-wrap--op';
    opWrap.innerHTML = `
      <select class="pill-select rule-operator">
        <option value="contains"     ${target.operator === 'contains'     ? 'selected' : ''}>${t('condition.op.contains')}</option>
        <option value="equals"       ${target.operator === 'equals'       ? 'selected' : ''}>${t('condition.op.equals')}</option>
        <option value="not_contains" ${target.operator === 'not_contains' ? 'selected' : ''}>${t('condition.op.not_contains')}</option>
      </select>
    `;

    const valueWrap = document.createElement('div');
    valueWrap.className = 'pill-value pill-value--wide';
    valueWrap.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor" style="width:14px;height:14px"><path d="M280 64h40c35.3 0 64 28.7 64 64V448c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V128C0 92.7 28.7 64 64 64h40 9.6C121 27.5 153.3 0 192 0s71 27.5 78.4 64H280zM64 112c-8.8 0-16 7.2-16 16V448c0 8.8 7.2 16 16 16H320c8.8 0 16-7.2 16-16V128c0-8.8-7.2-16-16-16H304v24c0 13.3-10.7 24-24 24H104c-13.3 0-24-10.7-24-24V112H64zm128-8a24 24 0 1 0 0-48 24 24 0 1 0 0 48z"/></svg>
      <input type="text" class="rule-value" value="${escapeHtml(target.value || '')}" placeholder="${t('condition.clipboard_content.placeholder')}" />
    `;

    container.appendChild(opWrap);
    container.appendChild(valueWrap);

    opWrap.querySelector('.rule-operator')!.addEventListener('change', (e) => {
      target.operator = (e.target as HTMLSelectElement).value as any;
      onSave();
    });
    valueWrap.querySelector('.rule-value')!.addEventListener('input', (e) => {
      target.value = (e.target as HTMLInputElement).value;
      onSave();
    });
  }

  private renderVariableValueInputs(target: ConditionCriterion, container: HTMLElement, onSave: () => void) {
    if (target.operator !== 'contains' && target.operator !== 'equals' && target.operator !== 'not_contains') {
      target.operator = 'equals';
    }
    let parsed = { key: '', val: '' };
    try {
      const p = JSON.parse(target.value || '{}');
      parsed.key = p.key || '';
      parsed.val = p.val ?? p.value ?? '';
    } catch {
      const parts = (target.value || '').split(':');
      parsed.key = parts[0] || '';
      parsed.val = parts.slice(1).join(':') || '';
    }

    const keyWrap = document.createElement('div');
    keyWrap.className = 'pill-value';
    keyWrap.style.flex = '0 1 8rem';
    keyWrap.innerHTML = `
      <input type="text" class="var-key-input" value="${escapeHtml(parsed.key)}" placeholder="${t('condition.variable_value.key_placeholder')}" />
    `;

    const opWrap = document.createElement('div');
    opWrap.className = 'pill-select-wrap pill-select-wrap--op';
    opWrap.innerHTML = `
      <select class="pill-select rule-operator">
        <option value="equals"       ${target.operator === 'equals'       ? 'selected' : ''}>${t('condition.op.equals')}</option>
        <option value="contains"     ${target.operator === 'contains'     ? 'selected' : ''}>${t('condition.op.contains')}</option>
        <option value="not_contains" ${target.operator === 'not_contains' ? 'selected' : ''}>${t('condition.op.not_contains')}</option>
      </select>
    `;

    const valWrap = document.createElement('div');
    valWrap.className = 'pill-value pill-value--wide';
    valWrap.innerHTML = `
      <input type="text" class="var-val-input" value="${escapeHtml(parsed.val)}" placeholder="${t('condition.variable_value.val_placeholder')}" />
    `;

    container.appendChild(keyWrap);
    container.appendChild(opWrap);
    container.appendChild(valWrap);

    const save = () => {
      const k = (keyWrap.querySelector('.var-key-input') as HTMLInputElement).value;
      const v = (valWrap.querySelector('.var-val-input') as HTMLInputElement).value;
      target.value = JSON.stringify({ key: k, val: v });
      onSave();
    };

    keyWrap.querySelector('.var-key-input')!.addEventListener('input', save);
    opWrap.querySelector('.rule-operator')!.addEventListener('change', (e) => {
      target.operator = (e.target as HTMLSelectElement).value as any;
      onSave();
    });
    valWrap.querySelector('.var-val-input')!.addEventListener('input', save);
  }

  private renderTimeSinceLastExpansionInputs(target: ConditionCriterion, container: HTMLElement, onSave: () => void) {
    if (target.operator !== 'before' && target.operator !== 'after') {
      target.operator = 'after';
    }
    const opWrap = document.createElement('div');
    opWrap.className = 'pill-select-wrap pill-select-wrap--op-wide';
    opWrap.innerHTML = `
      <select class="pill-select time-since-op">
        <option value="after"  ${target.operator === 'after'  ? 'selected' : ''}>${t('condition.time_since.after')}</option>
        <option value="before" ${target.operator === 'before' ? 'selected' : ''}>${t('condition.time_since.before')}</option>
      </select>
    `;

    const valWrap = document.createElement('div');
    valWrap.className = 'pill-value';
    valWrap.style.flex = '0 1 5rem';
    valWrap.innerHTML = `
      <input type="number" min="0" step="1" class="rule-value" value="${escapeHtml(target.value || '10')}" />
    `;

    const unitLabel = document.createElement('span');
    unitLabel.className = 'pill-pair-sep';
    unitLabel.textContent = t('condition.time_since.minutes');

    container.appendChild(opWrap);
    container.appendChild(valWrap);
    container.appendChild(unitLabel);

    if (!target.value) {
      target.value = '10';
      onSave();
    }

    opWrap.querySelector('.time-since-op')!.addEventListener('change', (e) => {
      target.operator = (e.target as HTMLSelectElement).value as any;
      onSave();
    });
    valWrap.querySelector('.rule-value')!.addEventListener('input', (e) => {
      target.value = (e.target as HTMLInputElement).value;
      onSave();
    });
  }
}
