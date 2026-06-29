/**
 * src/dashboard/pages/editor.ts — Flow Editor Main Page
 */

import type { Page } from './index.js';
import { storage } from '../../shared/storage/StorageService.js';
import type { Flow, Block, TriggerBlock as ITriggerBlock, ConditionBlock as IConditionBlock, ActionBlock as IActionBlock } from '../../shared/types/index.js';
import { router } from '../router.js';
import { t } from '../../shared/i18n/index.js';
import { TriggerBlock } from '../components/blocks/TriggerBlock.js';
import { ConditionBlock } from '../components/blocks/ConditionBlock.js';
import { ActionBlock } from '../components/blocks/ActionBlock.js';
import './editor.css';
import './tokens.css';

const ICONS = {
  eye: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor"><path d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z"/></svg>`,
  save: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V173.3c0-17-6.7-33.3-18.7-45.3L352 50.7C340 38.7 323.7 32 306.7 32H64zm0 96c0-17.7 14.3-32 32-32H288c17.7 0 32 14.3 32 32v64c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V128zM224 288a64 64 0 1 1 0 128 64 64 0 1 1 0-128z"/></svg>`,
  chevronDown: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z"/></svg>`,
  plus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z"/></svg>`,
};

export default class FlowEditorPage implements Page {
  private el!: HTMLElement;
  private currentFlow!: Flow;
  private isDirty = false;
  private isNew = false;
  private flowId = '';

  // Block Instances
  private triggerBlockInst!: TriggerBlock;
  private conditionBlockInst: ConditionBlock | null = null;
  private actionBlockInst!: ActionBlock;

  // Keydown handler reference for removal
  private handleKeyDown!: (e: KeyboardEvent) => void;

  render(): HTMLElement {
    this.el = document.createElement('div');
    this.el.className = 'editor-canvas-wrap';
    this.el.innerHTML = /* html */ `
      <div class="editor-header">
        <div class="editor-status-indicator">
          <span class="status-label">Inactive</span>
          <div class="status-toggle" id="flow-status-toggle"></div>
          <span class="status-label" style="color: #d4d4d4;">Active</span>
        </div>

        <div class="editor-folder-select" style="margin-left: 20px; display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 13px; color: var(--neutral-400);">Folder:</span>
          <select id="flow-folder" style="background: var(--neutral-800); color: white; border: 1px solid var(--neutral-700); border-radius: 4px; padding: 4px 8px; font-size: 13px; outline: none;">
            <option value="">Uncategorised</option>
          </select>
        </div>
        
        <div class="editor-actions">
          <button class="btn-preview">${ICONS.eye} Preview</button>
          <button class="btn-save" id="btn-save-flow">${ICONS.save} <span id="save-label">${t('editor.saveFlow')}</span></button>
        </div>
      </div>

      <div class="editor-canvas-bg">
        <div class="dot-grid"></div>
        

        <div class="node-flow" id="node-flow-container">
          <!-- Blocks injected here -->
        </div>
      </div>
    `;
    return this.el;
  }

