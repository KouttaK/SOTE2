/**
 * src/dashboard/components/blocks/ActionBlock.ts
 */

import type { ActionBlock as IActionBlock, Token, Variable } from '../../../shared/types/index.js';
import { t } from '../../../shared/i18n/index.js';
import { storage } from '../../../shared/storage/StorageService.js';
import { TokenPill } from '../tokens/TokenPill.js';
import { TokenMenu } from '../tokens/TokenMenu.js';
import { ChoiceModal } from '../tokens/modals/ChoiceModal.js';
import { RandomModal } from '../tokens/modals/RandomModal.js';
import { ClipboardModal } from '../tokens/modals/ClipboardModal.js';
import { InputModal } from '../tokens/modals/InputModal.js';
import { DateModal } from '../tokens/modals/DateModal.js';
import { FlowRefModal } from '../tokens/modals/FlowRefModal.js';

/** Escapes HTML-significant characters before interpolating user-controlled
 * strings (Global Variable keys/values) into innerHTML. */
function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

const ICONS = {
  keyboard: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor"><path d="M64 64C28.7 64 0 92.7 0 128V384c0 35.3 28.7 64 64 64H512c35.3 0 64-28.7 64-64V128c0-35.3-28.7-64-64-64H64zm16 64h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H80c-8.8 0-16-7.2-16-16V144c0-8.8 7.2-16 16-16zM64 240c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H80c-8.8 0-16-7.2-16-16V240zm16 80h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H80c-8.8 0-16-7.2-16-16V336c0-8.8 7.2-16 16-16zm80-176c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H176c-8.8 0-16-7.2-16-16V144zm16 80h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H176c-8.8 0-16-7.2-16-16V240c0-8.8 7.2-16 16-16zM160 336c0-8.8 7.2-16 16-16H400c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H176c-8.8 0-16-7.2-16-16V336zM272 128h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H272c-8.8 0-16-7.2-16-16V144c0-8.8 7.2-16 16-16zM256 240c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H272c-8.8 0-16-7.2-16-16V240zM368 128h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H368c-8.8 0-16-7.2-16-16V144c0-8.8 7.2-16 16-16zM352 240c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H368c-8.8 0-16-7.2-16-16V240zM464 128h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H464c-8.8 0-16-7.2-16-16V144c0-8.8 7.2-16 16-16zM448 240c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H464c-8.8 0-16-7.2-16-16V240zm16 80h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H464c-8.8 0-16-7.2-16-16V336c0-8.8 7.2-16 16-16z"/></svg>`,
  listUl: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M64 144a48 48 0 1 0 0-96 48 48 0 1 0 0 96zM192 64c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zM64 464a48 48 0 1 0 0-96 48 48 0 1 0 0 96zm48-208a48 48 0 1 0 -96 0 48 48 0 1 0 96 0z"/></svg>`,
  listOl: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M24 56c0-13.3 10.7-24 24-24H80c13.3 0 24 10.7 24 24V176h16c13.3 0 24 10.7 24 24s-10.7 24-24 24H40c-13.3 0-24-10.7-24-24s10.7-24 24-24H56V80H48C34.7 80 24 69.3 24 56zM86.7 341.2c-6.5-7.4-18.3-6.9-24 1.2L51.5 357.9c-7.7 10.8-22.7 13.3-33.5 5.6s-13.3-22.7-5.6-33.5l11.1-15.6c23.7-33.2 72.3-35.6 99.2-4.9c21.3 24.4 20.8 60.9-1.1 84.7L86.8 432H120c13.3 0 24 10.7 24 24s-10.7 24-24 24H32c-9.5 0-18.2-5.6-22-14.4s-2.1-18.9 4.3-25.9l72-78c5.3-5.8 5.4-14.6 .3-20.5zM224 64H480c17.7 0 32 14.3 32 32s-14.3 32-32 32H224c-17.7 0-32-14.3-32-32s14.3-32 32-32zm0 160H480c17.7 0 32 14.3 32 32s-14.3 32-32 32H224c-17.7 0-32-14.3-32-32s14.3-32 32-32zm0 160H480c17.7 0 32 14.3 32 32s-14.3-32-32-32H224c-17.7 0-32-14.3-32-32s14.3-32 32-32z"/></svg>`,
  link: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" fill="currentColor"><path d="M579.8 267.7c56.5-56.5 56.5-148 0-204.5c-50-50-128.8-56.5-186.3-15.4l-1.6 1.1c-14.4 10.3-17.7 30.3-7.4 44.6s30.3 17.7 44.6 7.4l1.6-1.1c32.1-22.9 76-19.3 103.8 8.6c31.5 31.5 31.5 82.5 0 114L422.3 334.8c-31.5 31.5-82.5 31.5-114 0c-27.9-27.9-31.5-71.8-8.6-103.8l1.1-1.6c10.3-14.4 6.9-34.4-7.4-44.6s-34.4-6.9-44.6 7.4l-1.1 1.6C206.5 251.2 213 330 263 380c56.5 56.5 148 56.5 204.5 0L579.8 267.7zM60.2 244.3c-56.5 56.5-56.5 148 0 204.5c50 50 128.8 56.5 186.3 15.4l1.6-1.1c14.4-10.3 17.7-30.3 7.4-44.6s-30.3-17.7-44.6-7.4l-1.6 1.1c-32.1 22.9-76 19.3-103.8-8.6C74 372 74 321 105.5 289.5L217.7 177.2c31.5-31.5 82.5-31.5 114 0c27.9 27.9 31.5 71.8 8.6 103.9l-1.1 1.6c-10.3 14.4-6.9 34.4 7.4 44.6s34.4 6.9 44.6-7.4l1.1-1.6C433.5 260.8 427 182 377 132c-56.5-56.5-148-56.5-204.5 0L60.2 244.3z"/></svg>`,
  code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" fill="currentColor"><path d="M392.8 1.2c-17-4.9-34.7 5-39.6 22l-128 448c-4.9 17 5 34.7 22 39.6s34.7-5 39.6-22l128-448c4.9-17-5-34.7-22-39.6zm80.6 120.1c-12.5 12.5-12.5 32.8 0 45.3L562.7 256l-89.4 89.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l112-112c12.5-12.5 12.5-32.8 0-45.3l-112-112c-12.5-12.5-32.8-12.5-45.3 0zm-306.7 0c-12.5-12.5-32.8-12.5-45.3 0l-112 112c-12.5 12.5-12.5 32.8 0 45.3l112 112c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256l89.4-89.4c12.5-12.5 12.5-32.8 0-45.3z"/></svg>`,
  plus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z"/></svg>`,
  ellipsis: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 512" fill="currentColor"><path d="M64 360a56 56 0 1 0 0 112 56 56 0 1 0 0-112zm0-160a56 56 0 1 0 0 112 56 56 0 1 0 0-112zM120 96A56 56 0 1 0 8 96a56 56 0 1 0 112 0z"/></svg>`,
  trash: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M170.5 51.6L151.5 80h145l-19-28.4c-1.5-2.2-4-3.6-6.7-3.6H177.1c-2.7 0-5.2 1.3-6.7 3.6zm147-26.6L354.2 80H368h48 8c13.3 0 24 10.7 24 24s-10.7 24-24 24h-8V432c0 44.2-35.8 80-80 80H112c-44.2 0-80-35.8-80-80V128H24c-13.3 0-24-10.7-24-24S10.7 80 24 80h8H80 93.8l36.7-55.1C140.9 9.4 158.4 0 177.1 0h93.7c18.7 0 36.2 9.4 46.6 24.9zM80 128V432c0 17.7 14.3 32 32 32H336c17.7 0 32-14.3 32-32V128H80zm80 64V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16zm80 0V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16zm80 0V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16z"/></svg>`,
  variable: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M448 80v48c0 44.2-100.3 80-224 80S0 172.2 0 128V80C0 35.8 100.3 0 224 0S448 35.8 448 80zM393.2 214.7c20.8-7.4 39.2-16.9 54.8-28.6V288c0 44.2-100.3 80-224 80S0 332.2 0 288V186.1c15.6 11.7 34 21.2 54.8 28.6C111.8 236.6 165 240 224 240s112.2-3.4 169.2-25.3zM0 346.1c15.6 11.7 34 21.2 54.8 28.6C111.8 396.6 165 400 224 400s112.2-3.4 169.2-25.3c20.8-7.4 39.2-16.9 54.8-28.6V432c0 44.2-100.3 80-224 80S0 476.2 0 432V346.1z"/></svg>`,
};

