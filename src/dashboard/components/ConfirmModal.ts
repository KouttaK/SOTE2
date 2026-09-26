/**
 * src/dashboard/components/ConfirmModal.ts
 *
 * Shared "dangerous action" confirmation modal — icon-in-circle header,
 * an optional block of extra warning content (e.g. a list of things that
 * will be affected), and an optional "type this exact phrase to unlock
 * the button" gate for the most destructive actions (factory reset, etc).
 *
 * Replaces the near-identical confirm-modal markup that used to be
 * hand-rolled separately in analytics.ts, settings.ts, forms.ts and
 * variables.ts (`.analytics-modal-*`, `.settings-modal-*`, `.modal-*`
 * with inline `style="color:#ef4444"` danger overrides, etc) — one
 * implementation, one place to fix bugs or restyle it in the future.
 */

import { t } from '../../shared/i18n/index.js';
import { escapeHtml } from '../../shared/utils/dom.js';

const ICON_WARNING = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c7.3 12.4 7.3 27.7.2 40.1S486.3 480 472 480H40c-14.3 0-27.6-7.7-34.7-20.1s-7-27.8.2-40.1l216-368C228.7 39.5 241.8 32 256 32zm0 128c-13.3 0-24 10.7-24 24V296c0 13.3 10.7 24 24 24s24-10.7 24-24V184c0-13.3-10.7-24-24-24zm32 224a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z"/></svg>`;

export interface ConfirmModalOptions {
  /** Modal title, next to the warning icon. */
  title: string;
  /** Main message. May contain simple inline HTML (e.g. a `<span>` to
   * highlight a name) — the caller is responsible for escaping any
   * untrusted values it interpolates in (see `escapeHtml`). */
  message: string;
  /** Extra HTML rendered between the message and the (optional) type-to-
   * confirm gate — e.g. an `.affected-flows-list` of what will break. */
  extraContent?: string;
  /** Label for the confirm button. */
  confirmLabel: string;
  /** If set, the confirm button stays disabled until the user types this
   * exact phrase into the gate input — for the most destructive, hard-
   * to-undo actions (factory reset, deleting a variable used elsewhere). */
  requireTypedPhrase?: string;
  /** Called when the user clicks the (enabled) confirm button. The modal
   * closes right after — if the action can fail, catch/report inside
   * this callback before it resolves. */
  onConfirm: () => void | Promise<void>;
  /** Called when the modal is dismissed WITHOUT confirming (Cancel, the
   * × button, or clicking the backdrop). Optional — most callers don't
   * need to react to a plain "never mind". */
  onCancel?: () => void;
}

export class ConfirmModal {
  /** Builds and shows the modal, appended to `document.body`. */
  static show(opts: ConfirmModalOptions): void {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-modal-overlay';

    const gateId = 'confirm-modal-gate-input';
    const gateHtml = opts.requireTypedPhrase
      ? /* html */ `
        <div class="confirm-modal-gate">
          <div class="confirm-modal-gate-row">
            <span>${t('confirm_modal.gate_label')}</span>
            <span class="confirm-modal-gate-hint">${t('confirm_modal.gate_hint')}</span>
          </div>
          <div class="confirm-modal-gate-box">
            <span class="confirm-modal-gate-desc">${t('confirm_modal.gate_type_prompt')} <code>${escapeHtml(opts.requireTypedPhrase)}</code></span>
            <input type="text" id="${gateId}" placeholder="${t('confirm_modal.gate_placeholder')}" autocomplete="off" />
          </div>
        </div>
      `
      : '';

    overlay.innerHTML = /* html */ `
      <div class="confirm-modal-content">
        <div class="confirm-modal-header">
          <div class="confirm-modal-icon">${ICON_WARNING}</div>
          <h3 class="confirm-modal-title">${escapeHtml(opts.title)}</h3>
          <button type="button" class="confirm-modal-close" title="${t('common.cancel')}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></svg>
          </button>
        </div>
        <div class="confirm-modal-body">
          <p class="confirm-modal-message">${opts.message}</p>
          ${opts.extraContent || ''}
          ${gateHtml}
        </div>
        <div class="confirm-modal-footer">
          <button type="button" class="btn-secondary" id="confirm-modal-cancel">${t('common.cancel')}</button>
          <button type="button" class="btn-danger" id="confirm-modal-confirm"${opts.requireTypedPhrase ? ' disabled' : ''}>${escapeHtml(opts.confirmLabel)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    const cancel = () => { close(); opts.onCancel?.(); };
    const confirmBtn = overlay.querySelector<HTMLButtonElement>('#confirm-modal-confirm')!;

    overlay.querySelector('.confirm-modal-close')!.addEventListener('click', cancel);
    overlay.querySelector('#confirm-modal-cancel')!.addEventListener('click', cancel);
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) cancel();
    });

    if (opts.requireTypedPhrase) {
      const gateInput = overlay.querySelector<HTMLInputElement>(`#${gateId}`)!;
      gateInput.addEventListener('input', () => {
        confirmBtn.disabled = gateInput.value !== opts.requireTypedPhrase;
      });
      gateInput.focus();
    }

    confirmBtn.addEventListener('click', async () => {
      if (confirmBtn.disabled) return;
      confirmBtn.disabled = true;
      await opts.onConfirm();
      close();
    });
  }
}
