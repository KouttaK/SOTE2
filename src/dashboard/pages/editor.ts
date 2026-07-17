/**
 * src/dashboard/pages/editor.ts — Flow Editor Main Page
 */

import type { Page } from './index.js';
import { browser } from 'wxt/browser';
import { storage } from '../../shared/storage/StorageService.js';
import type { Flow, Block, TriggerBlock as ITriggerBlock, ConditionBlock as IConditionBlock, ActionBlock as IActionBlock, Settings, BranchTarget } from '../../shared/types/index.js';
import { isConditionBlock } from '../../shared/types/index.js';
import { router } from '../router.js';
import { t } from '../../shared/i18n/index.js';
import { TriggerBlock } from '../components/blocks/TriggerBlock.js';
import { ConditionRuleBlock, ConditionElseBlock, describeConditionRule } from '../components/blocks/ConditionBlock.js';
import { ActionBlock } from '../components/blocks/ActionBlock.js';
import { PreviewModal } from '../components/PreviewModal.js';
import type { PreviewBranch } from '../components/PreviewModal.js';
import type { ConditionRule } from '../../shared/types/index.js';
import './editor.css';
import './tokens.css';

/** Escapes HTML-significant characters before interpolating user/page-
 * controlled strings (e.g. a context-menu text selection) into innerHTML. */
function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

const ICONS = {
  eye: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor"><path d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z"/></svg>`,
  save: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V173.3c0-17-6.7-33.3-18.7-45.3L352 50.7C340 38.7 323.7 32 306.7 32H64zm0 96c0-17.7 14.3-32 32-32H288c17.7 0 32 14.3 32 32v64c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V128zM224 288a64 64 0 1 1 0 128 64 64 0 1 1 0-128z"/></svg>`,
  chevronDown: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z"/></svg>`,
  plus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z"/></svg>`,
  minus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M432 256c0 17.7-14.3 32-32 32L48 288c-17.7 0-32-14.3-32-32s14.3-32 32-32l352 0c17.7 0 32 14.3 32 32z"/></svg>`,
  expand: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M32 32C14.3 32 0 46.3 0 64V192c0 17.7 14.3 32 32 32s32-14.3 32-32V96h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H32zM64 320c0-17.7-14.3-32-32-32s-32 14.3-32 32V448c0 17.7 14.3 32 32 32H160c17.7 0 32-14.3 32-32s-14.3-32-32-32H64V320zM320 32c-17.7 0-32 14.3-32 32s14.3 32 32 32h96v96c0 17.7 14.3 32 32 32s32-14.3 32-32V64c0-17.7-14.3-32-32-32H320zM448 320c0-17.7-14.3-32-32-32s-32 14.3-32 32v96H288c-17.7 0-32 14.3-32 32s14.3 32 32 32H416c17.7 0 32-14.3 32-32V320z"/></svg>`,
};

/** Zoom bounds & step for the flow canvas. */
const CANVAS_MIN_ZOOM = 0.4;
const CANVAS_MAX_ZOOM = 1.75;
const CANVAS_ZOOM_STEP = 0.15;

export default class FlowEditorPage implements Page {
  private el!: HTMLElement;
  private currentFlow!: Flow;
  private _isDirty = false;
  private isNew = false;
  private flowId = '';
  private settings!: Settings; // global settings (trigger mode, exact-match prefix char, etc.)

  // Block Instances
  private triggerBlockInst!: TriggerBlock;
  private hasCondition = false;
  private conditionData: IConditionBlock | null = null; // rules[] + optional elseBranch, owned by the editor while a condition step exists
  private actionBlockInst: ActionBlock | null = null; // used only in the linear (no-condition) flow
  // One entry per LEAF ActionBlock instance rendered anywhere in the branch
  // tree (at any nesting depth). `commit()` writes the instance's live data
  // back into its owning rule.action/elseBranch slot — the owner objects
  // are already the real (nested) condition data by reference, so no extra
  // bookkeeping about *where* in the tree a leaf lives is needed here.
  private branchActionInsts: { inst: ActionBlock; commit: () => void }[] = [];

