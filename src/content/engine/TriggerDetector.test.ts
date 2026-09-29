/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TriggerDetector } from './TriggerDetector.js';
import type { Flow, Settings } from '../../shared/types/index.js';
import { DEFAULT_SETTINGS } from '../../shared/storage/defaults.js';
import { detectAllConflicts } from '../../shared/utils/conflictDetector.js';

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

  describe('Bug 1 - Domain condition evaluation and precedence on identical shortcuts', () => {
    const createConditionalFlow = (id: string, shortcut: string, domain: string, content: string): Flow => ({
      id,
      name: `Flow ${id}`,
      enabled: true,
      createdAt: 100,
      updatedAt: 200,
      tags: [],
      stats: { usageCount: 0, keysSaved: 0 },
      blocks: [
        {
          id: `trig-${id}`,
          type: 'trigger',
          data: { shortcut, smartCase: true, forceCapitalize: false },
        },
        {
          id: `cond-${id}`,
          type: 'condition',
          data: {
            rules: [
              {
                type: 'domain',
                operator: 'contains',
                value: domain,
                action: { format: 'plaintext', content, tokens: [] },
              },
            ],
          },
        },
      ],
    });

    const originalLocation = window.location;

    const setMockHostname = (hostname: string) => {
      delete (window as any).location;
      (window as any).location = { ...originalLocation, hostname, href: `https://${hostname}/` };
    };

    afterEach(() => {
      (window as any).location = originalLocation;
    });

    it('prioritizes specific domain condition over unrestricted flow with identical shortcut (google.com)', () => {
      setMockHostname('google.com');

      const flowA = createFlow('flow-a', 'teste'); // older/unrestricted
      const flowB = createConditionalFlow('flow-b', 'teste', 'google.com', 'teste 15');

      // flowA first in list
      detector.updateData([flowA, flowB], settings);

      const match = detector.detectExactMatchMode('/teste');
      expect(match).not.toBeNull();
      expect(match?.flow.id).toBe('flow-b'); // Flow B must win because it has matching domain specificity!
    });

    it('reproduces and resolves Bug 1: Flow A edited to claude.ai allows Flow B to trigger on google.com', () => {
      setMockHostname('google.com');

      const flowA = createConditionalFlow('flow-a', 'teste', 'claude.ai', 'saida claude');
      const flowB = createConditionalFlow('flow-b', 'teste', 'google.com', 'teste 15');

      detector.updateData([flowA, flowB], settings);

      // On google.com: Flow A condition does NOT match, Flow B condition DOES match
      const matchGoogle = detector.detectExactMatchMode('/teste');
      expect(matchGoogle).not.toBeNull();
      expect(matchGoogle?.flow.id).toBe('flow-b');

      // On claude.ai: Flow A condition DOES match, Flow B condition does NOT match
      setMockHostname('claude.ai');
      const matchClaude = detector.detectExactMatchMode('/teste');
      expect(matchClaude).not.toBeNull();
      expect(matchClaude?.flow.id).toBe('flow-a');

      // On outro.com: neither matches, expansion is prevented
      setMockHostname('outro.com');
      expect(detector.detectExactMatchMode('/teste')).toBeNull();
    });

    it('falls back to unrestricted flow when domain-specific flow does not match current site', () => {
      setMockHostname('outro.com');

      const flowA = createConditionalFlow('flow-a', 'teste', 'claude.ai', 'saida claude');
      const flowB = createConditionalFlow('flow-b', 'teste', 'google.com', 'teste 15');
      const flowC = createFlow('flow-c', 'teste'); // unrestricted

      detector.updateData([flowA, flowB, flowC], settings);

      const match = detector.detectExactMatchMode('/teste');
      expect(match).not.toBeNull();
      expect(match?.flow.id).toBe('flow-c');
    });

    it('applies domain precedence in trigger mode (Space/Tab/Enter) as well', () => {
      setMockHostname('google.com');
      const triggerSettings = { ...settings, triggerMode: 'trigger' as const };

      const flowA = createFlow('flow-a', 'teste');
      const flowB = createConditionalFlow('flow-b', 'teste', 'google.com', 'teste 15');

      detector.updateData([flowA, flowB], triggerSettings);

      const match = detector.detectTriggerMode('ola teste');
      expect(match).not.toBeNull();
      expect(match?.flow.id).toBe('flow-b');
    });

    it('breaks ties between flows with identical condition match scores using recency (updatedAt) without masking conflict', () => {
      setMockHostname('google.com');

      // Both flows have identical domain condition on google.com (both have score = 20)
      const olderFlow = createConditionalFlow('older', 'teste', 'google.com', 'saida antiga');
      olderFlow.updatedAt = 1000;

      const newerFlow = createConditionalFlow('newer', 'teste', 'google.com', 'saida nova');
      newerFlow.updatedAt = 2000;

      // Put olderFlow first in the list to ensure order in array does not matter
      detector.updateData([olderFlow, newerFlow], settings);

      const match = detector.detectExactMatchMode('/teste');
      expect(match).not.toBeNull();
      expect(match?.flow.id).toBe('newer'); // Newer flow wins the tie-break deterministically!

      // Critical check: this situation is NOT masked from the user.
      // In the Central de Conflitos, this exact pair is flagged as 'duplicate' with error severity
      // because their domains overlap (both match google.com).
      const conflicts = detectAllConflicts([olderFlow, newerFlow], settings);
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].type).toBe('duplicate');
      expect(conflicts[0].severity).toBe('error');
    });
  });
});

