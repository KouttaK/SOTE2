/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { showToast } from '../../shared/components/Toast.js';

describe('Toast Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('renders a toast notification element with proper aria, type class and message', () => {
    showToast('Operação realizada com sucesso!', 'success', 3000);

    const toast = document.querySelector('.sote-toast') as HTMLElement;
    expect(toast).not.toBeNull();
    expect(toast.textContent).toContain('Operação realizada com sucesso!');
    expect(toast.className).toContain('sote-toast-success');
    expect(toast.getAttribute('role')).toBe('alert');
    expect(toast.getAttribute('aria-live')).toBe('assertive');
  });

  it('renders different variant styles for error, warning and info', () => {
    showToast('Erro crítico', 'error', 3000);
    let toast = document.querySelector('.sote-toast') as HTMLElement;
    expect(toast.className).toContain('sote-toast-error');

    showToast('Aviso importante', 'warning', 3000);
    const toasts = document.querySelectorAll('.sote-toast');
    expect(toasts.length).toBe(2);
    expect(toasts[1].className).toContain('sote-toast-warning');
  });

  it('removes the toast automatically after the specified duration + fade animation', () => {
    showToast('Temporário', 'info', 2000);

    expect(document.querySelector('.sote-toast')).not.toBeNull();

    // Advance right to duration (starts fade out)
    vi.advanceTimersByTime(2000);
    // Advance fade animation time (300ms)
    vi.advanceTimersByTime(350);

    expect(document.querySelector('.sote-toast')).toBeNull();
  });

  it('dismisses immediately when clicked by the user without waiting for timeout', () => {
    showToast('Clique para fechar', 'info', 10000);

    const toast = document.querySelector('.sote-toast') as HTMLElement;
    expect(toast).not.toBeNull();

    toast.click();
    vi.advanceTimersByTime(350);

    expect(document.querySelector('.sote-toast')).toBeNull();
  });
});