  // Keydown handler reference for removal
  private handleKeyDown!: (e: KeyboardEvent) => void;
  private handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (this._isDirty) {
      // Standard cross-browser way to trigger the native
      // "leave site? changes may not be saved" confirmation dialog.
      e.preventDefault();
      e.returnValue = '';
    }
  };

  // Canvas pan/zoom state
  private canvasZoom = 1;
  private canvasPanX = 0;
  private canvasPanY = 0;
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private panOriginX = 0;
  private panOriginY = 0;
  private canvasPanZoomInited = false;
  private handleCanvasMouseMove!: (e: MouseEvent) => void;
  private handleCanvasMouseUp!: (e: MouseEvent) => void;

  render(): HTMLElement {
    this.el = document.createElement('div');
    this.el.className = 'editor-canvas-wrap';
    this.el.innerHTML = /* html */ `
      <div class="editor-header">
        <div class="editor-status-indicator">
          <span class="status-label">${t('editor.status.inactive')}</span>
          <div class="status-toggle" id="flow-status-toggle"></div>
          <span class="status-label" style="color: #d4d4d4;">${t('editor.status.active')}</span>
        </div>

        <div class="editor-folder-select" style="margin-left: 20px; display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 13px; color: var(--neutral-400);">${t('editor.folder_label')}</span>
          <select id="flow-folder" style="background: var(--neutral-800); color: white; border: 1px solid var(--neutral-700); border-radius: 4px; padding: 4px 8px; font-size: 13px; outline: none;">
            <option value="">${t('flows.folder.none')}</option>
          </select>
        </div>
        
        <div class="editor-actions">
          <button class="btn-preview">${ICONS.eye} <span class="btn-preview-label">${t('preview.title')}</span></button>
          <button class="btn-save" id="btn-save-flow">${ICONS.save} <span id="save-label">${t('editor.saveFlow')}</span></button>
        </div>
      </div>

      <div class="editor-canvas-bg" id="editor-canvas-bg">
        <div class="canvas-viewport" id="canvas-viewport">
          <div class="dot-grid"></div>

          <div class="node-flow" id="node-flow-container">
            <!-- Blocks injected here -->
          </div>
        </div>

        <div class="canvas-controls">
          <button class="canvas-ctrl-btn" id="canvas-zoom-out" title="Diminuir zoom">${ICONS.minus}</button>
          <span class="canvas-zoom-label" id="canvas-zoom-label">100%</span>
          <button class="canvas-ctrl-btn" id="canvas-zoom-in" title="Aumentar zoom">${ICONS.plus}</button>
          <div class="canvas-ctrl-divider"></div>
          <button class="canvas-ctrl-btn" id="canvas-zoom-reset" title="Ajustar à tela">${ICONS.expand}</button>
        </div>
      </div>
    `;
    return this.el;
  }

  async mount(params?: Record<string, string>): Promise<void> {
    this.flowId = params?.id || 'new';
    this.isNew = this.flowId === 'new';

    let prefilledFromSelection = false;
    if (this.isNew) {
      this.currentFlow = this.createEmptyFlow();
      prefilledFromSelection = await this.applyPendingSelection();
    } else {
      const flow = await storage.getFlow(this.flowId);
      if (!flow) {
        alert('Flow not found.');
        router.navigate('/flows');
        return;
      }
      this.currentFlow = JSON.parse(JSON.stringify(flow)); // deep clone
    }

    this._isDirty = false;
    this.settings = await storage.getSettings();
    this.renderFlow();
    this.updateStatusToggle();
    // Prefilled from a context-menu text selection: the draft already has
    // real content that would be lost on an accidental navigation away, so
    // treat it as dirty right away (same protection a manual edit gets).
    if (prefilledFromSelection) this.markDirty();

    // Populate folders
    const folders = await storage.getFolders();
    const folderSelect = this.el.querySelector('#flow-folder') as HTMLSelectElement;
    folders.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = f.name;
      folderSelect.appendChild(opt);
    });
    if (this.currentFlow.folderId) {
      folderSelect.value = this.currentFlow.folderId;
    }
    folderSelect.addEventListener('change', () => this.markDirty());

    // Event listeners
    this.el.querySelector('#flow-status-toggle')!.addEventListener('click', () => {
      this.currentFlow.enabled = !this.currentFlow.enabled;
      this.updateStatusToggle();
      this.markDirty();
    });

    this.el.querySelector('#btn-save-flow')!.addEventListener('click', () => this.saveFlow());
    this.el.querySelector('.btn-preview')!.addEventListener('click', () => this.openPreview());

    // Canvas pan & zoom (drag to move around, scroll/buttons to zoom)
    this.initCanvasPanZoom();

    // Ctrl+S
    this.handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.saveFlow();
      }
    };
    window.addEventListener('keydown', this.handleKeyDown);

    // Warns before closing the tab / refreshing / navigating to another
    // site while there are unsaved changes. Navigation *within* the
    // dashboard (sidebar links, Create New Flow) is handled separately by
    // the shell, which checks isDirty()/saveFlow() before switching pages.
    window.addEventListener('beforeunload', this.handleBeforeUnload);
  }

  unmount(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    if (this.handleCanvasMouseMove) window.removeEventListener('mousemove', this.handleCanvasMouseMove);
    if (this.handleCanvasMouseUp) window.removeEventListener('mouseup', this.handleCanvasMouseUp);
  }

  /** Public accessor so the shell can check for unsaved edits (e.g. before starting a new flow). */
  isDirty(): boolean {
    return this._isDirty;
  }

  // ---------------------------------------------------------------------------
  // Data Flow
  // ---------------------------------------------------------------------------

  /**
   * Consumes the one-shot "selected text" handoff left by the
   * "Criar atalho com a seleção" context menu item (see background/index.ts).
   * Pre-fills the new flow's name and action content with it, then removes
   * the key immediately so it's never re-applied (e.g. if the user later
   * navigates back to "/editor/new" on their own).
   */
  private async applyPendingSelection(): Promise<boolean> {
    const PENDING_SELECTION_KEY = '__sote_pending_selection__';
    try {
      const raw = await browser.storage.local.get(PENDING_SELECTION_KEY);
      const text = raw[PENDING_SELECTION_KEY];
      if (typeof text !== 'string' || !text.trim()) return false;

      await browser.storage.local.remove(PENDING_SELECTION_KEY);

      const actionBlock = this.currentFlow.blocks.find((b) => b.type === 'action');
      if (actionBlock) {
        (actionBlock.data as IActionBlock).content = escapeHtml(text);
      }
      this.currentFlow.name = text.length > 40 ? `${text.slice(0, 40)}…` : text;
      return true;
    } catch (err) {
      console.error('[SOTE] Failed to apply pending selection:', err);
      return false;
    }
  }

  private createEmptyFlow(): Flow {
    return {
      id: crypto.randomUUID(),
      name: 'New Flow',
      tags: [],
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      stats: { usageCount: 0, keysSaved: 0 },
      blocks: [
        { id: crypto.randomUUID(), type: 'trigger', data: { shortcut: '', mode: 'trigger', smartCase: true, forceCapitalize: false } as ITriggerBlock },
        { id: crypto.randomUUID(), type: 'action', data: { format: 'richtext', content: '', tokens: [] } as IActionBlock }
      ]
    };
  }

  private markDirty() {
    this._isDirty = true;
    const saveLabel = this.el.querySelector('#save-label')!;
    saveLabel.textContent = t('editor.saveFlow') + ' *';
    const btn = this.el.querySelector('#btn-save-flow')!;
    btn.classList.add('dirty');
  }

  private clearDirty() {
    this._isDirty = false;
    const saveLabel = this.el.querySelector('#save-label')!;
    saveLabel.textContent = t('editor.saved_label');
    setTimeout(() => {
      if (!this._isDirty) saveLabel.textContent = t('editor.saveFlow');
    }, 2000);
  }

  /**
   * Shows a read-only preview of exactly what this flow will type: the
   * trigger shortcut, and — for each branch (or the single linear action,
   * if there's no condition step) — the rule summary and rendered content.
   * Pulls straight from the live block instances so it always reflects
   * unsaved edits, same as saveFlow() does.
   */
  private async openPreview() {
    const triggerData = this.triggerBlockInst.getData();
    const branches: PreviewBranch[] = [];

    if (this.hasCondition && this.conditionData) {
      // ActionBlock instances mutate the same data object passed to them
      // in place, so rule.action / elseBranch already reflect any live
      // unsaved edits — this walk can read straight from conditionData,
      // recursing into nested conditions until it reaches a leaf action.
      branches.push(...this.collectPreviewBranches(this.conditionData));
    } else if (this.actionBlockInst) {
      branches.push({ action: this.actionBlockInst.getData() });
    }

    // Fetched fresh on every open so a variable created/edited on the
    // Variables page shows up immediately, same as the runtime {{KEY}}
    // resolution in content.ts.
    const variables = await storage.getVariables();

    new PreviewModal({ trigger: triggerData, settings: this.settings, branches, variables }).open();
  }

  /**
   * Walks a (possibly nested) ConditionBlock and flattens it into one
   * PreviewBranch per leaf action, building a "SE X → SENÃO SE Y → ..."
   * path description as it descends so nested conditions are still
   * legible in the flat preview list.
   */
  private collectPreviewBranches(condData: IConditionBlock, pathSoFar: string[] = []): PreviewBranch[] {
    const result: PreviewBranch[] = [];

    condData.rules.forEach((rule: ConditionRule, i: number) => {
      const path = [...pathSoFar, describeConditionRule(rule)];
      if (isConditionBlock(rule.action)) {
        result.push(...this.collectPreviewBranches(rule.action, path));
      } else {
        result.push({
          tag: pathSoFar.length === 0 ? (i === 0 ? t('condition.tag.if') : t('condition.tag.elseif')) : t('condition.tag.if'),
          ruleDescription: path.join(' → '),
          action: rule.action as IActionBlock,
        });
      }
    });

    if (condData.elseBranch) {
      if (isConditionBlock(condData.elseBranch)) {
        result.push(...this.collectPreviewBranches(condData.elseBranch, [...pathSoFar, t('condition.tag.else')]));
      } else {
        result.push({
          tag: t('condition.tag.else'),
          ruleDescription: pathSoFar.length ? pathSoFar.join(' → ') : undefined,
          action: condData.elseBranch as IActionBlock,
        });
      }
    }

    return result;
  }

  /**
   * Saves the current flow. Returns true if the save actually completed
   * (used by the shell to decide whether it's safe to navigate away, e.g.
   * when starting a new flow from an unsaved one).
   */
  async saveFlow(): Promise<boolean> {
    // Collect data from instances
    const triggerData = this.triggerBlockInst.getData();
    const condData = this.hasCondition ? this.conditionData : null;

    if (!triggerData.shortcut.trim()) {
      alert('Trigger shortcut cannot be empty.');
      return false;
    }

    // Name is just the shortcut
    this.currentFlow.name = `/${triggerData.shortcut}`;
    
    // Folder
    const folderSelect = this.el.querySelector('#flow-folder') as HTMLSelectElement;
    this.currentFlow.folderId = folderSelect.value || undefined;

    const blocks: Block[] = [];
    blocks.push({ id: crypto.randomUUID(), type: 'trigger', data: triggerData });
    
    if (condData) {
      // Every leaf ActionBlock rendered in the branch tree (at any nesting
      // depth) has its own dedicated instance — pull each one's data back
      // into its owning rule.action/elseBranch slot before persisting.
      this.branchActionInsts.forEach(({ commit }) => commit());
      blocks.push({ id: crypto.randomUUID(), type: 'condition', data: condData });
    } else {
      const actionData = this.actionBlockInst!.getData();
      blocks.push({ id: crypto.randomUUID(), type: 'action', data: actionData });
    }

    this.currentFlow.blocks = blocks;
    this.currentFlow.updatedAt = Date.now();

    await storage.saveFlow(this.currentFlow);
    this.clearDirty();
    if (this.isNew) {
      // Keep the address bar in sync with the real id now that it's saved,
      // so "Create New Flow" (and refreshes) don't get confused by a stale
      // "/editor/new" URL still pointing at what is now a saved flow.
      this.flowId = this.currentFlow.id;
      router.replace(`/editor/${this.currentFlow.id}`);
    }
    this.isNew = false;
    return true;
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  private renderFlow() {
    const container = this.el.querySelector('#node-flow-container')!;
    container.innerHTML = '';

    // Step Counter
    const badge = document.createElement('div');
    badge.className = 'flow-step-badge';
    badge.innerHTML = t('editor.flow_summary', {
      count: this.currentFlow.blocks.length,
      status: this.isNew ? t('editor.status.not_saved') : t('editor.status.saved_recently'),
    });
    container.appendChild(badge);

    // 1. Trigger
    const triggerBlockData = this.currentFlow.blocks.find(b => b.type === 'trigger')?.data as ITriggerBlock;
    this.triggerBlockInst = new TriggerBlock(triggerBlockData, () => this.markDirty(), this.settings);
    container.appendChild(this.triggerBlockInst.getElement());

    // 2. Condition (if exists) — each Se / Senão Se / Senão is its own
    // standalone block+column, built entirely inside renderBranches().
    const condBlock = this.currentFlow.blocks.find(b => b.type === 'condition');
    if (condBlock) {
      this.hasCondition = true;
      this.conditionData = condBlock.data as IConditionBlock;
      if (!this.conditionData.rules || this.conditionData.rules.length === 0) {
        this.conditionData.rules = [{ type: 'domain', operator: 'contains', value: '', action: { format: 'plaintext', content: '', tokens: [] } }];
      }
      container.appendChild(this.createConnector());
      this.renderBranches(container);
      return;
    }
    this.hasCondition = false;
    this.conditionData = null;

    // 3. Main Action (linear flow, no condition)
    container.appendChild(this.createConnector());
    const actionBlockData = this.currentFlow.blocks.find(b => b.type === 'action')?.data as IActionBlock;
    this.actionBlockInst = new ActionBlock(actionBlockData, () => this.markDirty());
    container.appendChild(this.actionBlockInst.getElement());

    // 4. Add Step (Condition)
    container.appendChild(this.createConnector());
    const addWrap = document.createElement('div');
    addWrap.className = 'add-step-wrap';
    addWrap.innerHTML = `<button class="add-step-btn">${ICONS.plus} ${t('editor.condition.add')}</button>`;
    addWrap.querySelector('button')!.addEventListener('click', () => {
      // We mutate the flow to add a condition block and re-render
      this.currentFlow.blocks.push({ id: crypto.randomUUID(), type: 'condition', data: { rules: [] } as IConditionBlock });
      this.markDirty();
      this.renderFlow();
    });
    container.appendChild(addWrap);
  }

  /**
   * Renders everything downstream of the trigger connector when a
   * condition step exists: one column per branch (Se / Senão Se / Senão),
   * each with its OWN condition card (ConditionRuleBlock or
   * ConditionElseBlock) followed by its own connector and dedicated Action
   * block — matching the reference design where every condition is a
   * distinct visual block, not grouped inside a shared card.
   */
  private renderBranches(container: Element) {
    if (!this.hasCondition || !this.conditionData) return;

    // Remove everything previously rendered after the trigger's connector
    // (i.e. re-render the whole branch section from scratch).
    const trigEl = this.triggerBlockInst.getElement();
    let node = trigEl.nextSibling; // the connector right after the trigger
    node = node?.nextSibling ?? null; // first node after that connector
    while (node) {
      const next = node.nextSibling;
      container.removeChild(node);
      node = next;
    }

    this.branchActionInsts = [];

    const removeConditionEntirely = () => {
      this.hasCondition = false;
      this.conditionData = null;
      // Actually remove the condition block from the flow's data — without
      // this, renderFlow() re-derives hasCondition by looking it up in
      // currentFlow.blocks again, finds it still there, and the condition
      // section instantly reappears, making the remove button look broken.
      this.currentFlow.blocks = this.currentFlow.blocks.filter(b => b.type !== 'condition');
      this.markDirty();
      this.renderFlow();
    };

    // A structural change anywhere in the branch tree (add/remove a rule,
    // add/remove Else, convert a leaf into a nested condition or back)
    // re-renders the *entire* branch section from currentFlow's live data,
    // same as the top-level-only version used to — simplest correct thing
    // to do given branches can now be arbitrarily deep.
    const rebuild = () => {
      this.markDirty();
      this.renderBranches(container);
    };

    this.renderConditionFanout(container, this.conditionData, rebuild, removeConditionEntirely);
  }

  /**
   * Renders one level of a Se / Senão Se / Senão fan-out into `parentEl`:
   * one column per branch, each with its own condition card followed by
   * whatever that branch leads to — a plain Action block, or (recursively)
   * another nested fan-out, when `renderBranchTarget` finds the branch has
   * been converted into a nested condition.
   *
   * `onRemoveThisFanout` is what runs when the *only* remaining rule in
   * this particular fan-out is removed: at the top level that removes the
   * condition step entirely; for a nested fan-out it instead collapses
   * the nesting back into a plain Action block (see `renderBranchTarget`).
   */
  private renderConditionFanout(
    parentEl: Element,
    condData: IConditionBlock,
    rebuild: () => void,
    onRemoveThisFanout: () => void,
  ) {
    if (!condData.rules || condData.rules.length === 0) {
      condData.rules = [{ type: 'domain', operator: 'contains', value: '', action: { format: 'plaintext', content: '', tokens: [] } }];
    }

    const addSenaoSe = () => {
      condData.rules.push({ type: 'domain', operator: 'contains', value: '', action: { format: 'plaintext', content: '', tokens: [] } });
      rebuild();
    };
    const addElse = () => {
      condData.elseBranch = { format: 'plaintext', content: '', tokens: [] };
      rebuild();
    };

    const fanWrap = document.createElement('div');
    fanWrap.className = 'branch-fanout';
    const row = document.createElement('div');
    row.className = 'branch-row';

    const isOnlyBranch = condData.rules.length === 1 && !condData.elseBranch;

    condData.rules.forEach((rule, i) => {
      const isLastRule = i === condData.rules.length - 1;
      const col = document.createElement('div');
      col.className = 'branch-col';

      const ruleCard = new ConditionRuleBlock(rule, {
        label: i === 0 ? t('condition.tag.if') : t('condition.tag.elseif'),
        onChange: () => this.markDirty(),
        onRemove: () => {
          if (isOnlyBranch) {
            onRemoveThisFanout();
          } else {
            condData.rules.splice(i, 1);
            rebuild();
          }
        },
        onAddSenaoSe: isLastRule ? addSenaoSe : undefined,
        onAddElse: (isLastRule && !condData.elseBranch) ? addElse : undefined,
      });
      col.appendChild(ruleCard.getElement());
      col.appendChild(this.createConnector());

      this.renderBranchTarget(
        col,
        () => rule.action,
        (target) => { rule.action = target; },
        rebuild,
        false, // rule branches: use the AND/OR criteria group inside ConditionRuleBlock instead
      );

      row.appendChild(col);
    });

    if (condData.elseBranch) {
      const col = document.createElement('div');
      col.className = 'branch-col';

      const elseCard = new ConditionElseBlock({
        onRemove: () => {
          condData.elseBranch = undefined;
          rebuild();
        },
      });
      col.appendChild(elseCard.getElement());
      col.appendChild(this.createConnector());

      this.renderBranchTarget(
        col,
        () => condData.elseBranch!,
        (target) => { condData.elseBranch = target; },
        rebuild,
        true, // Senão has no rule of its own to attach AND/OR criteria to,
              // so nesting a further Se/Senão Se/Senão inside it remains
              // the only way to add conditioning after an Else.
      );

      row.appendChild(col);
    }

    fanWrap.appendChild(row);
    parentEl.appendChild(fanWrap);
  }

  /**
   * Renders whatever a single branch (a rule's `action`, or an
   * `elseBranch`) leads to, into `col`:
   *  - a nested ConditionBlock → its own recursive fan-out, one level
   *    deeper, with a way to collapse it back into a plain action; or
   *  - a plain leaf ActionBlock → the normal Action editor, with an
   *    affordance to convert it into a nested condition instead.
   *
   * `getTarget`/`setTarget` read and replace whatever this branch
   * currently points to (owned by the caller's rule/elseBranch slot).
   */
  private renderBranchTarget(
    col: HTMLElement,
    getTarget: () => BranchTarget,
    setTarget: (target: BranchTarget) => void,
    rebuild: () => void,
    allowNestedNew: boolean,
  ) {
    const target = getTarget();

    if (isConditionBlock(target)) {
      const nestedWrap = document.createElement('div');
      nestedWrap.className = 'branch-nested-wrap';

      const nestedHeader = document.createElement('div');
      nestedHeader.className = 'branch-nested-header';
      nestedHeader.innerHTML = `
        <span class="branch-nested-badge">${ICONS.plus} ${t('condition.nested.badge')}</span>
        <button type="button" class="branch-nested-remove" title="${t('condition.nested.remove')}">${ICONS.minus}</button>
      `;
      nestedHeader.querySelector('.branch-nested-remove')!.addEventListener('click', () => {
        if (confirm(t('condition.confirm.remove_nested'))) {
          setTarget({ format: 'plaintext', content: '', tokens: [] });
          rebuild();
        }
      });
      nestedWrap.appendChild(nestedHeader);

      col.appendChild(nestedWrap);
      this.renderConditionFanout(nestedWrap, target, rebuild, () => {
        // The only rule in this nested condition was removed: collapse
        // the nesting back into a single plain (empty) action.
        setTarget({ format: 'plaintext', content: '', tokens: [] });
        rebuild();
      });
      return;
    }

    const actionInst = new ActionBlock(target, () => this.markDirty());
    this.branchActionInsts.push({ inst: actionInst, commit: () => setTarget(actionInst.getData()) });
    col.appendChild(actionInst.getElement());

    // Old saved flows may already have a nested ConditionBlock here (from
    // before this redesign) — those keep rendering via the recursive
    // fan-out above. For a still-plain leaf action, only the Else branch
    // still offers converting it into a further nested condition: a rule
    // branch's own AND/OR criteria group (in ConditionRuleBlock) covers
    // that need now, and does it more legibly.
    if (!allowNestedNew) return;

    const nestWrap = document.createElement('div');
    nestWrap.className = 'add-nested-condition-wrap';
    nestWrap.innerHTML = `<button type="button" class="add-nested-condition-btn">${ICONS.plus} ${t('editor.condition.add_nested')}</button>`;
    nestWrap.querySelector('button')!.addEventListener('click', () => {
      setTarget({ rules: [{ type: 'domain', operator: 'contains', value: '', action: { format: 'plaintext', content: '', tokens: [] } }] });
      rebuild();
    });
    col.appendChild(nestWrap);
  }

  private createConnector(): HTMLElement {
    const conn = document.createElement('div');
    conn.className = 'connector';
    conn.innerHTML = `
      <div class="connector-line"></div>
      <div class="connector-dot">${ICONS.chevronDown}</div>
      <div class="connector-line"></div>
    `;
    return conn;
  }

  // ---------------------------------------------------------------------------
  // Canvas Pan & Zoom
  // ---------------------------------------------------------------------------

  /**
   * Wires up dragging (pan) and mouse-wheel / button zoom on the flow
   * canvas, so flows with many conditions/branches can be fully explored
   * even when the fanned-out branches are wider than the viewport.
   */
  private initCanvasPanZoom() {
    if (this.canvasPanZoomInited) return; // avoid double-binding across mounts
    this.canvasPanZoomInited = true;

    const canvas = this.el.querySelector('#editor-canvas-bg') as HTMLElement;
    const viewport = this.el.querySelector('#canvas-viewport') as HTMLElement;
    if (!canvas || !viewport) return;

    const zoomInBtn = this.el.querySelector('#canvas-zoom-in') as HTMLElement;
    const zoomOutBtn = this.el.querySelector('#canvas-zoom-out') as HTMLElement;
    const zoomResetBtn = this.el.querySelector('#canvas-zoom-reset') as HTMLElement;

    this.applyCanvasTransform();

    // ── Drag to pan ──
    // Ignore drags that start on interactive elements (inputs, buttons,
    // selects, block cards, etc.) so block editing still works normally;
    // only dragging the empty canvas background pans the view.
    canvas.addEventListener('mousedown', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.block-card, button, select, input, textarea, .block-menu')) return;
      if (e.button !== 0) return;

      this.isPanning = true;
      this.panStartX = e.clientX;
      this.panStartY = e.clientY;
      this.panOriginX = this.canvasPanX;
      this.panOriginY = this.canvasPanY;
      canvas.classList.add('is-panning');
      e.preventDefault();
    });

    this.handleCanvasMouseMove = (e: MouseEvent) => {
      if (!this.isPanning) return;
      this.canvasPanX = this.panOriginX + (e.clientX - this.panStartX);
      this.canvasPanY = this.panOriginY + (e.clientY - this.panStartY);
      this.applyCanvasTransform();
    };
    this.handleCanvasMouseUp = () => {
      if (!this.isPanning) return;
      this.isPanning = false;
      canvas.classList.remove('is-panning');
    };
    window.addEventListener('mousemove', this.handleCanvasMouseMove);
    window.addEventListener('mouseup', this.handleCanvasMouseUp);

    // ── Wheel to zoom (zooms toward the cursor position) ──
    canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const direction = e.deltaY > 0 ? -1 : 1;
      this.zoomCanvasBy(direction * CANVAS_ZOOM_STEP, cursorX, cursorY);
    }, { passive: false });

    // ── Buttons ──
    zoomInBtn?.addEventListener('click', () => {
      const rect = canvas.getBoundingClientRect();
      this.zoomCanvasBy(CANVAS_ZOOM_STEP, rect.width / 2, rect.height / 2);
    });
    zoomOutBtn?.addEventListener('click', () => {
      const rect = canvas.getBoundingClientRect();
      this.zoomCanvasBy(-CANVAS_ZOOM_STEP, rect.width / 2, rect.height / 2);
    });
    zoomResetBtn?.addEventListener('click', () => this.resetCanvasView());
  }

  /**
   * Adjusts zoom by `delta`, keeping the point under (cursorX, cursorY)
   * (relative to the canvas viewport) visually fixed, so zooming feels
   * anchored to the mouse instead of jumping around.
   */
  private zoomCanvasBy(delta: number, cursorX: number, cursorY: number) {
    const oldZoom = this.canvasZoom;
    const newZoom = Math.min(CANVAS_MAX_ZOOM, Math.max(CANVAS_MIN_ZOOM, +(oldZoom + delta).toFixed(2)));
    if (newZoom === oldZoom) return;

    // Keep the point under the cursor stable: solve for the new pan offset
    // so that (cursor - pan) / zoom stays constant before and after.
    const canvasPointX = (cursorX - this.canvasPanX) / oldZoom;
    const canvasPointY = (cursorY - this.canvasPanY) / oldZoom;

    this.canvasZoom = newZoom;
    this.canvasPanX = cursorX - canvasPointX * newZoom;
    this.canvasPanY = cursorY - canvasPointY * newZoom;

    this.applyCanvasTransform();
  }

  /** Resets pan & zoom back to the default 100% centered view. */
  private resetCanvasView() {
    this.canvasZoom = 1;
    this.canvasPanX = 0;
    this.canvasPanY = 0;
    this.applyCanvasTransform();
  }

  private applyCanvasTransform() {
    const viewport = this.el.querySelector('#canvas-viewport') as HTMLElement;
    const label = this.el.querySelector('#canvas-zoom-label') as HTMLElement;
    if (!viewport) return;
    viewport.style.transform = `translate(${this.canvasPanX}px, ${this.canvasPanY}px) scale(${this.canvasZoom})`;
    if (label) label.textContent = `${Math.round(this.canvasZoom * 100)}%`;
  }

  private updateStatusToggle() {
    const toggle = this.el.querySelector('#flow-status-toggle')!;
    if (this.currentFlow?.enabled) {
      toggle.classList.add('is-on');
    } else {
      toggle.classList.remove('is-on');
    }
  }
}