export class ActionBlock {
  private el: HTMLElement;
  public data: IActionBlock;
  private onChange: () => void;
  private editorEl!: HTMLDivElement;
  private tokenMenu!: TokenMenu;
  private variableMenuEl!: HTMLElement;
  private variables: Variable[] = [];
  private mutationObserver!: MutationObserver;
  private savedRange: Range | null = null;
  /** This flow's own id — passed through to FlowRefModal so a flow can't
   * (directly) include itself in the "Incluir Fluxo" picker. Undefined for
   * contexts where no meaningful id exists yet; the modal simply doesn't
   * filter anything out in that case. */
  private excludeFlowId?: string;

  constructor(data: IActionBlock | undefined, onChange: () => void, excludeFlowId?: string) {
    this.data = data || {
      format: 'richtext',
      content: '',
      tokens: [],
    };
    // Ensure tokens array exists (migration)
    if (!this.data.tokens) this.data.tokens = [];
    
    this.onChange = onChange;
    this.excludeFlowId = excludeFlowId;
    this.el = document.createElement('div');
    this.el.className = 'block-card';
    this.el.id = 'action-block';
    this.render();
  }

  public getElement(): HTMLElement {
    return this.el;
  }

  public getData(): IActionBlock {
    this.data.content = this.editorEl.innerHTML;
    return this.data;
  }

