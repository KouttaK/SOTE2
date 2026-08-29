/**
 * src/dashboard/pages/editor.ts — Flow Editor Main Page
 */

import type { Page } from './index.js';
import { browser } from 'wxt/browser';
import { storage } from '../../shared/storage/StorageService.js';
import type { Flow, Block, TriggerBlock as ITriggerBlock, ConditionBlock as IConditionBlock, ActionBlock as IActionBlock, RandomBlock as IRandomBlock, Settings, BranchTarget } from '../../shared/types/index.js';
import { isConditionBlock, isRandomBlock } from '../../shared/types/index.js';
import { rebalanceWeights, removeAndRebalance, evenWeights } from '../../shared/utils/randomWeights.js';
import { router } from '../router.js';
import { setHeaderOverride } from '../shell.js';
import { t } from '../../shared/i18n/index.js';
import { TriggerBlock } from '../components/blocks/TriggerBlock.js';
import { ConditionRuleBlock, describeConditionRule } from '../components/blocks/ConditionBlock.js';
import { ActionBlock } from '../components/blocks/ActionBlock.js';
import { BlockDock, DOCK_DRAG_MIME } from '../components/blocks/BlockDock.js';
import type { BlockDockItemType } from '../components/blocks/BlockDock.js';
import { PreviewModal } from '../components/PreviewModal.js';
import type { PreviewBranch } from '../components/PreviewModal.js';
import { showMissingVariablesModal } from '../components/MissingVariablesModal.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import { findMissingVariableKeys } from '../../shared/utils/flowVariableScanner.js';
import type { ConditionRule } from '../../shared/types/index.js';
import { escapeHtml } from '../../shared/utils/dom.js';
import './editor.css';
import './tokens.css';

/** Strips HTML tags/entities and collapses whitespace from an Action's
 * (possibly rich-text) content, truncated to a short one-line snippet —
 * used by the collapsed `.mini-action` preview inside Condition/Random
 * branches (see renderMiniAction). */
