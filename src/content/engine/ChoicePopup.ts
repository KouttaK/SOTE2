/**
 * src/content/engine/ChoicePopup.ts
 */

import type { Token } from '../../shared/types/index.js';

export class ChoicePopup {
  private host!: HTMLDivElement;
  private shadow!: ShadowRoot;
  
  constructor() {
    this.host = document.createElement('div');
    this.host.style.position = 'absolute';
    this.host.style.zIndex = '2147483647'; // Max z-index
    this.shadow = this.host.attachShadow({ mode: 'open' });
    this.injectStyles();
  }

  private injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: block;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }
      .popup-container {
        background: #171717;
        border: 1px solid #404040;
        border-radius: 0.5rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
        padding: 0.75rem;
        width: max-content;
        min-width: 200px;
        color: #fff;
      }
      .popup-title {
        font-size: 0.75rem;
        color: #a3a3a3;
        margin: 0 0 0.5rem 0;
        font-weight: 500;
        text-transform: uppercase;
      }
      /* Choice styles */
      .choice-list {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .choice-item {
        background: transparent;
        border: none;
        color: #d4d4d4;
        text-align: left;
        padding: 0.5rem 0.75rem;
        border-radius: 0.25rem;
        cursor: pointer;
        font-size: 0.875rem;
        transition: background 150ms;
      }
      .choice-item:hover, .choice-item.active {
        background: #262626;
        color: #fff;
      }
      /* Input styles */
      .input-field {
        width: 100%;
        background: #262626;
        border: 1px solid #404040;
        border-radius: 0.25rem;
        padding: 0.5rem;
        color: #fff;
        font-size: 0.875rem;
        margin-bottom: 0.5rem;
        box-sizing: border-box;
      }
      .input-field:focus {
        outline: none;
        border-color: #3b82f6;
      }
      .btn-submit {
        width: 100%;
        background: #3b82f6;
        color: #fff;
        border: none;
        padding: 0.5rem;
        border-radius: 0.25rem;
        cursor: pointer;
        font-size: 0.875rem;
        font-weight: 500;
      }
      .btn-submit:hover {
        background: #2563eb;
      }
    `;
    this.shadow.appendChild(style);
  }

  public showForToken(token: Token, targetElement: HTMLElement): Promise<string | null> {
    return new Promise((resolve) => {
      this.positionPopup(targetElement);
      document.body.appendChild(this.host);

      const container = document.createElement('div');
      container.className = 'popup-container';

      if (token.type === 'choice') {
        const title = document.createElement('p');
        title.className = 'popup-title';
        title.textContent = 'Select an option';
        container.appendChild(title);

        const list = document.createElement('div');
        list.className = 'choice-list';
        
        const options = (token.config?.options as string[]) || ['Error: No options'];
        let activeIndex = 0;

        options.forEach((opt, idx) => {
          const btn = document.createElement('button');
          btn.className = 'choice-item' + (idx === 0 ? ' active' : '');
          btn.textContent = opt;
          btn.addEventListener('click', () => {
            this.close();
            resolve(opt);
          });
          btn.addEventListener('mouseover', () => {
            list.querySelectorAll('.choice-item').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            activeIndex = idx;
          });
          list.appendChild(btn);
        });
        
        container.appendChild(list);

        // Keyboard nav
        const onKeyDown = (e: KeyboardEvent) => {
          const items = list.querySelectorAll('.choice-item');
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIndex = (activeIndex + 1) % items.length;
            items.forEach((el, i) => el.classList.toggle('active', i === activeIndex));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIndex = (activeIndex - 1 + items.length) % items.length;
            items.forEach((el, i) => el.classList.toggle('active', i === activeIndex));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            this.close();
            document.removeEventListener('keydown', onKeyDown);
            resolve(options[activeIndex]);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            this.close();
            document.removeEventListener('keydown', onKeyDown);
            resolve(null);
          }
        };
        document.addEventListener('keydown', onKeyDown);

      } else if (token.type === 'input') {
        const title = document.createElement('p');
        title.className = 'popup-title';
        title.textContent = (token.config?.label as string) || 'Enter value';
        container.appendChild(title);

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'input-field';
        input.placeholder = (token.config?.placeholder as string) || '';
        container.appendChild(input);

        const btn = document.createElement('button');
        btn.className = 'btn-submit';
        btn.textContent = 'Confirm';
        btn.addEventListener('click', () => {
          this.close();
          resolve(input.value);
        });
        container.appendChild(btn);

        const onKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.close();
            document.removeEventListener('keydown', onKeyDown);
            resolve(input.value);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            this.close();
            document.removeEventListener('keydown', onKeyDown);
            resolve(null);
          }
        };
        document.addEventListener('keydown', onKeyDown);
        
        // Auto focus
        setTimeout(() => input.focus(), 10);
      }

      this.shadow.appendChild(container);
    });
  }

  private close() {
    if (this.host.parentNode) {
      this.host.parentNode.removeChild(this.host);
    }
    // Remove all children from shadow except style
    Array.from(this.shadow.childNodes).forEach(node => {
      if (node.nodeName !== 'STYLE') {
        this.shadow.removeChild(node);
      }
    });
  }

  private positionPopup(target: HTMLElement) {
    const rect = target.getBoundingClientRect();
    this.host.style.top = `${rect.bottom + window.scrollY + 8}px`;
    this.host.style.left = `${rect.left + window.scrollX}px`;
    
    // Simple viewport bounds check could be added here
  }
}
