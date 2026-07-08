/**
 * src/dashboard/components/blocks/TriggerBlock.ts
 */

import type { TriggerBlock as ITriggerBlock, TriggerMode, Settings } from '../../../shared/types/index.js';
import { t } from '../../../shared/i18n/index.js';
import { shortcutConflictsWithSearchTrigger } from '../../../content/engine/SearchTriggerDetector.js';

const ICONS = {
  play: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor"><path d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z"/></svg>`,
  keyboard: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor"><path d="M64 64C28.7 64 0 92.7 0 128V384c0 35.3 28.7 64 64 64H512c35.3 0 64-28.7 64-64V128c0-35.3-28.7-64-64-64H64zm16 64h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H80c-8.8 0-16-7.2-16-16V144c0-8.8 7.2-16 16-16zM64 240c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H80c-8.8 0-16-7.2-16-16V240zm16 80h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H80c-8.8 0-16-7.2-16-16V336c0-8.8 7.2-16 16-16zm80-176c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H176c-8.8 0-16-7.2-16-16V144zm16 80h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H176c-8.8 0-16-7.2-16-16V240c0-8.8 7.2-16 16-16zM160 336c0-8.8 7.2-16 16-16H400c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H176c-8.8 0-16-7.2-16-16V336zM272 128h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H272c-8.8 0-16-7.2-16-16V144c0-8.8 7.2-16 16-16zM256 240c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H272c-8.8 0-16-7.2-16-16V240zM368 128h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H368c-8.8 0-16-7.2-16-16V144c0-8.8 7.2-16 16-16zM352 240c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H368c-8.8 0-16-7.2-16-16V240zM464 128h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H464c-8.8 0-16-7.2-16-16V144c0-8.8 7.2-16 16-16zM448 240c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H464c-8.8 0-16-7.2-16-16V240zm16 80h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H464c-8.8 0-16-7.2-16-16V336c0-8.8 7.2-16 16-16z"/></svg>`,
};

export class TriggerBlock {
  private el: HTMLElement;
  public data: ITriggerBlock;
  private onChange: () => void;
  private settings?: Settings;

  constructor(data: ITriggerBlock | undefined, onChange: () => void, settings?: Settings) {
    this.data = data || {
      shortcut: '',
      smartCase: true,
      forceCapitalize: false,
    };
    this.settings = settings;
    this.onChange = onChange;
    this.el = document.createElement('div');
    this.el.className = 'block-card';
    this.el.id = 'trigger-block';
    this.render();
  }

  public getElement(): HTMLElement {
    return this.el;
  }

  public getData(): ITriggerBlock {
    return this.data;
  }

  private render() {
    // The prefix hint (e.g. "Prefix: /") only makes sense in "exact match"
    // trigger mode, where a shortcut is expanded as soon as it's typed
    // after that prefix character. In the default "trigger" mode
    // (word-boundary based: type the word then Space/Tab/Enter), there is
    // no prefix at all, so the hint used to be shown — hardcoded to "/" —
    // even when it didn't apply and even if the user had configured a
    // different character in Settings.
    const usesPrefix = this.settings?.triggerMode === 'exact_match';
    const prefixChar = this.settings?.exactMatchChar || '/';
    const prefixHintHtml = usesPrefix
      ? `<div class="input-hint">
          ${ICONS.keyboard} ${t('trigger.block.prefix_label')} <span style="color:#e5e5e5">${escapeHtml(prefixChar)}</span>
        </div>`
      : '';

    this.el.innerHTML = /* html */ `
      <div class="block-header">
        <div class="block-icon">${ICONS.play}</div>
        <div class="block-title-wrap">
          <p class="block-step">${t('trigger.block.step')}</p>
          <h2 class="block-title">${t('trigger.block.title')}</h2>
        </div>
        <span class="block-badge">${t('trigger.block.badge')}</span>
      </div>
      <div class="block-body">
        
        <!-- Shortcut input -->
        <div style="margin-bottom: 1.25rem;">
          <label class="form-label">${t('trigger.block.field_label')}</label>
          <div class="input-wrap">
            <div class="input-field">
              <span>${usesPrefix ? escapeHtml(prefixChar) : ''}</span>
              <input type="text" id="trigger-shortcut" value="${this.data.shortcut}" placeholder="${t('editor.trigger.shortcut_placeholder')}" />
            </div>
            ${prefixHintHtml}
          </div>
          <p class="input-hint" id="trigger-reserved-warning" style="display:none; color:#f59e0b;"></p>
        </div>

        <!-- Mode Select Removed -->
        <!-- Exact Match Character Removed -->

        <!-- Toggles -->
        <div class="toggle-row">
          <div class="toggle-info">
            <p>${t('trigger.block.smartcase_title')}</p>
            <p>${t('trigger.block.smartcase_desc')}</p>
          </div>
          <div class="switch ${this.data.smartCase ? 'is-on' : ''}" id="trigger-smartcase"></div>
        </div>
        
        <div class="toggle-row">
          <div class="toggle-info">
            <p>${t('trigger.block.capitalize_title')}</p>
            <p>${t('trigger.block.capitalize_desc')}</p>
          </div>
          <div class="switch ${this.data.forceCapitalize ? 'is-on' : ''}" id="trigger-capitalize"></div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents() {
    const input = this.el.querySelector<HTMLInputElement>('#trigger-shortcut')!;
    input.addEventListener('input', (e) => {
      this.data.shortcut = (e.target as HTMLInputElement).value;
      this.updateReservedPrefixWarning();
      this.onChange();
    });
    this.updateReservedPrefixWarning();


    const smartCase = this.el.querySelector<HTMLElement>('#trigger-smartcase')!;
    smartCase.addEventListener('click', () => {
      this.data.smartCase = !this.data.smartCase;
      smartCase.classList.toggle('is-on', this.data.smartCase);
      this.onChange();
    });

    const forceCap = this.el.querySelector<HTMLElement>('#trigger-capitalize')!;
    forceCap.addEventListener('click', () => {
      this.data.forceCapitalize = !this.data.forceCapitalize;
      forceCap.classList.toggle('is-on', this.data.forceCapitalize);
      this.onChange();
    });
  }

  /**
   * Spec §6 — reserved prefixes: while the Gatilho de Busca is active,
   * warn in real time if the shortcut being typed starts with one of its
   * configured prefixes. This never blocks saving — it's a heads-up, same
   * spirit as the Settings page's migration scan over existing Flows.
   */
  private updateReservedPrefixWarning() {
    const warningEl = this.el.querySelector<HTMLElement>('#trigger-reserved-warning');
    if (!warningEl) return;

    const conflicts = shortcutConflictsWithSearchTrigger(this.data.shortcut, this.settings?.searchTrigger);
    if (conflicts) {
      const prefix = this.settings?.searchTrigger?.domainPrefix && this.data.shortcut.startsWith(this.settings.searchTrigger.domainPrefix)
        ? this.settings.searchTrigger.domainPrefix
        : this.settings?.searchTrigger?.globalPrefix || '';
      warningEl.textContent = t('trigger.block.reserved_prefix_warning', { prefix });
      warningEl.style.display = 'block';
    } else {
      warningEl.style.display = 'none';
    }
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
