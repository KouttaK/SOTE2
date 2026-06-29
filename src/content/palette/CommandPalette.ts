/**
 * src/content/palette/CommandPalette.ts
 */

import type { Flow } from '../../shared/types/index.js';
// We'll inject the CSS string manually since Vite content-script CSS imports 
// might just append to the page head, but we need it inside the Shadow DOM.
// Wait, wxt supports importing CSS as a string with ?raw or ?inline, 
// but since we are writing standard TS, let's just fetch or use the raw string.
import cssText from './CommandPalette.css?inline';

export class CommandPalette {
  private host!: HTMLDivElement;
  private shadow!: ShadowRoot;
  
  private flows: Flow[] = [];
  private filteredFlows: Flow[] = [];
  private activeIndex: number = 0;
  
  private onSelectCallback!: (flow: Flow) => void;
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

  public open(onSelect: (flow: Flow) => void, onClose: () => void) {
    if (this.isVisible) return;
    
    this.onSelectCallback = onSelect;
    this.onCloseCallback = onClose;
    
    this.previousFocus = document.activeElement as HTMLElement;
    
    document.body.appendChild(this.host);
    this.isVisible = true;
    
    this.searchInput.value = '';
    this.filterFlows('');
    
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
    this.searchInput.placeholder = 'Search flows by name or shortcut...';
    this.searchInput.addEventListener('input', () => this.filterFlows(this.searchInput.value));
    
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

  private filterFlows(query: string) {
    const q = query.toLowerCase().trim();
    
    if (!q) {
      this.filteredFlows = this.flows.slice(0, 8);
    } else {
      // 1. Exact shortcut match
      // 2. Contains in shortcut
      // 3. Contains in name
      const exactShortcuts: Flow[] = [];
      const partialShortcuts: Flow[] = [];
      const partialNames: Flow[] = [];

      for (const f of this.flows) {
        const trigger = f.blocks.find(b => b.type === 'trigger')?.data as any;
        const shortcut = (trigger?.shortcut || '').toLowerCase();
        const name = f.name.toLowerCase();

        if (shortcut === q) {
          exactShortcuts.push(f);
        } else if (shortcut.includes(q)) {
          partialShortcuts.push(f);
        } else if (name.includes(q)) {
          partialNames.push(f);
        }
      }

      // Sort within categories by usage (if available)
      const sortByUsage = (a: Flow, b: Flow) => (b.stats?.usageCount || 0) - (a.stats?.usageCount || 0);
      
      exactShortcuts.sort(sortByUsage);
      partialShortcuts.sort(sortByUsage);
      partialNames.sort(sortByUsage);

      this.filteredFlows = [...exactShortcuts, ...partialShortcuts, ...partialNames].slice(0, 8);
    }

    this.activeIndex = 0;
    this.renderResults();
  }

  private renderResults() {
    this.resultsList.innerHTML = '';
    
    if (this.filteredFlows.length === 0) {
      this.resultsList.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: #737373; font-size: 0.875rem;">
          No matching flows found.
        </div>
      `;
      return;
    }

    this.filteredFlows.forEach((flow, idx) => {
      const el = document.createElement('div');
      el.className = 'result-item' + (idx === this.activeIndex ? ' active' : '');
      
      const trigger = flow.blocks.find(b => b.type === 'trigger')?.data as any;
      const shortcut = trigger?.shortcut || 'none';
      const actionBlock = flow.blocks.find(b => b.type === 'action' || b.type === 'condition');
      
      let preview = '';
      if (actionBlock && actionBlock.type === 'action') {
        const content = (actionBlock.data as any).content || '';
        // Strip HTML and interactive tokens
        preview = this.generatePreview(content);
      } else if (actionBlock && actionBlock.type === 'condition') {
        preview = 'Conditional logic block...';
      }

      const activeBadgeClass = idx === this.activeIndex ? 'active' : 'inactive';
      const prefix = trigger?.mode === 'exact_match' ? trigger.exactMatchChar || '/' : '';

      el.innerHTML = `
        <div class="active-indicator"></div>
        <div class="result-content">
          <span class="result-badge ${activeBadgeClass}">${prefix}${shortcut}</span>
          <span class="result-text">${flow.name} — <span style="opacity:0.7">${preview}</span></span>
        </div>
        <div class="result-hint">
          <span>Press</span>
          <kbd>Enter</kbd>
          <span>to insert</span>
        </div>
        <div class="result-hint-alt">
          <kbd>↑↓</kbd>
        </div>
      `;

      el.addEventListener('click', () => {
        this.selectFlow(flow);
      });
      el.addEventListener('mouseover', () => {
        this.activeIndex = idx;
        this.updateSelectionUI();
      });

      this.resultsList.appendChild(el);
    });
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

    if (e.key === 'ArrowDown') {
      this.activeIndex = (this.activeIndex + 1) % this.filteredFlows.length;
      this.updateSelectionUI();
    } else if (e.key === 'ArrowUp') {
      this.activeIndex = (this.activeIndex - 1 + this.filteredFlows.length) % this.filteredFlows.length;
      this.updateSelectionUI();
    } else if (e.key === 'Enter') {
      if (this.filteredFlows[this.activeIndex]) {
        this.selectFlow(this.filteredFlows[this.activeIndex]);
      }
    }
  }

  private selectFlow(flow: Flow) {
    this.close();
    // Use setTimeout so close() executes and focus returns before injection fires
    setTimeout(() => {
      this.onSelectCallback(flow);
    }, 10);
  }
}
