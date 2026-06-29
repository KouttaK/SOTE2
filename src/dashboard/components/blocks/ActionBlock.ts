/**
 * src/dashboard/components/blocks/ActionBlock.ts
 */

import type { ActionBlock as IActionBlock, Token } from '../../../shared/types/index.js';
import { TokenPill } from '../tokens/TokenPill.js';
import { TokenMenu } from '../tokens/TokenMenu.js';
import { ChoiceModal } from '../tokens/modals/ChoiceModal.js';
import { ClipboardModal } from '../tokens/modals/ClipboardModal.js';
import { InputModal } from '../tokens/modals/InputModal.js';
import { DateModal } from '../tokens/modals/DateModal.js';

const ICONS = {
  keyboard: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor"><path d="M64 64C28.7 64 0 92.7 0 128V384c0 35.3 28.7 64 64 64H512c35.3 0 64-28.7 64-64V128c0-35.3-28.7-64-64-64H64zm16 64h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H80c-8.8 0-16-7.2-16-16V144c0-8.8 7.2-16 16-16zM64 240c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H80c-8.8 0-16-7.2-16-16V240zm16 80h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H80c-8.8 0-16-7.2-16-16V336c0-8.8 7.2-16 16-16zm80-176c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H176c-8.8 0-16-7.2-16-16V144zm16 80h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H176c-8.8 0-16-7.2-16-16V240c0-8.8 7.2-16 16-16zM160 336c0-8.8 7.2-16 16-16H400c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H176c-8.8 0-16-7.2-16-16V336zM272 128h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H272c-8.8 0-16-7.2-16-16V144c0-8.8 7.2-16 16-16zM256 240c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H272c-8.8 0-16-7.2-16-16V240zM368 128h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H368c-8.8 0-16-7.2-16-16V144c0-8.8 7.2-16 16-16zM352 240c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H368c-8.8 0-16-7.2-16-16V240zM464 128h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H464c-8.8 0-16-7.2-16-16V144c0-8.8 7.2-16 16-16zM448 240c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H464c-8.8 0-16-7.2-16-16V240zm16 80h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H464c-8.8 0-16-7.2-16-16V336c0-8.8 7.2-16 16-16z"/></svg>`,
  listUl: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M64 144a48 48 0 1 0 0-96 48 48 0 1 0 0 96zM192 64c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zM64 464a48 48 0 1 0 0-96 48 48 0 1 0 0 96zm48-208a48 48 0 1 0 -96 0 48 48 0 1 0 96 0z"/></svg>`,
  listOl: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M24 56c0-13.3 10.7-24 24-24H80c13.3 0 24 10.7 24 24V176h16c13.3 0 24 10.7 24 24s-10.7 24-24 24H40c-13.3 0-24-10.7-24-24s10.7-24 24-24H56V80H48C34.7 80 24 69.3 24 56zM86.7 341.2c-6.5-7.4-18.3-6.9-24 1.2L51.5 357.9c-7.7 10.8-22.7 13.3-33.5 5.6s-13.3-22.7-5.6-33.5l11.1-15.6c23.7-33.2 72.3-35.6 99.2-4.9c21.3 24.4 20.8 60.9-1.1 84.7L86.8 432H120c13.3 0 24 10.7 24 24s-10.7 24-24 24H32c-9.5 0-18.2-5.6-22-14.4s-2.1-18.9 4.3-25.9l72-78c5.3-5.8 5.4-14.6 .3-20.5zM224 64H480c17.7 0 32 14.3 32 32s-14.3 32-32 32H224c-17.7 0-32-14.3-32-32s14.3-32 32-32zm0 160H480c17.7 0 32 14.3 32 32s-14.3 32-32 32H224c-17.7 0-32-14.3-32-32s14.3-32 32-32zm0 160H480c17.7 0 32 14.3 32 32s-14.3-32-32-32H224c-17.7 0-32-14.3-32-32s14.3-32 32-32z"/></svg>`,
  link: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" fill="currentColor"><path d="M579.8 267.7c56.5-56.5 56.5-148 0-204.5c-50-50-128.8-56.5-186.3-15.4l-1.6 1.1c-14.4 10.3-17.7 30.3-7.4 44.6s30.3 17.7 44.6 7.4l1.6-1.1c32.1-22.9 76-19.3 103.8 8.6c31.5 31.5 31.5 82.5 0 114L422.3 334.8c-31.5 31.5-82.5 31.5-114 0c-27.9-27.9-31.5-71.8-8.6-103.8l1.1-1.6c10.3-14.4 6.9-34.4-7.4-44.6s-34.4-6.9-44.6 7.4l-1.1 1.6C206.5 251.2 213 330 263 380c56.5 56.5 148 56.5 204.5 0L579.8 267.7zM60.2 244.3c-56.5 56.5-56.5 148 0 204.5c50 50 128.8 56.5 186.3 15.4l1.6-1.1c14.4-10.3 17.7-30.3 7.4-44.6s-30.3-17.7-44.6-7.4l-1.6 1.1c-32.1 22.9-76 19.3-103.8-8.6C74 372 74 321 105.5 289.5L217.7 177.2c31.5-31.5 82.5-31.5 114 0c27.9 27.9 31.5 71.8 8.6 103.9l-1.1 1.6c-10.3 14.4-6.9 34.4 7.4 44.6s34.4 6.9 44.6-7.4l1.1-1.6C433.5 260.8 427 182 377 132c-56.5-56.5-148-56.5-204.5 0L60.2 244.3z"/></svg>`,
  code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" fill="currentColor"><path d="M392.8 1.2c-17-4.9-34.7 5-39.6 22l-128 448c-4.9 17 5 34.7 22 39.6s34.7-5 39.6-22l128-448c4.9-17-5-34.7-22-39.6zm80.6 120.1c-12.5 12.5-12.5 32.8 0 45.3L562.7 256l-89.4 89.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l112-112c12.5-12.5 12.5-32.8 0-45.3l-112-112c-12.5-12.5-32.8-12.5-45.3 0zm-306.7 0c-12.5-12.5-32.8-12.5-45.3 0l-112 112c-12.5 12.5-12.5 32.8 0 45.3l112 112c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256l89.4-89.4c12.5-12.5 12.5-32.8 0-45.3z"/></svg>`,
  plus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z"/></svg>`,
};

