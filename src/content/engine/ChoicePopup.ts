/**
 * src/content/engine/ChoicePopup.ts
 */

import type { Token, Variable, FormField } from '../../shared/types/index.js';
import { resolveVariablesInText } from '../../shared/utils/variableResolver.js';
import { isProtected } from './SensitiveFieldGuard.js';
import { t } from '../../shared/i18n/index.js';

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
      .prefill-banner {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        background: rgba(245, 158, 11, 0.12);
        border: 1px solid rgba(245, 158, 11, 0.3);
        border-radius: 0.25rem;
        padding: 0.35rem 0.5rem;
        margin-bottom: 0.5rem;
        color: #fbbf24;
        font-size: 0.75rem;
        line-height: 1.25;
      }
      .prefill-banner svg {
        flex-shrink: 0;
        width: 0.875rem;
        height: 0.875rem;
      }
      .btn-row {
        display: flex;
        gap: 0.5rem;
        width: 100%;
      }
      .btn-clear {
        background: #262626;
        color: #d4d4d4;
        border: 1px solid #404040;
        padding: 0.5rem;
        border-radius: 0.25rem;
        cursor: pointer;
        font-size: 0.8125rem;
        font-weight: 500;
        white-space: nowrap;
        transition: background 0.15s, border-color 0.15s, color 0.15s;
        flex: 1;
      }
      .btn-clear:hover {
        background: #383838;
        border-color: #525252;
        color: #fff;
      }
      .btn-submit {
        background: #3b82f6;
        color: #fff;
        border: none;
        padding: 0.5rem;
        border-radius: 0.25rem;
        cursor: pointer;
        font-size: 0.8125rem;
        font-weight: 500;
        flex: 1;
      }
      .btn-submit:hover {
        background: #2563eb;
      }
      /* Form popup styles */
      .form-popup-container {
        min-width: 260px;
        max-width: 380px;
        max-height: 80vh;
        overflow-y: auto;
      }
      .form-fields-list {
        display: flex;
        flex-direction: column;
        gap: 0.625rem;
        margin-bottom: 0.75rem;
      }
      .form-field-group {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .form-label-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
      }
      .form-field-label {
        font-size: 0.75rem;
        font-weight: 500;
        color: #d4d4d4;
        text-overflow: ellipsis;
        overflow: hidden;
        white-space: nowrap;
      }
      .form-prefill-badge {
        font-size: 0.6875rem;
        font-weight: 500;
        color: #fbbf24;
        background: rgba(245, 158, 11, 0.15);
        border: 1px solid rgba(245, 158, 11, 0.3);
        border-radius: 0.2rem;
        padding: 0.1rem 0.35rem;
        line-height: 1;
      }
      .form-input-item {
        margin-bottom: 0;
      }
      .form-btn-row {
        margin-top: 0.25rem;
      }
    `;
    this.shadow.appendChild(style);
  }

  public showForToken(
    token: Token,
    targetElement: HTMLElement,
    variables: Variable[] = [],
    prefillValue?: string
  ): Promise<string | null> {
    if (targetElement && isProtected(targetElement)) {
      return Promise.resolve(null);
    }
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

        let mousedownTimer: ReturnType<typeof setTimeout> | null = null;

        const finish = (value: string | null) => {
          if (settled) return; // Promise already resolved, ignore further calls
          settled = true;
          if (autoSelectTimer) clearTimeout(autoSelectTimer);
          if (mousedownTimer) {
            clearTimeout(mousedownTimer);
            mousedownTimer = null;
          } else {
            document.removeEventListener('mousedown', onDocMouseDown, true);
          }
          document.removeEventListener('keydown', onKeyDown, true);
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
        mousedownTimer = setTimeout(() => {
          document.addEventListener('mousedown', onDocMouseDown, true);
          mousedownTimer = null;
        }, 0);

        autoSelectTimer = setTimeout(() => finish(options[0]), AUTO_SELECT_MS);

      } else if (token.type === 'input') {
        const title = document.createElement('p');
        title.className = 'popup-title';
        title.textContent = resolveVariablesInText((token.config?.label as string) || 'Enter value', false, variables);
        container.appendChild(title);

        let prefillBanner: HTMLDivElement | null = null;
        if (prefillValue !== undefined && prefillValue.trim() !== '') {
          prefillBanner = document.createElement('div');
          prefillBanner.className = 'prefill-banner';

          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('viewBox', '0 0 512 512');
          svg.setAttribute('fill', 'currentColor');
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', 'M463.5 224H472c13.3 0 24-10.7 24-24V72c0-9.7-5.8-18.5-14.8-22.2s-19.3-1.7-26.2 5.2L413.4 96.6c-87.6-86.5-228.7-86.2-315.8 1c-87.5 87.5-87.5 229.3 0 316.8s229.3 87.5 316.8 0c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0c-62.5 62.5-163.8 62.5-226.3 0s-62.5-163.8 0-226.3c62.2-62.2 162.7-62.5 225.3-1L327 182.6c-6.9 6.9-8.9 17.2-5.2 26.2s12.5 14.8 22.2 14.8H463.5z');
          svg.appendChild(path);

          const span = document.createElement('span');
          span.textContent = t('token.input.prefill_banner');

          prefillBanner.appendChild(svg);
          prefillBanner.appendChild(span);
          container.appendChild(prefillBanner);
        }

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'input-field';
        input.placeholder = resolveVariablesInText((token.config?.placeholder as string) || '', false, variables);
        if (prefillValue !== undefined) {
          input.value = prefillValue;
        }
        container.appendChild(input);

        const btnRow = document.createElement('div');
        btnRow.className = 'btn-row';

        let clearBtn: HTMLButtonElement | null = null;
        if (prefillValue !== undefined && prefillValue.trim() !== '') {
          clearBtn = document.createElement('button');
          clearBtn.type = 'button';
          clearBtn.className = 'btn-clear';
          clearBtn.textContent = t('token.input.clear_btn');
          clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            input.value = '';
            if (prefillBanner) {
              prefillBanner.remove();
              prefillBanner = null;
            }
            if (clearBtn) {
              clearBtn.remove();
              clearBtn = null;
            }
            input.focus();
          });
          btnRow.appendChild(clearBtn);
        }

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-submit';
        btn.textContent = t('token.input.confirm_btn') || 'Confirm';

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
        btnRow.appendChild(btn);
        container.appendChild(btnRow);

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
        
        // Auto focus and select for instant Enter confirmation or effortless replacement
        setTimeout(() => {
          input.focus();
          if (prefillValue !== undefined) {
            input.select();
          }
        }, 10);
      }

      this.shadow.appendChild(container);
      this.positionPopup(targetElement);
    });
  }

  public showForm(
    fields: FormField[],
    targetElement: HTMLElement,
    variables: Variable[] = []
  ): Promise<Record<string, string> | null> {
    if (targetElement && isProtected(targetElement)) {
      return Promise.resolve(null);
    }
    if (!fields || fields.length === 0) {
      return Promise.resolve({});
    }

    return new Promise((resolve) => {
      document.body.appendChild(this.host);

      const container = document.createElement('div');
      container.className = 'popup-container form-popup-container';

      const title = document.createElement('p');
      title.className = 'popup-title';
      title.textContent = t('token.form.title');
      container.appendChild(title);

      const formList = document.createElement('div');
      formList.className = 'form-fields-list';

      const inputElements: Array<{ field: FormField; input: HTMLInputElement }> = [];

      for (const field of fields) {
        const group = document.createElement('div');
        group.className = 'form-field-group';

        const labelRow = document.createElement('div');
        labelRow.className = 'form-label-row';

        const label = document.createElement('label');
        label.className = 'form-field-label';
        label.textContent = resolveVariablesInText(field.label, false, variables);
        labelRow.appendChild(label);

        if (field.prefilled && field.value) {
          const badge = document.createElement('span');
          badge.className = 'form-prefill-badge';
          badge.textContent = t('token.form.prefill_badge');
          labelRow.appendChild(badge);
        }
        group.appendChild(labelRow);

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'input-field form-input-item';
        input.placeholder = resolveVariablesInText(field.placeholder || '', false, variables);
        if (field.value !== undefined) {
          input.value = field.value;
        }
        group.appendChild(input);

        formList.appendChild(group);
        inputElements.push({ field, input });
      }

      container.appendChild(formList);

      const btnRow = document.createElement('div');
      btnRow.className = 'btn-row form-btn-row';

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn-clear';
      cancelBtn.textContent = t('token.form.cancel_btn');

      const submitBtn = document.createElement('button');
      submitBtn.type = 'button';
      submitBtn.className = 'btn-submit';
      submitBtn.textContent = t('token.form.submit_btn');

      btnRow.appendChild(cancelBtn);
      btnRow.appendChild(submitBtn);
      container.appendChild(btnRow);

      let settled = false;
      let focusGuardActive = true;

      const finish = (result: Record<string, string> | null) => {
        if (settled) return;
        settled = true;
        focusGuardActive = false;
        document.removeEventListener('keydown', onKeyDown, true);
        document.removeEventListener('mousedown', onDocMouseDown, true);
        this.close();
        resolve(result);
      };

      const collectValues = (): Record<string, string> => {
        const res: Record<string, string> = {};
        for (const item of inputElements) {
          res[item.field.key] = item.input.value;
        }
        return res;
      };

      cancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        finish(null);
      });

      submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        finish(collectValues());
      });

      const onKeyDown = (e: KeyboardEvent) => {
        e.stopPropagation();

        if (e.key === 'Escape') {
          e.preventDefault();
          finish(null);
          return;
        }

        if (e.key === 'Enter') {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            finish(collectValues());
            return;
          }

          const target = e.target as HTMLElement;
          const currentIndex = inputElements.findIndex(item => item.input === target);
          if (currentIndex >= 0) {
            e.preventDefault();
            if (currentIndex === inputElements.length - 1) {
              finish(collectValues());
            } else {
              inputElements[currentIndex + 1].input.focus();
              inputElements[currentIndex + 1].input.select();
            }
          } else if (target === submitBtn) {
            e.preventDefault();
            finish(collectValues());
          }
        }
      };

      document.addEventListener('keydown', onKeyDown, true);

      const onDocMouseDown = (e: MouseEvent) => {
        const path = e.composedPath ? e.composedPath() : [];
        if (path.includes(this.host)) return;
        finish(null);
      };

      setTimeout(() => {
        document.addEventListener('mousedown', onDocMouseDown, true);
      }, 0);

      inputElements.forEach(item => {
        item.input.addEventListener('blur', () => {
          if (!focusGuardActive) return;
          requestAnimationFrame(() => {
            if (!document.body.contains(this.host)) return;
            const active = this.shadow.activeElement;
            if (!active) {
              item.input.focus();
            }
          });
        });
      });

      setTimeout(() => {
        const firstEmpty = inputElements.find(item => !item.input.value);
        const targetToFocus = firstEmpty || inputElements[0];
        if (targetToFocus) {
          targetToFocus.input.focus();
          if (targetToFocus.input.value) {
            targetToFocus.input.select();
          }
        }
      }, 10);

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
