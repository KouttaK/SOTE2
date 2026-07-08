/**
 * src/content/palette/CommandPalette.ts
 */

import type { Flow, Form, FormField } from '../../shared/types/index.js';
import { buildSearchResults, SearchResultItem, SearchScope } from '../engine/SearchTriggerDetector.js';
// We'll inject the CSS string manually since Vite content-script CSS imports 
// might just append to the page head, but we need it inside the Shadow DOM.
// Wait, wxt supports importing CSS as a string with ?raw or ?inline, 
// but since we are writing standard TS, let's just fetch or use the raw string.
import cssText from './CommandPalette.css?inline';

/**
 * §7 — the Palette is the secondary way to reach the same search Gatilho
 * de Busca offers via `//`/`///` (same matching + ranking, see
 * SearchTriggerDetector.ts): useful outside text fields, or for people who
 * prefer browsing visually instead of typing a prefix.
 */
export type PaletteSelection = { kind: 'flow'; flow: Flow } | { kind: 'form-field'; form: Form; field: FormField };

export class CommandPalette {
  private host!: HTMLDivElement;
  private shadow!: ShadowRoot;
  
  private flows: Flow[] = [];
  private forms: Form[] = [];
  private hostname: string = '';
  private includeFlows: boolean = true;
  /** Starts scoped to the current site (like `//`); "buscar em todos os sites" flips this for the rest of the session. */
  private scope: SearchScope = 'domain';

  private results: SearchResultItem[] = [];
  private mode: 'results' | 'submenu' = 'results';
  private submenuForm: Form | null = null;
  private footerSuggestion: { label: string; onClick: () => void } | null = null;
  private activeIndex: number = 0;
  
  private onSelectCallback!: (sel: PaletteSelection) => void;
  private onCloseCallback!: () => void;
  
  private container!: HTMLDivElement;
  private searchInput!: HTMLInputElement;
  private resultsList!: HTMLDivElement;

  private isVisible: boolean = false;
  private previousFocus: HTMLElement | null = null;
  private keydownListener: (e: KeyboardEvent) => void;

  constructor() {
    this.createDOM();
    this.keydownListener = this.handleKeydown.bind(this);
  }

  public updateFlows(flows: Flow[]) {
    this.flows = flows.filter(f => f.enabled);
  }

  public updateForms(forms: Form[]) {
    this.forms = forms;
  }

  /** Current page's domain + whether Flows should be included at all (mirrors Settings → Gatilho de Busca → "Incluir Atalhos"). */
  public updateContext(hostname: string, includeFlows: boolean) {
    this.hostname = hostname;
    this.includeFlows = includeFlows;
  }

  public open(onSelect: (sel: PaletteSelection) => void, onClose: () => void) {
    if (this.isVisible) return;
    
    this.onSelectCallback = onSelect;
    this.onCloseCallback = onClose;
    
    this.previousFocus = document.activeElement as HTMLElement;
    
    document.body.appendChild(this.host);
    this.isVisible = true;

    this.mode = 'results';
    this.submenuForm = null;
    this.scope = 'domain';
    
    this.searchInput.value = '';
    this.filterResults('');
    
    document.addEventListener('keydown', this.keydownListener, true);
    
    // Focus search input on next tick
    setTimeout(() => {
      this.searchInput.focus();
    }, 10);
  }

  public close() {
    if (!this.isVisible) return;
    
    document.removeEventListener('keydown', this.keydownListener, true);
    
    if (this.host.parentNode) {
      this.host.parentNode.removeChild(this.host);
    }
    this.isVisible = false;
    
    if (this.previousFocus) {
      this.previousFocus.focus();
    }
    
    this.onCloseCallback();
  }