export class ActionBlock {
  private el: HTMLElement;
  public data: IActionBlock;
  private onChange: () => void;
  private editorEl!: HTMLDivElement;
  private tokenMenu!: TokenMenu;
  private mutationObserver!: MutationObserver;
  private savedRange: Range | null = null;

  constructor(data: IActionBlock | undefined, onChange: () => void) {
    this.data = data || {
      format: 'richtext',
      content: '',
      tokens: [],
    };
    // Ensure tokens array exists (migration)
    if (!this.data.tokens) this.data.tokens = [];
    
    this.onChange = onChange;
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
          <p class="block-step">Step 3</p>
          <h2 class="block-title">Action: Insert this text</h2>
        </div>
        <span class="block-badge">Output</span>
      </div>
      <div class="block-body" style="position: relative;">
        
        <div class="rt-toolbar" id="rt-toolbar">
          <button class="rt-btn" data-cmd="bold" style="font-weight:bold;">B</button>
          <button class="rt-btn" data-cmd="italic" style="font-style:italic;">I</button>
          <button class="rt-btn" data-cmd="underline" style="text-decoration:underline;">U</button>
          <div class="rt-divider"></div>
          <button class="rt-btn" data-cmd="insertUnorderedList" title="Bulleted List">${ICONS.listUl}</button>
          <button class="rt-btn" data-cmd="insertOrderedList" title="Numbered List">${ICONS.listOl}</button>
          <button class="rt-btn" data-cmd="createLink" title="Insert Link">${ICONS.link}</button>
          <div class="rt-divider"></div>
          <button class="rt-btn" data-cmd="removeFormat" title="Clear Formatting">${ICONS.code}</button>
          
          <div style="flex:1;"></div>
          <div style="position: relative;">
            <button class="rt-insert-token" id="btn-insert-token">
              ${ICONS.plus} Insert Token
            </button>
            <div id="token-menu-container"></div>
          </div>
        </div>

        <div class="rt-editor-area" contenteditable="true" id="rt-editor"></div>
      </div>
    `;

    this.editorEl = this.el.querySelector<HTMLDivElement>('#rt-editor')!;
    this.editorEl.innerHTML = this.data.content || '<p><br></p>';

    // Rebind token interactions to existing tokens
    this.bindExistingTokens();

    this.bindEvents();
    this.setupObserver();
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
      let tokensRemoved = false;
      mutations.forEach(mutation => {
        mutation.removedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            if (el.classList.contains('token-pill')) {
              const id = el.getAttribute('data-token-id');
              if (id) {
                this.removeTokenById(id);
                tokensRemoved = true;
              }
            } else {
              // Check if token pills were removed inside a parent node (e.g. deleting a paragraph)
              const childPills = el.querySelectorAll('.token-pill');
              childPills.forEach(child => {
                const id = child.getAttribute('data-token-id');
                if (id) {
                  this.removeTokenById(id);
                  tokensRemoved = true;
                }
              });
            }
          }
        });
      });
      if (tokensRemoved) {
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
          const url = prompt('Enter URL:');
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
      this.tokenMenu.toggle();
    });
    document.addEventListener('click', (e) => {
      if (!btnToken.contains(e.target as Node) && !this.tokenMenu.getElement().contains(e.target as Node)) {
        this.tokenMenu.hide();
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

  private insertToken(type: Token['type']) {
    this.editorEl.focus();
    this.restoreRange();
    
    // Default config if needed
    let config: any = {};
    if (type === 'clipboard') config.index = 1;
    if (type === 'date') config.format = 'DD/MM/YYYY';

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

    this.onChange();
  }

  private bindExistingTokens() {
    const pills = this.editorEl.querySelectorAll('.token-pill');
    pills.forEach((pillEl) => {
      const id = pillEl.getAttribute('data-token-id');
      const token = this.data.tokens.find(t => t.id === id);
      if (token) {
        this.attachPillInteractivity(pillEl as HTMLElement, token);
      }
    });
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
        this.onChange();
      };

      if (token.type === 'choice') new ChoiceModal(token, onSave).open();
      if (token.type === 'clipboard') new ClipboardModal(token, onSave).open();
      if (token.type === 'input') new InputModal(token, onSave).open();
      if (token.type === 'date') new DateModal(token, onSave).open();
    });
  }

  private getCursorIndex(id: string): number {
    const cursors = this.data.tokens.filter(t => t.type === 'cursor');
    return cursors.findIndex(t => t.id === id) + 1;
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