  private render() {
    this.el.innerHTML = /* html */ `
      <div class="block-header">
        <div class="block-icon">${ICONS.keyboard}</div>
        <div class="block-title-wrap">
          <p class="block-step">${t('action.block.step')}</p>
          <h2 class="block-title">${t('action.block.title')}</h2>
        </div>
        <span class="block-badge">${t('action.block.badge')}</span>
        <div class="block-menu-wrap">
          <button class="block-menu-btn" title="${t('common.more_options')}">${ICONS.ellipsis}</button>
          <div class="block-menu" style="display:none;">
            <button class="block-menu-item danger" data-action="clear">
              ${ICONS.trash} ${t('action.block.menu.clear_text')}
            </button>
          </div>
        </div>
      </div>
      <div class="block-body" style="position: relative;">
        
        <div class="rt-toolbar" id="rt-toolbar">
          <button class="rt-btn" data-cmd="bold" style="font-weight:bold;">B</button>
          <button class="rt-btn" data-cmd="italic" style="font-style:italic;">I</button>
          <button class="rt-btn" data-cmd="underline" style="text-decoration:underline;">U</button>
          <div class="rt-divider"></div>
          <button class="rt-btn" data-cmd="insertUnorderedList" title="${t('action.block.toolbar.bulleted_list')}">${ICONS.listUl}</button>
          <button class="rt-btn" data-cmd="insertOrderedList" title="${t('action.block.toolbar.numbered_list')}">${ICONS.listOl}</button>
          <button class="rt-btn" data-cmd="createLink" title="${t('action.block.toolbar.insert_link')}">${ICONS.link}</button>
          <div class="rt-divider"></div>
          <button class="rt-btn" data-cmd="removeFormat" title="${t('action.block.toolbar.clear_formatting')}">${ICONS.code}</button>
          
          <div style="flex:1;"></div>
          <div style="position: relative;">
            <button class="rt-insert-variable" id="btn-insert-variable" title="${t('variable.insert_title')}">
              ${ICONS.variable} ${t('variable.insert_title')}
            </button>
            <div class="token-menu-overlay" id="variable-menu-container"></div>
          </div>
          <div style="position: relative;">
            <button class="rt-insert-token" id="btn-insert-token">
              ${ICONS.plus} ${t('token.insert_title')}
            </button>
            <div id="token-menu-container"></div>
          </div>
        </div>

        <div class="rt-editor-area" contenteditable="true" id="rt-editor"></div>

        <div class="tokens-preview" id="tokens-preview" style="display:none;">
          <p class="tokens-preview-title">${t('action.block.tokens_preview.title')}</p>
          <div class="tokens-preview-list" id="tokens-preview-list"></div>
        </div>
      </div>
    `;

    this.editorEl = this.el.querySelector<HTMLDivElement>('#rt-editor')!;
    this.editorEl.innerHTML = this.data.content || '<p><br></p>';

    // Rebind token interactions to existing tokens
    this.bindExistingTokens();

    this.variableMenuEl = this.el.querySelector<HTMLElement>('#variable-menu-container')!;

    this.bindHeaderMenu();
    this.bindEvents();
    this.setupObserver();
    this.renderTokensPreview();
  }

