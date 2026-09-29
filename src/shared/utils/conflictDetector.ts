/**
 * src/shared/utils/conflictDetector.ts
 *
 * Conflict and overlap detection for shortcuts (Flows).
 * Detects:
 *   1. Duplicate shortcuts (same exact shortcut or case-insensitive match when smartCase is on).
 *   2. Prefix overlaps (e.g. /d vs /data or eml vs email).
 *   3. Search Trigger prefix collisions (e.g. shortcut starts with // or ///).
 */

import type { Flow, Block, TriggerBlock, Settings, SearchTriggerSettings, ConditionBlock, ConditionRule } from '../types/index.js';
import { shortcutConflictsWithSearchTrigger } from '../../content/engine/SearchTriggerDetector.js';
import { normalizeHostLike, matchesDomainPattern } from '../storage/helpers.js';

export type ConflictSeverity = 'error' | 'warning' | 'info';

export interface ShortcutConflict {
  id: string;
  type: 'duplicate' | 'prefix' | 'search_trigger';
  severity: ConflictSeverity;
  flowA: Flow;
  flowB?: Flow; // Optional when colliding with system/searchTrigger
  shortcutA: string;
  shortcutB?: string;
  descriptionKey: string;
  descriptionParams?: Record<string, string | number>;
}

export interface ShortcutOverlapResult {
  hasLongerMatch: boolean;
  longerMatches: Flow[];
}

/**
 * Extracts the TriggerBlock data from a flow if it exists and has a shortcut.
 */
export function getFlowTriggerData(flow: Flow): TriggerBlock | null {
  const block = flow.blocks.find((b: Block) => b.type === 'trigger');
  if (!block || !block.data) return null;
  const trigger = block.data as TriggerBlock;
  if (!trigger.shortcut || !trigger.shortcut.trim()) return null;
  return trigger;
}

/**
 * Extracts domain restriction patterns from a flow's ConditionBlock if present.
 * Returns an array of normalized domain strings if domain conditions exist, or null if unrestricted.
 */
export function getFlowDomainRestrictions(flow: Flow): string[] | null {
  const condBlock = flow.blocks.find((b: Block) => b.type === 'condition');
  if (!condBlock || !condBlock.data) return null;

  const data = condBlock.data as ConditionBlock;
  if (!Array.isArray(data.rules) || data.rules.length === 0) return null;

  const domainPatterns: string[] = [];
  for (const rule of data.rules) {
    if (rule.type === 'domain' && rule.value && (rule.operator === 'equals' || !rule.operator)) {
      const norm = normalizeHostLike(rule.value);
      if (norm) domainPatterns.push(norm);
    }
    if (rule.criteria && Array.isArray(rule.criteria)) {
      for (const crit of rule.criteria) {
        if (crit.type === 'domain' && crit.value && (crit.operator === 'equals' || !crit.operator)) {
          const norm = normalizeHostLike(crit.value);
          if (norm) domainPatterns.push(norm);
        }
      }
    }
  }

  return domainPatterns.length > 0 ? domainPatterns : null;
}

/**
 * Checks whether two domain patterns overlap (can match at least one common domain).
 */
export function doDomainPatternsOverlap(patternA: string, patternB: string): boolean {
  const normA = normalizeHostLike(patternA);
  const normB = normalizeHostLike(patternB);
  if (!normA || !normB) return false;

  if (normA === normB) return true;

  // Exact non-wildcard tests against the other's pattern
  const hasWildcardA = normA.includes('*') || normA.includes('?');
  const hasWildcardB = normB.includes('*') || normB.includes('?');

  if (!hasWildcardA && hasWildcardB) {
    return matchesDomainPattern(normA, normB);
  }
  if (hasWildcardA && !hasWildcardB) {
    return matchesDomainPattern(normB, normA);
  }
  if (!hasWildcardA && !hasWildcardB) {
    return normA === normB;
  }

  // Both have wildcards (e.g. *.site.com vs *site.com or *.a.com vs *.b.com)
  const sampleA = normA.replace(/\*/g, 'sub').replace(/\?/g, 'x');
  const sampleB = normB.replace(/\*/g, 'sub').replace(/\?/g, 'x');
  return matchesDomainPattern(sampleA, normB) || matchesDomainPattern(sampleB, normA);
}

/**
 * Determines whether two flows have overlapping domains.
 * Rules:
 * 1. If both flows have domain restrictions, they only overlap if at least one pattern in A overlaps with one in B.
 * 2. If only one flow (or neither) has domain restrictions, they overlap (the unrestricted flow runs on all domains).
 */
