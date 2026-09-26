/**
 * src/shared/utils/flowSummary.ts
 *
 * Extracts a concise human-readable text preview from simple Flows for table/list views,
 * and detects complex flows that require opening the PreviewModal.
 *
 * - Simple flows (pure text or simple {{VAR}} / {{VAR|fallback}} variables) have their
 *   content extracted, tags stripped, variables replaced, and truncated.
 * - Complex flows (containing RepeatBlock, ConditionBlock, RandomBlock or dynamic tokens
 *   like counter, math, choice, input, clipboard, cursor, flow_ref) return
 *   flows.preview_empty if queried, and are rendered with a "Visualizar" button in the table.
 */

import type { Flow, Variable, BranchTarget, Token } from '../types/index.js';
import { isRepeatBlock, isRandomBlock, isConditionBlock } from '../types/index.js';
import { htmlToPreviewText } from './dom.js';
import { resolveVariablesInText } from './variableResolver.js';
import { t } from '../i18n/index.js';

/**
 * Dynamic non-trivial token types that require interactive execution,
 * dynamic evaluation, counter state, or cross-flow references.
 */
export const DYNAMIC_TOKEN_TYPES = new Set<string>([
  'counter',
  'math',
  'random',
  'input',
  'choice',
  'clipboard',
  'cursor',
  'flow_ref',
]);

/**
 * Checks if a BranchTarget (or ActionBlock data) contains logic blocks
 * (RepeatBlock, RandomBlock, ConditionBlock) or dynamic non-trivial tokens.
 */
export function isComplexBranchTarget(target: BranchTarget | any): boolean {
  if (!target) return false;

  if (isRepeatBlock(target) || isRandomBlock(target) || isConditionBlock(target)) {
    return true;
  }

  // Check tokens array
  if (Array.isArray(target.tokens)) {
    if (target.tokens.some((tok: Token) => tok && DYNAMIC_TOKEN_TYPES.has(tok.type))) {
      return true;
    }
  }

  // Check serialized token pills or references in HTML content
  if (typeof target.content === 'string') {
    if (
      /(?:token-(?:counter|math|random|input|choice|clipboard|cursor|flow_ref)|token\.(?:counter|math|random|input|choice|clipboard|cursor|flow_ref))/i.test(
        target.content
      )
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Determines whether a flow is "complex", meaning it contains:
 * 1. Any RepeatBlock, ConditionBlock or RandomBlock at any level of the tree, OR
 * 2. Any dynamic non-trivial token (counter, math, random, input, choice, clipboard, cursor, flow_ref).
 *
 * Simple flows contain only plain text and optionally simple variable substitutions ({{VAR}}, {{VAR|fallback}}).
 */
export function isComplexFlow(flow: Flow | null | undefined): boolean {
  if (!flow || !Array.isArray(flow.blocks) || flow.blocks.length === 0) {
    return false;
  }

  // 1. Any top-level condition step
  if (flow.blocks.some((b) => b.type === 'condition')) {
    return true;
  }

  // 2. Any non-trigger block whose data contains logic blocks or dynamic tokens
  for (const block of flow.blocks) {
    if (block.type !== 'trigger' && block.data) {
      if (isComplexBranchTarget(block.data)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Recursively descends into BranchTargets (RepeatBlock, RandomBlock, ConditionBlock)
 * to locate the first resolvable leaf ActionBlock content string.
 */
export function findFirstLeafContent(target: BranchTarget | any): string {
  if (!target) return '';

  if (isRepeatBlock(target)) {
    return findFirstLeafContent(target.target);
  }

  if (isRandomBlock(target)) {
    for (const opt of target.options || []) {
      const text = findFirstLeafContent(opt.target);
      if (text && text.trim() !== '' && text !== '<p><br></p>') {
        return text;
      }
    }
    return '';
  }

  if (isConditionBlock(target)) {
    for (const rule of target.rules || []) {
      const text = findFirstLeafContent(rule.action);
      if (text && text.trim() !== '' && text !== '<p><br></p>') {
        return text;
      }
    }
    if (target.elseBranch) {
      const text = findFirstLeafContent(target.elseBranch);
      if (text && text.trim() !== '' && text !== '<p><br></p>') {
        return text;
      }
    }
    return '';
  }

  if (typeof target.content === 'string') {
    return target.content;
  }

  return '';
}

/**
 * Extracts a truncated plain-text preview from a Simple Flow's blocks.
 * If the flow is complex or has no text, returns `flows.preview_empty`.
 */
export function extractFlowPreviewText(flow: Flow, variables: Variable[] = [], maxLen = 50): string {
  if (!flow || !flow.blocks || flow.blocks.length === 0 || isComplexFlow(flow)) {
    return t('flows.preview_empty');
  }

  let rawContent = '';

  // 1. Look for root action block
  const actionBlock = flow.blocks.find((b) => b.type === 'action');
  if (actionBlock) {
    rawContent = findFirstLeafContent(actionBlock.data);
  }

  // 2. If not found, look for dedicated condition step
  if (!rawContent || rawContent.trim() === '' || rawContent === '<p><br></p>') {
    const conditionBlock = flow.blocks.find((b) => b.type === 'condition');
    if (conditionBlock) {
      rawContent = findFirstLeafContent(conditionBlock.data);
    }
  }

  // 3. Fallback: inspect any other non-trigger blocks
  if (!rawContent || rawContent.trim() === '' || rawContent === '<p><br></p>') {
    for (const block of flow.blocks) {
      if (block.type !== 'trigger' && block.data) {
        const found = findFirstLeafContent(block.data);
        if (found && found.trim() !== '' && found !== '<p><br></p>') {
          rawContent = found;
          break;
        }
      }
    }
  }

  const plainText = htmlToPreviewText(rawContent);
  const resolved = resolveVariablesInText(plainText, false, variables);
  const trimmed = resolved.trim();

  if (trimmed.length > 0) {
    return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen)}…` : trimmed.slice(0, maxLen);
  }

  return t('flows.preview_empty');
}
