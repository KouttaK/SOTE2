/**
 * src/shared/utils/flowVariableScanner.ts
 *
 * Finds every `{{KEY}}` placeholder referenced anywhere in a Flow's action
 * content — walking its full Condition/Random branch tree, not just the
 * top-level action — and checks which of those keys have no matching
 * Global Variable. Used by the editor to warn when opening or saving a
 * flow that would otherwise silently expand with a literal "{{NOME}}"
 * still in the text: resolveVariablesInText() (shared/utils/
 * variableResolver.ts) deliberately leaves an unknown key untouched
 * rather than swallowing it — that's correct for catching typos, but it
 * also means a genuinely-missing variable stays silent until something
 * actively scans for it, which is what this module does.
 */
import type { Flow, BranchTarget, ConditionBlock, Variable } from '../types/index.js';
import { isConditionBlock, isRandomBlock, isRepeatBlock } from '../types/index.js';

// Mirrors resolveVariablesInText's own pattern — keeping the two in
// sync matters, since this scanner's whole point is to catch every key
// that resolver would actually leave untouched at expansion time.
const VARIABLE_PATTERN = /\{\{\s*([A-Z0-9_]+)\s*(?:\|\s*[^}]*?\s*)?\}\}/g;

/** Every distinct `{{KEY}}` found in `text`, deduped, in order of first appearance. */
export function findVariableKeysInText(text: string): string[] {
  if (!text || !text.includes('{{')) return [];
  const found: string[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(VARIABLE_PATTERN)) {
    const key = match[1];
    if (!seen.has(key)) {
      seen.add(key);
      found.push(key);
    }
  }
  return found;
}

/** Walks a BranchTarget (plain leaf, nested Condition, Random Block, or Repeat Block, at
 * any depth) collecting every `{{KEY}}` reference into `into`. */
function collectFromTarget(target: BranchTarget, into: Set<string>): void {
  if (isConditionBlock(target)) {
    for (const rule of target.rules) {
      if (rule.action) collectFromTarget(rule.action, into);
    }
    if (target.elseBranch) collectFromTarget(target.elseBranch, into);
    return;
  }
  if (isRandomBlock(target)) {
    for (const opt of target.options) collectFromTarget(opt.target, into);
    return;
  }
  if (isRepeatBlock(target)) {
    collectFromTarget(target.target, into);
    return;
  }
  // Leaf ActionBlock.
  for (const key of findVariableKeysInText(target.content || '')) {
    into.add(key);
  }
}

/** Applies `fn` to every leaf ActionBlock in a BranchTarget's tree, mutating in place. */
function walkLeaves(target: BranchTarget, fn: (leaf: { content: string }) => void): void {
  if (isConditionBlock(target)) {
    for (const rule of target.rules) {
      if (rule.action) walkLeaves(rule.action, fn);
    }
    if (target.elseBranch) walkLeaves(target.elseBranch, fn);
    return;
  }
  if (isRandomBlock(target)) {
    for (const opt of target.options) walkLeaves(opt.target, fn);
    return;
  }
  if (isRepeatBlock(target)) {
    walkLeaves(target.target, fn);
    return;
  }
  fn(target);
}

/**
 * Every distinct `{{KEY}}` referenced anywhere in `flow`: every rule's
 * action, every Senão branch, every Random option, at any nesting depth —
 * plus the root action slot directly when there's no dedicated Condition
 * step (see Block's doc comment in shared/types/index.ts).
 */
export function collectFlowVariableKeys(flow: Flow): string[] {
  const keys = new Set<string>();
  for (const block of flow.blocks) {
    if (block.type === 'condition') collectFromTarget(block.data as ConditionBlock, keys);
    else if (block.type === 'action') collectFromTarget(block.data as BranchTarget, keys);
  }
  return Array.from(keys);
}

/** Which of `flow`'s `{{KEY}}` references have no matching Global Variable. */
export function findMissingVariableKeys(flow: Flow, variables: Variable[]): string[] {
  const known = new Set(variables.map((v) => v.key));
  return collectFlowVariableKeys(flow).filter((key) => !known.has(key));
}

/**
 * Strips every `{{KEY}}` occurrence (for one specific key) from every leaf
 * action's content anywhere in `flow`'s tree, mutating it in place — this
 * is "Remover" in the missing-variables alert: since the Variable never
 * existed, there's nothing global to delete, only this flow's own
 * references to it. Only the placeholder text itself is removed; whatever
 * surrounds it is left untouched. `key` only ever contains `[A-Z0-9_]`
 * (see VARIABLE_PATTERN), so it's always safe to interpolate directly
 * into a RegExp with no injection risk.
 */
export function removeVariableKeyFromFlow(flow: Flow, key: string): void {
  const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
  for (const block of flow.blocks) {
    if (block.type === 'condition') {
      walkLeaves(block.data as ConditionBlock, (leaf) => { leaf.content = (leaf.content || '').replace(pattern, ''); });
    } else if (block.type === 'action') {
      walkLeaves(block.data as BranchTarget, (leaf) => { leaf.content = (leaf.content || '').replace(pattern, ''); });
    }
  }
}
