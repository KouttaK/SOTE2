/**
 * src/dashboard/components/tokens/TokenMenu.ts
 *
 * Matches ref_pages/criadorFluxo.htm's "TOKEN" dropdown: a search field,
 * a "Dinâmico" section, and a "Referência de Fluxo" section — each row is
 * a colored icon box + title + small colored type badge + description,
 * using the same per-type hues as the token pills inside the editor
 * (see tokens.css's .token-* colors) so a token looks the same whether
 * it's in this menu, inserted as a pill, or listed in the preview below.
 */

import type { Token } from '../../../shared/types/index.js';
import { t } from '../../../shared/i18n/index.js';

interface MenuItemDef {
  type: Token['type'];
  icon: string;
  viewbox?: string;
  shapes?: string;
  /** Matches the corresponding .token-<type> color in tokens.css. */
  color: string;
  badge: string; // small uppercase label shown on the row (e.g. "token", "pausa", "flow ref")
}

const DYNAMIC_ITEMS: MenuItemDef[] = [
  { type: 'random', icon: '', viewbox: '0 0 24 24', shapes: '<rect x="3" y="3" width="18" height="18" rx="4" ry="4" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="8" cy="8" r="1.6" fill="currentColor"/><circle cx="16" cy="8" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="8" cy="16" r="1.6" fill="currentColor"/><circle cx="16" cy="16" r="1.6" fill="currentColor"/>', color: '#d97706', badge: 'token' },
  { type: 'input', icon: 'M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.2 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z', color: '#9333ea', badge: 'pausa' },
  { type: 'date', icon: 'M152 24c0-13.3-10.7-24-24-24s-24 10.7-24 24V64H64C28.7 64 0 92.7 0 128v16 48V448c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V192 144 128c0-35.3-28.7-64-64-64H344V24c0-13.3-10.7-24-24-24s-24 10.7-24 24V64H152V24zM48 192H400V448c0 8.8-7.2 16-16 16H64c-8.8 0-16-7.2-16-16V192z', viewbox: '0 0 448 512', color: '#525252', badge: 'token' },
  { type: 'choice', icon: 'M64 144a48 48 0 1 0 0-96 48 48 0 1 0 0 96zM192 64c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192z', color: '#2563eb', badge: 'token' },
  { type: 'clipboard', icon: 'M192 0c-41.8 0-77.4 26.7-90.5 64H64C28.7 64 0 92.7 0 128V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V128c0-35.3-28.7-64-64-64H282.5C269.4 26.7 233.8 0 192 0zm0 64a32 32 0 1 1 0 64 32 32 0 1 1 0-64zM112 192H272c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16z', viewbox: '0 0 384 512', color: '#f97316', badge: 'token' },
  { type: 'cursor', icon: 'M0 55.2V426c0 12.2 9.9 22 22 22c4.6 0 8.9-1.4 12.5-3.9l98.8-67.9l46.2 80c3.9 6.7 10.3 11.5 17.8 13.3s15.3-.2 21.3-5.2l29.4-24.8c8.3-7 11.2-18.7 7-28.7l-42.3-100.9l98.8 32c10.8 3.5 22.8-1.5 27.8-11.8c4.9-10.1 2.3-22.3-6.1-29.6l-297-251C30.6 44 21.6 46.1 14.8 53S0 67.5 0 77.2V55.2z', viewbox: '0 0 320 512', color: '#16a34a', badge: 'token' },
  { type: 'url', icon: 'M579.8 267.7c56.5-56.5 56.5-148 0-204.5c-50-50-128.8-56.5-186.3-15.4l-1.6 1.1c-14.4 10.3-17.7 30.3-7.4 44.6s30.3 17.7 44.6 7.4l1.6-1.1c32.1-22.9 76-19.3 103.8 8.6c31.5 31.5 31.5 82.5 0 114L422.3 334.8c-31.5 31.5-82.5 31.5-114 0c-27.9-27.9-31.5-71.8-8.6-103.8l1.1-1.6c10.3-14.4 6.9-34.4-7.4-44.6s-34.4-6.9-44.6 7.4l-1.1 1.6C206.5 251.2 213 330 263 380c56.5 56.5 148 56.5 204.5 0L579.8 267.7zM60.2 244.3c-56.5 56.5-56.5 148 0 204.5c50 50 128.8 56.5 186.3 15.4l1.6-1.1c14.4-10.3 17.7-30.3 7.4-44.6s-30.3-17.7-44.6-7.4l-1.6 1.1c-32.1 22.9-76 19.3-103.8-8.6C74 372 74 321 105.5 289.5L217.7 177.2c31.5-31.5 82.5-31.5 114 0c27.9 27.9 31.5 71.8 8.6 103.9l-1.1 1.6c-10.3 14.4-6.9 34.4 7.4 44.6s34.4 6.9 44.6-7.4l1.1-1.6C433.5 260.8 427 182 377 132c-56.5-56.5-148-56.5-204.5 0L60.2 244.3z', viewbox: '0 0 640 512', color: '#0d9488', badge: 'token' },
  { type: 'title', icon: 'M64 0C28.7 0 0 28.7 0 64V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V160H256c-17.7 0-32-14.3-32-32V0H64zM256 0V128H384L256 0zM112 256H272c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64H272c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64H272c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16z', viewbox: '0 0 384 512', color: '#eab308', badge: 'token' },
];

