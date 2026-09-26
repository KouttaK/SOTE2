/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractFlowPreviewText,
  findFirstLeafContent,
  isComplexFlow,
  isComplexBranchTarget,
  DYNAMIC_TOKEN_TYPES,
} from './flowSummary.js';
import { setLanguage } from '../i18n/index.js';
import type {
  Flow,
  ActionBlock,
  RepeatBlock,
  ConditionBlock,
  RandomBlock,
  Variable,
  Token,
} from '../types/index.js';

describe('flowSummary — isComplexFlow, extractFlowPreviewText & findFirstLeafContent', () => {
  beforeEach(() => {
    setLanguage('pt-BR');
  });

  const baseTrigger = { id: 'trig', type: 'trigger' as const, data: { shortcut: 'test' } };

  describe('isComplexFlow & isComplexBranchTarget', () => {
    it('identifies pure text action as simple (isComplexFlow = false)', () => {
      const flow: Flow = {
        id: 'f_simple',
        name: '/simple',
        enabled: true,
        blocks: [
          baseTrigger,
          {
            id: 'act',
            type: 'action',
            data: { format: 'plaintext', content: 'Texto simples sem blocos', tokens: [] },
          },
        ],
        createdAt: 0,
        updatedAt: 0,
        stats: { usageCount: 0, keysSaved: 0 },
      };
      expect(isComplexFlow(flow)).toBe(false);
    });

    it('identifies simple variable references as simple (isComplexFlow = false)', () => {
      const flow: Flow = {
        id: 'f_var',
        name: '/var',
        enabled: true,
        blocks: [
          baseTrigger,
          {
            id: 'act',
            type: 'action',
            data: {
              format: 'plaintext',
              content: 'Olá {{CLIENTE}}, seu status é {{STATUS|ativo}}',
              tokens: [],
            },
          },
        ],
        createdAt: 0,
        updatedAt: 0,
        stats: { usageCount: 0, keysSaved: 0 },
      };
      expect(isComplexFlow(flow)).toBe(false);
    });

    it('identifies RepeatBlock as complex (isComplexFlow = true)', () => {
      const repeat: RepeatBlock = {
        type: 'repeat',
        count: 3,
        separator: '\n',
        target: { format: 'plaintext', content: 'repetir', tokens: [] },
      };
      const flow: Flow = {
        id: 'f_repeat',
        name: '/repeat',
        enabled: true,
        blocks: [baseTrigger, { id: 'act', type: 'action', data: repeat }],
        createdAt: 0,
        updatedAt: 0,
        stats: { usageCount: 0, keysSaved: 0 },
      };
      expect(isComplexFlow(flow)).toBe(true);
    });

    it('identifies top-level condition step as complex (isComplexFlow = true)', () => {
      const condition: ConditionBlock = {
        type: 'condition',
        rules: [],
      };
      const flow: Flow = {
        id: 'f_cond',
        name: '/cond',
        enabled: true,
        blocks: [baseTrigger, { id: 'cond', type: 'condition', data: condition }],
        createdAt: 0,
        updatedAt: 0,
        stats: { usageCount: 0, keysSaved: 0 },
      };
      expect(isComplexFlow(flow)).toBe(true);
    });

    it('identifies RandomBlock as complex (isComplexFlow = true)', () => {
      const random: RandomBlock = {
        type: 'random',
        options: [
          { id: '1', weight: 100, target: { format: 'plaintext', content: 'A', tokens: [] } },
        ],
      };
      const flow: Flow = {
        id: 'f_random',
        name: '/random',
        enabled: true,
        blocks: [baseTrigger, { id: 'act', type: 'action', data: random }],
        createdAt: 0,
        updatedAt: 0,
        stats: { usageCount: 0, keysSaved: 0 },
      };
      expect(isComplexFlow(flow)).toBe(true);
    });

    it('identifies all dynamic token types as complex (counter, math, choice, etc)', () => {
      const dynamicTypes: Token['type'][] = [
        'counter',
        'math',
        'random',
        'input',
        'choice',
        'clipboard',
        'cursor',
        'flow_ref',
      ];

      for (const tokType of dynamicTypes) {
        const flow: Flow = {
          id: `f_${tokType}`,
          name: `/${tokType}`,
          enabled: true,
          blocks: [
            baseTrigger,
            {
              id: 'act',
              type: 'action',
              data: {
                format: 'plaintext',
                content: `Texto com token`,
                tokens: [{ id: 'tok_1', type: tokType, config: {} }],
              },
            },
          ],
          createdAt: 0,
          updatedAt: 0,
          stats: { usageCount: 0, keysSaved: 0 },
        };
        expect(isComplexFlow(flow), `Expected token type ${tokType} to be complex`).toBe(true);
      }
    });

    it('identifies token pill HTML classes as complex even if tokens array is empty', () => {
      const flow: Flow = {
        id: 'f_html_pill',
        name: '/pill',
        enabled: true,
        blocks: [
          baseTrigger,
          {
            id: 'act',
            type: 'action',
            data: {
              format: 'richtext',
              content: '<p>Valor: <span class="token-pill token-counter" data-token-id="c1">1</span></p>',
              tokens: [],
            },
          },
        ],
        createdAt: 0,
        updatedAt: 0,
        stats: { usageCount: 0, keysSaved: 0 },
      };
      expect(isComplexFlow(flow)).toBe(true);
    });

    it('treats static tokens like date, url, and title as simple', () => {
      const flow: Flow = {
        id: 'f_static',
        name: '/static',
        enabled: true,
        blocks: [
          baseTrigger,
          {
            id: 'act',
            type: 'action',
            data: {
              format: 'plaintext',
              content: 'Hoje é dia [data]',
              tokens: [{ id: 'd1', type: 'date', config: { format: 'DD/MM/YYYY' } }],
            },
          },
        ],
        createdAt: 0,
        updatedAt: 0,
        stats: { usageCount: 0, keysSaved: 0 },
      };
      expect(isComplexFlow(flow)).toBe(false);
    });
  });

  describe('findFirstLeafContent', () => {
    it('unwraps RepeatBlock', () => {
      const action: ActionBlock = {
        format: 'plaintext',
        content: 'código repetido',
        tokens: [],
      };
      const repeat: RepeatBlock = {
        type: 'repeat',
        count: 2,
        separator: '\n',
        target: action,
      };
      expect(findFirstLeafContent(repeat)).toBe('código repetido');
    });

    it('unwraps ConditionBlock', () => {
      const ifAction: ActionBlock = {
        format: 'plaintext',
        content: 'Resposta para Gmail',
        tokens: [],
      };
      const condition: ConditionBlock = {
        type: 'condition',
        rules: [
          {
            id: 'r1',
            type: 'domain',
            operator: 'equals',
            value: 'gmail.com',
            action: ifAction,
          },
        ],
      };
      expect(findFirstLeafContent(condition)).toBe('Resposta para Gmail');
    });

    it('unwraps RandomBlock', () => {
      const random: RandomBlock = {
        type: 'random',
        options: [
          { id: 'o1', weight: 50, target: { format: 'plaintext', content: 'Opção Aleatória 1', tokens: [] } },
          { id: 'o2', weight: 50, target: { format: 'plaintext', content: 'Opção Aleatória 2', tokens: [] } },
        ],
      };
      expect(findFirstLeafContent(random)).toBe('Opção Aleatória 1');
    });
  });

  describe('extractFlowPreviewText', () => {
    it('extracts preview from a direct ActionBlock root', () => {
      const action: ActionBlock = {
        format: 'plaintext',
        content: 'Texto simples de resposta',
        tokens: [],
      };
      const flow: Flow = {
        id: 'f1',
        name: '/test',
        enabled: true,
        blocks: [baseTrigger, { id: 'act', type: 'action', data: action }],
        createdAt: 0,
        updatedAt: 0,
        stats: { usageCount: 0, keysSaved: 0 },
      };

      expect(extractFlowPreviewText(flow)).toBe('Texto simples de resposta');
    });

    it('extracts preview from a direct rich-text ActionBlock and strips tags', () => {
      const action: ActionBlock = {
        format: 'richtext',
        content: '<p>Primeira linha</p><p>Segunda linha</p>',
        tokens: [],
      };
      const flow: Flow = {
        id: 'f1',
        name: '/test',
        enabled: true,
        blocks: [baseTrigger, { id: 'act', type: 'action', data: action }],
        createdAt: 0,
        updatedAt: 0,
        stats: { usageCount: 0, keysSaved: 0 },
      };

      expect(extractFlowPreviewText(flow)).toBe('Primeira linha Segunda linha');
    });

    it('refuses to extract preview for complex flows and returns fallback', () => {
      const repeat: RepeatBlock = {
        type: 'repeat',
        count: 2,
        separator: '\n',
        target: { format: 'plaintext', content: 'código repetido', tokens: [] },
      };
      const flow: Flow = {
        id: 'f_repeat',
        name: '/qq3',
        enabled: true,
        blocks: [baseTrigger, { id: 'act', type: 'action', data: repeat }],
        createdAt: 0,
        updatedAt: 0,
        stats: { usageCount: 0, keysSaved: 0 },
      };

      // Guarded against complex flows
      expect(extractFlowPreviewText(flow)).toBe('Nenhuma prévia disponível');
    });

    it('resolves variables inside the preview text for simple flows', () => {
      const action: ActionBlock = {
        format: 'plaintext',
        content: 'Olá {{CLIENTE}}, bem-vindo!',
        tokens: [],
      };
      const variables: Variable[] = [
        { id: 'v1', key: 'CLIENTE', value: 'Mariana', createdAt: 0, updatedAt: 0 },
      ];
      const flow: Flow = {
        id: 'f_var',
        name: '/var',
        enabled: true,
        blocks: [baseTrigger, { id: 'act', type: 'action', data: action }],
        createdAt: 0,
        updatedAt: 0,
        stats: { usageCount: 0, keysSaved: 0 },
      };

      expect(extractFlowPreviewText(flow, variables)).toBe('Olá Mariana, bem-vindo!');
    });

    it('truncates preview exceeding maxLen with an ellipsis', () => {
      const action: ActionBlock = {
        format: 'plaintext',
        content: 'Este é um texto extremamente longo que certamente ultrapassa o limite padrão de cinquenta caracteres configurado.',
        tokens: [],
      };
      const flow: Flow = {
        id: 'f_long',
        name: '/long',
        enabled: true,
        blocks: [baseTrigger, { id: 'act', type: 'action', data: action }],
        createdAt: 0,
        updatedAt: 0,
        stats: { usageCount: 0, keysSaved: 0 },
      };

      const preview = extractFlowPreviewText(flow, [], 30);
      expect(preview.length).toBe(31); // 30 chars + ellipsis
      expect(preview.endsWith('…')).toBe(true);
    });

    it('falls back to "Nenhuma prévia disponível" when action content is empty or only <p><br></p>', () => {
      const emptyAction: ActionBlock = {
        format: 'richtext',
        content: '<p><br></p>',
        tokens: [],
      };
      const flow: Flow = {
        id: 'f_empty',
        name: '/empty',
        enabled: true,
        blocks: [baseTrigger, { id: 'act', type: 'action', data: emptyAction }],
        createdAt: 0,
        updatedAt: 0,
        stats: { usageCount: 0, keysSaved: 0 },
      };

      expect(extractFlowPreviewText(flow)).toBe('Nenhuma prévia disponível');
    });

    it('falls back to "Nenhuma prévia disponível" when flow has no action or condition blocks', () => {
      const flow: Flow = {
        id: 'f_no_action',
        name: '/none',
        enabled: true,
        blocks: [baseTrigger],
        createdAt: 0,
        updatedAt: 0,
        stats: { usageCount: 0, keysSaved: 0 },
      };

      expect(extractFlowPreviewText(flow)).toBe('Nenhuma prévia disponível');
    });

    it('handles en translation fallback correctly', () => {
      setLanguage('en');
      const flow: Flow = {
        id: 'f_none',
        name: '/none',
        enabled: true,
        blocks: [],
        createdAt: 0,
        updatedAt: 0,
        stats: { usageCount: 0, keysSaved: 0 },
      };

      expect(extractFlowPreviewText(flow)).toBe('No preview available');
    });
  });
});
