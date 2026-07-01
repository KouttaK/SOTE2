import { describe, it, expect } from 'vitest';
import { TextInjector } from '../../content/engine/TextInjector.js';

describe('TextInjector', () => {
  describe('injectIntoInput', () => {
    it('deve substituir corretamente o atalho no início absoluto do campo (ex: campo="obg", cursor=3)', () => {
      // Mock de um input element
      const input = document.createElement('input');
      input.value = 'obg';
      
      // Simula o cursor no final do texto recém digitado
      input.selectionStart = 3;
      input.selectionEnd = 3;
      
      // Injetamos a expansão "obrigado", passando o atalho exato ("obg") sem espaços fantasmas
      TextInjector.inject(input, 'obg', 'obrigado', false);
      
      // O valor deve ser "obrigado" ao invés de abortar e continuar "obg"
      expect(input.value).toBe('obrigado');
    });

    it('deve manter o restante do texto intacto ao injetar no meio', () => {
      const input = document.createElement('input');
      input.value = 'olá obg pelo apoio';
      
      // Simula o cursor logo após o "obg"
      input.selectionStart = 7; // "olá obg".length
      input.selectionEnd = 7;
      
      TextInjector.inject(input, 'obg', 'obrigado', false);
      
      expect(input.value).toBe('olá obrigado pelo apoio');
    });
  });
});
