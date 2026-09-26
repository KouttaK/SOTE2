/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PromptModal } from './PromptModal.js';

describe('PromptModal Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders title, message, placeholder, pre-filled value and confirms on button click', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    PromptModal.show({
      title: 'Criar Pasta',
      message: 'Insira o nome da nova pasta de atalhos',
      placeholder: 'Nome...',
      defaultValue: 'Trabalho',
      confirmLabel: 'Criar',
      cancelLabel: 'Desistir',
      onConfirm,
      onCancel,
    });

    const overlay = document.querySelector('.confirm-modal-overlay');
    expect(overlay).not.toBeNull();

    const title = overlay?.querySelector('.confirm-modal-title');
    expect(title?.textContent).toBe('Criar Pasta');

    const msg = overlay?.querySelector('.confirm-modal-message');
    expect(msg?.textContent).toBe('Insira o nome da nova pasta de atalhos');

    const input = overlay?.querySelector<HTMLInputElement>('#prompt-modal-input');
    expect(input).not.toBeNull();
    expect(input?.value).toBe('Trabalho');
    expect(input?.placeholder).toBe('Nome...');

    const confirmBtn = overlay?.querySelector<HTMLButtonElement>('#prompt-modal-confirm');
    expect(confirmBtn?.textContent).toBe('Criar');

    const cancelBtn = overlay?.querySelector<HTMLButtonElement>('#prompt-modal-cancel');
    expect(cancelBtn?.textContent).toBe('Desistir');

    confirmBtn?.click();

    expect(onConfirm).toHaveBeenCalledWith('Trabalho');
    expect(onCancel).not.toHaveBeenCalled();
    expect(document.querySelector('.confirm-modal-overlay')).toBeNull();
  });

  it('submits on Enter key inside the text input with trimmed value', () => {
    const onConfirm = vi.fn();

    PromptModal.show({
      title: 'Inserir Link',
      defaultValue: '  https://google.com  ',
      onConfirm,
    });

    const input = document.querySelector<HTMLInputElement>('#prompt-modal-input')!;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(onConfirm).toHaveBeenCalledWith('https://google.com');
    expect(document.querySelector('.confirm-modal-overlay')).toBeNull();
  });

  it('cancels and triggers onCancel on Escape key, Cancel button, and backdrop click', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    // 1. Cancel via cancel button
    PromptModal.show({
      title: 'Teste Cancel 1',
      onConfirm,
      onCancel,
    });
    const cancelBtn = document.querySelector<HTMLButtonElement>('#prompt-modal-cancel')!;
    cancelBtn.click();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(document.querySelector('.confirm-modal-overlay')).toBeNull();

    // 2. Cancel via Escape key
    PromptModal.show({
      title: 'Teste Cancel 2',
      onConfirm,
      onCancel,
    });
    const input = document.querySelector<HTMLInputElement>('#prompt-modal-input')!;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(document.querySelector('.confirm-modal-overlay')).toBeNull();

    // 3. Cancel via backdrop click
    PromptModal.show({
      title: 'Teste Cancel 3',
      onConfirm,
      onCancel,
    });
    const overlay = document.querySelector<HTMLDivElement>('.confirm-modal-overlay')!;
    overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onCancel).toHaveBeenCalledTimes(3);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(document.querySelector('.confirm-modal-overlay')).toBeNull();
  });

  it('handles empty input submission gracefully', () => {
    const onConfirm = vi.fn();

    PromptModal.show({
      title: 'Vazio',
      defaultValue: '',
      onConfirm,
    });

    const confirmBtn = document.querySelector<HTMLButtonElement>('#prompt-modal-confirm')!;
    confirmBtn.click();

    expect(onConfirm).toHaveBeenCalledWith('');
    expect(document.querySelector('.confirm-modal-overlay')).toBeNull();
  });
});
