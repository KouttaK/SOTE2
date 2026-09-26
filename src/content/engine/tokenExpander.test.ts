import { describe, it, expect, beforeEach } from 'vitest';
import { expandToken, resetCounterState } from './tokenExpander.js';
import type { Token } from '../../shared/types/index.js';

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
    it('expands counter starting from start with default step 1', async () => {
      const token: Token = {
        id: 'counter-1',
        type: 'counter',
        config: { start: 1, step: 1 },
      };

      const first = await expandToken(token, dummyContext);
      expect(first).toBe('1');

      const second = await expandToken(token, dummyContext);
      expect(second).toBe('2');

      const third = await expandToken(token, dummyContext);
      expect(third).toBe('3');
    });

    it('expands counter with custom step', async () => {
      const token: Token = {
        id: 'counter-step',
        type: 'counter',
        config: { start: 10, step: 5 },
      };

      expect(await expandToken(token, dummyContext)).toBe('10');
      expect(await expandToken(token, dummyContext)).toBe('15');
      expect(await expandToken(token, dummyContext)).toBe('20');
    });

    it('formats with leading zeros when padLength is specified', async () => {
      const token: Token = {
        id: 'counter-pad',
        type: 'counter',
        config: { start: 7, step: 1, padLength: 4 },
      };

      expect(await expandToken(token, dummyContext)).toBe('0007');
      expect(await expandToken(token, dummyContext)).toBe('0008');
    });

    it('respects pre-existing current in config', async () => {
      const token: Token = {
        id: 'counter-current',
        type: 'counter',
        config: { start: 1, step: 1, current: 42 },
      };

      expect(await expandToken(token, dummyContext)).toBe('42');
      expect(await expandToken(token, dummyContext)).toBe('43');
    });

    it('resolves silently when displayMode is silent (returns empty string but increments internally)', async () => {
      const token: Token = {
        id: 'counter-silent',
        type: 'counter',
        config: { start: 1, step: 1, displayMode: 'silent', incrementMode: 'always' },
      };

      expect(await expandToken(token, dummyContext)).toBe('');
      expect(await expandToken(token, dummyContext)).toBe('');

      // Now expand with visible mode on same token id to verify internal increment happened
      const visibleToken: Token = {
        id: 'counter-silent',
        type: 'counter',
        config: { start: 1, step: 1, displayMode: 'visible' },
      };
      expect(await expandToken(visibleToken, dummyContext)).toBe('3');
    });

    it('does not increment when displayMode is silent and incrementMode is visible_only', async () => {
      const token: Token = {
        id: 'counter-visible-only',
        type: 'counter',
        config: { start: 5, step: 1, displayMode: 'silent', incrementMode: 'visible_only' },
      };

      expect(await expandToken(token, dummyContext)).toBe('');
      expect(await expandToken(token, dummyContext)).toBe('');

      // Since it was silent and incrementMode was visible_only, internal counter remained at 5
      const visibleToken: Token = {
        id: 'counter-visible-only',
        type: 'counter',
        config: { start: 5, step: 1, displayMode: 'visible' },
      };
      expect(await expandToken(visibleToken, dummyContext)).toBe('5');
    });

    it('isolates counters by site domain when scope is site', async () => {
      const token: Token = {
        id: 'counter-site-scoped',
        type: 'counter',
        config: { start: 1, step: 1, scope: 'site' },
      };

      const siteA = { tabUrl: 'https://site-a.com/page', tabTitle: 'Site A' };
      const siteB = { tabUrl: 'https://site-b.com/dashboard', tabTitle: 'Site B' };

      // Site A runs
      expect(await expandToken(token, siteA)).toBe('1');
      expect(await expandToken(token, siteA)).toBe('2');

      // Site B runs independently from start
      expect(await expandToken(token, siteB)).toBe('1');
      expect(await expandToken(token, siteB)).toBe('2');

      // Site A continues where it left off
      expect(await expandToken(token, siteA)).toBe('3');
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
