/**
 * src/content/engine/SearchTriggerDetector.ts
 *
 * The "Gatilho de Busca" — a third trigger mode (distinct from Trigger Key
 * and Exact Match, see spec §4): typing the configured prefix (default `//`
 * or `///`) inside any editable field opens a cursor-anchored search popup
 * instead of expanding automatically.
 *
 * This module is intentionally free of any DOM/popup concerns — it only:
 *   1. Detects whether the text immediately before the caret currently
 *      represents an active search session, and what the scope + query are
 *      (`detect`);
 *   2. Given that scope + query, builds and ranks the matching Forms/Flows
 *      (`buildResults`).
 * The popup (SearchPopup) and content.ts only consume its pure output.
 */
import type { Flow, Form, FormField, Settings, SearchTriggerSettings } from '../../shared/types/index.js';
import { domainMatchesAny } from '../../shared/storage/helpers.js';

export type SearchScope = 'domain' | 'global';

export interface SearchTriggerState {
  scope: SearchScope;
  /** Everything typed after the matched prefix, up to the caret. */
  query: string;
  /** The exact substring (prefix + query) that must be deleted on insertion — see TextInjector.inject's `shortcutTyped` param. */
  typed: string;
}

/** How strongly a result matched the current query. Lower = better. Level 0 = no query yet (browse mode). */
export type MatchLevel = 0 | 1 | 2 | 3;

export type SearchResultItem =
  | { kind: 'form-field'; form: Form; field: FormField; matchLevel: MatchLevel; matchedIn: 'name' | 'content' | null; snippet?: string }
  | { kind: 'form'; form: Form; matchLevel: MatchLevel }
  | { kind: 'flow'; flow: Flow; matchLevel: MatchLevel; matchedIn: 'name' | 'shortcut' | 'content' | null; snippet?: string };

export interface BuildResultsOutput {
  results: SearchResultItem[];
  /** True when scope==='domain' and zero Form-sourced rows matched — drives the "tente ///" footer suggestion (spec §4.3). */
  noFormResultsForSite: boolean;
}

