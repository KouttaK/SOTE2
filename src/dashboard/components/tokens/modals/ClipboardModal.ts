/**
 * src/dashboard/components/tokens/modals/ClipboardModal.ts
 */

import { BaseModal } from './BaseModal.js';
import type { Token } from '../../../../shared/types/index.js';
import { t } from '../../../../shared/i18n/index.js';
import { storage } from '../../../../shared/storage/StorageService.js';

const ICON_CLIPBOARD = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor"><path d="M280 64h40c35.3 0 64 28.7 64 64V448c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V128C0 92.7 28.7 64 64 64h40 9.6C121 27.5 153.3 0 192 0s71 27.5 78.4 64H280zM64 112c-8.8 0-16 7.2-16 16V448c0 8.8 7.2 16 16 16H320c8.8 0 16-7.2 16-16V128c0-8.8-7.2-16-16-16H304v24c0 13.3-10.7 24-24 24H104c-13.3 0-24-10.7-24-24V112H64zm128-8a24 24 0 1 0 0-48 24 24 0 1 0 0 48z"/></svg>`;
const ICON_INFO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"/></svg>`;

/** "1º"/"2º"/"Nº" — kept out of the translation strings themselves since
 * it needs actual number logic (1st/2nd/Nth), not just interpolation. */
function ordinal(n: number): string {
  if (n === 1) return t('token.clipboard.ordinal_1st');
  if (n === 2) return t('token.clipboard.ordinal_2nd');
  return t('token.clipboard.ordinal_nth', { n });
}

export class ClipboardModal extends BaseModal {
  private onSaveCallback: (newConfig: { index: number }) => void;
  private inputEl!: HTMLInputElement;
  private sliderEl!: HTMLInputElement;
  private indexDisplayEl!: HTMLElement;
  private infoDescEl!: HTMLElement;
  private oldestLabelEl!: HTMLElement;
  /** Hard ceiling enforced by StorageService.clampHistoryMax(), used as
   * the slider's max until the real per-install setting loads. */
  private sliderMax = 50;

  constructor(token: Token, onSave: (newConfig: { index: number }) => void) {
    super(`${ICON_CLIPBOARD} ${t('token.modal.configure_clipboard')}`);
    this.onSaveCallback = onSave;

    const config = token.config || {};
    const index = (config.index as number) || 1;

    this.body.innerHTML = `
      <div class="field-group">
        <div class="field-label-row">
          <label>${t('token.clipboard.index_label')}</label>
          <span class="clipboard-global-badge" id="clipboard-global-badge">…</span>
        </div>
        <p class="field-hint">${t('token.clipboard.index_hint')}</p>

        <div class="clipboard-slider-row" style="margin-top: var(--spacing-3)">
          <div class="clipboard-slider-col">
            <input type="range" min="1" max="${this.sliderMax}" step="1" class="clipboard-slider" id="clipboard-slider" value="${index}">
            <div class="clipboard-slider-labels">
              <span>${t('token.clipboard.slider_recent')}</span>
              <span id="clipboard-slider-oldest">${t('token.clipboard.slider_oldest', { max: this.sliderMax })}</span>
            </div>
          </div>
          <div class="clipboard-index-display" id="clipboard-index-display">${index}</div>
        </div>
        <input type="number" class="form-input" id="clipboard-index" value="${index}" style="display:none">
      </div>

      <div class="clipboard-info-box">
        ${ICON_INFO}
        <div>
          <p class="clipboard-info-box-title">${t('token.clipboard.info_title')}</p>
          <p class="clipboard-info-box-desc" id="clipboard-info-desc"></p>
        </div>
      </div>
    `;

    this.inputEl = this.body.querySelector('#clipboard-index') as HTMLInputElement;
    this.sliderEl = this.body.querySelector('#clipboard-slider') as HTMLInputElement;
    this.indexDisplayEl = this.body.querySelector('#clipboard-index-display') as HTMLElement;
    this.infoDescEl = this.body.querySelector('#clipboard-info-desc') as HTMLElement;
    this.oldestLabelEl = this.body.querySelector('#clipboard-slider-oldest') as HTMLElement;

    const setIndex = (val: number) => {
      const clamped = Math.min(Math.max(1, val), this.sliderMax);
      this.inputEl.value = String(clamped);
      this.sliderEl.value = String(clamped);
      this.indexDisplayEl.textContent = String(clamped);
      this.infoDescEl.innerHTML = t('token.clipboard.info_desc', {
        index: `<span class="highlight">${clamped}</span>`,
        ordinal: ordinal(clamped),
      });
    };
    this.sliderEl.addEventListener('input', () => setIndex(parseInt(this.sliderEl.value, 10)));
    setIndex(index);

    // The slider's real max (and the "Global setting" badge) depend on
    // `settings.clipboardHistoryMax` — a per-install value, not something
    // knowable synchronously in a constructor — so it starts at the hard
    // ceiling (50) and narrows down once storage resolves. An index the
    // user had already saved past the real max stays visible/editable
    // rather than being silently clamped out from under them here; that
    // clamping is StorageService's job (clampHistoryMax), not this modal's.
    storage.getSettings().then((settings) => {
      const max = Math.min(Math.max(1, settings.clipboardHistoryMax ?? 10), 50);
      this.sliderMax = max;
      const badge = this.body.querySelector('#clipboard-global-badge');
      if (badge) badge.textContent = t('token.clipboard.global_setting_label', { max });
      this.sliderEl.max = String(max);
      this.oldestLabelEl.textContent = t('token.clipboard.slider_oldest', { max });
    }).catch(() => {
      const badge = this.body.querySelector('#clipboard-global-badge');
      if (badge) badge.remove();
    });
  }

  protected onSave(): void {
    const val = parseInt(this.inputEl.value, 10);
    if (isNaN(val) || val < 1) {
      alert(t('token.clipboard.invalid_alert'));
      return;
    }
    this.onSaveCallback({ index: val });
    this.close();
  }
}
