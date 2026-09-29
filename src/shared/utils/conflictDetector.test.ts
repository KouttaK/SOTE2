import { describe, it, expect } from 'vitest';
import {
  detectAllConflicts,
  findLongerPrefixFlows,
  areShortcutsEquivalent,
  isPrefixOf,
} from './conflictDetector.js';
import type { Flow, Settings } from '../types/index.js';
import { DEFAULT_SETTINGS } from '../storage/defaults.js';

describe('conflictDetector utils', () => {
  const createFlow = (id: string, shortcut: string, smartCase = true, enabled = true): Flow => ({
    id,
    name: `/${shortcut}`,
    enabled,
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
          smartCase,
          forceCapitalize: false,
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

  describe('areShortcutsEquivalent', () => {
    it('detects equal shortcuts with smartCase true', () => {
      expect(areShortcutsEquivalent('data', true, 'DATA', true)).toBe(true);
      expect(areShortcutsEquivalent('data', true, 'data', true)).toBe(true);
      expect(areShortcutsEquivalent('data', true, 'date', true)).toBe(false);
    });

    it('requires exact case when smartCase is false', () => {
      expect(areShortcutsEquivalent('data', false, 'DATA', true)).toBe(false);
      expect(areShortcutsEquivalent('data', true, 'data', false)).toBe(true);
    });
  });

  describe('isPrefixOf', () => {
    it('detects prefix with smartCase true', () => {
      expect(isPrefixOf('d', true, 'data', true)).toBe(true);
      expect(isPrefixOf('D', true, 'data', true)).toBe(true);
      expect(isPrefixOf('data', true, 'data', true)).toBe(false);
      expect(isPrefixOf('data', true, 'd', true)).toBe(false);
    });

    it('detects prefix with smartCase false', () => {
      expect(isPrefixOf('d', false, 'data', true)).toBe(true);
      expect(isPrefixOf('D', false, 'data', true)).toBe(false);
    });
  });

  describe('findLongerPrefixFlows', () => {
    it('finds longer shortcuts that start with the typed shortcut', () => {
      const flows = [
        createFlow('f1', 'd'),
        createFlow('f2', 'data'),
        createFlow('f3', 'date'),
        createFlow('f4', 'other'),
        createFlow('f5', 'disabled_data', true, false),
      ];

      const matches = findLongerPrefixFlows('f1', 'd', flows);
      expect(matches.map((m) => m.id)).toEqual(['f2', 'f3']);
    });
  });

  describe('detectAllConflicts', () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      searchTrigger: {
        enabled: true,
        includeFlows: true,
        domainPrefix: '//',
        globalPrefix: '///',
      },
    };

    it('detects duplicate shortcuts as error severity', () => {
      const flows = [
        createFlow('f1', 'data'),
        createFlow('f2', 'DATA'),
      ];

      const conflicts = detectAllConflicts(flows, settings);
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].type).toBe('duplicate');
      expect(conflicts[0].severity).toBe('error');
    });

    it('detects prefix overlaps as info severity', () => {
      const flows = [
        createFlow('f1', 'd'),
        createFlow('f2', 'data'),
      ];

      const conflicts = detectAllConflicts(flows, settings);
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].type).toBe('prefix');
      expect(conflicts[0].severity).toBe('info');
      expect(conflicts[0].shortcutA).toBe('d');
      expect(conflicts[0].shortcutB).toBe('data');
    });

    it('detects collisions with search trigger prefix as warning severity', () => {
      const flows = [
        createFlow('f1', '//test'),
        createFlow('f2', '///global'),
      ];

      const conflicts = detectAllConflicts(flows, settings);
      expect(conflicts.length).toBe(2);
      expect(conflicts.every((c) => c.type === 'search_trigger' && c.severity === 'warning')).toBe(true);
    });

    it('ignores disabled flows', () => {
      const flows = [
        createFlow('f1', 'data', true, true),
        createFlow('f2', 'data', true, false),
      ];

      const conflicts = detectAllConflicts(flows, settings);
      expect(conflicts.length).toBe(0);
    });

    it('ignores duplicate shortcuts when both flows have disjoint domains (domain isolation)', () => {
      const flowA = createFlow('f1', 'oi');
      flowA.blocks.push({
        id: 'cond-1',
        type: 'condition',
        data: {
          rules: [
            {
              type: 'domain',
              operator: 'equals',
              value: 'site-a.com',
              action: { format: 'plaintext', content: 'A', tokens: [] },
            },
          ],
        },
      });

      const flowB = createFlow('f2', 'oi');
      flowB.blocks.push({
        id: 'cond-2',
        type: 'condition',
        data: {
          rules: [
            {
              type: 'domain',
              operator: 'equals',
              value: 'site-b.com',
              action: { format: 'plaintext', content: 'B', tokens: [] },
            },
          ],
        },
      });

      const conflicts = detectAllConflicts([flowA, flowB], settings);
      expect(conflicts.length).toBe(0);
    });

    it('reports conflict when two flows have overlapping domains via wildcard (*.site.com and sub.site.com)', () => {
      const flowA = createFlow('f1', 'oi');
      flowA.blocks.push({
        id: 'cond-1',
        type: 'condition',
        data: {
          rules: [
            {
              type: 'domain',
              operator: 'equals',
              value: '*.site.com',
              action: { format: 'plaintext', content: 'Wildcard', tokens: [] },
            },
          ],
        },
      });

      const flowB = createFlow('f2', 'oi');
      flowB.blocks.push({
        id: 'cond-2',
        type: 'condition',
        data: {
          rules: [
            {
              type: 'domain',
              operator: 'equals',
              value: 'sub.site.com',
              action: { format: 'plaintext', content: 'Sub', tokens: [] },
            },
          ],
        },
      });

      const conflicts = detectAllConflicts([flowA, flowB], settings);
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].type).toBe('duplicate');
      expect(conflicts[0].severity).toBe('error');
    });

    it('reports conflict when one flow is domain-restricted and the other is unrestricted', () => {
      const flowA = createFlow('f1', 'oi');
      flowA.blocks.push({
        id: 'cond-1',
        type: 'condition',
        data: {
          rules: [
            {
              type: 'domain',
              operator: 'equals',
              value: 'site-a.com',
              action: { format: 'plaintext', content: 'A', tokens: [] },
            },
          ],
        },
      });

      // flowB has no condition blocks -> runs anywhere
      const flowB = createFlow('f2', 'oi');

      const conflicts = detectAllConflicts([flowA, flowB], settings);
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].type).toBe('duplicate');
      expect(conflicts[0].severity).toBe('error');
    });
  });
});
