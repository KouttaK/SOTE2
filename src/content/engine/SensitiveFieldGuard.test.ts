// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  isProtected,
  getTargetFromEvent,
  getDeepActiveElement,
} from './SensitiveFieldGuard.js';

describe('SensitiveFieldGuard', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('Bloqueio Rígido e Normativo', () => {
    it('bloqueia campo com type="password"', () => {
      const input = document.createElement('input');
      input.type = 'password';
      expect(isProtected(input)).toBe(true);
    });

    it('mantém o campo protegido mesmo após o type mudar de password para text (botão de mostrar senha)', () => {
      const input = document.createElement('input');
      input.type = 'password';
      
      // Primeira checagem registra no WeakSet
      expect(isProtected(input)).toBe(true);

      // Usuário clica no "olhinho" do campo de senha -> vira text
      input.type = 'text';

      // Deve continuar protegido pelo WeakSet
      expect(isProtected(input)).toBe(true);
    });

    it('bloqueia atributos autocomplete de cartão de crédito (cc-*)', () => {
      const attributes = [
        'cc-number',
        'cc-csc',
        'cc-exp',
        'cc-exp-month',
        'cc-exp-year',
        'cc-name',
        'cc-type',
        'billing cc-number',
        'section-blue cc-csc',
      ];

      for (const auto of attributes) {
        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('autocomplete', auto);
        expect(isProtected(input), `Deveria bloquear autocomplete="${auto}"`).toBe(true);
      }
    });

    it('bloqueia autocomplete current-password, new-password e one-time-code', () => {
      const autocompletes = ['current-password', 'new-password', 'one-time-code'];
      for (const auto of autocompletes) {
        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('autocomplete', auto);
        expect(isProtected(input), `Deveria bloquear autocomplete="${auto}"`).toBe(true);
      }
    });
  });

  describe('Heurísticas Estreitas (CVV, Cartão, OTP, Senha)', () => {
    it('bloqueia CVV e CVC em name, id, aria-label e placeholder', () => {
      const variations = [
        { attr: 'name', val: 'cvv' },
        { attr: 'name', val: 'cvc' },
        { attr: 'id', val: 'card-cvv' },
        { attr: 'id', val: 'card_cvc' },
        { attr: 'aria-label', val: 'Código de segurança' },
        { attr: 'placeholder', val: 'Cód. Segurança' },
        { attr: 'placeholder', val: 'CVV2' },
      ];

      for (const v of variations) {
        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute(v.attr, v.val);
        expect(isProtected(input), `Deveria bloquear ${v.attr}="${v.val}"`).toBe(true);
      }
    });

    it('bloqueia número do cartão em name, id, aria-label e placeholder', () => {
      const variations = [
        { attr: 'name', val: 'cardNumber' },
        { attr: 'name', val: 'card-number' },
        { attr: 'id', val: 'credit_card' },
        { attr: 'placeholder', val: 'Número do Cartão' },
        { attr: 'aria-label', val: 'Num cartão' },
      ];

      for (const v of variations) {
        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute(v.attr, v.val);
        expect(isProtected(input), `Deveria bloquear ${v.attr}="${v.val}"`).toBe(true);
      }
    });

    it('bloqueia OTP, 2FA, códigos e tokens com contexto de autenticação', () => {
      const variations = [
        { attr: 'name', val: 'otp' },
        { attr: 'id', val: 'auth-2fa' },
        { attr: 'name', val: 'mfa_code' },
        { attr: 'placeholder', val: 'Código de verificação' },
        { attr: 'aria-label', val: 'Código de autenticação' },
        { attr: 'name', val: 'auth-token' },
        { attr: 'name', val: 'access-token' },
        { attr: 'id', val: 'token-code' },
        { attr: 'placeholder', val: 'Token de acesso' },
        { attr: 'aria-label', val: 'security-token' },
        { attr: 'name', val: '2fa-token' },
        { attr: 'id', val: 'authToken' },
        { attr: 'name', val: 'tokenCode' },
        { attr: 'name', val: 'auth-code' },
        { attr: 'placeholder', val: 'one-time-code' },
      ];

      for (const v of variations) {
        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute(v.attr, v.val);
        expect(isProtected(input), `Deveria bloquear ${v.attr}="${v.val}"`).toBe(true);
      }
    });

    it('bloqueia campos com termos de senha em texto plano', () => {
      const variations = [
        { attr: 'name', val: 'user_password' },
        { attr: 'id', val: 'txt-senha' },
        { attr: 'placeholder', val: 'Digite sua senha' },
        { attr: 'name', val: 'passwd' },
        { attr: 'id', val: 'pwd' },
      ];

      for (const v of variations) {
        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute(v.attr, v.val);
        expect(isProtected(input), `Deveria bloquear ${v.attr}="${v.val}"`).toBe(true);
      }
    });
  });

  describe('Prevenção de Falsos Positivos (NÃO devem ser bloqueados)', () => {
    it('NÃO bloqueia cid, client_id, category-id e category_id', () => {
      const safeInputs = [
        { attr: 'name', val: 'cid' },
        { attr: 'name', val: 'client_id' },
        { attr: 'name', val: 'category-id' },
        { attr: 'id', val: 'category_id' },
        { attr: 'placeholder', val: 'Category ID' },
        { attr: 'aria-label', val: 'Customer ID' },
      ];

      for (const s of safeInputs) {
        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute(s.attr, s.val);
        expect(isProtected(input), `NÃO deveria bloquear ${s.attr}="${s.val}"`).toBe(false);
      }
    });

    it('NÃO bloqueia palavras comuns que contêm substrings coincidentes', () => {
      const safeWords = [
        { attr: 'name', val: 'device' },
        { attr: 'name', val: 'receive' },
        { attr: 'name', val: 'acid' },
        { attr: 'name', val: 'footprint' },
        { attr: 'name', val: 'hotplug' },
        { attr: 'name', val: 'platform' },
        { attr: 'name', val: 'fast' },
        { attr: 'name', val: 'passport' },
        { attr: 'name', val: 'card' }, // card de Kanban
        { attr: 'id', val: 'task-card' },
        { attr: 'name', val: 'giftcard_balance' },
      ];

      for (const s of safeWords) {
        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute(s.attr, s.val);
        expect(isProtected(input), `NÃO deveria bloquear ${s.attr}="${s.val}"`).toBe(false);
      }
    });

    it('NÃO bloqueia apenas por causa de inputmode="numeric"', () => {
      const cepInput = document.createElement('input');
      cepInput.type = 'text';
      cepInput.setAttribute('inputmode', 'numeric');
      cepInput.name = 'cep';
      expect(isProtected(cepInput)).toBe(false);

      const phoneInput = document.createElement('input');
      phoneInput.type = 'tel';
      phoneInput.setAttribute('inputmode', 'numeric');
      phoneInput.name = 'telefone';
      expect(isProtected(phoneInput)).toBe(false);

      const qtyInput = document.createElement('input');
      qtyInput.type = 'number';
      qtyInput.setAttribute('inputmode', 'numeric');
      qtyInput.name = 'quantidade';
      expect(isProtected(qtyInput)).toBe(false);
    });

    it('NÃO bloqueia palavra "token" isolada nem tokens genéricos sem contexto de autenticação', () => {
      const genericTokens = [
        { attr: 'name', val: 'token' },
        { attr: 'id', val: 'token' },
        { attr: 'placeholder', val: 'token' },
        { attr: 'aria-label', val: 'token' },
        { attr: 'name', val: 'promo-token' },
        { attr: 'id', val: 'promo_token' },
        { attr: 'name', val: 'promotoken' },
        { attr: 'placeholder', val: 'Promo Token' },
        { attr: 'name', val: 'referral-token' },
        { attr: 'id', val: 'referral_token' },
        { attr: 'name', val: 'share-token' },
        { attr: 'id', val: 'share_token' },
        { attr: 'name', val: 'csrf-token' },
        { attr: 'id', val: 'csrf_token' },
        { attr: 'name', val: 'csrfToken' },
        { attr: 'name', val: 'xsrf-token' },
        { attr: 'name', val: 'token-promo' },
        { attr: 'name', val: 'user-token' },
        { attr: 'name', val: 'session-token' },
        { attr: 'name', val: 'token_id' },
        { attr: 'name', val: 'token_type' },
      ];

      for (const t of genericTokens) {
        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute(t.attr, t.val);
        expect(isProtected(input), `NÃO deveria bloquear ${t.attr}="${t.val}"`).toBe(false);
      }
    });

    it('NÃO bloqueia inputs de texto comuns nem textareas de chat (ex: Tarelo)', () => {
      const chatTextarea = document.createElement('textarea');
      chatTextarea.placeholder = 'Digite uma mensagem...';
      chatTextarea.name = 'chat_message';
      expect(isProtected(chatTextarea)).toBe(false);

      const regularInput = document.createElement('input');
      regularInput.type = 'text';
      regularInput.placeholder = 'Pesquisar...';
      regularInput.name = 'q';
      expect(isProtected(regularInput)).toBe(false);

      const emailInput = document.createElement('input');
      emailInput.type = 'email';
      emailInput.placeholder = 'seu@email.com';
      emailInput.name = 'email';
      expect(isProtected(emailInput)).toBe(false);
    });
  });

  describe('Garantia de Não Desativação', () => {
    it('garante que a função isProtected não aceita parâmetros ou flags para desligar a proteção', () => {
      // isProtected aceita estritamente o Element
      expect(isProtected.length).toBe(1);
    });
  });

  describe('Suporte a Shadow DOM Aberto', () => {
    it('getTargetFromEvent extrai o primeiro elemento de event.composedPath()', () => {
      const div = document.createElement('div');
      const fakeEvent = {
        composedPath: () => [div, document.body, document],
        target: document.body,
      } as unknown as Event;

      expect(getTargetFromEvent(fakeEvent)).toBe(div);
    });

    it('getTargetFromEvent recorre a event.target se composedPath não estiver disponível', () => {
      const div = document.createElement('div');
      const fakeEvent = {
        target: div,
      } as unknown as Event;

      expect(getTargetFromEvent(fakeEvent)).toBe(div);
    });

    it('getDeepActiveElement penetra shadowRoot aberto', () => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      
      const shadowRoot = host.attachShadow({ mode: 'open' });
      const innerInput = document.createElement('input');
      shadowRoot.appendChild(innerInput);

      innerInput.focus();
      // Em JSDOM, simula activeElement
      Object.defineProperty(document, 'activeElement', { value: host, configurable: true });
      Object.defineProperty(shadowRoot, 'activeElement', { value: innerInput, configurable: true });

      expect(getDeepActiveElement()).toBe(innerInput);
    });
  });
});
