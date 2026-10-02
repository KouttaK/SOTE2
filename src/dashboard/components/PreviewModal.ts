/**
 * src/dashboard/components/PreviewModal.ts
 *
 * Side-by-side 2-column preview modal for the flow editor.
 * Replaces the old two-mode toggle with a simultaneous layout:
 * - Left column (340px): "Árvore de Blocos" logic cards (ConditionBlock,
 *   RandomBlock with option weights % and chosen badge, RepeatBlock, ActionBlock)
 *   plus color legend.
 * - Right column (flex-1): "Preview Renderizado" final output with inline styled
 *   pills for all tokens (counter dynamic per repeat iteration, math with formula
 *   tooltip, variable real vs fallback, flow_ref, choice, input, date, clipboard,
 *   cursor), active branch highlighting, and dimmed/struck-through inactive branches.
 * - Footer: "Copiar resultado" button that copies strictly clean plain text.
 */

import type {
  TriggerBlock as ITriggerBlock,
  ActionBlock as IActionBlock,
  Settings,
  Variable,
  BranchTarget,
  RepeatBlock as IRepeatBlock,
  RandomBlock as IRandomBlock,
  ConditionBlock as IConditionBlock,
  Flow,
  Token,
  ConditionRule,
  RandomTokenOption,
  FlowRefTokenConfig,
} from '../../shared/types/index.js';
import { isConditionBlock, isRandomBlock, isRepeatBlock } from '../../shared/types/index.js';
import { t } from '../../shared/i18n/index.js';
import { escapeHtml } from '../../shared/utils/dom.js';
import { sanitizeHtml } from '../../shared/utils/sanitizeHtml.js';
import { resolveLeaf, resolveBranchTarget, resolveFlowActionBlock } from '../../content/engine/ConditionResolver.js';
import { resolveActionBlockContent } from '../../content/engine/ActionContentResolver.js';
import { resetCounterState, expandToken, ExpansionContext } from '../../content/engine/tokenExpander.js';
import type { ChoicePopup } from '../../content/engine/ChoicePopup.js';
import { describeConditionRule } from './blocks/ConditionBlock.js';
import { storage } from '../../shared/storage/StorageService.js';
import './PreviewModal.css';

const ICONS = {
  eye: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor"><path d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z"/></svg>`,
  close: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></svg>`,
  copy: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M384 336H192c-8.8 0-16-7.2-16-16V64c0-8.8 7.2-16 16-16l140.1 0L384 99.9V320c0 8.8-7.2 16-16 16zM192 0c-35.3 0-64 28.7-64 64V320c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V96c0-17-6.7-33.3-18.7-45.3L389.3 18.7C377.3 6.7 361 0 344 0H192zm-96 128c-35.3 0-64 28.7-64 64V448c0 35.3 28.7 64 64 64H288c35.3 0 64-28.7 64-64V416H288v32c0 8.8-7.2 16-16 16H96c-8.8 0-16-7.2-16-16V192c0-8.8 7.2-16 16-16h32V128H96z"/></svg>`,
  check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/></svg>`,
  repeat: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M0 224c0 17.7 14.3 32 32 32s32-14.3 32-32c0-53 43-96 96-96l160 0 0 32c0 12.9 7.8 24.6 19.8 29.6s25.7 2.2 34.9-6.9l64-64c12.5-12.5 12.5-32.8 0-45.3l-64-64c-9.2-9.2-22.9-11.9-34.9-6.9S320 19.1 320 32l0 32L160 64C71.6 64 0 135.6 0 224zm512 64c0-17.7-14.3-32-32-32s-32 14.3-32 32c0 53-43 96-96 96l-160 0 0-32c0-12.9-7.8-24.6-19.8-29.6s-25.7-2.2-34.9 6.9l-64 64c-12.5 12.5-12.5 32.8 0 45.3l64 64c9.2 9.2 22.9 11.9 34.9 6.9s19.8-16.7 19.8-29.6l0-32 160 0c88.4 0 160-71.6 160-160z"/></svg>`,
  refresh: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M105.1 202.6c7.7-21.8 20.2-42.3 37.8-59.8c62.5-62.5 163.8-62.5 226.3 0L386.3 160H336c-17.7 0-32 14.3-32 32s14.3 32 32 32H463.5c0 0 0 0 0 0h.4c17.7 0 32-14.3 32-32V64c0-17.7-14.3-32-32-32s-32 14.3-32 32v51.2L414.4 97.6c-87.5-87.5-229.3-87.5-316.8 0C73.2 122 55.6 150.7 44.8 181.4c-5.9 16.7 2.9 34.9 19.5 40.8s34.9-2.9 40.8-19.5zM39 289.3c-5 1.5-9.8 4.2-13.7 8.2c-4 4-6.7 8.8-8.1 14c-.3 1.2-.6 2.5-.8 3.8c-.3 1.7-.4 3.4-.4 5.1V448c0 17.7 14.3 32 32 32s32-14.3 32-32V396.9l17.6 17.5 0 0c87.5 87.4 229.3 87.4 316.7 0c24.4-24.4 42.1-53.1 52.9-83.7c5.9-16.7-2.9-34.9-19.5-40.8s-34.9 2.9-40.8 19.5c-7.7 21.8-20.2 42.3-37.8 59.8c-62.5 62.5-163.8 62.5-226.3 0l-.1-.1L125.6 352H176c17.7 0 32-14.3 32-32s-14.3-32-32-32H48.4c-1.6 0-3.2 .1-4.8 .3s-3.1 .5-4.6 1z"/></svg>`,
  codeBranch: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M80 104a24 24 0 1 0 0-48 24 24 0 1 0 0 48zm80-24c0 32.8-19.7 61-48 73.3v87.8c18.8-10.9 40.7-17.1 64-17.1h96c35.3 0 64-28.7 64-64v-6.7C307.7 141 288 112.8 288 80c0-44.2 35.8-80 80-80s80 35.8 80 80c0 32.8-19.7 61-48 73.3V160c0 70.7-57.3 128-128 128H176c-35.3 0-64 28.7-64 64v6.7c28.3 12.3 48 40.5 48 73.3c0 44.2-35.8 80-80 80s-80-35.8-80-80c0-32.8 19.7-61 48-73.3V352 153.3C19.7 141 0 112.8 0 80C0 35.8 35.8 0 80 0s80 35.8 80 80zm232 0a24 24 0 1 0 -48 0 24 24 0 1 0 48 0zM80 456a24 24 0 1 0 0-48 24 24 0 1 0 0 48z"/></svg>`,
  dice: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" fill="currentColor"><path d="M274.9 34.3c-28.1-28.1-73.7-28.1-101.8 0L34.3 173.1c-28.1 28.1-28.1 73.7 0 101.8L173.1 413.7c28.1 28.1 73.7 28.1 101.8 0L413.7 274.9c28.1-28.1 28.1-73.7 0-101.8L274.9 34.3zM200 224a24 24 0 1 1 48 0 24 24 0 1 1 -48 0zM96 200a24 24 0 1 1 0 48 24 24 0 1 1 0-48zM224 376a24 24 0 1 1 0-48 24 24 0 1 1 0 48zM352 200a24 24 0 1 1 0 48 24 24 0 1 1 0-48zM224 120a24 24 0 1 1 0-48 24 24 0 1 1 0 48zm96 328c0 35.3 28.7 64 64 64H576c35.3 0 64-28.7 64-64V256c0-35.3-28.7-64-64-64H461.7c11.6 36 3.1 77-25.4 105.5L320 413.8V448zM480 328a24 24 0 1 1 0 48 24 24 0 1 1 0-48z"/></svg>`,
  anglesDown: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M246.6 470.6c-12.5 12.5-32.8 12.5-45.3 0l-160-160c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L224 402.7 361.4 265.4c12.5-12.5 32.8-12.5 45.3 0s12.5 32.8 0 45.3l-160 160zm160-352l-160 160c-12.5 12.5-32.8 12.5-45.3 0l-160-160c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L224 210.7 361.4 73.4c12.5-12.5 32.8-12.5 45.3 0s12.5 32.8 0 45.3z"/></svg>`,
  fileText: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor"><path d="M0 64C0 28.7 28.7 0 64 0H224V128c0 17.7 14.3 32 32 32H384V448c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V64zm384 64H256V0L384 128z"/></svg>`,
};

