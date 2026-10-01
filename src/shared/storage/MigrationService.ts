import { browser } from 'wxt/browser';
import type { StorageSchema, Flow, Token, Counter, BranchTarget, ActionBlock, ConditionBlock } from '../types/index.js';
import { isConditionBlock, isRandomBlock, isRepeatBlock } from '../types/index.js';
import { generateId } from './helpers.js';

export const CURRENT_SCHEMA_VERSION = 2;

function walkBranchTarget(target: BranchTarget | undefined | null, fn: (leaf: ActionBlock) => void): void {
  if (!target) return;
  if (isConditionBlock(target)) {
    for (const rule of target.rules || []) {
      if (rule.action) walkBranchTarget(rule.action, fn);
    }
    if (target.elseBranch) walkBranchTarget(target.elseBranch, fn);
    return;
  }
  if (isRandomBlock(target)) {
    for (const opt of target.options || []) {
      if (opt.target) walkBranchTarget(opt.target, fn);
    }
    return;
  }
  if (isRepeatBlock(target)) {
    if (target.target) walkBranchTarget(target.target, fn);
    return;
  }
  // Leaf ActionBlock
  fn(target as ActionBlock);
}

export function walkFlowActionBlocks(flow: Flow, fn: (actionBlock: ActionBlock) => void): void {
  for (const block of flow.blocks || []) {
    if (block.type === 'condition') {
      walkBranchTarget(block.data as ConditionBlock, fn);
    } else if (block.type === 'action') {
      walkBranchTarget(block.data as BranchTarget, fn);
    }
  }
}

/**
 * Executes idempotent migrations based on schemaVersion and deep counter inspection.
 */
