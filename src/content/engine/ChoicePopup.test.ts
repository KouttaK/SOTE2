/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChoicePopup } from './ChoicePopup.js';
import { setLanguage, t } from '../../shared/i18n/index.js';
import type { Token } from '../../shared/types/index.js';

describe('ChoicePopup - Input Prompt & Prefill UX (Propostas A & B.2)', () => {
  let popup: ChoicePopup;
  let targetEl: HTMLInputElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    setLanguage('pt-BR');
    targetEl = document.createElement('input');
    targetEl.type = 'text';
    document.body.appendChild(targetEl);
    popup = new ChoicePopup();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('renderiza promptInput padrão sem banner âmbar e sem botão limpar quando não há prefill', async () => {
    const token: Token = {
      id: 'tok_1',
      type: 'input',
      config: {
        label: 'Nome do Contato',
        placeholder: 'Digite aqui...',
      },
    };

    const promise = popup.showForToken(token, targetEl);

    // Verifica elementos no Shadow DOM
    const shadow = (popup as any).shadow as ShadowRoot;
    const banner = shadow.querySelector('.prefill-banner');
    const clearBtn = shadow.querySelector('.btn-clear');
    const submitBtn = shadow.querySelector('.btn-submit') as HTMLButtonElement;
    const input = shadow.querySelector('.input-field') as HTMLInputElement;

    expect(banner).toBeNull();
    expect(clearBtn).toBeNull();
    expect(submitBtn).not.toBeNull();
    expect(submitBtn.textContent).toBe(t('token.input.confirm_btn'));
    expect(input).not.toBeNull();
    expect(input.value).toBe('');

    // Preenche e submete
    input.value = 'Maria Souza';
    submitBtn.click();

    const result = await promise;
    expect(result).toBe('Maria Souza');
  });

  it('renderiza banner âmbar e botão Limpar quando há valor pré-preenchido (Propostas A & B.2)', async () => {
    const token: Token = {
      id: 'tok_2',
      type: 'input',
      config: {
        label: 'Número do Processo',
      },
    };

    const promise = popup.showForToken(token, targetEl, [], '12345/2026');

    const shadow = (popup as any).shadow as ShadowRoot;
    const banner = shadow.querySelector('.prefill-banner') as HTMLElement;
    const clearBtn = shadow.querySelector('.btn-clear') as HTMLButtonElement;
    const submitBtn = shadow.querySelector('.btn-submit') as HTMLButtonElement;
    const input = shadow.querySelector('.input-field') as HTMLInputElement;

    expect(banner).not.toBeNull();
    expect(banner.textContent).toContain(t('token.input.prefill_banner'));
    expect(clearBtn).not.toBeNull();
    expect(clearBtn.textContent).toBe(t('token.input.clear_btn'));
    expect(input.value).toBe('12345/2026');

    // Confirma com o valor pré-preenchido
    submitBtn.click();

    const result = await promise;
    expect(result).toBe('12345/2026');
  });

  it('ao clicar em "Limpar e digitar novo", limpa o input, remove o banner e o botão limpar, e foca o campo', async () => {
    const token: Token = {
      id: 'tok_3',
      type: 'input',
      config: {
        label: 'Protocolo',
      },
    };

    const promise = popup.showForToken(token, targetEl, [], 'ABC-999');

    const shadow = (popup as any).shadow as ShadowRoot;
    let banner = shadow.querySelector('.prefill-banner');
    let clearBtn = shadow.querySelector('.btn-clear') as HTMLButtonElement;
    const input = shadow.querySelector('.input-field') as HTMLInputElement;
    const focusSpy = vi.spyOn(input, 'focus');

    expect(banner).not.toBeNull();
    expect(clearBtn).not.toBeNull();
    expect(input.value).toBe('ABC-999');

    // Clica no botão Limpar
    clearBtn.click();

    // Input deve estar vazio
    expect(input.value).toBe('');
    // Banner e botão de limpar devem ter sido removidos
    banner = shadow.querySelector('.prefill-banner');
    clearBtn = shadow.querySelector('.btn-clear') as HTMLButtonElement;
    expect(banner).toBeNull();
    expect(clearBtn).toBeNull();
    expect(focusSpy).toHaveBeenCalled();

    // Digita um novo valor e confirma via Enter
    input.value = 'XYZ-001';
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    document.dispatchEvent(enterEvent);

    const result = await promise;
    expect(result).toBe('XYZ-001');
  });

  it('ao pressionar Escape, cancela o popup e resolve com null', async () => {
    const token: Token = {
      id: 'tok_4',
      type: 'input',
      config: {
        label: 'Identificador',
      },
    };

    const promise = popup.showForToken(token, targetEl, [], 'VAL-123');

    const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.dispatchEvent(escEvent);

    const result = await promise;
    expect(result).toBeNull();
  });
});