const UI_LEAK_SELECTORS =
  '.block-dock, .block-dock-toggle, .block-dock-chips, .block-dock-chip, .block-dock-label, .block-dock-toggle-label, .block-type-label, .block-type-icon, .block-type-meta, .block-badge, .block-header, .block-header-actions, .floating-node-header, .floating-node-grip, .floating-node-label, .tokens-preview, .token-menu-overlay, .token-menu-list, .token-menu-search-wrap, .token-menu-section-label, .token-menu-row, .token-menu-row-text, .token-menu-row-desc, .rt-toolbar, .rt-btn';

export interface PreviewBranch {
  /** 'SE' | 'SENÃO SE' | 'SENÃO' — omitted (undefined) when there's no condition step. */
  tag?: string;
  /** Human-readable rule summary (e.g. from describeConditionRule) — omitted for the Else branch. */
  ruleDescription?: string;
  action: IActionBlock;
  /** If this action is enclosed in a RepeatBlock, the repeat metadata */
  repeatBlock?: IRepeatBlock;
  /** The full BranchTarget to resolve (e.g. RepeatBlock or ActionBlock) */
  target?: BranchTarget;
  /** Expanded content produced by the real execution engine */
  simulatedContent?: string;
}

export interface PreviewData {
  trigger: ITriggerBlock;
  settings: Settings;
  branches: PreviewBranch[];
  variables?: Variable[];
  flows?: Flow[];
  flow?: Flow;
}

/**
 * Helper to display repeat separator clearly in UI
 */
export function formatSeparator(sep: string | undefined): string {
  if (sep === undefined || sep === '') return t('condition.preview.weekday_none') || '(nenhum)';
  if (sep === '\n') return '\\n';
  if (sep === '\r\n') return '\\r\\n';
  if (sep === '\t') return '\\t';
  if (sep === ' ') return '[espaço]';
  return sep;
}

/**
 * Strips HTML tags and resolves carriage returns into standard plain text
 */
