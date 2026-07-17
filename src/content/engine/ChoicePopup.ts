/**
 * src/content/engine/ChoicePopup.ts
 */

import type { Token, Variable } from '../../shared/types/index.js';
import { resolveVariablesInText } from '../../shared/utils/variableResolver.js';

export class ChoicePopup {
  private host!: HTMLDivElement;
  private shadow!: ShadowRoot;
  
  constructor() {
    this.host = document.createElement('div');
    // Lets TextMonitor's document-level keydown/input listeners recognize
    // and ignore keystrokes typed into this popup's own field (see
    // TextMonitor.ts) — without this, Space/Tab/Enter typed here could leak
    // through as a (stale) trigger-key match and steal focus back.
    this.host.className = 'sote-choice-popup-host';
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
        display: flex;
        align-items: center;
        gap: 0.625rem;
      }
      .choice-key {
        flex-shrink: 0;
        width: 1.125rem;
        height: 1.125rem;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.6875rem;
        font-weight: 600;
        color: #737373;
        background: #262626;
        border: 1px solid #404040;
        border-radius: 0.25rem;
      }
      .choice-item.active .choice-key,
      .choice-item:hover .choice-key {
        color: #fff;
        border-color: #525252;
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

  public showForToken(token: Token, targetElement: HTMLElement, variables: Variable[] = []): Promise<string | null> {
    return new Promise((resolve) => {
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

        const rawOptions = (token.config?.options as string[]) || ['Error: No options'];
        // Choice options can reference global variables too (e.g. "Olá
        // {{NOME_CLIENTE}}, tudo bem?") — resolve them once, up front, so
        // both what's shown in the list and what gets returned/injected
        // are the real value, never the raw "{{...}}" placeholder.
        const options = rawOptions.map((opt) => resolveVariablesInText(opt, false, variables));
        let activeIndex = 0;
        let settled = false;

        // Auto-pick the first option if the user doesn't respond in time.
        const AUTO_SELECT_MS = 30000;
        let autoSelectTimer: ReturnType<typeof setTimeout> | null = null;

        const finish = (value: string | null) => {
          if (settled) return; // Promise already resolved, ignore further calls
          settled = true;
          if (autoSelectTimer) clearTimeout(autoSelectTimer);
          document.removeEventListener('keydown', onKeyDown, true);
          document.removeEventListener('mousedown', onDocMouseDown, true);
          this.close();
          resolve(value);
        };

        options.forEach((opt, idx) => {
          const btn = document.createElement('button');
          btn.className = 'choice-item' + (idx === 0 ? ' active' : '');

          // Show the number key (1-9, then 0 for a 10th option) so the
          // user knows which key expands each choice.
          if (idx < 10) {
            const keyLabel = document.createElement('span');
            keyLabel.className = 'choice-key';
            keyLabel.textContent = String((idx + 1) % 10);
            btn.appendChild(keyLabel);
          }
          const labelSpan = document.createElement('span');
          labelSpan.textContent = opt;
          btn.appendChild(labelSpan);

          btn.addEventListener('click', () => finish(opt));
          btn.addEventListener('mouseover', () => {
            list.querySelectorAll('.choice-item').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            activeIndex = idx;
          });
          list.appendChild(btn);
        });

        container.appendChild(list);

        // Keyboard nav: arrows to move, Enter to confirm, Esc to cancel,
        // and number keys (1-9, 0) to jump straight to & confirm an option.
        const onKeyDown = (e: KeyboardEvent) => {
          e.stopPropagation(); // prevent site scripts from intercepting the keystroke
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
            finish(options[activeIndex]);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            finish(null);
          } else if (/^[0-9]$/.test(e.key)) {
            // '1'..'9' select options 0..8, '0' selects the 10th option.
            const pressed = parseInt(e.key, 10);
            const optionIndex = pressed === 0 ? 9 : pressed - 1;
            if (optionIndex < options.length) {
              e.preventDefault();
              finish(options[optionIndex]);
            }
          }
        };
        document.addEventListener('keydown', onKeyDown, true);

        // Click outside the popup cancels it.
        const onDocMouseDown = (e: MouseEvent) => {
          const path = e.composedPath ? e.composedPath() : [];
          if (path.includes(this.host)) return; // click was inside the popup
          finish(null);
        };
        // Registered on the next tick so the click/keypress that triggered
        // the expansion itself doesn't immediately close the popup.
        setTimeout(() => document.addEventListener('mousedown', onDocMouseDown, true), 0);

        autoSelectTimer = setTimeout(() => finish(options[0]), AUTO_SELECT_MS);

      } else if (token.type === 'input') {
        const title = document.createElement('p');
        title.className = 'popup-title';
        title.textContent = resolveVariablesInText((token.config?.label as string) || 'Enter value', false, variables);
        container.appendChild(title);

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'input-field';
        input.placeholder = resolveVariablesInText((token.config?.placeholder as string) || '', false, variables);
        container.appendChild(input);

        const btn = document.createElement('button');
        btn.className = 'btn-submit';
        btn.textContent = 'Confirm';

        // Focus guard: reclaims focus when a site script steals it (e.g.
        // sites that listen for keydown and force-focus their own input).
        // The guard is disabled *before* close() so the blur fired by
        // removing the host doesn't try to refocus a detached element.
        let focusGuardActive = true;
        input.addEventListener('blur', () => {
          if (!focusGuardActive) return;
          requestAnimationFrame(() => {
            if (document.body.contains(this.host)) input.focus();
          });
        });

        btn.addEventListener('click', () => {
          focusGuardActive = false;
          document.removeEventListener('keydown', onKeyDown, true);
          this.close();
          resolve(input.value);
        });
        container.appendChild(btn);

        const onKeyDown = (e: KeyboardEvent) => {
          e.stopPropagation(); // prevent site scripts from intercepting the keystroke
          if (e.key === 'Enter') {
            e.preventDefault();
            focusGuardActive = false;
            document.removeEventListener('keydown', onKeyDown, true);
            this.close();
            resolve(input.value);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            focusGuardActive = false;
            document.removeEventListener('keydown', onKeyDown, true);
            this.close();
            resolve(null);
          }
        };
        document.addEventListener('keydown', onKeyDown, true);
        
        // Auto focus
        setTimeout(() => input.focus(), 10);
      }

      this.shadow.appendChild(container);
      this.positionPopup(targetElement);
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
    const margin = 8;
    const rect = target.getBoundingClientRect();
    // Real size now that the popup's content has actually been built and
    // attached to the DOM (host is already position:absolute + appended,
    // so this reflects its final rendered width/height).
    const hostRect = this.host.getBoundingClientRect();
    const viewportW = document.documentElement.clientWidth;
    const viewportH = document.documentElement.clientHeight;

    const spaceBelow = viewportH - rect.bottom;
    const spaceAbove = rect.top;

    // Prefer opening below the field (matches the original behaviour), but
    // flip above it when there isn't enough room below — e.g. a text field
    // pinned to the bottom of the screen (position: fixed), where
    // rect.bottom sits right at the edge of the viewport and a "below"
    // popup would render entirely off-screen.
    let top: number;
    if (hostRect.height + margin <= spaceBelow || spaceBelow >= spaceAbove) {
      top = rect.bottom + margin;
    } else {
      top = rect.top - hostRect.height - margin;
    }
    // Final safety clamp: never let the popup render above or below the
    // visible viewport, regardless of which side was picked above.
    top = Math.max(margin, Math.min(top, viewportH - hostRect.height - margin));

    let left = rect.left;
    left = Math.max(margin, Math.min(left, viewportW - hostRect.width - margin));

    // host is position:absolute, so its coordinates are relative to the
    // document — add the current scroll offset on top of the
    // viewport-relative numbers computed above.
    this.host.style.top = `${top + window.scrollY}px`;
    this.host.style.left = `${left + window.scrollX}px`;
  }
}