const FLOW_REF_ITEMS: MenuItemDef[] = [
  { type: 'flow_ref', icon: '', viewbox: '0 0 24 24', shapes: '<path d="M4 5h9a4 4 0 0 1 4 4v10" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M13 15l4 4 4-4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>', color: 'var(--color-violet)', badge: 'flow ref' },
];

export class TokenMenu {
  private el: HTMLElement;
  private onSelect: (type: Token['type']) => void;
  private disabledTypes: Set<Token['type']> = new Set();
  private searchQuery = '';

  constructor(onSelect: (type: Token['type']) => void) {
    this.onSelect = onSelect;
    this.el = document.createElement('div');
    this.el.className = 'token-menu-overlay';
    this.render();
  }

  public getElement(): HTMLElement {
    return this.el;
  }

  public toggle() {
    this.el.classList.toggle('is-open');
    if (this.el.classList.contains('is-open')) {
      this.el.querySelector<HTMLInputElement>('.token-menu-search-input')?.focus();
    }
  }

  public hide() {
    this.el.classList.remove('is-open');
  }

  /**
   * Marks the given token types as unavailable (e.g. "cursor" once a flow
   * already has one — only one Cursor token per flow is supported). The
   * menu item still shows, greyed out with an explanatory title, but
   * selecting it does nothing.
   */
  public setDisabledTypes(types: Token['type'][]) {
    this.disabledTypes = new Set(types);
    this.render();
  }

  private renderItem(item: MenuItemDef): string {
    const isDisabled = this.disabledTypes.has(item.type);
    const label = t(`token.${item.type}`);
    const desc = isDisabled ? t('token.already_used') : t(`token.${item.type}.desc`);
    return /* html */ `
      <button type="button" class="token-menu-row${isDisabled ? ' is-disabled' : ''}" data-type="${item.type}" ${isDisabled ? `title="${t('token.cursor_limit_title')}"` : ''}>
        <div class="token-menu-row-icon" style="background:color-mix(in srgb, ${item.color} 12%, transparent); color:${item.color};">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="${item.viewbox || '0 0 512 512'}" fill="currentColor">
            ${item.shapes || `<path d="${item.icon}" />`}
          </svg>
        </div>
        <div class="token-menu-row-text">
          <div class="token-menu-row-head">
            <span class="token-menu-row-title">${label}</span>
            <span class="token-menu-row-badge" style="color:${item.color}; background:color-mix(in srgb, ${item.color} 12%, transparent);">${item.badge}</span>
          </div>
          <p class="token-menu-row-desc">${desc}</p>
        </div>
      </button>
    `;
  }

  private render() {
    const q = this.searchQuery.trim().toLowerCase();
    const matches = (item: MenuItemDef) => !q || t(`token.${item.type}`).toLowerCase().includes(q);

    const dynamic = DYNAMIC_ITEMS.filter(matches);
    const flowRef = FLOW_REF_ITEMS.filter(matches);

    this.el.innerHTML = /* html */ `
      <div class="token-menu-search-wrap">
        <span class="token-menu-search-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"/></svg>
        </span>
        <input type="text" class="token-menu-search-input" placeholder="${t('token.menu.search_placeholder')}" value="${this.searchQuery}" autocomplete="off" spellcheck="false" />
      </div>
      <div class="token-menu-list">
        ${dynamic.length ? `<p class="token-menu-section-label">${t('token.menu.section_dynamic')}</p>${dynamic.map(i => this.renderItem(i)).join('')}` : ''}
        ${flowRef.length ? `<p class="token-menu-section-label is-second">${t('token.menu.section_flow_ref')}</p>${flowRef.map(i => this.renderItem(i)).join('')}` : ''}
        ${!dynamic.length && !flowRef.length ? `<p class="token-menu-empty">${t('token.menu.no_results')}</p>` : ''}
      </div>
    `;

    const searchInput = this.el.querySelector<HTMLInputElement>('.token-menu-search-input');
    searchInput?.addEventListener('mousedown', (e) => e.stopPropagation());
    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      const caret = searchInput.selectionStart;
      this.render();
      const newInput = this.el.querySelector<HTMLInputElement>('.token-menu-search-input');
      newInput?.focus();
      if (caret !== null) newInput?.setSelectionRange(caret, caret);
    });

    this.el.querySelectorAll('.token-menu-row').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Prevent losing focus from contenteditable
        if (el.classList.contains('is-disabled')) return;
        const type = (el as HTMLElement).dataset.type as Token['type'];
        this.onSelect(type);
        this.hide();
      });
    });
  }
}