function htmlToPlainText(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html.replace(/<br\s*[\/]?>/gi, '\n').replace(/<\/p>/gi, '\n');
  return (tmp.textContent || tmp.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Resolves a token for a pill element inside the action content
 */
function resolveTokenForPill(pillEl: Element, tokens: Token[]): Token | null {
  const rawId = pillEl.getAttribute('data-token-id');
  const tokenId = rawId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `tok_${Date.now()}`);

  const typeClass = Array.from(pillEl.classList).find((c) => c.startsWith('token-') && c !== 'token-pill');
  const classType = typeClass?.replace('token-', '') as Token['type'] | undefined;

  const arrayMatch = rawId ? tokens.find((t) => t.id === rawId) : undefined;
  const sourceTokenId = (arrayMatch as any)?.sourceTokenId;

  const configAttr = pillEl.getAttribute('data-token-config');
  if (configAttr) {
    try {
      const config = JSON.parse(configAttr);
      const type = classType || arrayMatch?.type;
      if (type) {
        return {
          id: tokenId,
          type,
          config: { ...(arrayMatch?.config || {}), ...config },
          ...(sourceTokenId ? { sourceTokenId } : {}),
        } as Token;
      }
    } catch {
      // fall through
    }
  }

  if (arrayMatch) {
    return {
      ...arrayMatch,
      ...(sourceTokenId ? { sourceTokenId } : {}),
    };
  }

  if (!classType) return null;
  return { id: tokenId, type: classType, config: {} };
}

/**
 * Simulates real engine output for a branch target using ConditionResolver
 * and ActionContentResolver with counters reset to start state.
 */
export async function simulateBranchContent(
  target: BranchTarget,
  variables: Variable[] = [],
  flows: Flow[] = []
): Promise<string> {
  resetCounterState();
  const dummyEl = document.createElement('div');
  const dummyChoicePopup = {
    showForToken: async (token: Token, _el?: any, _vars?: any, prefillValue?: string) => {
      if (token.type === 'choice') {
        const opts = (token.config?.options as string[]) || [];
        return opts[0] || '[Opção]';
      }
      if (token.type === 'input') {
        return prefillValue || (token.config?.placeholder as string) || (token.config?.label as string) || '[Entrada]';
      }
      return '';
    },
  } as unknown as ChoicePopup;

  const resolvedAction = resolveLeaf(target, dummyEl, undefined, { variables });
  if (!resolvedAction) return '';

  const result = await resolveActionBlockContent(resolvedAction, dummyEl, {
    choicePopup: dummyChoicePopup,
    variables,
    context: {
      tabUrl: typeof window !== 'undefined' ? window.location?.href || 'https://example.com' : 'https://example.com',
      tabTitle: typeof document !== 'undefined' ? document.title || 'Page Title' : 'Page Title',
      clipboardHistory: ['Exemplo Clipboard'],
      isSimulation: true,
    },
    flows,
  });

  return result ? result.content : '';
}

export class PreviewModal {
  private backdrop: HTMLElement;
  private escHandler: (e: KeyboardEvent) => void;
  private variables: Variable[];
  private flows: Flow[];
  private data: PreviewData;
  private initPromise?: Promise<void>;
  private pureTextResult: string = '';
  private chosenRandomOptionIds = new Set<string>();

  constructor(data: PreviewData) {
    this.data = data;
    this.variables = data.variables || [];
    this.flows = data.flows || [];
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'modal-backdrop';

    this.renderSkeleton();
    this.init();
    this.setupEvents();
  }

  /**
   * Initializes simulation, resolving logic cards and rendered pills.
   */
  public async init(forceRefresh = false): Promise<void> {
    if (this.initPromise && !forceRefresh) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      resetCounterState();
      this.chosenRandomOptionIds.clear();

      // Determine active branch and run simulation
      await this.runSimulation();
      await this.renderBody();
    })();

    return this.initPromise;
  }

  private async runSimulation(): Promise<void> {
    const branches = this.data.branches;
    if (branches.length === 0) {
      this.pureTextResult = '';
      return;
    }

    // Identify active branch: if there's a condition step, find matching branch, else first branch
    let activeBranchIdx = 0;
    const condBlock = this.data.flow?.blocks.find((b) => b.type === 'condition');
    if (condBlock && isConditionBlock(condBlock.data)) {
      const dummyEl = document.createElement('div');
      const matchedAction = resolveBranchTarget(condBlock.data, dummyEl, undefined, { variables: this.variables });
      if (matchedAction) {
        const found = branches.findIndex((b) => b.action === matchedAction || b.target === matchedAction);
        if (found !== -1) activeBranchIdx = found;
      }
    }

    // Resolve active branch content with real engine for pure text copy
    const activeBranch = branches[activeBranchIdx];
    const targetToResolve = activeBranch.target || (activeBranch.repeatBlock as BranchTarget) || (activeBranch.action as BranchTarget);

    // Track chosen random options in the tree
    this.trackChosenRandomOptions(targetToResolve);

    // Get pure text from engine output
    const engineOutput = await simulateBranchContent(targetToResolve, this.variables, this.flows);
    activeBranch.simulatedContent = engineOutput;

    if (activeBranch.action.format === 'plaintext') {
      this.pureTextResult = engineOutput;
    } else {
      this.pureTextResult = htmlToPlainText(engineOutput);
    }
  }

  /**
   * Scans branch targets to pre-select or pick random options and remember chosen IDs
   */
  private trackChosenRandomOptions(target: BranchTarget): void {
    if (!target) return;
    if (isConditionBlock(target)) {
      target.rules.forEach((r) => this.trackChosenRandomOptions(r.action));
      if (target.elseBranch) this.trackChosenRandomOptions(target.elseBranch);
    } else if (isRandomBlock(target)) {
      const chosenId = (target as any)._lastChosenId || target.options[0]?.id;
      if (chosenId) {
        this.chosenRandomOptionIds.add(chosenId);
      }
      target.options.forEach((o) => this.trackChosenRandomOptions(o.target));
    } else if (isRepeatBlock(target)) {
      this.trackChosenRandomOptions(target.target);
    }
  }

  private renderSkeleton(): void {
    const prefix = this.data.settings.triggerMode === 'exact_match' ? (this.data.settings.exactMatchChar || '/') : '';
    const shortcut = this.data.trigger.shortcut?.trim();
    const shortcutDisplay = shortcut ? `${prefix}${shortcut}` : t('preview.no_shortcut');

    // Count blocks summary
    const blockCount = this.data.branches.length;
    const subText = `${blockCount} ${blockCount === 1 ? 'bloco' : 'blocos'}`;

    this.backdrop.innerHTML = `
      <div class="modal-container modal-container--preview">
        <!-- Header -->
        <div class="preview-header">
          <div class="preview-header-left">
            <div class="preview-header-icon">${ICONS.eye}</div>
            <div class="preview-header-info">
              <div class="preview-header-title-row">
                <h2 class="preview-header-title">${escapeHtml(shortcutDisplay)}</h2>
                <span class="preview-header-badge">${t('preview.root_block')}</span>
              </div>
              <p class="preview-header-sub">${escapeHtml(subText)}</p>
            </div>
          </div>
          <div class="preview-header-right">
            <button type="button" class="preview-header-btn preview-refresh-btn" title="Simular novamente">${ICONS.refresh}</button>
            <button type="button" class="preview-header-btn preview-close-btn modal-close" title="${t('common.close')}">${ICONS.close}</button>
          </div>
        </div>

        <!-- 2 Columns Body -->
        <div class="preview-body-columns">
          <!-- LEFT COLUMN: Block Tree -->
          <div class="preview-tree-col">
            <div class="preview-tree-header">
              <span class="preview-tree-title">${t('preview.tree_title')}</span>
              <span class="preview-tree-stats" id="preview-tree-stats-badge"></span>
            </div>
            <div class="preview-tree-list" id="preview-tree-list-container">
              <div class="preview-content preview-content--loading" style="color:var(--text-muted); font-size:12px; font-style:italic;">...</div>
            </div>
          </div>

          <!-- RIGHT COLUMN: Rendered Preview -->
          <div class="preview-render-col">
            <div class="preview-render-header">
              <div class="preview-render-title">${t('preview.rendered_title')}</div>
              <div class="preview-render-sub">${t('preview.rendered_subtitle')}</div>
            </div>
            <div class="preview-render-body">
              <div class="preview-render-output" id="preview-render-output-container">
                <div class="preview-content preview-content--loading" style="color:var(--text-muted); font-size:12px; font-style:italic;">...</div>
              </div>
            </div>
            <!-- Footer -->
            <div class="preview-footer">
              <span class="preview-footer-note">${t('preview.footer_note')}</span>
              <div class="preview-footer-actions">
                <button type="button" class="preview-footer-btn preview-close-btn-bottom">${t('common.close')}</button>
                <button type="button" class="preview-copy-all-btn">
                  ${ICONS.copy} <span>${t('preview.copy_result')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private async renderBody(): Promise<void> {
    const statsBadge = this.backdrop.querySelector('#preview-tree-stats-badge');
    const treeContainer = this.backdrop.querySelector('#preview-tree-list-container');
    const renderContainer = this.backdrop.querySelector('#preview-render-output-container');

    if (!treeContainer || !renderContainer) return;

    // Build tree column
    const { cardsHtml, typesCount } = this.buildTreeCards();
    if (statsBadge) {
      statsBadge.textContent = t('preview.types_count', { count: typesCount });
    }
    treeContainer.innerHTML = cardsHtml;

    // Build rendered preview column
    renderContainer.innerHTML = await this.buildRenderedPreviewHtml();

    this.attachDynamicListeners();
  }

  /**
   * Generates logic cards and legend for the left column
   */
  private buildTreeCards(): { cardsHtml: string; typesCount: number } {
    const typesSet = new Set<string>();
    const cards: string[] = [];

    // 1. Condition Block card
    const condBlock = this.data.flow?.blocks.find((b) => b.type === 'condition');
    const condData = condBlock && isConditionBlock(condBlock.data) ? (condBlock.data as IConditionBlock) : undefined;
    const hasBranchTags = this.data.branches.some((b) => b.tag);

    if (condData || hasBranchTags) {
      typesSet.add('condition');
      let rulesHtml = '';

      if (condData) {
        rulesHtml = condData.rules
          .map((r: ConditionRule, idx: number) => {
            const tag = idx === 0 ? 'SE' : 'SENÃO SE';
            const desc = describeConditionRule(r);
            return `<div class="preview-card-rule"><span class="text-app-dimmer">${tag}</span> ${escapeHtml(desc)}</div>`;
          })
          .join('');

        if (condData.elseBranch) {
          rulesHtml += `<div class="preview-card-else">${t('preview.branch_else_note')}</div>`;
        }
      } else {
        rulesHtml = this.data.branches
          .filter((b) => b.tag)
          .map((b) => `<div class="preview-card-rule"><span class="text-app-dimmer">${escapeHtml(b.tag || '')}</span> ${escapeHtml(b.ruleDescription || '')}</div>`)
          .join('');
      }

      cards.push(`
        <div class="preview-tree-card preview-card--condition">
          <div class="preview-card-header">
            <span class="preview-card-icon">${ICONS.codeBranch}</span>
            <span class="preview-card-title">ConditionBlock</span>
          </div>
          <div class="preview-card-body">
            ${rulesHtml}
          </div>
        </div>
      `);
    }

    // 2. Random Block cards
    const randomBlocks: IRandomBlock[] = [];
    const findRandom = (target?: BranchTarget) => {
      if (!target) return;
      if (isRandomBlock(target)) randomBlocks.push(target);
      if (isConditionBlock(target)) {
        target.rules.forEach((r) => findRandom(r.action));
        if (target.elseBranch) findRandom(target.elseBranch);
      }
      if (isRepeatBlock(target)) findRandom(target.target);
    };

    if (this.data.flow) {
      this.data.flow.blocks.forEach((b) => findRandom(b.data as BranchTarget));
    }
    this.data.branches.forEach((b) => findRandom(b.target || b.action));

    // Deduplicate RandomBlocks by instance/options
    const uniqueRandom = Array.from(new Set(randomBlocks));
    uniqueRandom.forEach((rb) => {
      typesSet.add('random');
      const optionsHtml = rb.options
        .map((opt, i) => {
          const isChosen = this.chosenRandomOptionIds.has(opt.id) || i === 0;
          const optLabel = isRepeatBlock(opt.target) ? 'RepeatBlock' : isActionBlock(opt.target) ? (opt.target.content ? htmlToPlainText(opt.target.content).slice(0, 20) || `Opção ${i + 1}` : `Opção ${i + 1}`) : `Opção ${i + 1}`;
          return `
            <div class="preview-card-option">
              <span class="text-app-muted">${Math.round(opt.weight)}% — ${escapeHtml(optLabel)}</span>
              ${
                isChosen
                  ? `<span class="preview-card-chosen-tag"><span class="preview-chosen-dot"></span>${t('preview.chosen')}</span>`
                  : `<span class="text-app-dimmer">·</span>`
              }
            </div>
          `;
        })
        .join('');

      cards.push(`
        <div class="preview-tree-card preview-card--random">
          <div class="preview-card-header">
            <span class="preview-card-icon">${ICONS.dice}</span>
            <span class="preview-card-title">RandomBlock</span>
            <span class="preview-card-badge">${t('preview.branches_count', { count: rb.options.length })}</span>
          </div>
          <div class="preview-card-body">
            ${optionsHtml}
          </div>
        </div>
      `);
    });

    // 3. Repeat Block cards
    const repeatBlocks: IRepeatBlock[] = [];
    const findRepeat = (target?: BranchTarget) => {
      if (!target) return;
      if (isRepeatBlock(target)) repeatBlocks.push(target);
      if (isConditionBlock(target)) {
        target.rules.forEach((r) => findRepeat(r.action));
        if (target.elseBranch) findRepeat(target.elseBranch);
      }
      if (isRandomBlock(target)) {
        target.options.forEach((o) => findRepeat(o.target));
      }
    };

    if (this.data.flow) {
      this.data.flow.blocks.forEach((b) => findRepeat(b.data as BranchTarget));
    }
    this.data.branches.forEach((b) => {
      if (b.repeatBlock) repeatBlocks.push(b.repeatBlock);
      findRepeat(b.target);
    });

    const uniqueRepeat = Array.from(new Set(repeatBlocks));
    uniqueRepeat.forEach((rb) => {
      typesSet.add('repeat');
      cards.push(`
        <div class="preview-tree-card preview-card--repeat">
          <div class="preview-card-header">
            <span class="preview-card-icon">${ICONS.repeat}</span>
            <span class="preview-card-title">RepeatBlock</span>
          </div>
          <div class="preview-card-body">
            Repetir <span class="text-app-text">${rb.count}×</span> · separador: <span class="text-app-text">${escapeHtml(formatSeparator(rb.separator))}</span>
          </div>
        </div>
      `);
    });

    // 4. Default Action Block card if no special logic blocks
    if (typesSet.size === 0) {
      typesSet.add('action');
      cards.push(`
        <div class="preview-tree-card preview-card--action">
          <div class="preview-card-header">
            <span class="preview-card-icon">${ICONS.fileText}</span>
            <span class="preview-card-title">ActionBlock</span>
          </div>
          <div class="preview-card-body">
            <span class="text-app-muted">Ação principal do fluxo</span>
          </div>
        </div>
      `);
    }

    // Legend
    const legendHtml = `
      <div class="preview-tree-legend">
        <div class="preview-legend-item"><span class="preview-legend-dot preview-legend-dot--condition"></span>ConditionBlock</div>
        <div class="preview-legend-item"><span class="preview-legend-dot preview-legend-dot--random"></span>RandomBlock</div>
        <div class="preview-legend-item"><span class="preview-legend-dot preview-legend-dot--repeat"></span>RepeatBlock</div>
        <div class="preview-legend-item"><span class="preview-legend-dot preview-legend-dot--action"></span>ActionBlock</div>
      </div>
    `;

    return {
      cardsHtml: cards.join('') + legendHtml,
      typesCount: typesSet.size,
    };
  }

  /**
   * Formats the rendered preview HTML for the right column with all styled pills
   */
  private async buildRenderedPreviewHtml(): Promise<string> {
    const branches = this.data.branches;
    if (branches.length === 0) {
      return `<div class="preview-content preview-content--empty">${t('preview.empty_content')}</div>`;
    }

    // Determine active branch index
    let activeIdx = 0;
    const condBlock = this.data.flow?.blocks.find((b) => b.type === 'condition');
    if (condBlock && isConditionBlock(condBlock.data)) {
      const dummyEl = document.createElement('div');
      const matched = resolveBranchTarget(condBlock.data, dummyEl, undefined, { variables: this.variables });
      if (matched) {
        const found = branches.findIndex((b) => b.action === matched || b.target === matched);
        if (found !== -1) activeIdx = found;
      }
    }

    resetCounterState();
    const activeBranch = branches[activeIdx];
    const targetToResolve = activeBranch.target || (activeBranch.repeatBlock as BranchTarget) || (activeBranch.action as BranchTarget);

    const activeHtml = await this.formatBranchTargetHtml(targetToResolve);

    // If there are multiple condition branches, render active branch and struck-through inactive branches
    const hasMultipleBranches = branches.length > 1 && branches.some((b) => b.tag);
    if (!hasMultipleBranches) {
      return activeHtml.trim() ? activeHtml : `<div class="preview-content preview-content--empty">${t('preview.empty_content')}</div>`;
    }

    const htmlParts: string[] = [];
    branches.forEach((b, idx) => {
      if (idx === activeIdx) {
        htmlParts.push(`<div class="preview-branch-active">${activeHtml}</div>`);
      } else {
        const desc = b.ruleDescription || (b.tag === t('condition.tag.else') ? 'domínio/condição diferente' : '');
        htmlParts.push(
          `<div class="preview-branch-inactive">[ramo ${escapeHtml(b.tag || 'SENÃO')}${desc ? ': ' + escapeHtml(desc) : ''}]</div>`
        );
      }
    });

    return htmlParts.join('\n');
  }

  /**
   * Formats a BranchTarget into rich HTML with styled pills
   */
  private async formatBranchTargetHtml(target: BranchTarget): Promise<string> {
    const dummyEl = document.createElement('div');
    const leaf = resolveLeaf(target, dummyEl, undefined, { variables: this.variables });
    if (!leaf) return '';

    const container = document.createElement('div');
    container.innerHTML = sanitizeHtml(leaf.content || '');

    // Strip editor UI leak selectors
    container.querySelectorAll(UI_LEAK_SELECTORS).forEach((el) => el.remove());

    const context: ExpansionContext = {
      tabUrl: typeof window !== 'undefined' ? window.location?.href || 'https://example.com' : 'https://example.com',
      tabTitle: typeof document !== 'undefined' ? document.title || 'Page Title' : 'Page Title',
      clipboardHistory: ['Exemplo Clipboard'],
      isSimulation: true,
    };

    // Replace token pills with styled preview pills
    const pillEls = Array.from(container.querySelectorAll('.token-pill'));
    for (const pillEl of pillEls) {
      const token = resolveTokenForPill(pillEl, leaf.tokens || []);
      if (!token) continue;

      if (token.type === 'counter') {
        const val = await expandToken(token, context);
        const span = document.createElement('span');
        span.className = 'preview-pill preview-pill--counter';
        span.title = t('preview.counter_tooltip', { val: val || '1' });
        span.textContent = val || '1';
        pillEl.replaceWith(span);
        continue;
      }

      if (token.type === 'math') {
        const val = await expandToken(token, context);
        const expr = (token.config?.expression as string) || '';
        const span = document.createElement('span');
        span.innerHTML = `<span class="preview-pill preview-pill--math" title="Fórmula: ${escapeHtml(expr)}">${escapeHtml(val || '0')}</span> <span class="preview-math-tag">(${t('preview.calc_label')})</span>`;
        pillEl.replaceWith(...Array.from(span.childNodes));
        continue;
      }

      if (token.type === 'choice') {
        const opts = (token.config?.options as string[]) || [];
        const summary = opts.length ? opts.map((opt, i) => `[${i + 1}] ${opt}`).join(' ') : '[Escolha]';
        const span = document.createElement('span');
        span.className = 'preview-pill preview-pill--choice';
        span.innerHTML = `${ICONS.anglesDown} ${escapeHtml(summary)}`;
        pillEl.replaceWith(span);
        continue;
      }

      if (token.type === 'input') {
        const placeholder =
          (token.config?.placeholder as string) || (token.config?.label as string) || t('preview.input_placeholder');
        const span = document.createElement('span');
        span.className = 'preview-pill preview-pill--input';
        span.textContent = `[${placeholder}]`;
        pillEl.replaceWith(span);
        continue;
      }

      if (token.type === 'date') {
        const val = await expandToken(token, context);
        const span = document.createElement('span');
        span.className = 'preview-pill preview-pill--date';
        span.textContent = val || 'Data';
        pillEl.replaceWith(span);
        continue;
      }

      if (token.type === 'clipboard') {
        const slot = Math.max(1, (token.config?.index as number) || 1);
        const val = await expandToken(token, context);
        const span = document.createElement('span');
        span.className = 'preview-pill preview-pill--clipboard';
        span.textContent = val || t('preview.clipboard_placeholder', { slot });
        pillEl.replaceWith(span);
        continue;
      }

      if (token.type === 'random') {
        const val = await expandToken(token, context);
        const span = document.createElement('span');
        span.className = 'preview-pill preview-pill--random';
        span.title = t('preview.random_sample_hint');
        span.textContent = val || 'Opção';
        pillEl.replaceWith(span);
        continue;
      }

      if (token.type === 'cursor') {
        const span = document.createElement('span');
        span.className = 'preview-pill preview-pill--cursor';
        span.title = t('preview.cursor_hint');
        span.textContent = '⌶ [cursor]';
        pillEl.replaceWith(span);
        continue;
      }

      if (token.type === 'flow_ref') {
        const cfg = (token.config || {}) as FlowRefTokenConfig;
        const targetFlow = (this.flows || []).find((f) => f.id === cfg.flowId);
        if (targetFlow) {
          const subAction = resolveFlowActionBlock(targetFlow, dummyEl, undefined, { variables: this.variables });
          const subHtml = subAction ? await this.formatBranchTargetHtml(subAction) : '';
          const wrap = document.createElement('div');
          wrap.className = 'preview-flowref-wrap';
          wrap.innerHTML = `
            <span class="preview-flowref-label">${t('preview.flow_included_from', { name: escapeHtml(targetFlow.name) })}</span>
            <div class="preview-flowref-card">${subHtml}</div>
          `;
          pillEl.replaceWith(wrap);
        } else {
          pillEl.replaceWith(document.createTextNode(''));
        }
        continue;
      }

      if (token.type === 'url') {
        const span = document.createElement('span');
        span.className = 'preview-pill preview-pill--url';
        span.textContent = context.tabUrl;
        pillEl.replaceWith(span);
        continue;
      }

      if (token.type === 'title') {
        const span = document.createElement('span');
        span.className = 'preview-pill preview-pill--title';
        span.textContent = context.tabTitle;
        pillEl.replaceWith(span);
        continue;
      }

      // Default token fallback
      const val = await expandToken(token, context);
      pillEl.replaceWith(document.createTextNode(val || ''));
    }

    // Format Variables in the HTML output
    let html = container.innerHTML;
    const varMap = new Map((this.variables || []).map((v) => [v.key, v]));

    html = html.replace(/\{\{\s*([A-Za-z0-9_]+)\s*(?:\|\s*([^}]*?)\s*)?\}\}/g, (match, key: string, fallback?: string) => {
      const v = varMap.get(key);
      if (v && v.value !== undefined && v.value.trim() !== '') {
        // Real variable value: solid cyan pill
        return `<span class="preview-pill preview-pill--var" title="Variável: ${escapeHtml(key)}">${escapeHtml(v.value)}</span>`;
      }
      if (fallback !== undefined && fallback.trim() !== '') {
        // Fallback value: dashed amber pill
        return `<span class="preview-pill preview-pill--fallback" title="Variável: ${escapeHtml(key)} (${t('preview.fallback_label')})">${escapeHtml(fallback)} <span class="preview-fallback-tag">(${t('preview.fallback_label')})</span></span>`;
      }
      if (v && v.defaultValue !== undefined && v.defaultValue.trim() !== '') {
        // Default variable value: dashed amber pill
        return `<span class="preview-pill preview-pill--fallback" title="Variável: ${escapeHtml(key)} (${t('preview.fallback_label')})">${escapeHtml(v.defaultValue)} <span class="preview-fallback-tag">(${t('preview.fallback_label')})</span></span>`;
      }
      // Undefined: formatted pill
      return `<span class="preview-pill preview-pill--var font-mono">${escapeHtml(match)}</span>`;
    });

    return html;
  }

  private attachDynamicListeners(): void {
    const copyBtn = this.backdrop.querySelector<HTMLButtonElement>('.preview-copy-all-btn');
    if (copyBtn && !(copyBtn as any)._bound) {
      (copyBtn as any)._bound = true;
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(this.pureTextResult);
          copyBtn.classList.add('copied');
          copyBtn.innerHTML = `${ICONS.check} <span>${t('variables.copied')}</span>`;
          setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.innerHTML = `${ICONS.copy} <span>${t('preview.copy_result')}</span>`;
          }, 2000);
        } catch (err) {
          console.warn('[SOTE] Failed to copy to clipboard:', err);
        }
      });
    }

    const refreshBtn = this.backdrop.querySelector<HTMLButtonElement>('.preview-refresh-btn');
    if (refreshBtn && !(refreshBtn as any)._bound) {
      (refreshBtn as any)._bound = true;
      refreshBtn.addEventListener('click', () => {
        this.init(true);
      });
    }

    this.backdrop.querySelectorAll<HTMLButtonElement>('.preview-close-btn, .preview-close-btn-bottom, .modal-close').forEach((btn) => {
      if (!(btn as any)._bound) {
        (btn as any)._bound = true;
        btn.addEventListener('click', () => this.close());
      }
    });
  }

  private setupEvents(): void {
    this.backdrop.addEventListener('mousedown', (e) => {
      if (e.target === this.backdrop) this.close();
    });

    this.escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.close();
    };
    document.addEventListener('keydown', this.escHandler);

    this.attachDynamicListeners();
  }

  public open(): void {
    document.querySelectorAll('.modal-backdrop').forEach((el) => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    document.body.appendChild(this.backdrop);
  }

  public close(): void {
    document.removeEventListener('keydown', this.escHandler);
    if (this.backdrop.parentNode) {
      this.backdrop.parentNode.removeChild(this.backdrop);
    }
  }
}

function isActionBlock(target: any): target is IActionBlock {
  return target && typeof target.content === 'string';
}

/**
 * Recursively walks a ConditionBlock and flattens it into PreviewBranch entries.
 */
export function collectPreviewBranches(condData: IConditionBlock, pathSoFar: string[] = []): PreviewBranch[] {
  const result: PreviewBranch[] = [];

  condData.rules.forEach((rule: ConditionRule, i: number) => {
    const path = [...pathSoFar, describeConditionRule(rule)];
    const tag = pathSoFar.length === 0 ? (i === 0 ? t('condition.tag.if') : t('condition.tag.elseif')) : t('condition.tag.if');
    result.push(...collectPreviewLeaf(rule.action, tag, path, path));
  });

  if (condData.elseBranch) {
    result.push(...collectPreviewLeaf(
      condData.elseBranch,
      t('condition.tag.else'),
      pathSoFar,
      [...pathSoFar, t('condition.tag.else')],
    ));
  }

  return result;
}

/**
 * Resolves a single branch target for preview: ConditionBlock, RandomBlock, RepeatBlock, or leaf ActionBlock.
 */
export function collectPreviewLeaf(
  target: BranchTarget,
  tag: string,
  leafPath: string[],
  nestedPath: string[],
  currentRepeat?: IRepeatBlock,
): PreviewBranch[] {
  if (isConditionBlock(target)) {
    return collectPreviewBranches(target, nestedPath);
  }
  if (isRandomBlock(target)) {
    const result: PreviewBranch[] = [];
    target.options.forEach((opt, idx) => {
      const label = t('editor.random.preview_option', { n: idx + 1, weight: Math.round(opt.weight) });
      result.push(...collectPreviewLeaf(opt.target, tag, [...leafPath, label], [...nestedPath, label], currentRepeat));
    });
    return result;
  }
  if (isRepeatBlock(target)) {
    const label = t('editor.repeat.preview_label', { count: target.count });
    return collectPreviewLeaf(target.target, tag, [...leafPath, label], [...nestedPath, label], target);
  }
  return [{
    tag,
    ruleDescription: leafPath.length ? leafPath.join(' → ') : undefined,
    action: target as IActionBlock,
    repeatBlock: currentRepeat,
    target: currentRepeat ?? target,
  }];
}

/**
 * Collects all preview branches from any Flow (Condition or Action root).
 */
export function collectFlowPreviewBranches(flow: Flow): PreviewBranch[] {
  const branches: PreviewBranch[] = [];
  const condBlock = flow.blocks.find((b) => b.type === 'condition');

  if (condBlock && condBlock.data) {
    branches.push(...collectPreviewBranches(condBlock.data as IConditionBlock));
  } else {
    const actionBlock = flow.blocks.find((b) => b.type === 'action');
    if (actionBlock && actionBlock.data) {
      branches.push(...collectPreviewLeaf(actionBlock.data as BranchTarget, '', [], []));
    }
  }

  if (branches.length === 0) {
    branches.push({
      action: { format: 'plaintext', content: '', tokens: [] },
      target: { format: 'plaintext', content: '', tokens: [] },
    });
  }

  return branches;
}

/**
 * Opens the PreviewModal for a given Flow, fetching variables, flows, and settings.
 */
export async function openFlowPreviewModal(flow: Flow, settings?: Settings): Promise<PreviewModal> {
  const triggerBlock = flow.blocks.find((b) => b.type === 'trigger');
  const triggerData: ITriggerBlock = (triggerBlock?.data as ITriggerBlock) || {
    shortcut: flow.name.replace(/^\//, ''),
    smartCase: false,
    forceCapitalize: false,
  };

  const branches = collectFlowPreviewBranches(flow);
  let variables: Variable[] = [];
  let flows: Flow[] = [];
  let resolvedSettings: Settings = settings || ({
    triggerMode: 'exact_match',
    exactMatchChar: '/',
    theme: 'dark',
    language: 'pt-BR',
    triggerKeys: [],
    globalEnabled: true,
    blocklist: [],
    commandPaletteShortcut: '',
    analytics: {},
    searchTrigger: { enabled: false, includeFlows: true, domainPrefix: '//', globalPrefix: '///' },
  } as Settings);

  try {
    if (storage?.getVariables) variables = (await storage.getVariables()) || [];
  } catch {}
  try {
    if (storage?.getFlows) flows = (await storage.getFlows()) || [];
  } catch {}
  try {
    if (!settings && storage?.getSettings) {
      const s = await storage.getSettings();
      if (s) resolvedSettings = s;
    }
  } catch {}

  const modal = new PreviewModal({
    trigger: triggerData,
    settings: resolvedSettings,
    branches,
    variables,
    flows,
    flow,
  });

  await modal.init();
  modal.open();
  return modal;
}



