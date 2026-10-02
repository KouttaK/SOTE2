import { BaseModal } from './BaseModal.js';
import type { Token, InputTokenConfig, SessionScope } from '../../../../shared/types/index.js';
import { t } from '../../../../shared/i18n/index.js';
import { escapeHtml } from '../../../../shared/utils/dom.js';
import { showToast } from '../../../../shared/components/Toast.js';

export class InputModal extends BaseModal {
  private onSaveCallback: (newConfig: InputTokenConfig) => void;
  private labelInput!: HTMLInputElement;
  private placeholderInput!: HTMLInputElement;
  private rememberCheckbox!: HTMLInputElement;
  private sessionOptionsPanel!: HTMLElement;
  private sessionNameInput!: HTMLInputElement;
  private scopeSelect!: HTMLSelectElement;
  private scopeHint!: HTMLElement;
  private ttlInput!: HTMLInputElement;
  private autoApplyCheckbox!: HTMLInputElement;

  constructor(token: Token, onSave: (newConfig: InputTokenConfig) => void) {
    super(t('token.modal.configure_input'));
    this.onSaveCallback = onSave;
    
    const config = (token.config || {}) as Partial<InputTokenConfig>;
    const label = config.label || '';
    const placeholder = config.placeholder || '';
    const rememberValue = Boolean(config.rememberValue);
    const sessionVarName = config.sessionVarName || '';
    const scope: SessionScope = config.scope || 'tab';
    const ttlHours = typeof config.ttlHours === 'number' && config.ttlHours > 0 ? config.ttlHours : '';
    const autoApply = Boolean(config.autoApply);

    this.body.innerHTML = `
      <div style="display:flex; flex-direction:column; gap: var(--spacing-4);">
        <!-- Card 1: Informações do Campo -->
        <div class="card" style="padding: 1rem; border: 1px solid var(--border-color, #404040); border-radius: 0.5rem; background: var(--bg-surface-secondary, rgba(255,255,255,0.02));">
          <div class="field-group" style="margin-bottom: var(--spacing-3);">
            <label for="input-label" style="font-weight: 500;">${t('token.input.field_label')}</label>
            <input type="text" class="form-input" id="input-label" value="${escapeHtml(label)}" placeholder="${t('token.input.label_example')}">
            <p class="field-hint">${t('token.input.field_hint')}</p>
          </div>
          <div class="field-group">
            <div class="field-label-row">
              <label for="input-placeholder" style="font-weight: 500;">${t('token.input.placeholder_field')}</label>
              <span class="field-optional-badge">${t('common.optional')}</span>
            </div>
            <input type="text" class="form-input" id="input-placeholder" value="${escapeHtml(placeholder)}" placeholder="${t('token.input.placeholder_example')}">
            <p class="field-hint">${t('token.input.placeholder_hint')}</p>
          </div>
        </div>

        <!-- Card 2: Variável de Sessão (Reutilizável) -->
        <div class="card" style="padding: 1rem; border: 1px solid var(--border-color, #404040); border-radius: 0.5rem; background: var(--bg-surface-secondary, rgba(255,255,255,0.02));">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem;">
            <div>
              <label for="input-remember" style="font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; color: var(--text-primary, #fff);">
                <input type="checkbox" id="input-remember" ${rememberValue ? 'checked' : ''} style="cursor: pointer; width: 1.1rem; height: 1.1rem; accent-color: var(--color-primary, #3b82f6);">
                ${t('token.input.remember_value')}
              </label>
              <p class="field-hint" style="margin-top: 0.25rem;">${t('token.input.remember_hint')}</p>
            </div>
          </div>

          <div id="session-options-panel" style="display: ${rememberValue ? 'flex' : 'none'}; flex-direction: column; gap: var(--spacing-3); margin-top: 0.75rem; border-top: 1px solid var(--border-color, #404040); padding-top: 0.75rem;">
            <div class="field-group">
              <label for="input-session-name" style="font-weight: 500;">${t('token.input.session_var_name')}</label>
              <input type="text" class="form-input" id="input-session-name" value="${escapeHtml(sessionVarName)}" placeholder="${t('token.input.session_var_name_placeholder')}">
              <p class="field-hint">${t('token.input.session_var_hint')}</p>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div class="field-group">
                <label for="input-scope" style="font-weight: 500;">${t('token.input.scope_label')}</label>
                <select class="form-input form-select" id="input-scope">
                  <option value="tab" ${scope === 'tab' ? 'selected' : ''}>${t('token.input.scope_tab')}</option>
                  <option value="url" ${scope === 'url' ? 'selected' : ''}>${t('token.input.scope_url')}</option>
                  <option value="title" ${scope === 'title' ? 'selected' : ''}>${t('token.input.scope_title')}</option>
                  <option value="global" ${scope === 'global' ? 'selected' : ''}>${t('token.input.scope_global')}</option>
                </select>
                <p class="field-hint" id="scope-hint" style="min-height: 2.2rem;"></p>
              </div>

              <div class="field-group">
                <div class="field-label-row">
                  <label for="input-ttl" style="font-weight: 500;">${t('token.input.ttl_label')}</label>
                  <span class="field-optional-badge">${t('common.optional')}</span>
                </div>
                <input type="number" class="form-input" id="input-ttl" value="${ttlHours}" placeholder="${t('token.input.ttl_placeholder')}" min="1" max="720">
                <p class="field-hint" style="min-height: 2.2rem;">${t('token.input.ttl_hint')}</p>
              </div>
            </div>

            <div class="field-group" style="margin-top: 0.25rem;">
              <label for="input-auto-apply" style="cursor: pointer; display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem;">
                <input type="checkbox" id="input-auto-apply" ${autoApply ? 'checked' : ''} style="cursor: pointer; width: 1rem; height: 1rem; accent-color: var(--color-primary, #3b82f6);">
                ${t('token.input.auto_apply_label')}
              </label>
              <p class="field-hint" style="margin-top: 0.25rem; margin-left: 1.5rem;">${t('token.input.auto_apply_hint')}</p>
            </div>
          </div>
        </div>
      </div>
    `;

    this.labelInput = this.body.querySelector('#input-label') as HTMLInputElement;
    this.placeholderInput = this.body.querySelector('#input-placeholder') as HTMLInputElement;
    this.rememberCheckbox = this.body.querySelector('#input-remember') as HTMLInputElement;
    this.sessionOptionsPanel = this.body.querySelector('#session-options-panel') as HTMLElement;
    this.sessionNameInput = this.body.querySelector('#input-session-name') as HTMLInputElement;
    this.scopeSelect = this.body.querySelector('#input-scope') as HTMLSelectElement;
    this.scopeHint = this.body.querySelector('#scope-hint') as HTMLElement;
    this.ttlInput = this.body.querySelector('#input-ttl') as HTMLInputElement;
    this.autoApplyCheckbox = this.body.querySelector('#input-auto-apply') as HTMLInputElement;

    this.updateScopeHint();
    this.attachEventListeners();
  }