const MAX_QUERY_LENGTH = 60;
const MAX_RESULTS = 30;
/** Characters that may legitimately precede a fresh prefix (start of field counts too). Excludes things like "https:" so ordinary URLs don't accidentally open the popup. */
const BOUNDARY_RE = /[\s([{"'“”«]/;

/**
 * Whether a Flow's Trigger shortcut collides with one of the configured
 * Gatilho de Busca prefixes (spec §6 — "reserved prefixes"). Shared by:
 *   - TriggerBlock.ts, for the real-time warning while typing a shortcut;
 *   - the Settings page, to scan all existing Flows when the feature is
 *     (re)activated or a prefix is changed.
 * Only meaningful while the search trigger is enabled — with it off, the
 * prefixes are free text and never conflict with anything (spec §6).
 */
export function shortcutConflictsWithSearchTrigger(shortcut: string, cfg: SearchTriggerSettings | undefined): boolean {
  if (!cfg?.enabled || !shortcut) return false;
  const { domainPrefix, globalPrefix } = cfg;
  return (!!domainPrefix && shortcut.startsWith(domainPrefix)) || (!!globalPrefix && shortcut.startsWith(globalPrefix));
}

/**
 * Looks at `buffer` (plain text immediately before the caret, e.g. the last
 * ~100 characters — see TextMonitor) and decides whether a Gatilho de
 * Busca session is currently active.
 */
export function detectSearchTrigger(buffer: string, settings: Settings): SearchTriggerState | null {
  const cfg = settings?.searchTrigger;
  if (!cfg || !cfg.enabled) return null;

  const { domainPrefix, globalPrefix } = cfg;
  if (!domainPrefix || !globalPrefix || domainPrefix === globalPrefix) return null;

  const domainIdx = buffer.lastIndexOf(domainPrefix);
  const globalIdx = buffer.lastIndexOf(globalPrefix);

  const domainEnd = domainIdx === -1 ? -1 : domainIdx + domainPrefix.length;
  const globalEnd = globalIdx === -1 ? -1 : globalIdx + globalPrefix.length;

  if (domainEnd === -1 && globalEnd === -1) return null;

  let scope: SearchScope;
  let idx: number;
  let prefixLen: number;

  if (domainEnd === globalEnd) {
    // Both prefixes match ending at the same point (e.g. "//" is a suffix
    // of "///") — the user typed the longer one, so honor that intent.
    if (globalPrefix.length >= domainPrefix.length) {
      scope = 'global'; idx = globalIdx; prefixLen = globalPrefix.length;
    } else {
      scope = 'domain'; idx = domainIdx; prefixLen = domainPrefix.length;
    }
  } else if (globalEnd > domainEnd) {
    scope = 'global'; idx = globalIdx; prefixLen = globalPrefix.length;
  } else {
    scope = 'domain'; idx = domainIdx; prefixLen = domainPrefix.length;
  }

  // Boundary check: the character right before the prefix must be a
  // start-of-field/whitespace/opening-punctuation — this is what keeps a
  // URL like "https://example.com" from being mistaken for the prefix.
  const before = buffer[idx - 1];
  if (idx > 0 && before !== undefined && !BOUNDARY_RE.test(before)) return null;

  const query = buffer.slice(idx + prefixLen);
  if (query.includes('\n') || query.length > MAX_QUERY_LENGTH) return null;

  return { scope, query, typed: buffer.slice(idx) };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function snippetAround(haystack: string, query: string, radius = 30): string {
  const idx = haystack.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return haystack.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  const end = Math.min(haystack.length, idx + query.length + radius);
  return (start > 0 ? '…' : '') + haystack.slice(start, end) + (end < haystack.length ? '…' : '');
}

/**
 * Collects every leaf ActionBlock's content reachable from a condition,
 * recursing into nested ConditionBlocks (a branch whose `action` or
 * `elseBranch` is itself another Se/Senão Se/Senão tree) to arbitrary
 * depth.
 */
function collectConditionContents(cond: any, parts: string[]): void {
  for (const rule of cond?.rules || []) {
    const target = rule.action;
    if (!target) continue;
    if (Array.isArray(target.rules)) {
      collectConditionContents(target, parts);
    } else if (target.content) {
      parts.push(target.content);
    }
  }
  const elseBranch = cond?.elseBranch;
  if (elseBranch) {
    if (Array.isArray(elseBranch.rules)) {
      collectConditionContents(elseBranch, parts);
    } else if (elseBranch.content) {
      parts.push(elseBranch.content);
    }
  }
}

/** All ActionBlock contents reachable from a Flow (main action + every condition branch, including nested ones), for the §4 "conteúdo do Action" content-match. */
function collectFlowContents(flow: Flow): string {
  const parts: string[] = [];
  for (const block of flow.blocks) {
    if (block.type === 'action') parts.push((block.data as any).content || '');
    if (block.type === 'condition') collectConditionContents(block.data as any, parts);
  }
  return stripHtml(parts.join(' '));
}

function getFlowShortcut(flow: Flow): string {
  const trigger = flow.blocks.find((b) => b.type === 'trigger')?.data as any;
  return trigger?.shortcut || '';
}

/**
 * Builds and ranks every Form/Flow result for the given scope + query.
 * `hostname` is the current page's domain (e.g. `location.hostname`).
 */
export function buildSearchResults(params: {
  query: string;
  scope: SearchScope;
  hostname: string;
  forms: Form[];
  flows: Flow[];
  includeFlows: boolean;
}): BuildResultsOutput {
  const { scope, hostname, forms, flows, includeFlows } = params;
  const query = params.query.trim();
  const q = query.toLowerCase();
  const browseMode = q === '';

  const results: SearchResultItem[] = [];
  let anyFormResult = false;

  // ---- Forms ----
  for (const form of forms) {
    const siteMatches = scope === 'global' ? true : form.sites.length > 0 && domainMatchesAny(hostname, form.sites);
    if (!siteMatches) continue;

    if (browseMode) {
      results.push({ kind: 'form', form, matchLevel: 0 });
      anyFormResult = true;
      continue;
    }

    const fieldMatches: Array<{ field: FormField; matchLevel: MatchLevel; matchedIn: 'name' | 'content'; snippet?: string }> = [];
    for (const field of form.fields) {
      const nameLower = field.name.toLowerCase();
      if (nameLower === q) {
        fieldMatches.push({ field, matchLevel: 1, matchedIn: 'name' });
      } else if (nameLower.includes(q)) {
        fieldMatches.push({ field, matchLevel: 2, matchedIn: 'name' });
      } else {
        const body = stripHtml(field.value?.content || '');
        if (body.toLowerCase().includes(q)) {
          fieldMatches.push({ field, matchLevel: 3, matchedIn: 'content', snippet: snippetAround(body, query) });
        }
      }
    }

    if (fieldMatches.length > 0) {
      for (const m of fieldMatches) {
        results.push({ kind: 'form-field', form, field: m.field, matchLevel: m.matchLevel, matchedIn: m.matchedIn, snippet: m.snippet });
      }
      anyFormResult = true;
      continue;
    }

    const formNameLower = form.name.toLowerCase();
    if (formNameLower === q) {
      results.push({ kind: 'form', form, matchLevel: 1 });
      anyFormResult = true;
    } else if (formNameLower.includes(q)) {
      results.push({ kind: 'form', form, matchLevel: 2 });
      anyFormResult = true;
    }
  }

  // ---- Flows (no domain restriction, per spec §4 — always eligible regardless of scope) ----
  if (includeFlows) {
    for (const flow of flows) {
      if (!flow.enabled) continue;

      if (browseMode) {
        results.push({ kind: 'flow', flow, matchLevel: 0, matchedIn: null });
        continue;
      }

      const shortcut = getFlowShortcut(flow);
      const nameLower = flow.name.toLowerCase();
      const shortcutLower = shortcut.toLowerCase();

      if (nameLower === q || (shortcut && shortcutLower === q)) {
        results.push({ kind: 'flow', flow, matchLevel: 1, matchedIn: nameLower === q ? 'name' : 'shortcut' });
      } else if (nameLower.includes(q) || (shortcut && shortcutLower.includes(q))) {
        results.push({ kind: 'flow', flow, matchLevel: 2, matchedIn: nameLower.includes(q) ? 'name' : 'shortcut' });
      } else {
        const content = collectFlowContents(flow);
        if (content.toLowerCase().includes(q)) {
          results.push({ kind: 'flow', flow, matchLevel: 3, matchedIn: 'content', snippet: snippetAround(content, query) });
        }
      }
    }
  }

  // ---- Ranking (spec §4.2): matchLevel asc, then usageCount desc, then name asc ----
  const usageOf = (item: SearchResultItem): number => {
    if (item.kind === 'flow') return item.flow.stats?.usageCount || 0;
    return item.form.stats?.usageCount || 0;
  };
  const nameOf = (item: SearchResultItem): string => {
    if (item.kind === 'flow') return item.flow.name;
    if (item.kind === 'form') return item.form.name;
    return item.field.name;
  };

  results.sort((a, b) => {
    if (a.matchLevel !== b.matchLevel) return a.matchLevel - b.matchLevel;
    const usageDiff = usageOf(b) - usageOf(a);
    if (usageDiff !== 0) return usageDiff;
    return nameOf(a).localeCompare(nameOf(b));
  });

  return {
    results: results.slice(0, MAX_RESULTS),
    noFormResultsForSite: scope === 'domain' && !anyFormResult,
  };
}
