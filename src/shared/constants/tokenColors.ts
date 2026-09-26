/**
 * src/shared/constants/tokenColors.ts
 *
 * Single Source of Truth for all Token and Block colors across SOTE 2.
 * All UI components (inline pills, tokens preview summary, token insertion menu,
 * preview tree modal, preview rendered output, and token modals) must reference
 * these canonical colors either directly via this module or via the CSS
 * custom properties (--token-* and --block-*) declared in variables.css.
 */

import type { Token } from '../types/index.js';

export type TokenType = Token['type'];
export type BlockType = 'action' | 'condition' | 'random' | 'repeat' | 'trigger';

/**
 * Canonical Hex Colors for Tokens & Variables
 */
export const TOKEN_COLORS = {
  counter: '#06b6d4',          // Cyan (Mandatory)
  math: '#ec4899',             // Pink / Magenta (Mandatory)
  date: '#f43f5e',             // Rose / Coral (calendar, replaces gray #525252)
  choice: '#2563eb',           // Royal Blue
  input: '#8b5cf6',            // Violet
  clipboard: '#f97316',        // Orange
  cursor: '#10b981',           // Emerald
  random: '#d97706',           // Amber Gold
  url: '#0d9488',              // Deep Teal
  title: '#eab308',            // Golden Yellow
  flow_ref: '#d946ef',         // Fuchsia / Magenta
  variable: '#a855f7',         // Purple
  variable_fallback: '#f59e0b',// Amber (dashed fallback)
} as const;

/**
 * Canonical Hex Colors for Blocks
 */
export const BLOCK_COLORS = {
  action: '#6366f1',           // Indigo
  condition: '#14b8a6',        // Teal Mint
  random: '#ea580c',           // Burnt Orange / Terracotta
  repeat: '#84cc16',           // Lime / Chartreuse
  trigger: '#dc2626',          // Red
} as const;

export interface TokenMetaDef {
  type: TokenType;
  color: string;
  badge: string;
  viewbox?: string;
  icon?: string;
  shapes?: string;
}

/**
 * Canonical Metadata for Tokens
 */
export const TOKEN_META: Record<TokenType, TokenMetaDef> = {
  random: {
    type: 'random',
    color: TOKEN_COLORS.random,
    badge: 'token',
    viewbox: '0 0 24 24',
    shapes: '<rect x="3" y="3" width="18" height="18" rx="4" ry="4" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="8" cy="8" r="1.6" fill="currentColor"/><circle cx="16" cy="8" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="8" cy="16" r="1.6" fill="currentColor"/><circle cx="16" cy="16" r="1.6" fill="currentColor"/>',
  },
  input: {
    type: 'input',
    color: TOKEN_COLORS.input,
    badge: 'pausa',
    icon: 'M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.2 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z',
  },
  date: {
    type: 'date',
    color: TOKEN_COLORS.date,
    badge: 'token',
    viewbox: '0 0 448 512',
    icon: 'M152 24c0-13.3-10.7-24-24-24s-24 10.7-24 24V64H64C28.7 64 0 92.7 0 128v16 48V448c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V192 144 128c0-35.3-28.7-64-64-64H344V24c0-13.3-10.7-24-24-24s-24 10.7-24 24V64H152V24zM48 192H400V448c0 8.8-7.2 16-16 16H64c-8.8 0-16-7.2-16-16V192z',
  },
  choice: {
    type: 'choice',
    color: TOKEN_COLORS.choice,
    badge: 'token',
    icon: 'M64 144a48 48 0 1 0 0-96 48 48 0 1 0 0 96zM192 64c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192z',
  },
  clipboard: {
    type: 'clipboard',
    color: TOKEN_COLORS.clipboard,
    badge: 'token',
    viewbox: '0 0 384 512',
    icon: 'M192 0c-41.8 0-77.4 26.7-90.5 64H64C28.7 64 0 92.7 0 128V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V128c0-35.3-28.7-64-64-64H282.5C269.4 26.7 233.8 0 192 0zm0 64a32 32 0 1 1 0 64 32 32 0 1 1 0-64zM112 192H272c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16z',
  },
  cursor: {
    type: 'cursor',
    color: TOKEN_COLORS.cursor,
    badge: 'token',
    viewbox: '0 0 320 512',
    icon: 'M0 55.2V426c0 12.2 9.9 22 22 22c4.6 0 8.9-1.4 12.5-3.9l98.8-67.9l46.2 80c3.9 6.7 10.3 11.5 17.8 13.3s15.3-.2 21.3-5.2l29.4-24.8c8.3-7 11.2-18.7 7-28.7l-42.3-100.9l98.8 32c10.8 3.5 22.8-1.5 27.8-11.8c4.9-10.1 2.3-22.3-6.1-29.6l-297-251C30.6 44 21.6 46.1 14.8 53S0 67.5 0 77.2V55.2z',
  },
  url: {
    type: 'url',
    color: TOKEN_COLORS.url,
    badge: 'token',
    viewbox: '0 0 640 512',
    icon: 'M579.8 267.7c56.5-56.5 56.5-148 0-204.5c-50-50-128.8-56.5-186.3-15.4l-1.6 1.1c-14.4 10.3-17.7 30.3-7.4 44.6s30.3 17.7 44.6 7.4l1.6-1.1c32.1-22.9 76-19.3 103.8 8.6c31.5 31.5 31.5 82.5 0 114L422.3 334.8c-31.5 31.5-82.5 31.5-114 0c-27.9-27.9-31.5-71.8-8.6-103.8l1.1-1.6c10.3-14.4 6.9-34.4-7.4-44.6s-34.4-6.9-44.6 7.4l-1.1 1.6C206.5 251.2 213 330 263 380c56.5 56.5 148 56.5 204.5 0L579.8 267.7zM60.2 244.3c-56.5 56.5-56.5 148 0 204.5c50 50 128.8 56.5 186.3 15.4l1.6-1.1c14.4-10.3 17.7-30.3 7.4-44.6s-30.3-17.7-44.6-7.4l-1.6 1.1c-32.1 22.9-76 19.3-103.8-8.6C74 372 74 321 105.5 289.5L217.7 177.2c31.5-31.5 82.5-31.5 114 0c27.9 27.9 31.5 71.8 8.6 103.9l-1.1 1.6c-10.3 14.4-6.9 34.4 7.4 44.6s34.4 6.9 44.6-7.4l1.1-1.6C433.5 260.8 427 182 377 132c-56.5-56.5-148-56.5-204.5 0L60.2 244.3z',
  },
  title: {
    type: 'title',
    color: TOKEN_COLORS.title,
    badge: 'token',
    viewbox: '0 0 384 512',
    icon: 'M64 0C28.7 0 0 28.7 0 64V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V160H256c-17.7 0-32-14.3-32-32V0H64zM256 0V128H384L256 0zM112 256H272c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64H272c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64H272c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16z',
  },
  counter: {
    type: 'counter',
    color: TOKEN_COLORS.counter,
    badge: 'token',
    viewbox: '0 0 24 24',
    shapes: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 7v10M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  },
  math: {
    type: 'math',
    color: TOKEN_COLORS.math,
    badge: 'token',
    viewbox: '0 0 24 24',
    shapes: '<path d="M4 7h6M7 4v6M14 7h6M14 17h6M14 13h6M4 17l6-6M10 17l-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>',
  },
  flow_ref: {
    type: 'flow_ref',
    color: TOKEN_COLORS.flow_ref,
    badge: 'flow ref',
    viewbox: '0 0 24 24',
    shapes: '<path d="M4 5h9a4 4 0 0 1 4 4v10" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M13 15l4 4 4-4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  },
};
