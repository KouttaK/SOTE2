/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChoicePopup } from './ChoicePopup.js';
import { setLanguage, t } from '../../shared/i18n/index.js';
import type { Token, FormField } from '../../shared/types/index.js';

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

describe('ChoicePopup - showForm (Subtarefa 3.2 Formulário Unificado)', () => {
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

  it('renderiza formulário com múltiplos campos, labels, placeholders e badge de sessão', async () => {
    const fields: FormField[] = [
      { key: 'nome', label: 'Nome do Cliente', placeholder: 'Ex: Maria' },
      { key: 'proc', label: 'Número do Processo', value: '12345/2026', prefilled: true },
    ];

    const promise = popup.showForm(fields, targetEl);

    const shadow = (popup as any).shadow as ShadowRoot;
    const title = shadow.querySelector('.popup-title') as HTMLElement;
    const inputs = shadow.querySelectorAll('.input-field') as NodeListOf<HTMLInputElement>;
    const labels = shadow.querySelectorAll('.form-field-label') as NodeListOf<HTMLElement>;
    const badges = shadow.querySelectorAll('.form-prefill-badge') as NodeListOf<HTMLElement>;
    const cancelBtn = shadow.querySelector('.btn-clear') as HTMLButtonElement;
    const submitBtn = shadow.querySelector('.btn-submit') as HTMLButtonElement;

    expect(title.textContent).toBe(t('token.form.title'));
    expect(inputs.length).toBe(2);
    expect(labels[0].textContent).toBe('Nome do Cliente');
    expect(inputs[0].placeholder).toBe('Ex: Maria');
    expect(inputs[0].value).toBe('');
    expect(labels[1].textContent).toBe('Número do Processo');
    expect(inputs[1].value).toBe('12345/2026');
    expect(badges.length).toBe(1);
    expect(badges[0].textContent).toBe(t('token.form.prefill_badge'));
    expect(cancelBtn.textContent).toBe(t('token.form.cancel_btn'));
    expect(submitBtn.textContent).toBe(t('token.form.submit_btn'));

    // Preenche campo 1 e confirma
    inputs[0].value = 'Maria Silva';
    submitBtn.click();

    const result = await promise;
    expect(result).toEqual({
      nome: 'Maria Silva',
      proc: '12345/2026',
    });
  });

  it('cancela e resolve com null ao clicar no botão Cancelar ou pressionar Escape', async () => {
    const fields: FormField[] = [
      { key: 'campo1', label: 'Campo 1' },
      { key: 'campo2', label: 'Campo 2' },
    ];

    const promise = popup.showForm(fields, targetEl);

    const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.dispatchEvent(escEvent);

    const result = await promise;
    expect(result).toBeNull();
  });

  it('navegação por teclado no form: Enter no primeiro campo avança foco, Enter no último submete', async () => {
    const fields: FormField[] = [
      { key: 'f1', label: 'Primeiro' },
      { key: 'f2', label: 'Segundo' },
    ];

    const promise = popup.showForm(fields, targetEl);

    const shadow = (popup as any).shadow as ShadowRoot;
    const inputs = shadow.querySelectorAll('.input-field') as NodeListOf<HTMLInputElement>;

    inputs[0].value = 'Valor 1';
    inputs[1].value = 'Valor 2';

    // Enter no primeiro campo
    const enterFirst = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    Object.defineProperty(enterFirst, 'target', { value: inputs[0] });
    document.dispatchEvent(enterFirst);

    // Enter no segundo (último) campo submete
    const enterSecond = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    Object.defineProperty(enterSecond, 'target', { value: inputs[1] });
    document.dispatchEvent(enterSecond);

    const result = await promise;
    expect(result).toEqual({
      f1: 'Valor 1',
      f2: 'Valor 2',
    });
  });

  it('Ctrl+Enter em qualquer campo submete o formulário imediatamente', async () => {
    const fields: FormField[] = [
      { key: 'f1', label: 'Primeiro' },
      { key: 'f2', label: 'Segundo' },
    ];

    const promise = popup.showForm(fields, targetEl);

    const shadow = (popup as any).shadow as ShadowRoot;
    const inputs = shadow.querySelectorAll('.input-field') as NodeListOf<HTMLInputElement>;

    inputs[0].value = 'Instantâneo';
    inputs[1].value = 'Padrão';

    const ctrlEnter = new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true });
    Object.defineProperty(ctrlEnter, 'target', { value: inputs[0] });
    document.dispatchEvent(ctrlEnter);

    const result = await promise;
    expect(result).toEqual({
      f1: 'Instantâneo',
      f2: 'Padrão',
    });
  });
});
