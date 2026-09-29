// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TextMonitor } from './TextMonitor.js';
import type { Settings } from '../../shared/types/index.js';

describe('TextMonitor (Blocklist & Sensitive Fields Integration)', () => {
  let monitor: TextMonitor;
  let settings: Settings;
  let onCharTyped: any;
  let onTriggerKeyPressed: any;
  let onProtectionStatusChange: any;

  beforeEach(() => {
    settings = {
      globalEnabled: true,
      blocklist: ['blocked-site.com'],
      triggerKeys: ['Space'],
    };

    onCharTyped = vi.fn();
    onTriggerKeyPressed = vi.fn();
    onProtectionStatusChange = vi.fn();

    // Mock window.location.hostname
    Object.defineProperty(window, 'location', {
      value: { hostname: 'allowed-site.com' },
      writable: true,
      configurable: true,
    });

    monitor = new TextMonitor(
      () => settings,
      onCharTyped,
      onTriggerKeyPressed,
      onProtectionStatusChange
    );
    monitor.start();
  });

  afterEach(() => {
    monitor.stop();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('allows event processing when site is NOT blocked', () => {
    window.location.hostname = 'allowed-site.com';
    
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    
    // Simulate typing
    input.value = 'hello';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onCharTyped).toHaveBeenCalled();
    expect(monitor.getBuffer()).toBe('hello');

    // Simulate trigger key
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Space', code: 'Space', bubbles: true }));
    expect(onTriggerKeyPressed).toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it('aborts and blocks event processing when site IS blocked', () => {
    window.location.hostname = 'blocked-site.com';
    
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    
    // Simulate typing
    input.value = 'hello';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onCharTyped).not.toHaveBeenCalled();

    // Simulate trigger key
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Space', code: 'Space', bubbles: true }));
    expect(onTriggerKeyPressed).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  describe('Proteção de Campos Sensíveis', () => {
    it('bloqueia gravação no buffer, chamada de atalhos e notifica proteção ao focar/digitar em campo de senha', () => {
      const passwordInput = document.createElement('input');
      passwordInput.type = 'password';
      document.body.appendChild(passwordInput);

      passwordInput.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      expect(onProtectionStatusChange).toHaveBeenCalledWith(true);

      passwordInput.value = 'MinhaSenhaSecreta';
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));

      // O buffer NUNCA deve gravar texto de senha
      expect(monitor.getBuffer()).toBe('');
      expect(onCharTyped).not.toHaveBeenCalled();

      // Trigger keys também são ignoradas
      passwordInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Space', code: 'Space', bubbles: true }));
      expect(onTriggerKeyPressed).not.toHaveBeenCalled();
    });

    it('mantém bloqueio de gravação no buffer mesmo se o type mudar de password para text (show password toggle)', () => {
      const passwordInput = document.createElement('input');
      passwordInput.type = 'password';
      document.body.appendChild(passwordInput);

      passwordInput.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      expect(onProtectionStatusChange).toHaveBeenCalledWith(true);

      // Usuário clica no "olhinho" do campo de senha
      passwordInput.type = 'text';

      passwordInput.value = 'MinhaSenhaExibida';
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));

      // Deve continuar estritamente protegido pelo WeakSet
      expect(monitor.getBuffer()).toBe('');
      expect(onCharTyped).not.toHaveBeenCalled();
    });

    it('permite expansão normal em input comum e textarea de chat (ex: Tarelo)', () => {
      const chatTextarea = document.createElement('textarea');
      chatTextarea.placeholder = 'Digite uma mensagem...';
      document.body.appendChild(chatTextarea);

      chatTextarea.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      expect(onProtectionStatusChange).toHaveBeenCalledWith(false);

      chatTextarea.value = '/oi';
      chatTextarea.dispatchEvent(new Event('input', { bubbles: true }));

      expect(monitor.getBuffer()).toBe('/oi');
      expect(onCharTyped).toHaveBeenCalled();

      chatTextarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Space', code: 'Space', bubbles: true }));
      expect(onTriggerKeyPressed).toHaveBeenCalled();
    });

    it('Bug 3: preserva status de proteção quando o foco sai da janela (relatedTarget null, ex: clique no ícone da extensão)', () => {
      const passwordInput = document.createElement('input');
      passwordInput.type = 'password';
      document.body.appendChild(passwordInput);

      // Usuário foca no campo de senha
      passwordInput.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      expect(onProtectionStatusChange).toHaveBeenCalledWith(true);
      onProtectionStatusChange.mockClear();

      // Usuário clica no ícone da extensão na barra de ferramentas: focusout com relatedTarget = null
      passwordInput.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));

      // NÃO deve disparar false, preservando o status de proteção para a consulta do popup
      expect(onProtectionStatusChange).not.toHaveBeenCalledWith(false);

      // Posteriormente, usuário clica em um input comum: agora sim emite false
      const normalInput = document.createElement('input');
      document.body.appendChild(normalInput);
      normalInput.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      expect(onProtectionStatusChange).toHaveBeenCalledWith(false);
    });
  });
});