  async mount(params?: Record<string, string>): Promise<void> {
    this.flowId = params?.id || 'new';
    this.isNew = this.flowId === 'new';

    if (this.isNew) {
      this.currentFlow = this.createEmptyFlow();
    } else {
      const flow = await storage.getFlow(this.flowId);
      if (!flow) {
        alert('Flow not found.');
        router.navigate('/flows');
        return;
      }
      this.currentFlow = JSON.parse(JSON.stringify(flow)); // deep clone
    }

    this.isDirty = false;
    this.renderFlow();
    this.updateStatusToggle();

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

    // Ctrl+S
    this.handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.saveFlow();
      }
    };
    window.addEventListener('keydown', this.handleKeyDown);

    // Sidebar warning before navigation
    // (This works by hooking into router or beforeunload. WXT background/shell handles routing, we'll intercept in unmount if possible, or just rely on a window confirmation).
  }

  unmount(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    if (this.isDirty) {
      // Actually we cannot easily abort unmount synchronously here because the router is naive.
      // But we'll trust the user to save. A more robust router would allow unmount cancellation.
      console.warn('Navigated away with unsaved changes');
    }
  }

  // ---------------------------------------------------------------------------
  // Data Flow
  // ---------------------------------------------------------------------------

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
    this.isDirty = true;
    const saveLabel = this.el.querySelector('#save-label')!;
    saveLabel.textContent = t('editor.saveFlow') + ' *';
    const btn = this.el.querySelector('#btn-save-flow')!;
    btn.classList.add('dirty');
  }

  private clearDirty() {
    this.isDirty = false;
    const saveLabel = this.el.querySelector('#save-label')!;
    saveLabel.textContent = 'Saved';
    setTimeout(() => {
      if (!this.isDirty) saveLabel.textContent = t('editor.saveFlow');
    }, 2000);
  }

  private async saveFlow() {
    // Collect data from instances
    const triggerData = this.triggerBlockInst.getData();
    const actionData = this.actionBlockInst.getData();
    const condData = this.conditionBlockInst ? this.conditionBlockInst.getData() : null;

    if (!triggerData.shortcut.trim()) {
      alert('Trigger shortcut cannot be empty.');
      return;
    }

    // Name is just the shortcut
    this.currentFlow.name = `/${triggerData.shortcut}`;
    
    // Folder
    const folderSelect = this.el.querySelector('#flow-folder') as HTMLSelectElement;
    this.currentFlow.folderId = folderSelect.value || undefined;

    const blocks: Block[] = [];
    blocks.push({ id: crypto.randomUUID(), type: 'trigger', data: triggerData });
    
    if (condData) {
      blocks.push({ id: crypto.randomUUID(), type: 'condition', data: condData });
      // The ConditionBlock's UI doesn't visually nest the action. 
      // But the data structure requires ConditionRule to have an action.
      // We will map the Main ActionBlock to the FIRST rule of the ConditionBlock to satisfy data structure.
      if (condData.rules.length > 0) {
        condData.rules[0].action = actionData;
      }
    } else {
      blocks.push({ id: crypto.randomUUID(), type: 'action', data: actionData });
    }

    this.currentFlow.blocks = blocks;
    this.currentFlow.updatedAt = Date.now();

    await storage.saveFlow(this.currentFlow);
    this.clearDirty();
    this.isNew = false;
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
    badge.innerHTML = `Flow: ${this.currentFlow.blocks.length} steps &middot; ${this.isNew ? 'Not saved yet' : 'Last saved recently'}`;
    container.appendChild(badge);

    // 1. Trigger
    const triggerBlockData = this.currentFlow.blocks.find(b => b.type === 'trigger')?.data as ITriggerBlock;
    this.triggerBlockInst = new TriggerBlock(triggerBlockData, () => this.markDirty());
    container.appendChild(this.triggerBlockInst.getElement());

    // 2. Condition (if exists)
    const condBlock = this.currentFlow.blocks.find(b => b.type === 'condition');
    if (condBlock) {
      container.appendChild(this.createConnector());
      this.conditionBlockInst = new ConditionBlock(
        condBlock.data as IConditionBlock,
        () => this.markDirty(),
        () => {
          this.conditionBlockInst = null;
          this.markDirty();
          this.renderFlow(); // re-render without condition
        }
      );
      container.appendChild(this.conditionBlockInst.getElement());
    }

    // 3. Main Action
    // Find action (if linear it's in blocks, if nested it's in rule)
    let actionBlockData = this.currentFlow.blocks.find(b => b.type === 'action')?.data as IActionBlock;
    if (!actionBlockData && condBlock) {
      // Map it from the first rule
      const rules = (condBlock.data as IConditionBlock).rules;
      if (rules.length > 0) {
        actionBlockData = rules[0].action;
      }
    }
    
    container.appendChild(this.createConnector());
    this.actionBlockInst = new ActionBlock(actionBlockData, () => this.markDirty());
    container.appendChild(this.actionBlockInst.getElement());

    // 4. Add Step (Condition)
    if (!this.conditionBlockInst) {
      container.appendChild(this.createConnector());
      const addWrap = document.createElement('div');
      addWrap.className = 'add-step-wrap';
      addWrap.innerHTML = `<button class="add-step-btn">${ICONS.plus} Add Condition</button>`;
      addWrap.querySelector('button')!.addEventListener('click', () => {
        // We mutate the flow to add a condition block and re-render
        this.currentFlow.blocks.push({ id: crypto.randomUUID(), type: 'condition', data: { rules: [] } as IConditionBlock });
        this.markDirty();
        this.renderFlow();
      });
      container.appendChild(addWrap);
    }
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

  private updateStatusToggle() {
    const toggle = this.el.querySelector('#flow-status-toggle')!;
    if (this.currentFlow?.enabled) {
      toggle.classList.add('is-on');
    } else {
      toggle.classList.remove('is-on');
    }
  }
}


