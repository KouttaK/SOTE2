/**
 * src/dashboard/components/tokens/modals/MathModal.ts
 */

import { BaseModal } from './BaseModal.js';
import type { Token } from '../../../../shared/types/index.js';
import { t } from '../../../../shared/i18n/index.js';
import { escapeHtml } from '../../../../shared/utils/dom.js';
import { showToast } from '../../../../shared/components/Toast.js';
import { evaluateMath } from '../../../../shared/utils/mathEvaluator.js';

export interface MathConfig {
  expression: string;
}

export class MathModal extends BaseModal {
  private onSaveCallback: (newConfig: MathConfig) => void;
  private exprInput!: HTMLInputElement;
  private previewEl!: HTMLElement;

  constructor(token: Token, onSave: (newConfig: MathConfig) => void) {
    super(t('token.modal.configure_math'));
    this.onSaveCallback = onSave;

    const config = (token.config || {}) as Partial<MathConfig>;
    const expression = config.expression || '10 * 5';

    this.body.innerHTML = `
      <div style="display:flex; flex-direction:column; gap: var(--spacing-4);">
        <div class="field-group">
          <label>${t('token.math.expression_label')}</label>
          <input type="text" class="form-input" id="math-expression" value="${escapeHtml(expression)}" placeholder="${t('token.math.expression_placeholder')}" spellcheck="false" autocomplete="off" />
          <p class="field-hint">${t('token.math.expression_hint')}</p>
        </div>

        <div style="background: var(--color-hair); border: 1px solid var(--color-hair-hover); border-radius: var(--radius-md); padding: 0.75rem 1rem;">
          <div style="font-size: 0.75rem; color: var(--color-mute); margin-bottom: 0.25rem;">${t('token.math.preview_label')}</div>
          <div id="math-preview-value" style="font-size: 1rem; font-weight: 600; font-family: var(--font-family-mono); color: var(--color-chalk);">--</div>
        </div>
      </div>
    `;

    this.exprInput = this.body.querySelector('#math-expression') as HTMLInputElement;
    this.previewEl = this.body.querySelector('#math-preview-value') as HTMLElement;

    this.exprInput.addEventListener('input', () => this.updatePreview());
    this.updatePreview();
  }

  private updatePreview(): void {
    const expr = this.exprInput.value.trim();
    if (!expr) {
      this.previewEl.textContent = '--';
      this.previewEl.style.color = 'var(--color-mute)';
      return;
    }

    try {
      const res = evaluateMath(expr);
      this.previewEl.textContent = `= ${res}`;
      this.previewEl.style.color = 'var(--color-chalk)';
    } catch {
      this.previewEl.textContent = t('token.math.invalid_expression');
      this.previewEl.style.color = '#ef4444';
    }
  }

  protected onSave(): void {
    const expression = this.exprInput.value.trim();
    if (!expression) {
      showToast(t('token.math.required_alert'), 'error');
      return;
    }

    try {
      evaluateMath(expression);
    } catch {
      showToast(t('token.math.invalid_expression'), 'error');
      return;
    }

    this.onSaveCallback({ expression });
    this.close();
  }
}