export const MigrationService = {
  /**
   * Deep inspection: checks whether any flow contains counter tokens that lack a counterId
   * or point to a counterId that does not exist in data.counters (reverse orphan).
   */
  hasUnmigratedCounters(data: Partial<StorageSchema>): boolean {
    const flows = data.flows || [];
    const existingCounters = new Set((data.counters || []).map((c) => c.id));

    let found = false;
    for (const flow of flows) {
      walkFlowActionBlocks(flow, (actionBlock) => {
        for (const token of actionBlock.tokens || []) {
          if (token.type === 'counter') {
            const cid = token.config?.counterId as string | undefined;
            if (!cid || !existingCounters.has(cid)) {
              found = true;
            }
          }
        }
        // Also check if content has .token-counter pills
        if (actionBlock.content && actionBlock.content.includes('token-counter')) {
          const counterSpans = actionBlock.content.match(/<span[^>]*class=["'][^"']*token-counter[^"']*["'][^>]*>[\s\S]*?<\/span>/gi) || [];
          for (const span of counterSpans) {
            const cfgMatch = span.match(/data-token-config=(["'])(.*?)\1/i);
            if (!cfgMatch) {
              found = true;
            } else {
              try {
                const unescaped = cfgMatch[2].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
                const cfg = JSON.parse(unescaped);
                if (!cfg.counterId || !existingCounters.has(cfg.counterId)) {
                  found = true;
                }
              } catch {
                found = true;
              }
            }
          }
        }
      });
      // Fallback for legacy flows that may have tokens at flow root
      for (const token of (flow as any).tokens || []) {
        if (token.type === 'counter') {
          const cid = token.config?.counterId as string | undefined;
          if (!cid || !existingCounters.has(cid)) {
            found = true;
          }
        }
      }
      if (found) return true;
    }
    return false;
  },

  /**
   * Checks the schema version and migrates if necessary.
   * Also triggers self-healing if unmigrated or reverse-orphan counters are found.
   * Returns true if migration is pending due to quota issues.
   */
  async checkAndMigrate(data: Partial<StorageSchema>): Promise<boolean> {
    const currentVersion = data.schemaVersion || 1;
    const isUnderVersion = currentVersion < CURRENT_SCHEMA_VERSION;
    const needsRepair = this.hasUnmigratedCounters(data);

    if (!isUnderVersion && !needsRepair) {
      return false; // Up to date
    }

    // Try to take a backup first
    try {
      await browser.storage.local.set({ ['backup_schema_v' + currentVersion]: data });
    } catch (e: any) {
      if (e.name === 'QuotaExceededError' || e.message?.toLowerCase().includes('quota') || e.message?.includes('QuotaExceededError')) {
        // Soft lock: UI will prompt for manual export
        return true;
      }
      console.warn('[SOTE] Failed to create backup before migration:', e);
    }

    await this.runMigrations(data, currentVersion);
    return false;
  },

  /**
   * Forces the migration to run (used after user manually exports backup).
   */
  async forceMigrate(data: Partial<StorageSchema>): Promise<void> {
    const currentVersion = data.schemaVersion || 1;
    await this.runMigrations(data, currentVersion);
  },

  async runMigrations(data: Partial<StorageSchema>, fromVersion: number): Promise<void> {
    let migratedData = { ...data };

    if (fromVersion < 2 || this.hasUnmigratedCounters(migratedData)) {
      migratedData = this.migrateToV2(migratedData);
    }

    // Finally, save the migrated data
    migratedData.schemaVersion = CURRENT_SCHEMA_VERSION;
    await browser.storage.local.set(migratedData);
  },

  migrateToV2(data: Partial<StorageSchema>): Partial<StorageSchema> {
    const flows = data.flows || [];
    const counters: Counter[] = [...(data.counters || [])];
    const newFlows: Flow[] = JSON.parse(JSON.stringify(flows));
    
    // Existing counters map
    const existingCounterIds = new Set(counters.map((c) => c.id));
    const groupToCounterMap = new Map<string, Counter>();

    for (const c of counters) {
      groupToCounterMap.set(c.id, c);
    }

    const processToken = (token: Token) => {
      if (token.type !== 'counter') return;
      const cfg = token.config || {};
      const cid = cfg.counterId as string | undefined;

      // If already validly linked to an existing counter in counters array, keep it
      if (cid && existingCounterIds.has(cid)) {
        return;
      }

      // Needs repair or migration:
      // Grouping key: counterGroupId or token.id
      const groupId = (cfg.counterGroupId as string) || (cid as string) || (token.id as string);
      let counter: Counter;

      if (groupToCounterMap.has(groupId)) {
        counter = groupToCounterMap.get(groupId)!;
      } else {
        const startVal = typeof cfg.start === 'number' ? cfg.start : (typeof (cfg as any).startValue === 'number' ? (cfg as any).startValue : 1);
        const curVal = typeof cfg.current === 'number' ? cfg.current : (typeof (cfg as any).currentValue === 'number' ? (cfg as any).currentValue : startVal);
        counter = {
          id: generateId(),
          name: `Contador ${counters.length + 1}`,
          format: (cfg.format as string) || '{contador}',
          resetRule: 'never',
          startValue: startVal,
          currentValue: curVal,
          scope: cfg.scope === 'site' ? 'site' : 'global',
          step: typeof cfg.step === 'number' ? cfg.step : 1,
          padLength: typeof cfg.padLength === 'number' ? cfg.padLength : 0,
        };
        groupToCounterMap.set(groupId, counter);
        existingCounterIds.add(counter.id);
        counters.push(counter);
      }

      // Update token to point to the new counter entity
      token.config = {
        ...cfg,
        counterId: counter.id,
      };
      
      // Clean up old properties that moved to Counter
      delete token.config.current;
      delete token.config.start;
      delete token.config.step;
      delete token.config.padLength;
      delete token.config.scope;
      delete (token.config as any).startValue;
      delete (token.config as any).currentValue;
      delete (token.config as any).counterGroupId;
    };

    for (const flow of newFlows) {
      walkFlowActionBlocks(flow, (actionBlock) => {
        actionBlock.tokens = actionBlock.tokens || [];

        // 1. Extract any counter pills embedded in actionBlock.content
        if (actionBlock.content && actionBlock.content.includes('token-counter')) {
          const spanRegex = /<span[^>]*class=(["'])[^"']*token-counter[^"']*\1[^>]*>([\s\S]*?)<\/span>/gi;
          actionBlock.content = actionBlock.content.replace(spanRegex, (fullSpan, _q, innerText) => {
            const idMatch = fullSpan.match(/data-token-id=(["'])(.*?)\1/i);
            const cfgMatch = fullSpan.match(/data-token-config=(["'])(.*?)\1/i);
            const tokenId = idMatch ? idMatch[2] : generateId();
            let cfg: Record<string, any> = {};

            if (cfgMatch) {
              try {
                const unescaped = cfgMatch[2].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
                cfg = JSON.parse(unescaped);
              } catch {}
            } else {
              const numMatch = innerText.match(/\((\d+),\s*\+?(\d+)\)/);
              if (numMatch) {
                cfg.start = parseInt(numMatch[1], 10);
                cfg.step = parseInt(numMatch[2], 10);
              }
            }

            let existingToken = actionBlock.tokens.find((t) => t.id === tokenId);
            if (!existingToken) {
              existingToken = { id: tokenId, type: 'counter', config: cfg };
              actionBlock.tokens.push(existingToken);
            } else {
              existingToken.config = { ...existingToken.config, ...cfg };
            }

            return fullSpan;
          });
        }

        // 2. Process all tokens in the action block
        for (const token of actionBlock.tokens) {
          processToken(token);
        }

        // 3. Update pills in actionBlock.content with new data-token-id and data-token-config
        if (actionBlock.content && actionBlock.content.includes('token-counter')) {
          const tokenMap = new Map(actionBlock.tokens.map((t) => [t.id, t]));
          const spanRegex = /<span([^>]*)class=(["'])([^"']*token-counter[^"']*)\2([^>]*)>([\s\S]*?)<\/span>/gi;
          actionBlock.content = actionBlock.content.replace(spanRegex, (fullSpan, pre, _q, cls, post, inner) => {
            const idMatch = fullSpan.match(/data-token-id=(["'])(.*?)\1/i);
            const tokenId = idMatch ? idMatch[2] : (actionBlock.tokens.find((t) => t.type === 'counter')?.id);
            const token = tokenId ? tokenMap.get(tokenId) : undefined;
            if (!token || !token.config?.counterId) return fullSpan;

            const cleanPre = pre.replace(/data-token-id=(["']).*?\1/gi, '').replace(/data-token-config=(["']).*?\1/gi, '').trim();
            const cleanPost = post.replace(/data-token-id=(["']).*?\1/gi, '').replace(/data-token-config=(["']).*?\1/gi, '').trim();
            const safeConfig = JSON.stringify(token.config).replace(/"/g, '&quot;');

            const attrs = [cleanPre, `class="${cls}"`, `data-token-id="${token.id}"`, `data-token-config="${safeConfig}"`, cleanPost]
              .filter(Boolean)
              .join(' ');
            return `<span ${attrs}>${inner}</span>`;
          });
        }
      });

      // Fallback for legacy flow.tokens
      for (const token of (flow as any).tokens || []) {
        processToken(token);
      }
    }

    return {
      ...data,
      flows: newFlows,
      counters,
      schemaVersion: 2,
    };
  },

  /**
   * Reverts the database to the exact state stored in the V1 backup.
   * Removes V2-specific keys to prevent hybrid corruption.
   */
  async rollbackToV1(): Promise<boolean> {
    const backupWrapper = await browser.storage.local.get('backup_schema_v1');
    const backupData = backupWrapper['backup_schema_v1'] as Partial<StorageSchema>;

    if (!backupData) {
      console.warn('[SOTE] No V1 backup found to restore.');
      return false;
    }

    // Identify current root keys
    const currentStorage = await browser.storage.local.get(null);
    const keysToRemove: string[] = [];

    // Any key present now that is NOT in the backup must be removed 
    // to avoid hybrid corruption (e.g., 'counters', 'schemaVersion').
    for (const key of Object.keys(currentStorage)) {
      if (key !== 'backup_schema_v1' && backupData[key as keyof StorageSchema] === undefined) {
        keysToRemove.push(key);
      }
    }

    if (keysToRemove.length > 0) {
      await browser.storage.local.remove(keysToRemove);
    }

    // Overwrite existing valid keys with their exact V1 backup values
    await browser.storage.local.set(backupData);
    
    return true;
  }
};