function stripPreviewText(html: string, maxLen = 60): string {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  const text = (div.textContent || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

/**
 * Wraps `currentTarget` into a new Random Block with two 50/50 options —
 * `currentTarget` becomes the first option (so converting a leaf to Random
 * never silently loses whatever the user already wrote), and the second
 * option starts as an empty plaintext action. Used by every "drop a
 * Random chip onto a leaf" conversion path in the editor.
 */
function wrapInRandomBlock(currentTarget: BranchTarget): IRandomBlock {
  return {
    type: 'random',
    options: [
      { id: crypto.randomUUID(), weight: 50, target: currentTarget },
      { id: crypto.randomUUID(), weight: 50, target: { format: 'plaintext', content: '', tokens: [] } },
    ],
  };
}

const ICONS = {
  bolt: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>`,
  eye: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor"><path d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z"/></svg>`,
  save: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V173.3c0-17-6.7-33.3-18.7-45.3L352 50.7C340 38.7 323.7 32 306.7 32H64zm0 96c0-17.7 14.3-32 32-32H288c17.7 0 32 14.3 32 32v64c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V128zM224 288a64 64 0 1 1 0 128 64 64 0 1 1 0-128z"/></svg>`,
  chevronDown: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z"/></svg>`,
  plus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z"/></svg>`,
  minus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M432 256c0 17.7-14.3 32-32 32L48 288c-17.7 0-32-14.3-32-32s14.3-32 32-32l352 0c17.7 0 32 14.3 32 32z"/></svg>`,
  trash: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 20 7"></polyline><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"></path><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`,
  gripHandle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>`,
  expand: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M32 32C14.3 32 0 46.3 0 64V192c0 17.7 14.3 32 32 32s32-14.3 32-32V96h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H32zM64 320c0-17.7-14.3-32-32-32s-32 14.3-32 32V448c0 17.7 14.3 32 32 32H160c17.7 0 32-14.3 32-32s-14.3-32-32-32H64V320zM320 32c-17.7 0-32 14.3-32 32s14.3 32 32 32h96v96c0 17.7 14.3 32 32 32s32-14.3 32-32V64c0-17.7-14.3-32-32-32H320zM448 320c0-17.7-14.3-32-32-32s-32 14.3-32 32v96H288c-17.7 0-32 14.3-32 32s14.3 32 32 32H416c17.7 0 32-14.3 32-32V320z"/></svg>`,
  dice: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="4" ry="4" stroke="currentColor" stroke-width="2"/><circle cx="8" cy="8" r="1.6" fill="currentColor"/><circle cx="16" cy="8" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="8" cy="16" r="1.6" fill="currentColor"/><circle cx="16" cy="16" r="1.6" fill="currentColor"/></svg>`,
  chevronRight: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" fill="currentColor"><path d="M310.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256 73.4 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z"/></svg>`,
  folder: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M64 480H448c35.3 0 64-28.7 64-64V160c0-35.3-28.7-64-64-64H288c-10.1 0-19.6-4.7-25.6-12.8L243.2 57.6C231.1 41.5 212.1 32 192 32H64C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64z"/></svg>`,
  search: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"/></svg>`,
  ellipsisV: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 512" fill="currentColor"><path d="M64 360a56 56 0 1 0 0 112 56 56 0 1 0 0-112zm0-160a56 56 0 1 0 0 112 56 56 0 1 0 0-112zM120 96A56 56 0 1 0 8 96a56 56 0 1 0 112 0z"/></svg>`,
  copy: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M384 336H192c-8.8 0-16-7.2-16-16V64c0-8.8 7.2-16 16-16l140.1 0L400 115.9V320c0 8.8-7.2 16-16 16zM192 384H384c35.3 0 64-28.7 64-64V115.9c0-12.7-5.1-24.9-14.1-33.9L366.1 14.1c-9-9-21.2-14.1-33.9-14.1H192c-35.3 0-64 28.7-64 64V320c0 35.3 28.7 64 64 64zM64 128c-35.3 0-64 28.7-64 64V448c0 35.3 28.7 64 64 64H256c35.3 0 64-28.7 64-64V416H272v32c0 8.8-7.2 16-16 16H64c-8.8 0-16-7.2-16-16V192c0-8.8 7.2-16 16-16H96V128H64z"/></svg>`,
  branch: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.2"></circle><circle cx="6" cy="18" r="2.2"></circle><circle cx="18" cy="9" r="2.2"></circle><path d="M6 8.2V15.8"></path><path d="M6 12c0-3.3 3-4.6 6-4.6h3.2"></path></svg>`,
  alignLeft: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M288 64c0 17.7-14.3 32-32 32H32C14.3 96 0 81.7 0 64S14.3 32 32 32H256c17.7 0 32 14.3 32 32zm0 256c0 17.7-14.3 32-32 32H32c-17.7 0-32-14.3-32-32s14.3-32 32-32H256c17.7 0 32 14.3 32 32zM0 192c0-17.7 14.3-32 32-32H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H32c-17.7 0-32-14.3-32-32zM448 448c0 17.7-14.3 32-32 32H32c-17.7 0-32-14.3-32-32s14.3-32 32-32H416c17.7 0 32 14.3 32 32z"/></svg>`,
  pencil: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z"/></svg>`,
  xmark: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></svg>`,
};

/** Zoom bounds & step for the flow canvas. */
const CANVAS_MIN_ZOOM = 0.4;
const CANVAS_MAX_ZOOM = 1.75;
const CANVAS_ZOOM_STEP = 0.15;

export default class FlowEditorPage implements Page {
  private el!: HTMLElement;
  private headerEl!: HTMLElement;
  private currentFlow!: Flow;
  private _isDirty = false;
  private isNew = false;
  private flowId = '';
  private settings!: Settings; // global settings (trigger mode, exact-match prefix char, etc.)

  // Block Instances
  private triggerBlockInst!: TriggerBlock;
  private hasCondition = false;
  private conditionData: IConditionBlock | null = null; // rules[] + optional elseBranch, owned by the editor while a condition step exists
  // One entry per LEAF ActionBlock instance rendered anywhere in the branch
  // tree (at any nesting depth). `commit()` writes the instance's live data
  // back into its owning rule.action/elseBranch slot — the owner objects
  // are already the real (nested) condition data by reference, so no extra
  // bookkeeping about *where* in the tree a leaf lives is needed here.
  private branchActionInsts: { inst: ActionBlock; commit: () => void }[] = [];
  private blockDock: BlockDock | null = null;

  // Free-floating Nível 3 nodes (Action/Random blocks detached from a
  // Condition branch — see renderDetachedBranchTarget) + the SVG layer
  // drawing the connecting line from each branch back to its node.
  private floatingNodes: HTMLElement[] = [];
  private connections: { source: HTMLElement; target: HTMLElement }[] = [];
  private svgLayer: SVGSVGElement | null = null;

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

    this.blockDock = new BlockDock();
    this.el.querySelector('#editor-canvas-bg')!.appendChild(this.blockDock.getElement());

    return this.el;
  }

  async mount(params?: Record<string, string>): Promise<void> {
    this.flowId = params?.id || 'new';
    this.isNew = this.flowId === 'new';

    // Takes over the shared `#dash-header` entirely (see setHeaderOverride's
    // docstring) so there's exactly one header, matching ref_pages/
    // criadorFluxo.htm — not this editor's own bar stacked under the
    // default dashboard header.
    this.headerEl = setHeaderOverride(/* html */ `
      <div class="editor-header-left">
        <div class="editor-breadcrumb">
          <span class="crumb-link" id="editor-crumb-flows">${t('sidebar.flows')}</span>
          <span class="crumb-sep">${ICONS.chevronRight}</span>
          <span class="crumb-active" id="editor-breadcrumb-title">${t('editor.title.new')}</span>
        </div>
      </div>
      <div class="editor-header-spacer"></div>
      <div class="editor-header-search">
        <span class="editor-header-search-icon">${ICONS.search}</span>
        <input type="text" id="editor-flow-search" placeholder="${t('editor.header.search_placeholder')}" autocomplete="off" spellcheck="false" />
        <span class="editor-header-search-kbd">⌘F</span>
      </div>
      <div class="editor-header-divider"></div>
      <div class="editor-toggle-wrap" id="flow-status-toggle" role="button" tabindex="0">
        <span class="editor-toggle-label is-off" id="editor-status-off-label">${t('editor.status.inactive')}</span>
        <div class="editor-toggle-track"><div class="editor-toggle-thumb"></div></div>
        <span class="editor-toggle-label is-on" id="editor-status-text">${t('editor.status.active')}</span>
      </div>
      <div class="editor-header-divider"></div>
      <span class="editor-folder-select">
        ${ICONS.folder}
        <select id="flow-folder">
          <option value="">${t('flows.folder.none')}</option>
        </select>
        ${ICONS.chevronDown}
      </span>
      <div class="editor-header-right">
        <div class="unsaved-dot" id="editor-unsaved-dot" style="display:none;"></div>
        <button class="editor-btn-secondary" id="btn-preview-flow">${t('preview.title')}</button>
        <button class="editor-btn-primary" id="btn-save-flow">${ICONS.save} <span id="save-label">${t('editor.saveFlow')}</span></button>
        <div class="editor-header-menu-wrap">
          <button class="editor-header-menu-btn" id="editor-header-menu-btn" title="${t('common.more_options')}">${ICONS.ellipsisV}</button>
          <div class="editor-header-menu" id="editor-header-menu" style="display:none;">
            <button class="block-menu-item" id="editor-menu-duplicate">${ICONS.copy} ${t('editor.header.menu.duplicate')}</button>
            <button class="block-menu-item danger" id="editor-menu-delete">${ICONS.trash} ${t('editor.header.menu.delete')}</button>
          </div>
        </div>
      </div>
    `);
    this.headerEl.querySelector('#editor-crumb-flows')?.addEventListener('click', () => router.navigate('/flows'));
    this.bindHeaderSearch();
    this.bindHeaderMenu();

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

    // Update breadcrumb to reflect actual flow name when editing an existing one
    const breadcrumbTitle = this.headerEl.querySelector('#editor-breadcrumb-title');
    if (breadcrumbTitle && !this.isNew && this.currentFlow.name) {
      breadcrumbTitle.textContent = this.currentFlow.name;
    }

    // A brand-new flow starts empty, so it can't reference anything yet —
    // only worth checking for an existing one.
    if (!this.isNew) {
      await this.checkMissingVariables(t('missing_vars.dismiss_open'));
    }
    // Prefilled from a context-menu text selection: the draft already has
    // real content that would be lost on an accidental navigation away, so
    // treat it as dirty right away (same protection a manual edit gets).
    if (prefilledFromSelection) this.markDirty();

    // Populate folders
    const folders = await storage.getFolders();
    const folderSelect = this.headerEl.querySelector('#flow-folder') as HTMLSelectElement;
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
    this.headerEl.querySelector('#flow-status-toggle')!.addEventListener('click', () => {
      this.currentFlow.enabled = !this.currentFlow.enabled;
      this.updateStatusToggle();
      this.markDirty();
    });

    this.headerEl.querySelector('#btn-save-flow')!.addEventListener('click', () => this.saveFlow());
    this.headerEl.querySelector('#btn-preview-flow')!.addEventListener('click', () => this.openPreview());

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
    const dot = this.headerEl.querySelector<HTMLElement>('#editor-unsaved-dot');
    if (dot) dot.style.display = '';
    const btn = this.headerEl.querySelector('#btn-save-flow')!;
    btn.classList.add('dirty');
  }

  private clearDirty() {
    this._isDirty = false;
    const dot = this.headerEl.querySelector<HTMLElement>('#editor-unsaved-dot');
    if (dot) dot.style.display = 'none';
    const saveLabel = this.headerEl.querySelector('#save-label')!;
    saveLabel.textContent = t('editor.saved_label');
    const btn = this.headerEl.querySelector('#btn-save-flow')!;
    btn.classList.remove('dirty');
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
    } else {
      // No dedicated Condition step: the root action slot is itself a
      // BranchTarget now (see renderFlow()) — commit every live leaf
      // instance back into its owning slot first (same as saveFlow()),
      // then walk it with the exact same generic leaf-collector used for
      // every nested branch, so a Random/Condition block added directly at
      // the root (with no dedicated Condition step) previews correctly too.
      this.branchActionInsts.forEach(({ commit }) => commit());
      const actionEntry = this.currentFlow.blocks.find((b) => b.type === 'action');
      if (actionEntry) {
        branches.push(...this.collectPreviewLeaf(actionEntry.data as BranchTarget, '', [], []));
      }
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
   * path description as it descends so nested conditions (and, now,
   * every alternative inside a Random Block) are still legible in the
   * flat preview list.
   */
  private collectPreviewBranches(condData: IConditionBlock, pathSoFar: string[] = []): PreviewBranch[] {
    const result: PreviewBranch[] = [];

    condData.rules.forEach((rule: ConditionRule, i: number) => {
      const path = [...pathSoFar, describeConditionRule(rule)];
      const tag = pathSoFar.length === 0 ? (i === 0 ? t('condition.tag.if') : t('condition.tag.elseif')) : t('condition.tag.if');
      result.push(...this.collectPreviewLeaf(rule.action, tag, path, path));
    });

    if (condData.elseBranch) {
      result.push(...this.collectPreviewLeaf(
        condData.elseBranch,
        t('condition.tag.else'),
        pathSoFar,
        [...pathSoFar, t('condition.tag.else')],
      ));
    }

    return result;
  }

  /**
   * Resolves a single branch target for the preview: recurses into a
   * nested ConditionBlock (via `nestedPath`, matching the breadcrumb
   * convention `collectPreviewBranches` already used for that case), fans
   * out into every option of a Random Block (appending each option's
   * label — with its weight — onto the breadcrumb, same tag as the
   * branch it lives in), or returns a single PreviewBranch for a plain
   * leaf ActionBlock (using `leafPath`, matching the other convention
   * `collectPreviewBranches` used for that case).
   */
  private collectPreviewLeaf(target: BranchTarget, tag: string, leafPath: string[], nestedPath: string[]): PreviewBranch[] {
    if (isConditionBlock(target)) {
      return this.collectPreviewBranches(target, nestedPath);
    }
    if (isRandomBlock(target)) {
      const result: PreviewBranch[] = [];
      target.options.forEach((opt, idx) => {
        const label = t('editor.random.preview_option', { n: idx + 1, weight: Math.round(opt.weight) });
        result.push(...this.collectPreviewLeaf(opt.target, tag, [...leafPath, label], [...nestedPath, label]));
      });
      return result;
    }
    return [{
      tag,
      ruleDescription: leafPath.length ? leafPath.join(' → ') : undefined,
      action: target as IActionBlock,
    }];
  }

  /**
   * Saves the current flow. Returns true if the save actually completed
   * (used by the shell to decide whether it's safe to navigate away, e.g.
   * when starting a new flow from an unsaved one).
   */
  /**
   * Scans the current flow for `{{KEY}}` references with no matching
   * Global Variable and, if any are found, shows the modal that lets the
   * user remove the reference or create the variable (see
   * shared/utils/flowVariableScanner.ts and
   * dashboard/components/MissingVariablesModal.ts). "Remover" mutates
   * `this.currentFlow` in place, so this re-renders (and marks the flow
   * dirty) only when something actually changed — dismissing the modal
   * without acting on anything shouldn't spuriously flag the flow as
   * having unsaved edits.
   */
  private async checkMissingVariables(dismissLabel: string): Promise<void> {
    const variables = await storage.getVariables();
    const missing = findMissingVariableKeys(this.currentFlow, variables);
    if (missing.length === 0) return;

    const before = JSON.stringify(this.currentFlow.blocks);
    await showMissingVariablesModal(this.currentFlow, missing, dismissLabel);
    if (JSON.stringify(this.currentFlow.blocks) !== before) {
      this.renderFlow();
      this.markDirty();
    }
  }

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
    const folderSelect = this.headerEl.querySelector('#flow-folder') as HTMLSelectElement;
    this.currentFlow.folderId = folderSelect.value || undefined;

    const blocks: Block[] = [];
    blocks.push({ id: crypto.randomUUID(), type: 'trigger', data: triggerData });

    // Every leaf ActionBlock rendered anywhere in the tree (at any nesting
    // depth, including the root when there's no dedicated Condition step)
    // has its own dedicated instance — pull each one's data back into its
    // owning rule.action/elseBranch/root slot before persisting.
    this.branchActionInsts.forEach(({ commit }) => commit());

    if (condData) {
      blocks.push({ id: crypto.randomUUID(), type: 'condition', data: condData });
    } else {
      // No dedicated Condition step: the root action slot's data was just
      // kept live-in-sync above by the commit() calls (same object already
      // referenced by the flow's 'action' block, mutated in place by
      // renderBranchTarget's setTarget) — just persist it as-is, whatever
      // it currently is (plain action, nested condition, or random block).
      const actionEntry = this.currentFlow.blocks.find((b) => b.type === 'action');
      blocks.push({ id: crypto.randomUUID(), type: 'action', data: (actionEntry?.data as BranchTarget) ?? { format: 'plaintext', content: '', tokens: [] } });
    }

    this.currentFlow.blocks = blocks;
    this.currentFlow.updatedAt = Date.now();

    // Same scan as on open, run again here since edits made during this
    // session could have introduced a new {{KEY}} reference (or fixed one)
    // since the flow was last opened. Never blocks the save itself —
    // "Salvar Mesmo Assim" is always available — it's a warning, not a
    // hard validation error. Re-renders first if "Remover" changed
    // anything, so the on-screen editor doesn't still show a `{{KEY}}`
    // that was just stripped from the data being persisted below.
    await this.checkMissingVariables(t('missing_vars.dismiss_save'));

    await storage.saveFlow(this.currentFlow);
    this.clearDirty();
    // Sync breadcrumb title with the saved flow name
    const breadcrumbTitle = this.headerEl.querySelector('#editor-breadcrumb-title');
    if (breadcrumbTitle) breadcrumbTitle.textContent = this.currentFlow.name;
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
    const container = this.el.querySelector<HTMLElement>('#node-flow-container')!;
    container.innerHTML = '';

    // Nível 3 free-floating nodes + their connecting lines are rebuilt
    // from scratch whenever the whole flow re-renders (container wiped
    // above) — see renderDetachedBranchTarget()/redrawConnections().
    this.floatingNodes = [];
    this.connections = [];
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'flow-connections-layer');
    // A large fixed viewBox centered on the container's own origin (same
    // trick .dot-grid uses) so connecting lines can reach a floating node
    // dragged well outside the flow's normal-flow content box, without
    // needing to resize the SVG on every drag.
    svg.setAttribute('viewBox', '-3000 -3000 6000 6000');
    svg.setAttribute('width', '6000');
    svg.setAttribute('height', '6000');
    svg.style.left = '-3000px';
    svg.style.top = '-3000px';
    container.appendChild(svg);
    this.svgLayer = svg;

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
      this.blockDock?.setAvailableTypes(['random', 'action']);
      this.renderBranches(container);
      return;
    }
    this.hasCondition = false;
    this.conditionData = null;

    // 3. Root action slot (linear flow, no dedicated Condition step): the
    // 'action' block's data is itself a full BranchTarget (see Block's doc
    // comment in shared/types/index.ts) — normally a plain leaf Action, but
    // it can also already be a nested Condition or Random Block if the user
    // added one via the unified "+ Adicionar Bloco" menu below without ever
    // adding a dedicated Condition step. Rendering it through the exact same
    // renderBranchTarget() every nested branch uses means the root gets the
    // same recursive Condition/Random support and the same "+ Adicionar
    // Bloco" control, instead of the old bespoke single-Action-block-only
    // rendering + a condition-only "Add Step" button.
    container.appendChild(this.createConnector());
    this.blockDock?.setAvailableTypes(['condition', 'random', 'action']);
    this.branchActionInsts = [];
    const actionEntry = this.currentFlow.blocks.find(b => b.type === 'action')
      ?? { id: crypto.randomUUID(), type: 'action' as const, data: { format: 'plaintext', content: '', tokens: [] } as IActionBlock };
    if (!this.currentFlow.blocks.includes(actionEntry)) this.currentFlow.blocks.push(actionEntry);

    this.renderBranchTarget(
      container,
      () => actionEntry.data as BranchTarget,
      (newTarget) => { actionEntry.data = newTarget; },
      () => { this.markDirty(); this.renderFlow(); },
      ['condition', 'random'], // root: both Condition (Nível 2) and Random (Nível 3) are offered
      true, // isRoot: "Condição" here creates a genuine dedicated top-level step
    );
  }

  /**
   * Renders everything downstream of the trigger connector when a
   * condition step exists: one unified Condition card containing every
   * branch (Se / Senão Se / Senão) stacked internally — see
   * renderConditionCard() for the actual layout.
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

    // Every branch's own Ação/Aleatório block (Nível 3) is no longer
    // stacked inside the card nor hidden behind a modal — it is rendered
    // as its own free-floating node directly on the canvas, connected
    // back to this branch by a line (see renderDetachedBranchTarget()).
    const card = this.renderConditionCard(this.conditionData, rebuild, removeConditionEntirely);
    container.appendChild(card);
    this.redrawConnections();
  }

  /**
   * Renders a Condition step as ONE unified card containing every branch —
   * Se / Senão Se / ... / Senão — stacked as `.branch-row`s, each with a
   * rail showing its tag and (except the last) a connecting line down to
   * the next branch. Matches the reference's single-card design; each
   * branch used to be its own separate block+column side by side in the
   * canvas instead.
   *
   * Used both for the top-level Condition step and recursively for any
   * nested Condition (a rule's own action, an Else, or a Random option can
   * all point at another whole ConditionBlock) — nesting looks identical,
   * just visually indented/scaled down slightly via the `.is-nested` class.
   */
  private renderConditionCard(
    condData: IConditionBlock,
    rebuild: () => void,
    onRemoveEntirely: () => void,
  ): HTMLElement {
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

    const isOnlyBranch = condData.rules.length === 1 && !condData.elseBranch;
    const branchCount = condData.rules.length + (condData.elseBranch ? 1 : 0);

    const card = document.createElement('div');
    card.className = 'block-card condition-card';
    card.innerHTML = /* html */ `
      <div class="block-header condition-card-header">
        <div class="block-type-icon">${ICONS.branch}</div>
        <span class="block-type-label">${t('condition.card.label')}</span>
        <span class="block-type-meta">· ${t('condition.branch_count', { count: branchCount })}</span>
        <div class="block-header-actions">
          <button type="button" class="icon-btn danger" id="condition-card-remove" title="${t('editor.condition.remove_rule')}">${ICONS.trash}</button>
        </div>
      </div>
      <div class="condition-body">
        <div class="condition-branches"></div>
      </div>
    `;
    card.querySelector('#condition-card-remove')!.addEventListener('click', () => {
      ConfirmModal.show({
        title: t('confirm_modal.remove_condition_title'),
        message: t('condition.confirm.remove_rule'),
        confirmLabel: t('common.remove'),
        onConfirm: () => onRemoveEntirely(),
      });
    });

    const body = card.querySelector('.condition-branches') as HTMLElement;

    // Display order matches evaluation order (see ConditionResolver.ts's own
    // identical scoring, kept as a separate defensive copy there): a rule
    // with a nested Condition of its own, or more AND/OR criteria, always
    // renders further up. Drag-and-drop reordering below only ever has a
    // visible effect between rules that tie on this score.
    const specificityScore = (rule: ConditionRule): number =>
      (isConditionBlock(rule.action) ? 1000 : 0) + (rule.criteria?.length ?? 0);

    const sortedEntries = condData.rules
      .map((rule, arrayIndex) => ({ rule, arrayIndex }))
      .sort((a, b) => specificityScore(b.rule) - specificityScore(a.rule));

    const hasElse = !!condData.elseBranch;

    sortedEntries.forEach(({ rule, arrayIndex }, displayIndex) => {
      const isLastRule = displayIndex === sortedEntries.length - 1;
      const isLastRow = isLastRule && !hasElse;

      const row = document.createElement('div');
      row.className = 'branch-row';
      if (!isLastRow) row.classList.add('has-next');

      const rail = document.createElement('div');
      rail.className = 'branch-rail';
      rail.innerHTML = /* html */ `
        <div class="branch-tag ${displayIndex === 0 ? 'if' : 'elseif'}${sortedEntries.length > 1 ? ' is-draggable' : ''}" ${sortedEntries.length > 1 ? `draggable="true" title="${t('condition.drag.reorder_hint')}"` : ''}>${displayIndex === 0 ? t('condition.tag.if') : t('condition.tag.elseif')}</div>
        ${isLastRow ? '' : '<div class="branch-rail-line"></div>'}
      `;

      // Drag-and-drop: the tag itself is the handle (see specificityScore
      // above for why a rule with more nested conditions/AND-OR always ends
      // up higher regardless of where it's dropped).
      const tag = rail.querySelector<HTMLElement>('.branch-tag')!;
      if (sortedEntries.length > 1) {
        tag.addEventListener('dragstart', (e) => {
          e.dataTransfer?.setData('text/plain', String(arrayIndex));
          if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
          row.classList.add('is-dragging');
        });
        tag.addEventListener('dragend', () => row.classList.remove('is-dragging'));
      }
      row.addEventListener('dragover', (e) => {
        if (!e.dataTransfer?.types.includes('text/plain')) return;
        e.preventDefault();
        row.classList.add('is-drag-over');
      });
      row.addEventListener('dragleave', () => row.classList.remove('is-drag-over'));
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('is-drag-over');
        const fromIndex = Number(e.dataTransfer?.getData('text/plain'));
        if (Number.isNaN(fromIndex) || fromIndex === arrayIndex) return;
        const [moved] = condData.rules.splice(fromIndex, 1);
        const adjustedTarget = fromIndex < arrayIndex ? arrayIndex - 1 : arrayIndex;
        condData.rules.splice(adjustedTarget, 0, moved);
        rebuild();
      });

      const content = document.createElement('div');
      content.className = 'branch-content';

      let refreshHeaderLabel = () => {}; // reatribuído logo abaixo, após renderDetachedBranchTarget existir
      const ruleCard = new ConditionRuleBlock(rule, {
        onChange: () => { this.markDirty(); refreshHeaderLabel(); },
        onRemove: () => {
          if (isOnlyBranch) onRemoveEntirely();
          else { condData.rules.splice(arrayIndex, 1); rebuild(); }
        },
      });
      content.appendChild(ruleCard.getElement());

      const actionWrap = document.createElement('div');
      actionWrap.className = 'branch-action';
      content.appendChild(actionWrap);

      refreshHeaderLabel = this.renderDetachedBranchTarget(
        actionWrap,
        () => rule.action,
        (target) => { rule.action = target; },
        rebuild,
        () => `${displayIndex === 0 ? t('condition.tag.if') : t('condition.tag.elseif')} ${describeConditionRule(rule)}`,
        displayIndex,
      );

      row.appendChild(rail);
      row.appendChild(content);
      body.appendChild(row);
    });

    if (condData.elseBranch) {
      const row = document.createElement('div');
      row.className = 'branch-row';

      const rail = document.createElement('div');
      rail.className = 'branch-rail';
      rail.innerHTML = /* html */ `<div class="branch-tag else">${t('condition.tag.else')}</div>`;

      const content = document.createElement('div');
      content.className = 'branch-content is-else';
      const removeElseBtn = document.createElement('button');
      removeElseBtn.type = 'button';
      removeElseBtn.className = 'icon-btn branch-else-remove';
      removeElseBtn.title = t('condition.else.menu.remove');
      removeElseBtn.innerHTML = ICONS.xmark;
      removeElseBtn.addEventListener('click', () => {
        ConfirmModal.show({
          title: t('confirm_modal.remove_else_title'),
          message: t('condition.confirm.remove_else'),
          confirmLabel: t('common.remove'),
          onConfirm: () => {
            condData.elseBranch = undefined;
            rebuild();
          },
        });
      });
      content.appendChild(removeElseBtn);
      const actionWrap = document.createElement('div');
      actionWrap.className = 'branch-action';
      content.appendChild(actionWrap);

      this.renderDetachedBranchTarget(
        actionWrap,
        () => condData.elseBranch!,
        (target) => { condData.elseBranch = target; },
        rebuild,
        () => t('condition.tag.else'),
        condData.rules.length,
      );

      row.appendChild(rail);
      row.appendChild(content);
      body.appendChild(row);
    }

    const footer = document.createElement('div');
    footer.className = 'condition-footer condition-footer-aligned';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'add-branch-btn';
    addBtn.innerHTML = `${ICONS.plus} ${t('condition.menu.add_elseif')}`;
    addBtn.addEventListener('click', addSenaoSe);
    footer.appendChild(addBtn);
    if (!condData.elseBranch) {
      const addElseBtn = document.createElement('button');
      addElseBtn.type = 'button';
      addElseBtn.className = 'add-branch-btn add-else-btn';
      addElseBtn.innerHTML = `${ICONS.plus} ${t('editor.condition.add_else')}`;
      addElseBtn.addEventListener('click', addElse);
      footer.appendChild(addElseBtn);
    }
    body.appendChild(footer);

    return card;
  }

  /**
   * Renders whatever a single branch (a rule's `action`, or an
   * `elseBranch`) leads to, into `col`:
   *  - a nested ConditionBlock → another unified Condition card, rendered
   *    recursively via renderConditionCard, one level deeper;
   *  - a RandomBlock → the unified Random card, via renderRandomCard; or
   *  - a plain leaf ActionBlock → a collapsed mini-action preview that
   *    expands inline into the real Action editor, with affordances to
   *    convert it into a Random Block and/or (where `allowedTypes`
   *    includes 'condition' — root only, see Nível 2's exclusivity rule)
   *    a nested condition instead.
   *
   * `getTarget`/`setTarget` read and replace whatever this branch
   * currently points to (owned by the caller's rule/elseBranch/option slot).
   */
  private renderBranchTarget(
    col: HTMLElement,
    getTarget: () => BranchTarget,
    setTarget: (target: BranchTarget) => void,
    rebuild: () => void,
    allowedTypes: BlockDockItemType[],
    isRoot = false,
  ) {
    const target = getTarget();

    // Lets the new "Texto" dock chip revert a nested Condition/Random block
    // back into a single plain action — the same collapse the card's own
    // trash icon already does, just also reachable by dragging the chip
    // straight onto the nested card.
    const acceptActionChip = (nestedCard: HTMLElement) => {
      this.makeLeafDropTarget(nestedCard, ['action'], () => {
        ConfirmModal.show({
          title: t('confirm_modal.convert_to_text_title'),
          message: t('editor.convert_to_action.confirm'),
          confirmLabel: t('common.convert'),
          onConfirm: () => {
            setTarget({ format: 'plaintext', content: '', tokens: [] });
            rebuild();
          },
        });
      });
    };

    if (isConditionBlock(target)) {
      const nestedCard = this.renderConditionCard(target, rebuild, () => {
        // The only rule in this nested condition was removed: collapse the
        // nesting back into a single plain (empty) action.
        setTarget({ format: 'plaintext', content: '', tokens: [] });
        rebuild();
      });
      nestedCard.classList.add('is-nested');
      acceptActionChip(nestedCard);
      col.appendChild(nestedCard);
      return;
    }

    if (isRandomBlock(target)) {
      const nestedCard = this.renderRandomCard(target, setTarget, rebuild);
      nestedCard.classList.add('is-nested');
      acceptActionChip(nestedCard);
      col.appendChild(nestedCard);
      return;
    }

    this.renderMiniAction(col, target as IActionBlock, setTarget, rebuild, allowedTypes, isRoot);
  }

  /**
   * Renders a leaf Action as a collapsed one-line preview — icon, a short
   * text snippet, and an edit pencil — matching the reference's
   * `.mini-action`. Clicking it expands the *same* real ActionBlock editor
   * inline in its place (nothing is lost — it's the same instance, just
   * hidden/shown), and collapsing it again re-derives the snippet from
   * whatever was just typed.
   *
   * Old saved flows may already have a nested ConditionBlock or Random
   * Block here (from before this redesign) — those keep rendering via
   * the branches in renderBranchTarget above. For a still-plain leaf
   * action, converting it into a Random Block (always available) or,
   * only where `allowedTypes` includes 'condition' (root only), into a
   * nested condition instead — happens
   * by dragging the matching chip from the BlockDock and dropping it
   * directly on this leaf (works whether collapsed or expanded).
   */
  private renderMiniAction(
    col: HTMLElement,
    target: IActionBlock,
    setTarget: (target: BranchTarget) => void,
    rebuild: () => void,
    allowedTypes: BlockDockItemType[],
    isRoot: boolean,
  ) {
    const actionInst = new ActionBlock(target, () => this.markDirty(), this.currentFlow.id);
    this.branchActionInsts.push({ inst: actionInst, commit: () => setTarget(actionInst.getData()) });

    const wrap = document.createElement('div');
    wrap.className = 'mini-action-wrap';

    const preview = document.createElement('div');
    preview.className = 'mini-action';
    const renderPreview = () => {
      const data = actionInst.getData();
      const snippet = stripPreviewText(data.content) || t('editor.mini_action.empty');
      preview.innerHTML = /* html */ `
        <div class="mini-action-icon">${ICONS.alignLeft}</div>
        <div class="mini-action-body">
          <p class="mini-action-title">${t('editor.mini_action.title')}</p>
          <p class="mini-action-snippet">${escapeHtml(snippet)}</p>
        </div>
        <button type="button" class="icon-btn mini-action-edit-btn" title="${t('common.edit')}">${ICONS.pencil}</button>
      `;
    };
    renderPreview();
    wrap.appendChild(preview);

    // No modal anywhere anymore: clicking always expands the very same
    // ActionBlock instance inline, in place — nothing is ever hidden
    // behind a separate popup window (see Task 3.1).
    const fullWrap = document.createElement('div');
    fullWrap.className = 'mini-action-full';
    fullWrap.style.display = 'none';
    fullWrap.appendChild(actionInst.getElement());
    wrap.appendChild(fullWrap);

    const toggle = () => {
      const isOpen = fullWrap.style.display !== 'none';
      if (isOpen) {
        fullWrap.style.display = 'none';
        renderPreview();
        preview.style.display = '';
      } else {
        preview.style.display = 'none';
        fullWrap.style.display = '';
      }
    };
    preview.addEventListener('click', toggle);

    if (allowedTypes.length > 0) {
      this.makeLeafDropTarget(wrap, allowedTypes, (type) => {
        const currentTarget = actionInst.getData();
        if (type === 'random') {
          setTarget(
            wrapInRandomBlock(currentTarget),
          );
        } else if (type === 'condition') {
          // Same reasoning: the new condition's first rule starts from
          // whatever was already here, not a blank action.
          const newCondition: IConditionBlock = {
            rules: [{ type: 'domain', operator: 'contains', value: '', action: currentTarget }],
          };
          if (isRoot) {
            // At the root, match today's dedicated top-level Condition step
            // instead of nesting the root action inside itself.
            this.currentFlow.blocks.push({ id: crypto.randomUUID(), type: 'condition', data: newCondition });
          } else {
            setTarget(newCondition);
          }
        }
        rebuild();
      });
    }

    col.appendChild(wrap);
  }

  /**
   * Turns a rendered leaf's own element into a drop target for the
   * BlockDock's chips: while a chip is being dragged (see document.body's
   * `is-dragging-block-chip` class, toggled by BlockDock.ts), every
   * eligible leaf gets a faint "you can drop here" outline via CSS, and
   * the one actually under the cursor gets a stronger highlight
   * (`.is-drop-target`, toggled here on dragenter/dragleave). Dropping a
   * chip whose type isn't in `allowedTypes` (e.g. Condição on a rule
   * branch's own leaf, where the AND/OR criteria group covers that need
   * instead) is silently ignored — dragover never marks it as a valid
   * target in the first place, so the browser shows its own "not allowed"
   * cursor.
   */
  private makeLeafDropTarget(el: HTMLElement, allowedTypes: BlockDockItemType[], onDrop: (type: BlockDockItemType) => void) {
    el.classList.add('leaf-drop-target');

    el.addEventListener('dragover', (e) => {
      if (!e.dataTransfer?.types.includes(DOCK_DRAG_MIME)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      el.classList.add('is-drop-target');
    });
    el.addEventListener('dragleave', () => el.classList.remove('is-drop-target'));
    el.addEventListener('drop', (e) => {
      if (!e.dataTransfer?.types.includes(DOCK_DRAG_MIME)) return;
      e.preventDefault();
      el.classList.remove('is-drop-target');
      const type = e.dataTransfer.getData(DOCK_DRAG_MIME) as BlockDockItemType;
      if (!allowedTypes.includes(type)) return;
      onDrop(type);
    });
  }

  /**
   * Renders a Random Block as one unified card: a probability-share bar
   * across the top, then every weighted option side by side as a "lane" —
   * each with its own % weight input that auto-rebalances every sibling so
   * the set always sums to 100, an optional remove button (kept ≥ 2
   * options), and its own nested branch target rendered recursively — and
   * a trailing "add option" button (no upper limit). Matches the
   * reference's multi-lane layout (previously every option was its own
   * stacked card with an "OU" divider between them).
   *
   * Weight edits update `randomBlock.options` and the other visible %
   * UI in place (no `rebuild()`), so typing a percentage never tears
   * down/loses focus on the nested Action editors below it. Structural
   * changes (add/remove option, convert back to a plain action) still go
   * through `rebuild()`, same as the rest of the branch tree.
   */
  private renderRandomCard(
    randomBlock: IRandomBlock,
    setTarget: (target: BranchTarget) => void,
    rebuild: () => void,
  ): HTMLElement {
    const card = document.createElement('div');
    card.className = 'block-card random-card';
    card.innerHTML = /* html */ `
      <div class="block-header condition-card-header">
        <div class="block-type-icon random-type-icon">${ICONS.dice}</div>
        <span class="block-type-label random-type-label">${t('editor.random.badge')}</span>
        <span class="block-type-meta">· ${t('editor.random.option_count_desc', { count: randomBlock.options.length })}</span>
        <div class="block-header-actions">
          <button type="button" class="icon-btn danger" id="random-card-remove" title="${t('editor.random.remove_title')}">${ICONS.trash}</button>
        </div>
      </div>
      <div class="random-body">
        <div class="random-lanes" id="random-lanes"></div>
      </div>
      <div class="random-footer">
        <button type="button" class="add-branch-btn" id="random-add-option">${ICONS.plus} ${t('editor.random.add_option')}</button>
        <span class="random-footer-hint">${t('editor.random.footer_hint')}</span>
      </div>
    `;
    card.querySelector('#random-card-remove')!.addEventListener('click', () => {
      ConfirmModal.show({
        title: t('confirm_modal.remove_random_title'),
        message: t('editor.random.confirm_remove'),
        confirmLabel: t('common.remove'),
        onConfirm: () => {
          setTarget({ format: 'plaintext', content: '', tokens: [] });
          rebuild();
        },
      });
    });

    const lanesEl = card.querySelector('#random-lanes') as HTMLElement;

    const syncWeightUI = () => {
      randomBlock.options.forEach((opt, i) => {
        const fill = lanesEl.querySelector<HTMLElement>(`[data-prob-fill="${i}"]`);
        const input = lanesEl.querySelector<HTMLInputElement>(`[data-random-weight="${i}"]`);
        if (fill) fill.style.width = `${opt.weight}%`;
        if (input && document.activeElement !== input) input.value = String(Math.round(opt.weight));
      });
    };

    randomBlock.options.forEach((opt, i) => {
      const lane = document.createElement('div');
      lane.className = 'random-lane';
      lane.innerHTML = /* html */ `
        <div class="lane-header">
          <div class="lane-label">
            <div class="lane-index">${i + 1}</div>
            <span class="lane-name">${t('editor.random.option_label', { n: i + 1 })}</span>
          </div>
          <div class="lane-prob">
            <div class="prob-track"><div class="prob-fill" data-prob-fill="${i}" style="width:${opt.weight}%"></div></div>
            <input type="number" class="lane-weight-input" data-random-weight="${i}" min="0" max="100" step="1" value="${Math.round(opt.weight)}">
            <span class="lane-weight-pct">%</span>
            ${randomBlock.options.length > 2 ? `<button type="button" class="icon-btn lane-remove-btn" title="${t('common.remove')}">${ICONS.xmark}</button>` : ''}
          </div>
        </div>
        <div class="lane-body"></div>
      `;

      const weightInput = lane.querySelector<HTMLInputElement>('.lane-weight-input')!;
      weightInput.addEventListener('input', () => {
        const raw = parseFloat(weightInput.value);
        const newWeight = Number.isFinite(raw) ? raw : 0;
        const weights = randomBlock.options.map((o) => o.weight);
        const rebalanced = rebalanceWeights(weights, i, newWeight);
        randomBlock.options.forEach((o, idx) => { o.weight = rebalanced[idx]; });
        syncWeightUI();
        this.markDirty();
      });

      lane.querySelector('.lane-remove-btn')?.addEventListener('click', () => {
        if (randomBlock.options.length <= 2) {
          alert(t('editor.random.min_options_alert'));
          return;
        }
        const weights = randomBlock.options.map((o) => o.weight);
        const rebalanced = removeAndRebalance(weights, i);
        randomBlock.options.splice(i, 1);
        randomBlock.options.forEach((o, idx) => { o.weight = rebalanced[idx]; });
        rebuild();
      });

      const laneBody = lane.querySelector('.lane-body') as HTMLElement;

      // Task 2: an option inside a Random Block now only ever holds a
      // plain Ação/Texto leaf — Condição belongs to a different
      // hierarchy level (Nível 2) and no longer makes sense nested here,
      // so no chip can be dropped on this lane to convert it into
      // anything else. Old flows saved before this restriction existed
      // may still have a nested Condição/Aleatório here; those keep
      // rendering (recursively, via renderBranchTarget below) purely for
      // backward compatibility, but the option can no longer be
      // converted *into* one going forward.
      this.renderBranchTarget(
        laneBody,
        () => opt.target,
        (newTarget) => { opt.target = newTarget; },
        rebuild,
        [], // no conversions offered — action only
      );

      lanesEl.appendChild(lane);
    });

    card.querySelector('#random-add-option')!.addEventListener('click', () => {
      const n = randomBlock.options.length + 1;
      const evenSplit = evenWeights(n);
      randomBlock.options.forEach((o, idx) => { o.weight = evenSplit[idx]; });
      randomBlock.options.push({ id: crypto.randomUUID(), weight: evenSplit[n - 1], target: { format: 'plaintext', content: '', tokens: [] } });
      rebuild();
    });

    return card;
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
  // Nível 3 — Free-floating nodes (Ação/Aleatório detached from a Condição)
  // ---------------------------------------------------------------------------

  /**
   * Renders whatever a Condição branch (a rule's `action`, or its
   * `elseBranch`) leads to as a free-floating node, per the new 3-level
   * hierarchy: Nível 1 (Gatilho) → Nível 2 (Condição, fixed right below
   * it) → Nível 3 (Ação/Texto or Aleatório), and a Nível 3 block that
   * comes from a Condição is no longer stacked inside the card — it can
   * be dragged anywhere on the canvas, staying linked to the branch it
   * came from by a connecting line (see redrawConnections()).
   *
   * `anchorCol` only ever gets a small compact chip (the "anchor"); the
   * real Action/Random editor is appended straight to the canvas as a
   * `.floating-node`. Dropping an "Aleatório" chip on the anchor still
   * converts a plain action into a Random Block (Condição is not offered
   * here anymore — Nível 2 is unique and fixed, it can't be recreated
   * from inside a branch, only from the root — see renderFlow()).
   */
  private renderDetachedBranchTarget(
    anchorCol: HTMLElement,
    getTarget: () => BranchTarget,
    setTarget: (target: BranchTarget) => void,
    rebuild: () => void,
    getLabel: () => string,
    slotIndex: number,
  ): () => void {
    const target = getTarget();

    // Old flows saved before this redesign may already have a nested
    // ConditionBlock here — Nível 2 is unique/fixed going forward, so no
    // *new* one can be created this way anymore, but an existing one
    // keeps rendering inline (recursively) for backward compatibility.
    if (isConditionBlock(target)) {
      const nestedCard = this.renderConditionCard(target, rebuild, () => {
        setTarget({ format: 'plaintext', content: '', tokens: [] });
        rebuild();
      });
      nestedCard.classList.add('is-nested');
      anchorCol.appendChild(nestedCard);
      return () => {}; // no header here to refresh
    }

    const isRandom = isRandomBlock(target);

    const chip = document.createElement('div');
    chip.className = 'branch-leaf-anchor';
    chip.title = t('editor.branch_leaf_stub.title');
    chip.innerHTML = /* html */ `
      <span class="branch-leaf-anchor-icon">${isRandom ? ICONS.dice : ICONS.alignLeft}</span>
      <span class="branch-leaf-anchor-label">${isRandom ? t('editor.random.badge') : t('editor.mini_action.title')}</span>
    `;
    anchorCol.appendChild(chip);

    // Converts a plain action into a Random Block by dropping the
    // "Aleatório" chip on the anchor — Condição is intentionally not in
    // this list (see method doc above).
    this.makeLeafDropTarget(chip, ['random'], (type) => {
      if (type !== 'random') return;
      const currentTarget = getTarget();
      if (isRandomBlock(currentTarget)) return;
      setTarget(wrapInRandomBlock(currentTarget));
      rebuild();
    });

    const container = this.el.querySelector<HTMLElement>('#node-flow-container')!;
    const node = document.createElement('div');
    node.className = 'floating-node';

    const header = document.createElement('div');
    header.className = 'floating-node-header';
    header.innerHTML = /* html */ `
      <span class="floating-node-grip" title="${t('editor.floating_node.drag_hint')}">${ICONS.gripHandle}</span>
      <span class="floating-node-label"></span>
    `;
    const labelEl = header.querySelector<HTMLElement>('.floating-node-label')!;
    // Tarefa 3: o rótulo do header (ex.: "SE domínio contém gmail.com")
    // some texto derivado da própria regra (describeConditionRule) — como
    // esse texto pode mudar a cada tecla digitada no campo "contém" da
    // regra, sem que o card inteiro seja reconstruído (rebuild()
    // completo a cada tecla faria o cursor do input "pular"), ele precisa
    // de uma forma de ser atualizado isoladamente. `refreshLabel()` é
    // exatamente essa forma — quem chama este método guarda a referência
    // devolvida e a invoca sempre que a regra mudar (ver
    // ConditionRuleBlock's onChange em renderConditionCard).
    const refreshLabel = () => { labelEl.textContent = getLabel(); };
    refreshLabel();
    node.appendChild(header);

    const body = document.createElement('div');
    body.className = 'floating-node-body';
    node.appendChild(body);

    if (isRandom) {
      const randomCard = this.renderRandomCard(target as IRandomBlock, setTarget, rebuild);
      body.appendChild(randomCard);
      this.makeLeafDropTarget(randomCard, ['action'], () => {
        ConfirmModal.show({
          title: t('confirm_modal.convert_to_text_title'),
          message: t('editor.convert_to_action.confirm'),
          confirmLabel: t('common.convert'),
          onConfirm: () => {
            setTarget({ format: 'plaintext', content: '', tokens: [] });
            rebuild();
          },
        });
      });
    } else {
      const actionInst = new ActionBlock(target as IActionBlock, () => this.markDirty(), this.currentFlow.id);
      this.branchActionInsts.push({ inst: actionInst, commit: () => setTarget(actionInst.getData()) });
      body.appendChild(actionInst.getElement());
      this.makeLeafDropTarget(node, ['random'], (type) => {
        if (type !== 'random') return;
        setTarget(wrapInRandomBlock(actionInst.getData()));
        rebuild();
      });
    }

    chip.addEventListener('click', (e) => {
      // preventDefault/stopPropagation: este chip não é um form control,
      // mas o clique não deve nunca "vazar" para nada que dispare o
      // scroll nativo do navegador (ver panCanvasToElement acima) nem
      // iniciar um pan do canvas por baixo dele.
      e.preventDefault();
      e.stopPropagation();
      this.panCanvasToElement(node);
      this.highlightElement(node);
    });

    container.appendChild(node);
    this.floatingNodes.push(node);
    // Tarefa 5: a origem da linha é o próprio `.branch-action` (o
    // container inteiro do ramo, `anchorCol` — a classe é aplicada pelo
    // chamador em renderConditionCard), não o pequeno chip `.branch-
    // leaf-anchor` dentro dele. Antes a linha saía exatamente da borda do
    // chip, o que a fazia "pular" de lugar (esquerda/direita/cima/baixo)
    // dependendo de quanto texto cabia ao lado dele na mesma linha —
    // ancorando no elemento `.branch-action` (que ocupa a largura cheia,
    // estável) a linha sempre sai do mesmo ponto relativo do ramo.
    //
    // Tarefa 3 (complemento): redrawConnections() usa a borda ESQUERDA
    // deste mesmo `.branch-action` como ponto de partida (`sx`), não a
    // direita — ver o comentário em redrawConnections() para o porquê.
    this.connections.push({ source: anchorCol, target: node });

    const posHolder = target as IActionBlock | IRandomBlock;
    const defaultPos = { x: 40 + slotIndex * 620, y: 90 }; // 620 = 580px (.floating-node width) + 40px gap
    this.makeFloatingNodeDraggable(
      node,
      header,
      () => posHolder.pos,
      (p) => { posHolder.pos = p; },
      posHolder.pos ?? defaultPos,
    );

    return refreshLabel;
  }

  /** Lets the user drag a `.floating-node` (Nível 3 block detached from a
   * Condição) anywhere on the canvas, persisting its position on the
   * underlying data (`pos`) and redrawing every connecting line live as
   * it moves. Mouse deltas are divided by the current zoom level so the
   * node tracks the cursor 1:1 regardless of how zoomed in/out the
   * canvas currently is (see redrawConnections() for the same
   * zoom-normalization trick applied the other way around). */
  private makeFloatingNodeDraggable(
    node: HTMLElement,
    handle: HTMLElement,
    getPos: () => { x: number; y: number } | undefined,
    setPos: (pos: { x: number; y: number }) => void,
    initialPos: { x: number; y: number },
  ) {
    let pos = getPos() ?? initialPos;
    node.style.left = `${pos.x}px`;
    node.style.top = `${pos.y}px`;
    setPos(pos);

    let dragging = false;
    let startClientX = 0;
    let startClientY = 0;
    let startPos = { x: 0, y: 0 };

    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      const zoom = this.canvasZoom || 1;
      const dx = (e.clientX - startClientX) / zoom;
      const dy = (e.clientY - startClientY) / zoom;
      pos = { x: startPos.x + dx, y: startPos.y + dy };
      node.style.left = `${pos.x}px`;
      node.style.top = `${pos.y}px`;
      this.redrawConnections();
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      node.classList.remove('is-dragging-node');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setPos(pos);
      this.markDirty();
    };
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation(); // don't also start a canvas pan
      dragging = true;
      startClientX = e.clientX;
      startClientY = e.clientY;
      startPos = { ...pos };
      node.classList.add('is-dragging-node');
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
  }

  /** Converts `el`'s current on-screen bounding box into coordinates local
   * to `#node-flow-container` (i.e. the same unscaled px unit `.floating-
   * node`'s own `left`/`top` are expressed in), undoing the canvas's pan
   * & zoom transform. Both the branch anchor and the floating node it
   * connects to are read this way so the line lands correctly regardless
   * of current zoom/pan. */
  private getLocalRect(el: HTMLElement, containerRect: DOMRect, zoom: number) {
    const r = el.getBoundingClientRect();
    return {
      left: (r.left - containerRect.left) / zoom,
      top: (r.top - containerRect.top) / zoom,
      width: r.width / zoom,
      height: r.height / zoom,
    };
  }

  /** Redraws every registered branch→floating-node connecting line as a
   * smooth horizontal bezier curve, from the LEFT edge of the branch's own
   * `.branch-action` pane (right where it meets that specific branch's
   * rule, at the dashed divider) to the left edge of the floating node's
   * header. Called once after every full render, and continuously while a
   * node is being dragged (see makeFloatingNodeDraggable).
   *
   * Tarefa 3 (bug de ancoragem): `sx` costumava ser a borda DIREITA de
   * `.branch-action` (`s.left + s.width`). Como `.branch-action` sempre
   * cresce (`flex: 1 1 180px`) até encostar na borda direita do card da
   * Condição — a mesma para TODO ramo, já que todos os ramos share o
   * mesmíssimo card de largura fixa — isso fazia CADA linha nascer do
   * mesmíssimo ponto X, alinhadas numa única borda vertical comum. Ramos
   * com pouca diferença de altura entre si (a maioria dos casos: uma
   * regra simples de domínio/data ocupa quase a mesma altura que a
   * seguinte) tornavam essa borda comum visualmente indistinguível de
   * "todas as linhas saindo do bloco geral da Condição", em vez de cada
   * uma saindo claramente do seu próprio ramo. Usar a borda ESQUERDA de
   * `.branch-action` — que fica exatamente onde aquele ramo específico
   * termina e sua própria ação começa — ancora cada linha de forma única
   * e inconfundível ao ramo que a originou. */
  private redrawConnections() {
    if (!this.svgLayer) return;
    const container = this.el.querySelector<HTMLElement>('#node-flow-container');
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const zoom = this.canvasZoom || 1;

    this.svgLayer.querySelectorAll('path.flow-connection').forEach((p) => p.remove());

    this.connections.forEach(({ source, target }) => {
      if (!source.isConnected || !target.isConnected) return;
      const s = this.getLocalRect(source, containerRect, zoom);
      const tgt = this.getLocalRect(target, containerRect, zoom);
      const sx = s.left;
      const sy = s.top + s.height / 2;
      const tx = tgt.left;
      const ty = tgt.top + 18; // aligns with the floating node's header, not its full height
      const dx = Math.max(50, (tx - sx) / 2);

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'flow-connection');
      path.setAttribute(
        'd',
        `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`,
      );
      this.svgLayer!.appendChild(path);
    });
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

    // Tarefa 1: o canvas é 100% posicionado via `transform` em
    // `#canvas-viewport` (canvasPanX/canvasPanY/canvasZoom) — ele nunca
    // deveria ter um scroll nativo próprio. Se algo (uma extensão do
    // navegador, um `:focus` automático do próprio browser em um input
    // fora da área visível, etc.) ainda assim setar `scrollLeft`/
    // `scrollTop` neste elemento, isso arrastaria consigo tudo que está
    // posicionado como `absolute` dentro dele — `.block-dock` e
    // `.canvas-controls` inclusive — para fora da área visível. Zerar
    // sempre que um scroll nativo for detectado neutraliza esse efeito
    // sem custar nada nos casos (a maioria) em que isso nunca acontece.
    canvas.addEventListener('scroll', () => {
      if (canvas.scrollLeft !== 0 || canvas.scrollTop !== 0) {
        canvas.scrollLeft = 0;
        canvas.scrollTop = 0;
      }
    });

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
      if (target.closest('.block-card, button, select, input, textarea, .block-menu, .branch-drag-handle, .block-dock')) return;
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
      // Floating overlays that sit visually on top of the canvas but live
      // inside its own DOM subtree (the "+ Inserir Token" dropdown, the
      // Blocks dock) still get a wheel event over them bubbled up to this
      // listener. Without this check, every scroll attempt inside one of
      // those lists was hijacked into a canvas zoom instead — the list
      // could never actually scroll, no matter how tall its own CSS
      // overflow made it. (Modals like ChoiceModal/FlowRefModal attach
      // straight to document.body, outside the canvas entirely, so they
      // never reach this listener in the first place — no check needed
      // for those.)
      const target = e.target as HTMLElement;
      if (target.closest('.token-menu-overlay, .block-dock')) return;

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

  /**
   * Brings `el` into view by adjusting the canvas's own pan offset
   * (`canvasPanX`/`canvasPanY`) instead of calling the native
   * `Element.scrollIntoView()`.
   *
   * Bug fix (Tarefa 1): `.editor-canvas-bg` has `overflow: hidden`, which
   * still makes it a genuine scroll container — `scrollIntoView()` was
   * silently changing its `scrollLeft`/`scrollTop` to bring an
   * off-screen floating node into view. `.block-dock` and
   * `.canvas-controls` are positioned `absolute` *inside* that same
   * scrolling container, so they scrolled right along with it, appearing
   * to get "pushed out" of the visible area — while the canvas content
   * itself (panned/zoomed via `#canvas-viewport`'s CSS `transform`, a
   * completely separate mechanism) stayed put, making it look like an
   * erratic, uncontrolled jump. Doing the "bring into view" entirely
   * through `canvasPanX`/`canvasPanY` (the same state `zoomCanvasBy()`
   * already uses) keeps everything on the one coordinate system the
   * canvas actually understands, and never touches native scroll at all.
   */
  private panCanvasToElement(el: HTMLElement) {
    const bg = this.el.querySelector<HTMLElement>('#editor-canvas-bg');
    if (!bg) return;
    const bgRect = bg.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const elCenterX = elRect.left + elRect.width / 2;
    const elCenterY = elRect.top + elRect.height / 2;
    const viewportCenterX = bgRect.left + bgRect.width / 2;
    const viewportCenterY = bgRect.top + bgRect.height / 2;
    this.canvasPanX += viewportCenterX - elCenterX;
    this.canvasPanY += viewportCenterY - elCenterY;
    this.applyCanvasTransform();
  }

  /** Briefly highlights `el` (the same pulse used by the header's "Buscar
   * no fluxo" and by a branch anchor jumping to its floating node) after
   * panning it into view. */
  private highlightElement(el: HTMLElement) {
    el.classList.add('editor-search-hit');
    setTimeout(() => el.classList.remove('editor-search-hit'), 1600);
  }

  private updateStatusToggle() {
    const toggle = this.headerEl.querySelector('#flow-status-toggle')!;
    const track = this.headerEl.querySelector('.editor-toggle-track')!;
    const offLabel = this.headerEl.querySelector('#editor-status-off-label')!;
    const onLabel = this.headerEl.querySelector('#editor-status-text')!;
    const isOn = !!this.currentFlow?.enabled;
    toggle.classList.toggle('is-on', isOn);
    track.classList.toggle('is-on', isOn);
    offLabel.classList.toggle('is-active', !isOn);
    onLabel.classList.toggle('is-active', isOn);
  }

  /** "Buscar no fluxo" — finds the first block on the canvas whose visible
   * text matches the query, pans it into view (see panCanvasToElement),
   * and gives it a brief highlight ring. A real, if simple, in-flow
   * search rather than a decorative input, since the ref's search bar
   * has no backing feature in the current data model to search *across*
   * flows from here. */
  private bindHeaderSearch() {
    const input = this.headerEl.querySelector<HTMLInputElement>('#editor-flow-search');
    if (!input) return;
    const runSearch = () => {
      const query = input.value.trim().toLowerCase();
      this.el.querySelectorAll('.editor-search-hit').forEach(el => el.classList.remove('editor-search-hit'));
      if (!query) return;

      const cards = Array.from(
        this.el.querySelectorAll<HTMLElement>('.trigger-node, .block-card')
      );
      const match = cards.find(card => card.textContent?.toLowerCase().includes(query));
      if (match) {
        this.panCanvasToElement(match);
        this.highlightElement(match);
      }
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') runSearch(); });
  }

  /** Header "⋮" menu — Duplicate/Delete, the same two destructive/
   * non-destructive actions already available from the Fluxos table row,
   * just reachable from inside the editor too. */
  private bindHeaderMenu() {
    const btn = this.headerEl.querySelector<HTMLButtonElement>('#editor-header-menu-btn');
    const menu = this.headerEl.querySelector<HTMLElement>('#editor-header-menu');
    if (!btn || !menu) return;

    const closeMenu = () => { menu.style.display = 'none'; };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    });
    document.addEventListener('click', closeMenu);

    this.headerEl.querySelector('#editor-menu-duplicate')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      closeMenu();
      if (this.isNew || !this.currentFlow) return;
      const copy = {
        ...this.currentFlow,
        id: crypto.randomUUID(),
        name: `${this.currentFlow.name} ${t('common.copy_suffix')}`,
        stats: { usageCount: 0, keysSaved: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await storage.saveFlow(copy);
      router.navigate(`/editor/${copy.id}`);
    });

    this.headerEl.querySelector('#editor-menu-delete')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      closeMenu();
      if (this.isNew) { router.navigate('/flows'); return; }
      ConfirmModal.show({
        title: t('confirm_modal.delete_flow_title'),
        message: t('editor.header.menu.delete_confirm'),
        confirmLabel: t('common.delete'),
        onConfirm: async () => {
          await storage.deleteFlow(this.flowId);
          this._isDirty = false;
          router.navigate('/flows');
        },
      });
    });
  }
}


