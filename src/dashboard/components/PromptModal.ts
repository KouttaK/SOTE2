/**
 * src/dashboard/components/PromptModal.ts
 *
 * Custom prompt modal to replace browser-native window.prompt().
 * Matches the look, feel, and accessibility standards of ConfirmModal.
 */

import { t } from '../../shared/i18n/index.js';
import { escapeHtml } from '../../shared/utils/dom.js';

export interface PromptModalOptions {
  /** Title shown in the modal header */
  title: string;
  /** Explanatory message above the input (optional) */
  message?: string;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Initial value pre-filled in the input */
  defaultValue?: string;
  /** Label on the confirm button (defaults to "Confirmar" / "Save") */
  confirmLabel?: string;
  /** Label on the cancel button (defaults to "Cancelar") */
  cancelLabel?: string;
  /** Called when user confirms. Receives the trimmed string value. */
  onConfirm: (value: string) => void | Promise<void>;
  /** Called when user dismisses or cancels (optional) */
  onCancel?: () => void;
}

const ICON_EDIT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z"/></svg>`;

interface ActivePromptState {
  overlay: HTMLElement;
  opts: PromptModalOptions;
  input: HTMLInputElement;
}

export class PromptModal {
  private static active: ActivePromptState | null = null;

  static show(opts: PromptModalOptions): void {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-modal-overlay';

    const inputId = 'prompt-modal-input';
    const confirmText = opts.confirmLabel || t('common.save');
    const cancelText = opts.cancelLabel || t('common.cancel');

    overlay.innerHTML = /* html */ `
      <div class="confirm-modal-content">
        <div class="confirm-modal-header">
          <div class="confirm-modal-icon" style="background: rgba(139, 92, 246, 0.15); color: #8b5cf6;">${ICON_EDIT}</div>
          <h3 class="confirm-modal-title">${escapeHtml(opts.title)}</h3>
          <button type="button" class="confirm-modal-close" title="${escapeHtml(cancelText)}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></svg>
          </button>
        </div>
        <div class="confirm-modal-body">
          ${opts.message ? `<p class="confirm-modal-message">${escapeHtml(opts.message)}</p>` : ''}
          <div style="margin-top: 12px;">
            <input 
              type="text" 
              id="${inputId}" 
              class="settings-input" 
              style="width: 100%; box-sizing: border-box;"
              placeholder="${escapeHtml(opts.placeholder || '')}" 
              value="${escapeHtml(opts.defaultValue || '')}"
              autocomplete="off"
            />
          </div>
        </div>
        <div class="confirm-modal-footer">
          <button type="button" class="btn-secondary" id="prompt-modal-cancel">${escapeHtml(cancelText)}</button>
          <button type="button" class="dash-cta-btn" id="prompt-modal-confirm" style="padding: 8px 16px; font-size: 0.8125rem;">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const input = overlay.querySelector<HTMLInputElement>(`#${inputId}`)!;
    const confirmBtn = overlay.querySelector<HTMLButtonElement>('#prompt-modal-confirm')!;
    const cancelBtn = overlay.querySelector<HTMLButtonElement>('#prompt-modal-cancel')!;
    const closeBtn = overlay.querySelector<HTMLButtonElement>('.confirm-modal-close')!;

    PromptModal.active = { overlay, opts, input };

    const close = () => {
      if (PromptModal.active?.overlay === overlay) {
        PromptModal.active = null;
      }
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    };

    const handleCancel = () => {
      close();
      opts.onCancel?.();
    };

    const handleConfirm = async () => {
      const val = input.value.trim();
      close();
      await opts.onConfirm(val);
    };

    closeBtn.addEventListener('click', handleCancel);
    cancelBtn.addEventListener('click', handleCancel);
    confirmBtn.addEventListener('click', handleConfirm);

    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) handleCancel();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    });

    // Auto-focus input
    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  }

  /**
   * Re-translates static labels in the active prompt modal without destroying
   * the user's typed input.
   */
  static updateLanguage(): void {
    if (!this.active || !this.active.overlay.parentNode) return;
    const { overlay, opts } = this.active;

    const confirmBtn = overlay.querySelector<HTMLButtonElement>('#prompt-modal-confirm');
    const cancelBtn = overlay.querySelector<HTMLButtonElement>('#prompt-modal-cancel');
    const closeBtn = overlay.querySelector<HTMLButtonElement>('.confirm-modal-close');

    const confirmText = opts.confirmLabel || t('common.save');
    const cancelText = opts.cancelLabel || t('common.cancel');

    if (confirmBtn) confirmBtn.textContent = confirmText;
    if (cancelBtn) cancelBtn.textContent = cancelText;
    if (closeBtn) closeBtn.title = cancelText;
  }
}