export function doFlowDomainsOverlap(flowA: Flow, flowB: Flow): boolean {
  const domainsA = getFlowDomainRestrictions(flowA);
  const domainsB = getFlowDomainRestrictions(flowB);

  // If neither has restrictions, both run everywhere -> overlap
  if (!domainsA && !domainsB) return true;

  // If only one is restricted, the other is unrestricted (runs everywhere) -> overlap
  if (!domainsA || !domainsB) return true;

  // Both are restricted: check if any pair of patterns overlaps
  for (const patA of domainsA) {
    for (const patB of domainsB) {
      if (doDomainPatternsOverlap(patA, patB)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks whether two shortcuts match, respecting smartCase.
 */
export function areShortcutsEquivalent(
  scA: string,
  smartCaseA: boolean | undefined,
  scB: string,
  smartCaseB: boolean | undefined
): boolean {
  const a = scA.trim();
  const b = scB.trim();
  if (smartCaseA === false || smartCaseB === false) {
    return a === b;
  }
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Checks whether scA is a strict prefix of scB.
 */
export function isPrefixOf(
  scA: string,
  smartCaseA: boolean | undefined,
  scB: string,
  smartCaseB: boolean | undefined
): boolean {
  const a = scA.trim();
  const b = scB.trim();
  if (a.length >= b.length) return false;

  if (smartCaseA === false || smartCaseB === false) {
    return b.startsWith(a);
  }
  return b.toLowerCase().startsWith(a.toLowerCase());
}

/**
 * Checks if a typed shortcut in exact match mode has any longer enabled flow shortcut that begins with it.
 */
export function findLongerPrefixFlows(
  currentFlowId: string,
  typedShortcut: string,
  flows: Flow[]
): Flow[] {
  const target = typedShortcut.trim().toLowerCase();
  const candidates: Flow[] = [];

  for (const flow of flows) {
    if (!flow.enabled || flow.id === currentFlowId) continue;
    const trigger = getFlowTriggerData(flow);
    if (!trigger) continue;

    const otherSc = trigger.shortcut.trim();
    const otherNorm = trigger.smartCase === false ? otherSc : otherSc.toLowerCase();
    const targetNorm = trigger.smartCase === false ? typedShortcut.trim() : target;

    if (otherNorm.length > targetNorm.length && otherNorm.startsWith(targetNorm)) {
      candidates.push(flow);
    }
  }

  return candidates;
}

/**
 * Scans a list of flows and settings to detect all conflicts.
 */
export function detectAllConflicts(flows: Flow[], settings?: Settings): ShortcutConflict[] {
  const conflicts: ShortcutConflict[] = [];
  const activeFlows = flows.filter((f) => f.enabled);

  // 1. Check against Search Trigger prefixes
  if (settings?.searchTrigger?.enabled) {
    for (const flow of flows) {
      const trigger = getFlowTriggerData(flow);
      if (!trigger) continue;

      if (shortcutConflictsWithSearchTrigger(trigger.shortcut, settings.searchTrigger)) {
        const prefix =
          settings.searchTrigger.domainPrefix && trigger.shortcut.startsWith(settings.searchTrigger.domainPrefix)
            ? settings.searchTrigger.domainPrefix
            : settings.searchTrigger.globalPrefix || '';

        conflicts.push({
          id: `st-${flow.id}`,
          type: 'search_trigger',
          severity: 'warning',
          flowA: flow,
          shortcutA: trigger.shortcut,
          descriptionKey: 'conflicts.type.search_trigger',
          descriptionParams: { prefix },
        });
      }
    }
  }

  // 2. Pairwise checks between active flows
  for (let i = 0; i < activeFlows.length; i++) {
    const flowA = activeFlows[i];
    const triggerA = getFlowTriggerData(flowA);
    if (!triggerA) continue;

    for (let j = i + 1; j < activeFlows.length; j++) {
      const flowB = activeFlows[j];
      const triggerB = getFlowTriggerData(flowB);
      if (!triggerB) continue;

      // Domain isolation check: if both flows have domain conditions and their domains do not overlap, ignore conflict
      if (!doFlowDomainsOverlap(flowA, flowB)) {
        continue;
      }

      // Duplicate Check
      if (areShortcutsEquivalent(triggerA.shortcut, triggerA.smartCase, triggerB.shortcut, triggerB.smartCase)) {
        conflicts.push({
          id: `dup-${flowA.id}-${flowB.id}`,
          type: 'duplicate',
          severity: 'error',
          flowA,
          flowB,
          shortcutA: triggerA.shortcut,
          shortcutB: triggerB.shortcut,
          descriptionKey: 'conflicts.type.duplicate',
          descriptionParams: { scA: triggerA.shortcut, scB: triggerB.shortcut },
        });
      }
      // Prefix Check: A is prefix of B
      else if (isPrefixOf(triggerA.shortcut, triggerA.smartCase, triggerB.shortcut, triggerB.smartCase)) {
        conflicts.push({
          id: `pref-${flowA.id}-${flowB.id}`,
          type: 'prefix',
          severity: 'info',
          flowA,
          flowB,
          shortcutA: triggerA.shortcut,
          shortcutB: triggerB.shortcut,
          descriptionKey: 'conflicts.type.prefix',
          descriptionParams: { short: triggerA.shortcut, long: triggerB.shortcut },
        });
      }
      // Prefix Check: B is prefix of A
      else if (isPrefixOf(triggerB.shortcut, triggerB.smartCase, triggerA.shortcut, triggerA.smartCase)) {
        conflicts.push({
          id: `pref-${flowB.id}-${flowA.id}`,
          type: 'prefix',
          severity: 'info',
          flowA: flowB,
          flowB: flowA,
          shortcutA: triggerB.shortcut,
          shortcutB: triggerA.shortcut,
          descriptionKey: 'conflicts.type.prefix',
          descriptionParams: { short: triggerB.shortcut, long: triggerA.shortcut },
        });
      }
    }
  }

  return conflicts;
}
