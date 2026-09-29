/**
 * src/dashboard/components/blocks/TriggerBlock.ts
 */

import type { TriggerBlock as ITriggerBlock, TriggerMode, Settings } from '../../../shared/types/index.js';
import { t } from '../../../shared/i18n/index.js';
import { shortcutConflictsWithSearchTrigger } from '../../../content/engine/SearchTriggerDetector.js';
import { escapeHtml } from '../../../shared/utils/dom.js';

const ICONS = {
  bolt: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>`,
  info: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336H232V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h40c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"/></svg>`,
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
      wordBoundary: settings?.wordBoundaryDefault !== false,
    };
    if (this.data.wordBoundary === undefined) {
      this.data.wordBoundary = settings?.wordBoundaryDefault !== false;
    }
    this.settings = settings;
    this.onChange = onChange;
    this.el = document.createElement('div');
    this.el.className = 'trigger-node';
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
    // no prefix at all.
    const usesPrefix = this.settings?.triggerMode === 'exact_match';
    const prefixChar = this.settings?.exactMatchChar || '/';

    this.el.innerHTML = /* html */ `
      <div class="trigger-node-head">
        <div class="trigger-node-icon">${ICONS.bolt}</div>
        <div class="trigger-node-title-wrap">
          <p class="trigger-node-label">${t('trigger.block.badge')}</p>
          <h3 class="trigger-node-shortcut-wrap">
            <span class="trigger-node-prefix" id="trigger-prefix-char">${usesPrefix ? escapeHtml(prefixChar) : ''}</span><input
              type="text" id="trigger-shortcut" class="trigger-node-shortcut-input"
              value="${escapeHtml(this.data.shortcut)}"
              placeholder="${t('editor.trigger.shortcut_placeholder')}"
              spellcheck="false" autocomplete="off"
            />
          </h3>
        </div>
      </div>

      <p class="input-hint" id="trigger-reserved-warning" style="display:none; color: var(--color-coral); margin: -0.5rem 0 0.75rem;"></p>

      <div class="trigger-node-body">
        <div class="trigger-toggle-row">
          <span class="trigger-toggle-label">${t('trigger.block.smartcase_title')}</span>
          <div class="trigger-toggle-right">
            <span class="trigger-toggle-state ${this.data.smartCase ? 'is-on' : ''}" id="trigger-smartcase-state">${this.data.smartCase ? t('editor.status.active') : t('editor.status.inactive')}</span>
            <div class="switch ${this.data.smartCase ? 'is-on' : ''}" id="trigger-smartcase"></div>
          </div>
        </div>
        <p class="trigger-node-hint">${ICONS.info} ${t('trigger.block.smartcase_desc')}</p>

        <div class="trigger-toggle-row">
          <span class="trigger-toggle-label">${t('trigger.block.capitalize_title')}</span>
          <div class="trigger-toggle-right">
            <span class="trigger-toggle-state ${this.data.forceCapitalize ? 'is-on' : ''}" id="trigger-capitalize-state">${this.data.forceCapitalize ? t('editor.status.active') : t('editor.status.inactive')}</span>
            <div class="switch ${this.data.forceCapitalize ? 'is-on' : ''}" id="trigger-capitalize"></div>
          </div>
        </div>
        <p class="trigger-node-hint">${ICONS.info} ${t('trigger.block.capitalize_desc')}</p>

        <div class="trigger-toggle-row">
          <span class="trigger-toggle-label">${t('trigger.block.wordboundary_title')}</span>
          <div class="trigger-toggle-right">
            <span class="trigger-toggle-state ${this.data.wordBoundary !== false ? 'is-on' : ''}" id="trigger-wordboundary-state">${this.data.wordBoundary !== false ? t('editor.status.active') : t('editor.status.inactive')}</span>
            <div class="switch ${this.data.wordBoundary !== false ? 'is-on' : ''}" id="trigger-wordboundary"></div>
          </div>
        </div>
        <p class="trigger-node-hint">${ICONS.info} ${t('trigger.block.wordboundary_desc')}</p>
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

    const smartCaseState = this.el.querySelector<HTMLElement>('#trigger-smartcase-state')!;
    const smartCase = this.el.querySelector<HTMLElement>('#trigger-smartcase')!;
    smartCase.addEventListener('click', () => {
      this.data.smartCase = !this.data.smartCase;
      smartCase.classList.toggle('is-on', this.data.smartCase);
      smartCaseState.classList.toggle('is-on', this.data.smartCase);
      smartCaseState.textContent = this.data.smartCase ? t('editor.status.active') : t('editor.status.inactive');
      this.onChange();
    });

    const forceCapState = this.el.querySelector<HTMLElement>('#trigger-capitalize-state')!;
    const forceCap = this.el.querySelector<HTMLElement>('#trigger-capitalize')!;
    forceCap.addEventListener('click', () => {
      this.data.forceCapitalize = !this.data.forceCapitalize;
      forceCap.classList.toggle('is-on', this.data.forceCapitalize);
      forceCapState.classList.toggle('is-on', this.data.forceCapitalize);
      forceCapState.textContent = this.data.forceCapitalize ? t('editor.status.active') : t('editor.status.inactive');
      this.onChange();
    });

    const wordBoundaryState = this.el.querySelector<HTMLElement>('#trigger-wordboundary-state')!;
    const wordBoundarySwitch = this.el.querySelector<HTMLElement>('#trigger-wordboundary')!;
    wordBoundarySwitch.addEventListener('click', () => {
      this.data.wordBoundary = !(this.data.wordBoundary !== false);
      wordBoundarySwitch.classList.toggle('is-on', this.data.wordBoundary);
      wordBoundaryState.classList.toggle('is-on', this.data.wordBoundary);
      wordBoundaryState.textContent = this.data.wordBoundary ? t('editor.status.active') : t('editor.status.inactive');
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


