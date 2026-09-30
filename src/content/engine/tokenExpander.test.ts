import { describe, it, expect, beforeEach, vi } from 'vitest';
import { expandToken, resetCounterState } from './tokenExpander.js';
import { browser } from 'wxt/browser';
import type { Token } from '../../shared/types/index.js';

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      sendMessage: vi.fn()
    },
    storage: {
      local: { get: vi.fn(), set: vi.fn() }
    }
  }
}));
describe('tokenExpander', () => {
  const dummyContext = {
    tabUrl: 'https://example.com/page',
    tabTitle: 'Example Title',
    clipboardHistory: ['first copy', 'second copy'],
  };

  beforeEach(() => {
    resetCounterState();
  });

describe('counter token', () => {
    beforeEach(() => {
      vi.mocked(browser.runtime.sendMessage).mockImplementation(async (msg: any) => {
        if (msg.type === 'RESERVE_COUNTER') {
          return {
            reservedValue: 42,
            counter: {
              format: 'C-{contador}-{ano}',
              padLength: 3
            }
          };
        }
        return null;
      });
    });

    it('returns empty if counterId is missing', async () => {
      const token: Token = { id: 'c1', type: 'counter', config: {} };
      expect(await expandToken(token, dummyContext)).toBe('');
    });

    it('calls background script to reserve counter and formats it', async () => {
      const token: Token = { id: 'c1', type: 'counter', config: { counterId: 'abc' } };
      const res = await expandToken(token, dummyContext);
      expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'RESERVE_COUNTER',
        payload: { counterId: 'abc', incrementMode: 'always', displayMode: 'visible' }
      });
      // padded 42 = 042, year = current year
      const year = new Date().getFullYear();
      expect(res).toBe('C-042-' + year);
    });

    it('returns empty if displayMode is silent', async () => {
      const token: Token = { id: 'c1', type: 'counter', config: { counterId: 'abc', displayMode: 'silent' } };
      const res = await expandToken(token, dummyContext);
      expect(res).toBe('');
    });
  });

  describe('math token', () => {
    it('evaluates simple expressions correctly', async () => {
      const token: Token = {
        id: 'math-1',
        type: 'math',
        config: { expression: '10 * 5' },
      };

      expect(await expandToken(token, dummyContext)).toBe('50');
    });

    it('evaluates division and parentheses', async () => {
      const token: Token = {
        id: 'math-2',
        type: 'math',
        config: { expression: '(100 + 20) / 4' },
      };

      expect(await expandToken(token, dummyContext)).toBe('30');
    });

    it('handles floating point results', async () => {
      const token: Token = {
        id: 'math-float',
        type: 'math',
        config: { expression: '7 / 2' },
      };

      expect(await expandToken(token, dummyContext)).toBe('3.5');
    });

    it('returns empty string on invalid math expression', async () => {
      const token: Token = {
        id: 'math-invalid',
        type: 'math',
        config: { expression: '10 / 0' },
      };

      expect(await expandToken(token, dummyContext)).toBe('');
    });

    it('returns empty string for blank expression', async () => {
      const token: Token = {
        id: 'math-blank',
        type: 'math',
        config: { expression: '   ' },
      };

      expect(await expandToken(token, dummyContext)).toBe('');
    });
  });

  describe('standard tokens', () => {
    it('expands url and title', async () => {
      const urlToken: Token = { id: 'url-1', type: 'url', config: {} };
      const titleToken: Token = { id: 'title-1', type: 'title', config: {} };

      expect(await expandToken(urlToken, dummyContext)).toBe('https://example.com/page');
      expect(await expandToken(titleToken, dummyContext)).toBe('Example Title');
    });

    it('returns null for interactive tokens (choice, input)', async () => {
      const choiceToken: Token = { id: 'ch-1', type: 'choice', config: {} };
      const inputToken: Token = { id: 'in-1', type: 'input', config: {} };

      expect(await expandToken(choiceToken, dummyContext)).toBeNull();
      expect(await expandToken(inputToken, dummyContext)).toBeNull();
    });
  });
});