  private bindHeaderMenu() {
    const menuBtn = this.el.querySelector('.block-menu-btn') as HTMLElement;
    const menu = this.el.querySelector('.block-menu') as HTMLElement;

    const closeMenu = () => { menu.style.display = 'none'; };
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    });
    document.addEventListener('click', closeMenu);

    menu.querySelector('[data-action="clear"]')!.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMenu();
      if (confirm(t('action.block.clear_confirm'))) {
        this.editorEl.innerHTML = '<p><br></p>';
        this.data.content = '';
        this.data.tokens = [];
        this.renderTokensPreview();
        this.onChange();
      }
    });
  }

  private saveRange() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && this.editorEl.contains(sel.anchorNode)) {
      this.savedRange = sel.getRangeAt(0).cloneRange();
    }
  }

  private restoreRange() {
    if (this.savedRange) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(this.savedRange);
      }
    } else {
      const range = document.createRange();
      range.selectNodeContents(this.editorEl);
      range.collapse(false);
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  }

  private setupObserver() {
    this.mutationObserver = new MutationObserver((mutations) => {
      const candidateIds = new Set<string>();

      mutations.forEach(mutation => {
        mutation.removedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            if (el.classList.contains('token-pill')) {
              const id = el.getAttribute('data-token-id');
              if (id) candidateIds.add(id);
            } else {
              // Check if token pills were removed inside a parent node (e.g. deleting a paragraph)
              const childPills = el.querySelectorAll('.token-pill');
              childPills.forEach(child => {
                const id = child.getAttribute('data-token-id');
                if (id) candidateIds.add(id);
              });
            }
          }
        });
      });

      if (candidateIds.size === 0) return;

      // A pill can be "removed" here for two very different reasons:
      //  1. The user actually deleted it (typed over it / deleted the paragraph).
      //  2. It was swapped for a fresh node via `pillEl.replaceWith(newPill)`,
      //     which happens every time a token is edited (e.g. saving new
      //     Choice options) or self-healed in bindExistingTokens(). That
      //     also shows up as a removal, but an equivalent pill with the
      //     SAME data-token-id is reinserted immediately after.
      // Only treat case 1 as a real deletion — i.e. only drop the token from
      // data.tokens if no pill with that id remains anywhere in the editor.
      // Getting this wrong silently orphaned the token from `data.tokens`
      // while its pill (and data-token-config) stayed in the saved HTML,
      // which is why reopening a saved flow and clicking e.g. a Choice pill
      // did nothing: bindExistingTokens() couldn't find a matching token
      // and skipped attaching the click handler entirely.
      let tokensRemoved = false;
      candidateIds.forEach(id => {
        const stillPresent = this.editorEl.querySelector(`.token-pill[data-token-id="${id}"]`);
        if (!stillPresent) {
          this.removeTokenById(id);
          tokensRemoved = true;
        }
      });

      if (tokensRemoved) {
        this.renderTokensPreview();
        this.onChange();
      }
    });

    this.mutationObserver.observe(this.editorEl, { childList: true, subtree: true });
  }

  private removeTokenById(id: string) {
    this.data.tokens = this.data.tokens.filter(t => t.id !== id);
    this.reindexCursors();
  }

  private bindEvents() {
    // Toolbar
    const btns = this.el.querySelectorAll('.rt-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const cmd = (e.currentTarget as HTMLElement).dataset.cmd;
        if (!cmd) return;

        if (cmd === 'createLink') {
          const url = prompt(t('action.block.toolbar.insert_link_prompt'));
          if (url) document.execCommand(cmd, false, url);
        } else {
          document.execCommand(cmd, false);
        }
        this.editorEl.focus();
        this.updateToolbarState();
        this.onChange();
      });
    });

    this.editorEl.addEventListener('input', () => this.onChange());
    this.editorEl.addEventListener('keyup', () => { this.updateToolbarState(); this.saveRange(); });
    this.editorEl.addEventListener('mouseup', () => { this.updateToolbarState(); this.saveRange(); });
    this.editorEl.addEventListener('mouseleave', () => { this.updateToolbarState(); this.saveRange(); });

    // Token Menu
    this.tokenMenu = new TokenMenu((type) => this.insertToken(type));
    this.el.querySelector('#token-menu-container')!.appendChild(this.tokenMenu.getElement());

    const btnToken = this.el.querySelector<HTMLElement>('#btn-insert-token')!;
    btnToken.addEventListener('click', (e) => {
      e.stopPropagation();
      // Only one Cursor token is allowed per flow — grey it out in the menu
      // once one has already been inserted (recomputed on every open so it
      // re-enables immediately if the existing one gets deleted).
      const hasCursor = this.data.tokens.some(t => t.type === 'cursor');
      this.tokenMenu.setDisabledTypes(hasCursor ? ['cursor'] : []);
      this.tokenMenu.toggle();
    });
    document.addEventListener('click', (e) => {
      if (!btnToken.contains(e.target as Node) && !this.tokenMenu.getElement().contains(e.target as Node)) {
        this.tokenMenu.hide();
      }
    });

    // Variable Menu (inserts a plain "{{KEY}}" placeholder — resolved
    // against Global Variables at expansion time, see content.ts).
    const btnVariable = this.el.querySelector<HTMLElement>('#btn-insert-variable')!;
    btnVariable.addEventListener('click', async (e) => {
      e.stopPropagation();
      this.saveRange();
      await this.openVariableMenu();
    });
    document.addEventListener('click', (e) => {
      if (!btnVariable.contains(e.target as Node) && !this.variableMenuEl.contains(e.target as Node)) {
        this.variableMenuEl.classList.remove('is-open');
      }
    });
  }

  private updateToolbarState() {
    const btns = this.el.querySelectorAll('.rt-btn');
    btns.forEach(btn => {
      const cmd = (btn as HTMLElement).dataset.cmd;
      if (cmd && cmd !== 'createLink' && cmd !== 'removeFormat') {
        const isActive = document.queryCommandState(cmd);
        btn.classList.toggle('is-active', isActive);
      }
    });
  }

  /**
   * Fetches the current Global Variables list and (re)renders the dropdown
   * shown under the "Insert Variable" button, then opens it. Re-fetched on
   * every open (rather than cached once) so a variable created moments ago
   * on the Variables page shows up immediately without reloading the editor.
   */
  private async openVariableMenu() {
    this.variables = await storage.getVariables();

    if (this.variables.length === 0) {
      this.variableMenuEl.innerHTML = /* html */ `
        <div class="token-menu-item is-disabled">
          <div class="token-menu-icon" style="background-color:#404040;">${ICONS.variable}</div>
          <div class="token-menu-text">
            <p>${t('variable.none_title')}</p>
            <span>${t('variable.none_desc')}</span>
          </div>
        </div>
      `;
    } else {
      this.variableMenuEl.innerHTML = this.variables.map((v) => /* html */ `
        <div class="token-menu-item" data-key="${escapeHtml(v.key)}">
          <div class="token-menu-icon" style="background-color:#0d9488;">${ICONS.variable}</div>
          <div class="token-menu-text">
            <p>{{${escapeHtml(v.key)}}}</p>
            <span>${escapeHtml((v.value || '').slice(0, 40))}</span>
          </div>
        </div>
      `).join('');

      this.variableMenuEl.querySelectorAll<HTMLElement>('[data-key]').forEach((item) => {
        item.addEventListener('mousedown', (e) => {
          e.preventDefault(); // don't lose the saved selection/focus
          const key = item.dataset.key!;
          this.insertVariable(key);
          this.variableMenuEl.classList.remove('is-open');
        });
      });
    }

    this.variableMenuEl.classList.add('is-open');
  }

  /** Inserts the literal text "{{KEY}}" at the saved caret position. */
  private insertVariable(key: string) {
    this.editorEl.focus();
    this.restoreRange();

    const textNode = document.createTextNode(`{{${key}}}`);

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (this.editorEl.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        this.editorEl.appendChild(textNode);
      }
    } else {
      this.editorEl.appendChild(textNode);
    }

    const space = document.createTextNode('\u00A0');
    textNode.parentNode?.insertBefore(space, textNode.nextSibling);

    this.onChange();
  }

  private insertToken(type: Token['type']) {
    // Only one Cursor token is allowed per flow (the engine only ever uses
    // the first one it finds at expansion time — extra ones were silently
    // discarded). The menu already greys this option out once one exists,
    // but this guard protects against it being called any other way.
    if (type === 'cursor' && this.data.tokens.some(t => t.type === 'cursor')) {
      alert(t('action.block.cursor_exists_alert'));
      return;
    }

    this.editorEl.focus();
    this.restoreRange();
    
    // Default config if needed
    let config: any = {};
    if (type === 'clipboard') config.index = 1;
    if (type === 'date') config.format = 'DD/MM/YYYY';
    if (type === 'random') config.options = [
      { id: crypto.randomUUID(), text: '', weight: 50 },
      { id: crypto.randomUUID(), text: '', weight: 50 },
    ];
    if (type === 'flow_ref') config.flowId = '';

    const token: Token = { id: crypto.randomUUID(), type, config };
    this.data.tokens.push(token);

    const cursorNumber = type === 'cursor' ? this.data.tokens.filter(t => t.type === 'cursor').length : undefined;
    const pill = TokenPill.createNode(token, cursorNumber);

    this.attachPillInteractivity(pill, token);

    // Insert into selection
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (this.editorEl.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        range.insertNode(pill);
        range.setStartAfter(pill);
        range.setEndAfter(pill);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        this.editorEl.appendChild(pill);
      }
    } else {
      this.editorEl.appendChild(pill);
    }
    
    const space = document.createTextNode('\u00A0');
    pill.parentNode?.insertBefore(space, pill.nextSibling);

    this.renderTokensPreview();
    this.onChange();

    // Unlike other tokens, an unconfigured flow_ref pill resolves to
    // nothing at all — prompt for which flow to include right away
    // instead of leaving a silently-empty pill for the user to notice
    // and click into later.
    if (type === 'flow_ref') {
      pill.click();
    }
  }

  private bindExistingTokens() {
    const pills = this.editorEl.querySelectorAll('.token-pill');
    let migrated = false;

    pills.forEach((pillEl) => {
      const id = pillEl.getAttribute('data-token-id');
      const token = this.data.tokens.find(t => t.id === id);
      if (!token) return;

      // Self-healing migration: pills saved before `data-token-config`
      // existed on the pill (see TokenPill.createHTML) don't carry their
      // own config yet, which used to make the expansion popup fall back
      // to "Error: No options" at runtime because it could no longer trust
      // a possibly-out-of-sync `tokens` array. Simply loading the flow in
      // the editor now regenerates every such pill's HTML from the (still
      // correct, in-memory) token data — the next Save persists the fix
      // with no manual "reopen the token" step required.
      if (!pillEl.getAttribute('data-token-config')) {
        const cursorNumber = token.type === 'cursor' ? this.getCursorIndex(token.id) : undefined;
        const newHtml = TokenPill.createHTML(token, cursorNumber);
        const temp = document.createElement('div');
        temp.innerHTML = newHtml;
        const newPill = temp.firstElementChild as HTMLElement;
        pillEl.replaceWith(newPill);
        this.attachPillInteractivity(newPill, token);
        migrated = true;
        return;
      }

      this.attachPillInteractivity(pillEl as HTMLElement, token);
    });

    if (migrated) {
      // Flags the flow as needing a save so the migrated HTML actually
      // gets persisted, instead of silently reverting next time it loads.
      this.onChange();
    }
  }

  private attachPillInteractivity(pillEl: HTMLElement, token: Token) {
    pillEl.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const onSave = (newConfig: any) => {
        token.config = { ...token.config, ...newConfig };
        // Re-render this specific pill's HTML to update label
        const cursorNumber = token.type === 'cursor' ? this.getCursorIndex(token.id) : undefined;
        const newHtml = TokenPill.createHTML(token, cursorNumber);
        
        const temp = document.createElement('div');
        temp.innerHTML = newHtml;
        const newPill = temp.firstElementChild as HTMLElement;
        
        pillEl.replaceWith(newPill);
        this.attachPillInteractivity(newPill, token);
        this.renderTokensPreview();
        this.onChange();
      };

      if (token.type === 'choice') new ChoiceModal(token, onSave).open();
      if (token.type === 'random') new RandomModal(token, onSave).open();
      if (token.type === 'clipboard') new ClipboardModal(token, onSave).open();
      if (token.type === 'input') new InputModal(token, onSave).open();
      if (token.type === 'date') new DateModal(token, onSave).open();
      if (token.type === 'flow_ref') new FlowRefModal(token, this.excludeFlowId, onSave).open();
    });
  }

  private getCursorIndex(id: string): number {
    const cursors = this.data.tokens.filter(t => t.type === 'cursor');
    return cursors.findIndex(t => t.id === id) + 1;
  }

  /**
   * Human-readable preview of a token's *configured value* — as opposed to
   * TokenPill's short in-line label, this is meant to be read at a glance
   * in the tokens list below the editor, without opening each token's
   * modal one by one. All user-typed config (choice options, input
   * label/placeholder, date format) is HTML-escaped before insertion.
   */
  private describeTokenValue(token: Token): string {
    const cfg = (token.config || {}) as Record<string, unknown>;
    switch (token.type) {
      case 'choice': {
        const opts = (cfg.options as string[]) || [];
        return opts.length
          ? opts.map((o) => escapeHtml(o)).join(' <span class="tokens-preview-sep">·</span> ')
          : `<em>${t('action.block.tokens_preview.no_options')}</em>`;
      }
      case 'random': {
        const opts = (cfg.options as { text: string; weight: number }[]) || [];
        return opts.length
          ? opts.map((o) => `${escapeHtml(o.text)} <span class="tokens-preview-sep">(${Math.round(o.weight)}%)</span>`).join(' <span class="tokens-preview-sep">·</span> ')
          : `<em>${t('action.block.tokens_preview.no_options')}</em>`;
      }
      case 'input': {
        const label = escapeHtml((cfg.label as string) || '');
        const placeholder = cfg.placeholder ? escapeHtml(cfg.placeholder as string) : '';
        if (!label) return `<em>${t('action.block.tokens_preview.no_label')}</em>`;
        return placeholder
          ? `${label} <span class="tokens-preview-sep">·</span> ${t('token.input.placeholder_field')}: ${placeholder}`
          : label;
      }
      case 'date':
        return escapeHtml((cfg.format as string) || 'DD/MM/YYYY');
      case 'clipboard':
        return `#${Number(cfg.index) || 1}`;
      case 'cursor':
        return t('token.cursor.desc');
      case 'url':
        return t('token.url.desc');
      case 'title':
        return t('token.title.desc');
      case 'flow_ref': {
        const flowLabel = cfg.flowLabel as string | undefined;
        return flowLabel ? escapeHtml(flowLabel) : `<em>${t('action.block.tokens_preview.no_flow_selected')}</em>`;
      }
      default:
        return '';
    }
  }

  /**
   * Re-renders the "tokens used" preview list below the editor — every
   * token currently in this.data.tokens, with its type and configured
   * value, so the user can see what each pill actually expands to without
   * clicking into each one. Hidden entirely when there are no tokens.
   * Called after every operation that adds/edits/removes a token.
   */
  private renderTokensPreview() {
    const container = this.el.querySelector<HTMLElement>('#tokens-preview');
    const list = this.el.querySelector<HTMLElement>('#tokens-preview-list');
    if (!container || !list) return;

    if (this.data.tokens.length === 0) {
      container.style.display = 'none';
      list.innerHTML = '';
      return;
    }
    container.style.display = '';

    const editableTypes = new Set(['choice', 'clipboard', 'input', 'date', 'random', 'flow_ref']);

    list.innerHTML = this.data.tokens.map((token) => {
      const isEditable = editableTypes.has(token.type);
      return /* html */ `
        <div class="tokens-preview-item${isEditable ? ' is-editable' : ''}" data-token-id="${token.id}">
          <span class="tokens-preview-dot token-${token.type}"></span>
          <span class="tokens-preview-type">${t(`token.${token.type}`)}</span>
          <span class="tokens-preview-value">${this.describeTokenValue(token)}</span>
        </div>
      `;
    }).join('');

    // Clicking a row opens the same edit modal as clicking the pill itself
    // in the editor — just forward the click instead of duplicating the
    // modal-opening logic already in attachPillInteractivity().
    list.querySelectorAll<HTMLElement>('.tokens-preview-item.is-editable').forEach((row) => {
      row.addEventListener('click', () => {
        const id = row.dataset.tokenId!;
        const pill = this.editorEl.querySelector<HTMLElement>(`.token-pill[data-token-id="${id}"]`);
        pill?.click();
      });
    });
  }

  private reindexCursors() {
    // Iterate over pills in DOM, update label if they are cursor tokens
    const pills = this.editorEl.querySelectorAll('.token-pill.token-cursor');
    pills.forEach((pillEl, domIndex) => {
      const id = pillEl.getAttribute('data-token-id');
      const token = this.data.tokens.find(t => t.id === id);
      if (token && token.type === 'cursor') {
        const newHtml = TokenPill.createHTML(token, domIndex + 1);
        const temp = document.createElement('div');
        temp.innerHTML = newHtml;
        const newPill = temp.firstElementChild as HTMLElement;
        pillEl.replaceWith(newPill);
        this.attachPillInteractivity(newPill, token);
      }
    });
  }
}