  private updateScopeHint(): void {
    const scope = this.scopeSelect.value as SessionScope;
    switch (scope) {
      case 'url':
        this.scopeHint.textContent = t('token.input.scope_url_hint');
        break;
      case 'title':
        this.scopeHint.textContent = t('token.input.scope_title_hint');
        break;
      case 'global':
        this.scopeHint.textContent = t('token.input.scope_global_hint');
        break;
      case 'tab':
      default:
        this.scopeHint.textContent = t('token.input.scope_tab_hint');
        break;
    }
  }

  private attachEventListeners(): void {
    this.rememberCheckbox.addEventListener('change', () => {
      const isChecked = this.rememberCheckbox.checked;
      this.sessionOptionsPanel.style.display = isChecked ? 'flex' : 'none';
      if (isChecked && !this.sessionNameInput.value) {
        // Automatically suggest sanitized label if empty
        const suggested = this.labelInput.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
        if (suggested) this.sessionNameInput.value = suggested;
      }
    });

    this.scopeSelect.addEventListener('change', () => {
      this.updateScopeHint();
    });
  }

  protected onSave(): void {
    const label = this.labelInput.value.trim();
    const placeholder = this.placeholderInput.value.trim();
    if (!label) {
      showToast(t('token.input.label_required_alert'), 'error');
      return;
    }

    const rememberValue = this.rememberCheckbox.checked;
    const sessionVarName = this.sessionNameInput.value.trim();

    if (rememberValue && !sessionVarName) {
      showToast(t('token.input.var_name_required'), 'error');
      this.sessionNameInput.focus();
      return;
    }

    const scope = this.scopeSelect.value as SessionScope;
    const ttlVal = parseInt(this.ttlInput.value, 10);
    const ttlHours = !isNaN(ttlVal) && ttlVal > 0 ? ttlVal : undefined;
    const autoApply = this.autoApplyCheckbox.checked;

    const newConfig: InputTokenConfig = {
      label,
      placeholder: placeholder || undefined,
      rememberValue: rememberValue ? true : undefined,
      sessionVarName: rememberValue ? sessionVarName : undefined,
      scope: rememberValue ? scope : undefined,
      ttlHours: rememberValue ? ttlHours : undefined,
      autoApply: rememberValue ? autoApply : undefined,
    };

    this.onSaveCallback(newConfig);
    this.close();
  }
}
