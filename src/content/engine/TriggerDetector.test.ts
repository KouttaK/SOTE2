/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TriggerDetector } from './TriggerDetector.js';
import type { Flow, Settings } from '../../shared/types/index.js';
import { DEFAULT_SETTINGS } from '../../shared/storage/defaults.js';

describe('TriggerDetector - Word Boundary and Exact Match', () => {
  let detector: TriggerDetector;
  let settings: Settings;

  beforeEach(() => {
    detector = new TriggerDetector();
    settings = {
      ...DEFAULT_SETTINGS,
      triggerMode: 'exact_match',
      exactMatchChar: '/',
      wordBoundaryDefault: true,
    };
  });

  const createFlow = (id: string, shortcut: string, wordBoundary?: boolean): Flow => ({
    id,
    name: `/${shortcut}`,
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [],
    stats: { usageCount: 0, keysSaved: 0 },
    blocks: [
      {
        id: `trig-${id}`,
        type: 'trigger',
        data: {
          shortcut,
          smartCase: true,
          forceCapitalize: false,
          wordBoundary,
        },
      },
      {
        id: `act-${id}`,
        type: 'action',
        data: {
          format: 'plaintext',
          content: `Content of ${shortcut}`,
          tokens: [],
        },
      },
    ],
  });

  it('matches shortcut at start of buffer', () => {
    const flows = [createFlow('f1', 'data')];
    detector.updateData(flows, settings);

    const match = detector.detectExactMatchMode('/data');
    expect(match).not.toBeNull();
    expect(match?.flow.id).toBe('f1');
    expect(match?.shortcutTyped).toBe('/data');
  });

  it('matches shortcut preceded by space or punctuation when wordBoundary is true', () => {
    const flows = [createFlow('f1', 'data', true)];
    detector.updateData(flows, settings);

    expect(detector.detectExactMatchMode('hello /data')?.flow.id).toBe('f1');
    expect(detector.detectExactMatchMode('hello, /data')?.flow.id).toBe('f1');
    expect(detector.detectExactMatchMode('hello\n/data')?.flow.id).toBe('f1');
    expect(detector.detectExactMatchMode('hello\u00A0/data')?.flow.id).toBe('f1');
    expect(detector.detectExactMatchMode('hello-/data')?.flow.id).toBe('f1');
  });

  it('rejects shortcut in the middle of a word when wordBoundary is true', () => {
    const flows = [createFlow('f1', 'data', true)];
    detector.updateData(flows, settings);

    expect(detector.detectExactMatchMode('my/data')).toBeNull();
    expect(detector.detectExactMatchMode('sub/data')).toBeNull();
    expect(detector.detectExactMatchMode('abc/data')).toBeNull();
  });

  it('allows matching in the middle of a word when wordBoundary is explicitly false', () => {
    const flows = [createFlow('f1', 'data', false)];
    detector.updateData(flows, settings);

    const match = detector.detectExactMatchMode('sub/data');
    expect(match).not.toBeNull();
    expect(match?.flow.id).toBe('f1');
  });

  it('selects longest matching shortcut in exact match mode', () => {
    const flows = [
      createFlow('f1', 'd'),
      createFlow('f2', 'data'),
    ];
    detector.updateData(flows, settings);

    const match = detector.detectExactMatchMode('/data');
    expect(match).not.toBeNull();
    expect(match?.flow.id).toBe('f2');
    expect(match?.shortcutTyped).toBe('/data');
  });

  describe('Word boundary nominal test cases (7 mandatory cases)', () => {
    it('Case 1: "crab" does not trigger "ab"', () => {
      // Flow with shortcut 'ab' and exactMatchChar empty
      const localSettings = { ...settings, exactMatchChar: '' };
      const flows = [createFlow('f_ab', 'ab', true)];
      detector.updateData(flows, localSettings);

      expect(detector.detectExactMatchMode('crab')).toBeNull();
    });

    it('Case 2: "site.com/ab" does not trigger "/ab"', () => {
      // Flow with shortcut 'ab' and exactMatchChar '/'
      const flows = [createFlow('f_ab', 'ab', true)];
      detector.updateData(flows, settings);

      expect(detector.detectExactMatchMode('site.com/ab')).toBeNull();
    });

    it('Case 3: "oi /ab" triggers "/ab"', () => {
      const flows = [createFlow('f_ab', 'ab', true)];
      detector.updateData(flows, settings);

      const match = detector.detectExactMatchMode('oi /ab');
      expect(match).not.toBeNull();
      expect(match?.flow.id).toBe('f_ab');
      expect(match?.shortcutTyped).toBe('/ab');
    });

    it('Case 4: "(ab" triggers "ab"', () => {
      const localSettings = { ...settings, exactMatchChar: '' };
      const flows = [createFlow('f_ab', 'ab', true)];
      detector.updateData(flows, localSettings);

      const match = detector.detectExactMatchMode('(ab');
      expect(match).not.toBeNull();
      expect(match?.flow.id).toBe('f_ab');
      expect(match?.shortcutTyped).toBe('ab');
    });

    it('Case 5: "[ab" triggers "ab"', () => {
      const localSettings = { ...settings, exactMatchChar: '' };
      const flows = [createFlow('f_ab', 'ab', true)];
      detector.updateData(flows, localSettings);

      const match = detector.detectExactMatchMode('[ab');
      expect(match).not.toBeNull();
      expect(match?.flow.id).toBe('f_ab');
      expect(match?.shortcutTyped).toBe('ab');
    });

    it('Case 6: newline before shortcut triggers ("/ab" preceded by \\n)', () => {
      const flows = [createFlow('f_ab', 'ab', true)];
      detector.updateData(flows, settings);

      const match = detector.detectExactMatchMode('linha1\n/ab');
      expect(match).not.toBeNull();
      expect(match?.flow.id).toBe('f_ab');
      expect(match?.shortcutTyped).toBe('/ab');
    });

    it('Case 7: shortcut at start of field triggers ("/ab" at beginning of buffer)', () => {
      const flows = [createFlow('f_ab', 'ab', true)];
      detector.updateData(flows, settings);

      const match = detector.detectExactMatchMode('/ab');
      expect(match).not.toBeNull();
      expect(match?.flow.id).toBe('f_ab');
      expect(match?.shortcutTyped).toBe('/ab');
    });
  });

  it('works in trigger mode (Space/Tab/Enter)', () => {
    settings.triggerMode = 'trigger';
    const flows = [createFlow('f1', 'obg')];
    detector.updateData(flows, settings);

    const match = detector.detectTriggerMode('ola obg');
    expect(match).not.toBeNull();
    expect(match?.flow.id).toBe('f1');
    expect(match?.shortcutTyped).toBe('obg');
  });
});
