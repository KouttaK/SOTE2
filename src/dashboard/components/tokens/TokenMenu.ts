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
import { TOKEN_META, type TokenMetaDef } from '../../../shared/constants/tokenColors.js';

const DYNAMIC_ITEMS: TokenMetaDef[] = [
  TOKEN_META.random,
  TOKEN_META.input,
  TOKEN_META.date,
  TOKEN_META.choice,
  TOKEN_META.clipboard,
  TOKEN_META.cursor,
  TOKEN_META.url,
  TOKEN_META.title,
  TOKEN_META.counter,
  TOKEN_META.math,
];

const FLOW_REF_ITEMS: TokenMetaDef[] = [
  TOKEN_META.flow_ref,
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
