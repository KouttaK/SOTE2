import { describe, it, expect } from 'vitest';
import { evaluateMath } from './mathEvaluator.js';

describe('mathEvaluator', () => {
  describe('basic arithmetic operations', () => {
    it('evaluates addition correctly', () => {
      expect(evaluateMath('10 + 5')).toBe(15);
      expect(evaluateMath('0 + 0')).toBe(0);
      expect(evaluateMath('100 + 250 + 50')).toBe(400);
    });

    it('evaluates subtraction correctly', () => {
      expect(evaluateMath('10 - 4')).toBe(6);
      expect(evaluateMath('5 - 10')).toBe(-5);
      expect(evaluateMath('20 - 5 - 3')).toBe(12);
    });

    it('evaluates multiplication correctly', () => {
      expect(evaluateMath('10 * 5')).toBe(50);
      expect(evaluateMath('7 * 8')).toBe(56);
      expect(evaluateMath('2 * 3 * 4')).toBe(24);
    });

    it('evaluates division correctly', () => {
      expect(evaluateMath('100 / 4')).toBe(25);
      expect(evaluateMath('9 / 2')).toBe(4.5);
      expect(evaluateMath('100 / 2 / 2')).toBe(25);
    });

    it('evaluates modulo correctly', () => {
      expect(evaluateMath('10 % 3')).toBe(1);
      expect(evaluateMath('20 % 5')).toBe(0);
      expect(evaluateMath('15 % 4')).toBe(3);
    });
  });

  describe('operator precedence and parentheses', () => {
    it('respects multiplication over addition', () => {
      expect(evaluateMath('2 + 3 * 4')).toBe(14);
      expect(evaluateMath('2 * 3 + 4')).toBe(10);
    });

    it('respects division over subtraction', () => {
      expect(evaluateMath('20 - 10 / 2')).toBe(15);
      expect(evaluateMath('20 / 4 - 2')).toBe(3);
    });

    it('evaluates parentheses with highest precedence', () => {
      expect(evaluateMath('(2 + 3) * 4')).toBe(20);
      expect(evaluateMath('2 * (3 + 4)')).toBe(14);
      expect(evaluateMath('((10 + 5) * 2) / 3')).toBe(10);
    });
  });

  describe('unary operators and negative numbers', () => {
    it('handles negative numbers', () => {
      expect(evaluateMath('-5 + 10')).toBe(5);
      expect(evaluateMath('10 + -5')).toBe(5);
      expect(evaluateMath('-10 * -5')).toBe(50);
    });

    it('handles unary plus and parentheses negation', () => {
      expect(evaluateMath('+5 + +10')).toBe(15);
      expect(evaluateMath('-(2 + 3) * 4')).toBe(-20);
    });
  });

  describe('decimal numbers', () => {
    it('evaluates floating point calculations correctly', () => {
      expect(evaluateMath('0.5 + 0.25')).toBe(0.75);
      expect(evaluateMath('3.5 * 2')).toBe(7);
      expect(evaluateMath('10.5 / 2.5')).toBe(4.2);
    });
  });

  describe('error handling and edge cases', () => {
    it('throws error on division by zero', () => {
      expect(() => evaluateMath('10 / 0')).toThrow('Division by zero');
    });

    it('throws error on modulo by zero', () => {
      expect(() => evaluateMath('10 % 0')).toThrow('Modulo by zero');
    });

    it('throws error on empty expression', () => {
      expect(() => evaluateMath('')).toThrow('Empty expression');
      expect(() => evaluateMath('   ')).toThrow('Empty expression');
    });

    it('throws error on invalid characters', () => {
      expect(() => evaluateMath('10 + abc')).toThrow();
      expect(() => evaluateMath('10 $ 5')).toThrow();
    });

    it('throws error on unbalanced parentheses', () => {
      expect(() => evaluateMath('(10 + 5')).toThrow('Mismatched parentheses');
      expect(() => evaluateMath('10 + 5)')).toThrow();
    });

    it('throws error on invalid syntax', () => {
      expect(() => evaluateMath('10 + * 5')).toThrow();
      expect(() => evaluateMath('10 +')).toThrow();
    });
  });
});
