// @vitest-environment jsdom
/**
 * src/shared/constants/tokenColors.test.ts
 *
 * Regression test suite ensuring complete synchronization of Token and Block colors
 * across all components, style files, and the single source of truth (TOKEN_COLORS / BLOCK_COLORS).
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { TOKEN_COLORS, BLOCK_COLORS, TOKEN_META } from './tokenColors.js';
import type { Token } from '../types/index.js';
import { TokenPill } from '../../dashboard/components/tokens/TokenPill.js';
import { TokenMenu } from '../../dashboard/components/tokens/TokenMenu.js';

describe('Token & Block Colors — Single Source of Truth Audit', () => {
  it('defines all canonical token types with valid hex codes in TOKEN_COLORS', () => {
    const requiredTokens: Token['type'][] = [
      'counter',
      'math',
      'random',
      'input',
      'date',
      'choice',
      'clipboard',
      'cursor',
      'url',
      'title',
      'flow_ref',
    ];

    for (const type of requiredTokens) {
      expect(TOKEN_COLORS[type]).toBeDefined();
      expect(TOKEN_COLORS[type]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }

    // Specific user-mandated canonical colors
    expect(TOKEN_COLORS.counter).toBe('#06b6d4');
    expect(TOKEN_COLORS.math).toBe('#ec4899');
    expect(TOKEN_COLORS.date).toBe('#f43f5e'); // Replaces gray with vibrant rose
    expect(TOKEN_COLORS.cursor).toBe('#10b981');
    expect(TOKEN_COLORS.input).toBe('#8b5cf6');
    expect(TOKEN_COLORS.flow_ref).toBe('#d946ef');
    expect(TOKEN_COLORS.variable).toBe('#a855f7');
    expect(TOKEN_COLORS.variable_fallback).toBe('#f59e0b');

    // Distinguishability: zero duplicate colors among all 11 tokens
    const tokenHexes = requiredTokens.map(t => TOKEN_COLORS[t]);
    expect(new Set(tokenHexes).size).toBe(requiredTokens.length);
  });

  it('defines all canonical block types with valid hex codes in BLOCK_COLORS', () => {
    const requiredBlocks = ['action', 'condition', 'random', 'repeat', 'trigger'] as const;

    for (const b of requiredBlocks) {
      expect(BLOCK_COLORS[b]).toBeDefined();
      expect(BLOCK_COLORS[b]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }

    expect(BLOCK_COLORS.action).toBe('#6366f1');
    expect(BLOCK_COLORS.condition).toBe('#14b8a6');
    expect(BLOCK_COLORS.random).toBe('#ea580c');
    expect(BLOCK_COLORS.repeat).toBe('#84cc16');
    expect(BLOCK_COLORS.trigger).toBe('#dc2626');

    // Distinguishability: zero duplicate colors among all 5 blocks
    const blockHexes = requiredBlocks.map(b => BLOCK_COLORS[b]);
    expect(new Set(blockHexes).size).toBe(requiredBlocks.length);
  });

  it('guarantees TOKEN_META includes all tokens and maps directly to TOKEN_COLORS', () => {
    const types: Token['type'][] = [
      'counter',
      'math',
      'random',
      'input',
      'date',
      'choice',
      'clipboard',
      'cursor',
      'url',
      'title',
      'flow_ref',
    ];

    for (const type of types) {
      const meta = TOKEN_META[type];
      expect(meta).toBeDefined();
      expect(meta.type).toBe(type);
      expect(meta.color).toBe(TOKEN_COLORS[type]);
    }
  });

  it('verifies TokenMenu renders menu items with the canonical colors from TOKEN_COLORS', () => {
    const menu = new TokenMenu(() => {});
    const el = menu.getElement();

    const mathRow = el.querySelector('[data-type="math"]');
    expect(mathRow).not.toBeNull();
    const mathIcon = mathRow?.querySelector<HTMLElement>('.token-menu-row-icon');
    expect(mathIcon?.getAttribute('style')).toContain(TOKEN_COLORS.math);

    const counterRow = el.querySelector('[data-type="counter"]');
    expect(counterRow).not.toBeNull();
    const counterIcon = counterRow?.querySelector<HTMLElement>('.token-menu-row-icon');
    expect(counterIcon?.getAttribute('style')).toContain(TOKEN_COLORS.counter);

    const randomRow = el.querySelector('[data-type="random"]');
    expect(randomRow).not.toBeNull();
    const randomIcon = randomRow?.querySelector<HTMLElement>('.token-menu-row-icon');
    expect(randomIcon?.getAttribute('style')).toContain(TOKEN_COLORS.random);

    const flowRefRow = el.querySelector('[data-type="flow_ref"]');
    expect(flowRefRow).not.toBeNull();
    const flowRefIcon = flowRefRow?.querySelector<HTMLElement>('.token-menu-row-icon');
    expect(flowRefIcon?.getAttribute('style')).toContain(TOKEN_COLORS.flow_ref);
  });

  it('verifies variables.css declares matching CSS custom properties for all tokens and blocks', () => {
    const cssPath = path.resolve(__dirname, '../../assets/styles/variables.css');
    const content = fs.readFileSync(cssPath, 'utf-8');

    for (const [token, hex] of Object.entries(TOKEN_COLORS)) {
      if (token === 'variable_fallback') continue;
      const regex = new RegExp(`--token-${token}:\\s*${hex}`, 'i');
      expect(content).toMatch(regex);
    }

    for (const [block, hex] of Object.entries(BLOCK_COLORS)) {
      const regex = new RegExp(`--block-${block}:\\s*${hex}`, 'i');
      expect(content).toMatch(regex);
    }
  });

  it('verifies tokens.css connects all .token-* classes to canonical variables', () => {
    const cssPath = path.resolve(__dirname, '../../dashboard/pages/tokens.css');
    const content = fs.readFileSync(cssPath, 'utf-8');

    expect(content).toContain('.token-counter { background-color: var(--token-counter, #06b6d4)');
    expect(content).toContain('.token-math { background-color: var(--token-math, #ec4899)');
    expect(content).toContain('.token-choice { background-color: var(--token-choice, #2563eb)');
    expect(content).toContain('.token-cursor { background-color: var(--token-cursor, #10b981)');
    expect(content).toContain('.token-clipboard { background-color: var(--token-clipboard, #f97316)');
    expect(content).toContain('.token-input { background-color: var(--token-input, #8b5cf6)');
    expect(content).toContain('.token-date { background-color: var(--token-date, #f43f5e)');
    expect(content).toContain('.token-url { background-color: var(--token-url, #0d9488)');
    expect(content).toContain('.token-title { background-color: var(--token-title, #eab308)');
    expect(content).toContain('.token-random { background-color: var(--token-random, #d97706)');
    expect(content).toContain('.token-flow_ref { background-color: var(--token-flow_ref, #d946ef)');
    expect(content).toContain('.token-condition { background-color: var(--block-condition, #14b8a6)');
    expect(content).toContain('.token-repeat { background-color: var(--block-repeat, #84cc16)');
    expect(content).toContain('.token-action { background-color: var(--block-action, #6366f1)');
  });

  it('verifies editor.css does not override .token-pill background or text with hardcoded indigo', () => {
    const cssPath = path.resolve(__dirname, '../../dashboard/pages/editor.css');
    const content = fs.readFileSync(cssPath, 'utf-8');

    // Matches the .token-pill definition in editor.css
    const pillBlockMatch = content.match(/\.token-pill\s*\{([^}]+)\}/);
    expect(pillBlockMatch).not.toBeNull();
    const pillBlock = pillBlockMatch![1];

    // Must NOT contain destructive overrides
    expect(pillBlock).not.toContain('background: var(--indigo-dim)');
    expect(pillBlock).not.toContain('color: var(--indigo)');
    expect(content).not.toContain('.token-pill svg { width: 10px; height: 10px; flex-shrink: 0; color: var(--indigo); }');

    // BlockDock chips must use canonical block variables
    expect(content).toContain('--block-condition');
    expect(content).toContain('--block-random');
    expect(content).toContain('--block-repeat');
    expect(content).toContain('--block-action');

    // Block headers must use canonical block variables
    expect(content).toContain('.block-type-icon.condition-type-icon');
    expect(content).toContain('.block-type-icon.random-type-icon');
    expect(content).toContain('.block-type-icon.repeat-type-icon');
  });

  it('verifies PreviewModal.css uses canonical block and token variables', () => {
    const cssPath = path.resolve(__dirname, '../../dashboard/components/PreviewModal.css');
    const content = fs.readFileSync(cssPath, 'utf-8');

    // Tree cards
    expect(content).toContain('border-left-color: var(--block-condition, #14b8a6)');
    expect(content).toContain('border-left-color: var(--block-random, #ea580c)');
    expect(content).toContain('border-left-color: var(--block-repeat, #84cc16)');
    expect(content).toContain('border-left-color: var(--block-action, #6366f1)');

    // Legend dots
    expect(content).toContain('.preview-legend-dot--condition { background: var(--block-condition, #14b8a6)');
    expect(content).toContain('.preview-legend-dot--random { background: var(--block-random, #ea580c)');
    expect(content).toContain('.preview-legend-dot--repeat { background: var(--block-repeat, #84cc16)');
    expect(content).toContain('.preview-legend-dot--action { background: var(--block-action, #6366f1)');

    // Rendered pills
    expect(content).toContain('color: var(--token-counter, #06b6d4)');
    expect(content).toContain('color: var(--token-math, #ec4899)');
    expect(content).toContain('color: var(--token-random, #d97706)');
    expect(content).toContain('color: var(--token-choice, #2563eb)');
    expect(content).toContain('color: var(--token-input, #8b5cf6)');
    expect(content).toContain('color: var(--token-date, #f43f5e)');
    expect(content).toContain('color: var(--token-clipboard, #f97316)');
    expect(content).toContain('color: var(--token-cursor, #10b981)');
    expect(content).toContain('color: var(--token-url, #0d9488)');
    expect(content).toContain('color: var(--token-title, #eab308)');
    expect(content).toContain('color: var(--token-flow_ref, #d946ef)');
    expect(content).toContain('color: var(--token-variable-soft, #c084fc)');
    expect(content).toContain('color: var(--token-fallback, #f59e0b)');
  });

  it('verifies TokenPill generates correct semantic classes for math and counter', () => {
    const mathToken: Token = { id: 'm1', type: 'math', config: { expression: '10*2' } };
    const mathHtml = TokenPill.createHTML(mathToken);
    expect(mathHtml).toContain('token-pill token-math');

    const counterToken: Token = { id: 'c1', type: 'counter', config: { start: 1, step: 1 } };
    const counterHtml = TokenPill.createHTML(counterToken);
    expect(counterHtml).toContain('token-pill token-counter');
  });
});
