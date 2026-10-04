/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InputModal } from './InputModal.js';
import { setLanguage } from '../../../../shared/i18n/index.js';
import type { Token, Flow } from '../../../../shared/types/index.js';
import { showToast } from '../../../../shared/components/Toast.js';

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
      },
    },
    tabs: { query: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock('../../../../shared/components/Toast.js', () => ({
  showToast: vi.fn(),
}));

describe('InputModal (src/dashboard/components/tokens/modals/InputModal.ts)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    setLanguage('pt-BR');
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('renders initial state without session options visible when rememberValue is false', () => {
    const token: Token = {
      id: 'tok_input_1',
      type: 'input',
      config: {
        label: 'Nome do Cliente',
        placeholder: 'João Silva',
      },
    };

    const modal = new InputModal(token, vi.fn());
    modal.open();

    const labelInput = document.querySelector('#input-label') as HTMLInputElement;
    const placeholderInput = document.querySelector('#input-placeholder') as HTMLInputElement;
    const rememberCheckbox = document.querySelector('#input-remember') as HTMLInputElement;
    const sessionPanel = document.querySelector('#session-options-panel') as HTMLElement;

    expect(labelInput.value).toBe('Nome do Cliente');
    expect(placeholderInput.value).toBe('João Silva');
    expect(rememberCheckbox.checked).toBe(false);
    expect(sessionPanel.style.display).toBe('none');
  });

  it('toggles session panel and automatically suggests variable name on check', () => {
    const token: Token = {
      id: 'tok_input_2',
      type: 'input',
      config: {
        label: 'Nome do Cliente',
      },
    };

    const modal = new InputModal(token, vi.fn());
    modal.open();

    const rememberCheckbox = document.querySelector('#input-remember') as HTMLInputElement;
    const sessionPanel = document.querySelector('#session-options-panel') as HTMLElement;
    const sessionNameInput = document.querySelector('#input-session-name') as HTMLInputElement;

    rememberCheckbox.checked = true;
    rememberCheckbox.dispatchEvent(new Event('change'));

    expect(sessionPanel.style.display).toBe('flex');
    expect(sessionNameInput.value).toBe('nome_do_cliente');
  });

  it('updates scope hint dynamically and shows global session notice', () => {
    const token: Token = {
      id: 'tok_input_3',
      type: 'input',
      config: {
        label: 'Empresa',
        rememberValue: true,
        sessionVarName: 'empresa',
        scope: 'tab',
      },
    };

    const modal = new InputModal(token, vi.fn());
    modal.open();

    const scopeSelect = document.querySelector('#input-scope') as HTMLSelectElement;
    const scopeHint = document.querySelector('#scope-hint') as HTMLElement;

    expect(scopeHint.textContent).toContain('Salvo somente nesta aba');

    scopeSelect.value = 'global';
    scopeSelect.dispatchEvent(new Event('change'));
    expect(scopeHint.textContent).toContain('Disponível em todas as abas');
    expect(scopeHint.textContent).toContain('fechar o navegador');
  });

  it('validates that sessionVarName is required when rememberValue is checked', () => {
    const onSave = vi.fn();
    const token: Token = {
      id: 'tok_input_4',
      type: 'input',
      config: {
        label: 'Empresa',
        rememberValue: true,
        sessionVarName: '',
      },
    };

    const modal = new InputModal(token, onSave);
    modal.open();

    const saveBtn = document.querySelector('#btn-modal-save') as HTMLButtonElement;
    saveBtn.click();

    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('obrigatório'), 'error');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves complete reusable session configuration on valid save click', () => {
    const onSave = vi.fn();
    const token: Token = {
      id: 'tok_input_5',
      type: 'input',
      config: {
        label: 'Nome',
      },
    };

    const modal = new InputModal(token, onSave);
    modal.open();

    const rememberCheckbox = document.querySelector('#input-remember') as HTMLInputElement;
    rememberCheckbox.checked = true;
    rememberCheckbox.dispatchEvent(new Event('change'));

    const sessionNameInput = document.querySelector('#input-session-name') as HTMLInputElement;
    sessionNameInput.value = 'cliente_atual';

    const scopeSelect = document.querySelector('#input-scope') as HTMLSelectElement;
    scopeSelect.value = 'url';
    scopeSelect.dispatchEvent(new Event('change'));

    const ttlInput = document.querySelector('#input-ttl') as HTMLInputElement;
    ttlInput.value = '4';

    const autoApplyCheckbox = document.querySelector('#input-auto-apply') as HTMLInputElement;
    autoApplyCheckbox.checked = true;

    const saveBtn = document.querySelector('#btn-modal-save') as HTMLButtonElement;
    saveBtn.click();

    expect(onSave).toHaveBeenCalledWith({
      label: 'Nome',
      placeholder: undefined,
      rememberValue: true,
      sessionVarName: 'cliente_atual',
      scope: 'url',
      ttlHours: 4,
      autoApply: true,
    });
  });

  it('renders educational CRM tip card inside session options panel', () => {
    const token: Token = {
      id: 'tok_input_6',
      type: 'input',
      config: {
        label: 'Nome',
        rememberValue: true,
        sessionVarName: 'nome',
      },
    };

    const modal = new InputModal(token, vi.fn());
    modal.open();

    const sessionPanel = document.querySelector('#session-options-panel') as HTMLElement;
    const crmCard = sessionPanel.querySelector('.field-hint-card') as HTMLElement;

    expect(crmCard).not.toBeNull();
    expect(crmCard.textContent).toContain('Dica para CRM/Atendimento');
  });

  it('displays discrete warning when another flow uses same variable name with different scope', () => {
    const existingFlows: Flow[] = [
      {
        id: 'flow_1',
        name: 'Fluxo A',
        folderId: null,
        blocks: [
          {
            id: 'b1',
            type: 'action',
            data: {
              content: 'Processo: {{var}}',
              tokens: [
                {
                  id: 'tok_other',
                  type: 'input',
                  config: {
                    label: 'Processo',
                    rememberValue: true,
                    sessionVarName: 'num_proc',
                    scope: 'global',
                  },
                },
              ],
            },
          },
        ],
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const currentToken: Token = {
      id: 'tok_curr',
      type: 'input',
      config: {
        label: 'Processo Atual',
        rememberValue: true,
        sessionVarName: 'num_proc',
        scope: 'tab',
      },
    };

    const modal = new InputModal(currentToken, vi.fn(), existingFlows);
    modal.open();

    const warningCard = document.querySelector('#scope-mismatch-warning') as HTMLElement;
    const warningText = document.querySelector('#scope-mismatch-text') as HTMLElement;

    expect(warningCard.style.display).toBe('flex');
    expect(warningText.textContent).toContain('num_proc');
    expect(warningText.textContent).toMatch(/global/i);
  });

  it('hides warning when user changes scope to match the other token or uses different variable name', () => {
    const existingFlows: Flow[] = [
      {
        id: 'flow_1',
        name: 'Fluxo A',
        folderId: null,
        blocks: [
          {
            id: 'b1',
            type: 'action',
            data: {
              content: 'Processo: {{var}}',
              tokens: [
                {
                  id: 'tok_other',
                  type: 'input',
                  config: {
                    label: 'Processo',
                    rememberValue: true,
                    sessionVarName: 'num_proc',
                    scope: 'global',
                  },
                },
              ],
            },
          },
        ],
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const currentToken: Token = {
      id: 'tok_curr',
      type: 'input',
      config: {
        label: 'Processo Atual',
        rememberValue: true,
        sessionVarName: 'num_proc',
        scope: 'tab',
      },
    };

    const modal = new InputModal(currentToken, vi.fn(), existingFlows);
    modal.open();

    const warningCard = document.querySelector('#scope-mismatch-warning') as HTMLElement;
    const scopeSelect = document.querySelector('#input-scope') as HTMLSelectElement;
    const nameInput = document.querySelector('#input-session-name') as HTMLInputElement;

    expect(warningCard.style.display).toBe('flex');

    // Change scope to 'global' -> matches existing flow's scope -> warning disappears
    scopeSelect.value = 'global';
    scopeSelect.dispatchEvent(new Event('change'));
    expect(warningCard.style.display).toBe('none');

    // Change scope back to 'tab' -> warning reappears
    scopeSelect.value = 'tab';
    scopeSelect.dispatchEvent(new Event('change'));
    expect(warningCard.style.display).toBe('flex');

    // Change name to a different variable name -> warning disappears
    nameInput.value = 'outro_proc';
    nameInput.dispatchEvent(new Event('input'));
    expect(warningCard.style.display).toBe('none');
  });

  it('does not display warning when tokens share the same variable name and same scope', () => {
    const existingFlows: Flow[] = [
      {
        id: 'flow_1',
        name: 'Fluxo A',
        folderId: null,
        blocks: [
          {
            id: 'b1',
            type: 'action',
            data: {
              content: 'Processo: {{var}}',
              tokens: [
                {
                  id: 'tok_other',
                  type: 'input',
                  config: {
                    label: 'Processo',
                    rememberValue: true,
                    sessionVarName: 'num_proc',
                    scope: 'tab',
                  },
                },
              ],
            },
          },
        ],
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const currentToken: Token = {
      id: 'tok_curr',
      type: 'input',
      config: {
        label: 'Processo Atual',
        rememberValue: true,
        sessionVarName: 'num_proc',
        scope: 'tab',
      },
    };

    const modal = new InputModal(currentToken, vi.fn(), existingFlows);
    modal.open();

    const warningCard = document.querySelector('#scope-mismatch-warning') as HTMLElement;
    expect(warningCard.style.display).toBe('none');
  });
});