  private createDOM() {
    this.host = document.createElement('div');
    this.host.className = 'sote-palette-host';
    this.shadow = this.host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = cssText;
    this.shadow.appendChild(style);

    const backdrop = document.createElement('div');
    backdrop.className = 'backdrop';
    backdrop.addEventListener('click', () => this.close());
    this.shadow.appendChild(backdrop);

    this.container = document.createElement('div');
    this.container.className = 'modal';
    
    // Search Header
    const searchHeader = document.createElement('div');
    searchHeader.className = 'search-header';
    
    const iconBox = document.createElement('div');
    iconBox.className = 'search-icon-box';
    iconBox.innerHTML = `<span>S</span>`;
    
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'search-input-wrapper';
    inputWrapper.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
        <path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"/>
      </svg>
    `;
    
    this.searchInput = document.createElement('input');
    this.searchInput.className = 'search-input';
    this.searchInput.type = 'text';
    this.searchInput.placeholder = 'Search forms or flows by name, shortcut, or content...';
    this.searchInput.addEventListener('input', () => this.filterResults(this.searchInput.value));
    
    inputWrapper.appendChild(this.searchInput);
    
    const escHint = document.createElement('div');
    escHint.innerHTML = `<kbd>ESC</kbd>`;
    
    searchHeader.appendChild(iconBox);
    searchHeader.appendChild(inputWrapper);
    searchHeader.appendChild(escHint);
    
    // Results
    this.resultsList = document.createElement('div');
    this.resultsList.className = 'results-list';
    
    // Footer
    const footer = document.createElement('div');
    footer.className = 'footer';
    footer.innerHTML = `
      <div class="footer-left">
        <span class="footer-shortcut"><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
        <span class="footer-divider"></span>
        <span class="footer-shortcut"><kbd>⏎</kbd> insert</span>
      </div>
      <div class="footer-right">
        <span>SOTE</span>
      </div>
    `;

    this.container.appendChild(searchHeader);
    this.container.appendChild(this.resultsList);
    this.container.appendChild(footer);
    
    this.shadow.appendChild(this.container);
  }

  private currentRows(): SearchResultItem[] {
    if (this.mode === 'submenu' && this.submenuForm) {
      return this.submenuForm.fields.map((field) => ({
        kind: 'form-field' as const,
        form: this.submenuForm as Form,
        field,
        matchLevel: 0 as const,
        matchedIn: null,
      }));
    }
    return this.results;
  }

  private filterResults(query: string) {
    const { results, noFormResultsForSite } = buildSearchResults({
      query: query.trim(),
      scope: this.scope,
      hostname: this.hostname,
      forms: this.forms,
      flows: this.flows,
      includeFlows: this.includeFlows,
    });

    this.results = results.slice(0, 8);
    this.footerSuggestion =
      this.scope === 'domain' && noFormResultsForSite
        ? {
            label: 'No Forms for this site — search all sites',
            onClick: () => {
              this.scope = 'global';
              this.filterResults(this.searchInput.value);
            },
          }
        : null;

    this.activeIndex = 0;
    this.renderResults();
  }

  private renderResults() {
    this.resultsList.innerHTML = '';
    const rows = this.currentRows();

    if (this.mode === 'submenu' && this.submenuForm) {
      const breadcrumb = document.createElement('div');
      breadcrumb.className = 'palette-breadcrumb';
      breadcrumb.textContent = this.submenuForm.name;
      this.resultsList.appendChild(breadcrumb);
    }

    if (rows.length === 0) {
      this.resultsList.innerHTML += `
        <div style="padding: 2rem; text-align: center; color: #737373; font-size: 0.875rem;">
          No matching forms or flows found.
        </div>
      `;
    }

    rows.forEach((item, idx) => {
      const el = document.createElement('div');
      el.className = 'result-item' + (idx === this.activeIndex ? ' active' : '');

      const activeBadgeClass = idx === this.activeIndex ? 'active' : 'inactive';
      const typeLabel = item.kind === 'flow' ? 'Atalho' : 'Formulário';
      const typeClass = item.kind === 'flow' ? 'flow' : 'form';

      const badgeText = this.badgeTextFor(item);
      const preview = this.previewTextFor(item);

      el.innerHTML = `
        <div class="active-indicator"></div>
        <div class="result-content">
          <span class="palette-type-badge ${typeClass}">${typeLabel}</span>
          <span class="result-badge ${activeBadgeClass}">${badgeText}</span>
          <span class="result-text">${this.titleFor(item)} — <span style="opacity:0.7">${preview}</span></span>
        </div>
        <div class="result-hint">
          <span>Press</span>
          <kbd>Enter</kbd>
          <span>to ${item.kind === 'form' ? 'browse fields' : 'insert'}</span>
        </div>
        <div class="result-hint-alt">
          <kbd>↑↓</kbd>
        </div>
      `;

      el.addEventListener('click', () => this.activate(idx));
      el.addEventListener('mouseover', () => {
        this.activeIndex = idx;
        this.updateSelectionUI();
      });

      this.resultsList.appendChild(el);
    });

    if (this.mode === 'results' && this.footerSuggestion) {
      const suggestion = document.createElement('div');
      suggestion.className = 'palette-footer-suggestion';
      suggestion.textContent = this.footerSuggestion.label;
      suggestion.addEventListener('click', () => this.footerSuggestion?.onClick());
      this.resultsList.appendChild(suggestion);
    }
  }

  private titleFor(item: SearchResultItem): string {
    if (item.kind === 'flow') return item.flow.name;
    if (item.kind === 'form') return item.form.name;
    return item.field.name || '—';
  }

  private badgeTextFor(item: SearchResultItem): string {
    if (item.kind === 'flow') {
      const trigger = item.flow.blocks.find((b) => b.type === 'trigger')?.data as any;
      const shortcut = trigger?.shortcut || 'none';
      const prefix = trigger?.mode === 'exact_match' ? trigger.exactMatchChar || '/' : '';
      return `${prefix}${shortcut}`;
    }
    if (item.kind === 'form') return `${item.form.fields.length} campo(s)`;
    return item.field.type || 'texto';
  }

  private previewTextFor(item: SearchResultItem): string {
    if (item.kind === 'form') return this.submenuForm ? '' : (item.form.sites.join(', ') || 'sem restrição de site');
    if (item.matchedIn === 'content' && item.snippet) return item.snippet;

    if (item.kind === 'flow') {
      const actionBlock = item.flow.blocks.find((b) => b.type === 'action' || b.type === 'condition');
      if (actionBlock && actionBlock.type === 'action') return this.generatePreview((actionBlock.data as any).content || '');
      if (actionBlock && actionBlock.type === 'condition') return 'Conditional logic block...';
      return '';
    }

    // form-field, matched by name (or browse mode)
    return this.generatePreview(item.field.value?.content || '');
  }

  private generatePreview(html: string): string {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    
    // Replace tokens with placeholders
    const pills = tmp.querySelectorAll('.token-pill');
    pills.forEach(p => {
      const label = p.textContent?.trim() || 'token';
      const textNode = document.createTextNode(`[${label}]`);
      p.parentNode?.replaceChild(textNode, p);
    });
    
    return tmp.textContent?.replace(/\s+/g, ' ').trim() || '';
  }

  private updateSelectionUI() {
    const items = this.resultsList.querySelectorAll('.result-item');
    items.forEach((item, idx) => {
      const isAct = idx === this.activeIndex;
      item.className = 'result-item' + (isAct ? ' active' : '');
      
      const badge = item.querySelector('.result-badge');
      if (badge) {
        badge.className = 'result-badge ' + (isAct ? 'active' : 'inactive');
      }
    });

    // Scroll into view
    if (items[this.activeIndex]) {
      (items[this.activeIndex] as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  }

  private handleKeydown(e: KeyboardEvent) {
    if (!this.isVisible) return;
    const rows = this.currentRows();
    
    // Prevent default scrolling for up/down
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.close();
      return;
    }

    if (rows.length === 0) return;

    if (e.key === 'ArrowDown') {
      this.activeIndex = (this.activeIndex + 1) % rows.length;
      this.updateSelectionUI();
    } else if (e.key === 'ArrowUp') {
      this.activeIndex = (this.activeIndex - 1 + rows.length) % rows.length;
      this.updateSelectionUI();
    } else if (e.key === 'Enter') {
      this.activate(this.activeIndex);
    }
  }

  /** Selecting a Form (name-matched, no specific field) drills into its fields — same palette instance, no close/reopen (spec §4.1, reused here too). */
  private activate(index: number) {
    const rows = this.currentRows();
    const item = rows[index];
    if (!item) return;

    if (item.kind === 'form') {
      this.mode = 'submenu';
      this.submenuForm = item.form;
      this.activeIndex = 0;
      this.renderResults();
      return;
    }

    const sel: PaletteSelection = item.kind === 'flow' ? { kind: 'flow', flow: item.flow } : { kind: 'form-field', form: item.form, field: item.field };
    this.close();
    // Use setTimeout so close() executes and focus returns before injection fires
    setTimeout(() => {
      this.onSelectCallback(sel);
    }, 10);
  }
}
