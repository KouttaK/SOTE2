/**
 * src/dashboard/pages/templates.ts — Reusable Models (Templates) page
 */
import type { Page } from './index.js';
import { storage } from '../../shared/storage/StorageService.js';
import type { Template, Flow, ActionBlock } from '../../shared/types/index.js';
import './templates.css';

const ICONS = {
  search: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor"><path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"/></svg>`,
  plus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" aria-hidden="true" fill="currentColor"><path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z"/></svg>`,
  code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" aria-hidden="true" fill="currentColor"><path d="M392.8 1.2c-17-4.9-34.7 5-39.6 22l-128 448c-4.9 17 5 34.7 22 39.6s34.7-5 39.6-22l128-448c4.9-17-5-34.7-22-39.6zm80.6 120.1c-12.5 12.5-12.5 32.8 0 45.3L562.7 256l-89.4 89.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l112-112c12.5-12.5 12.5-32.8 0-45.3l-112-112c-12.5-12.5-32.8-12.5-45.3 0zm-306.7 0c-12.5-12.5-32.8-12.5-45.3 0l-112 112c-12.5 12.5-12.5 32.8 0 45.3l112 112c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256l89.4-89.4c12.5-12.5 12.5-32.8 0-45.3z"/></svg>`,
  ellipsis: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" aria-hidden="true" fill="currentColor"><path d="M8 256a56 56 0 1 1 112 0A56 56 0 1 1 8 256zm160 0a56 56 0 1 1 112 0 56 56 0 1 1 -112 0zm216-56a56 56 0 1 1 0 112 56 56 0 1 1 0-112z"/></svg>`,
  save: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" aria-hidden="true" fill="currentColor"><path d="M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V173.3c0-17-6.7-33.3-18.7-45.3L352 50.7C340 38.7 323.7 32 306.7 32H64zm0 96c0-17.7 14.3-32 32-32H288c17.7 0 32 14.3 32 32v64c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V128zM224 288a64 64 0 1 1 0 128 64 64 0 1 1 0-128z"/></svg>`,
  trash: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" aria-hidden="true" fill="currentColor"><path d="M170.5 51.6L151.5 80h145l-19-28.4c-1.5-2.2-4-3.6-6.7-3.6H177.1c-2.7 0-5.2 1.3-6.7 3.6zm147-26.6L354.2 80H368h48 8c13.3 0 24 10.7 24 24s-10.7 24-24 24h-8V432c0 44.2-35.8 80-80 80H112c-44.2 0-80-35.8-80-80V128H24c-13.3 0-24-10.7-24-24S10.7 80 24 80h8H80 93.8l36.7-55.1C140.9 9.4 158.4 0 177.1 0h93.7c18.7 0 36.2 9.4 46.6 24.9zM80 128V432c0 17.7 14.3 32 32 32H336c17.7 0 32-14.3 32-32V128H80zm80 64V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16zm80 0V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16zm80 0V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16z"/></svg>`,
  copy: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor"><path d="M448 384H256c-35.3 0-64-28.7-64-64V64c0-35.3 28.7-64 64-64H396.1c12.7 0 24.9 5.1 33.9 14.1l67.9 67.9c9 9 14.1 21.2 14.1 33.9V320c0 35.3-28.7 64-64 64zM64 128h96v48H64c-8.8 0-16 7.2-16 16V448c0 8.8 7.2 16 16 16H256c8.8 0 16-7.2 16-16V416h48v32c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V192c0-35.3 28.7-64 64-64z"/></svg>`,
  info: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"/></svg>`
};

class TemplatesPage implements Page {
  private el: HTMLElement;
  private templates: Template[] = [];
  private filteredTemplates: Template[] = [];
  private searchQuery = '';
  private flows: Flow[] = [];
  private activeTemplate: Template | null = null;
  private isEditing = false; // true if creating new or editing

  // Editor states
  private draftName = '';
  private draftTag = '';
  private draftContent = '';

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'page-templates';
  }

  render(): HTMLElement {
    this.el.innerHTML = /* html */ `
      <header class="tpl-header">
        <div>
          <h1 class="tpl-header-title">Reusable Models</h1>
          <p class="tpl-header-subtitle">Create and manage rich-text blocks embeddable in any flow</p>
        </div>
        <div class="tpl-actions">
          <div class="tpl-search">
            ${ICONS.search}
            <input type="text" id="tpl-search-input" placeholder="Search models..." />
          </div>
          <button class="btn-primary" id="btn-create-tpl">
            ${ICONS.plus}
            Create New Model
          </button>
        </div>
      </header>

      <main class="tpl-main">
        <aside class="tpl-sidebar">
          <div class="tpl-sidebar-header">
            <span class="tpl-sidebar-count" id="tpl-count">0 Models</span>
          </div>
          <div class="tpl-list" id="tpl-list">
            <!-- Rendered templates list -->
          </div>
        </aside>

        <section class="tpl-editor-area" id="tpl-editor-area">
          <!-- Editor or empty state will be injected here -->
        </section>
      </main>
    `;
    return this.el;
  }

  async mount() {
    this.templates = await storage.getTemplates();
    this.flows = await storage.getFlows();
    this.applySearch();

    this.el.querySelector('#tpl-search-input')?.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value.trim().toLowerCase();
      this.applySearch();
    });

    this.el.querySelector('#btn-create-tpl')?.addEventListener('click', () => {
      this.createNewTemplate();
    });
  }

  unmount() {}

  private applySearch() {
    if (!this.searchQuery) {
      this.filteredTemplates = [...this.templates];
    } else {
      this.filteredTemplates = this.templates.filter(
        (t) =>
          t.name.toLowerCase().includes(this.searchQuery) ||
          t.tag.toLowerCase().includes(this.searchQuery) ||
          t.content.toLowerCase().includes(this.searchQuery)
      );
    }
    this.renderSidebar();
    
    if (this.activeTemplate && !this.filteredTemplates.find(t => t.id === this.activeTemplate?.id)) {
      this.activeTemplate = null;
    }
    
    if (!this.isEditing) {
      if (this.filteredTemplates.length > 0 && !this.activeTemplate) {
        this.selectTemplate(this.filteredTemplates[0]);
      } else if (this.filteredTemplates.length === 0) {
        this.renderEmptyState();
      }
    }
  }

  private renderSidebar() {
    this.el.querySelector('#tpl-count')!.textContent = `${this.filteredTemplates.length} Models`;
    const list = this.el.querySelector('#tpl-list');
    if (!list) return;

    list.innerHTML = this.filteredTemplates.map(t => {
      const isActive = this.activeTemplate?.id === t.id && !this.isEditing;
      const strippedContent = t.content.replace(/<[^>]+>/g, ' ');

      return /* html */ `
        <div class="tpl-card ${isActive ? 'active' : ''}" data-id="${t.id}">
          <div class="tpl-card-top">
            <h3 class="tpl-card-title">${this.escapeHTML(t.name)}</h3>
            ${ICONS.ellipsis}
          </div>
          <div class="tpl-card-tag">
            ${ICONS.code}
            {{modelo:${t.tag}}}
          </div>
          <p class="tpl-card-desc">${this.escapeHTML(strippedContent) || 'Empty content...'}</p>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.tpl-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.id;
        const t = this.templates.find(x => x.id === id);
        if (t) {
          this.isEditing = false;
          this.selectTemplate(t);
        }
      });
    });
  }

  private renderEmptyState() {
    const area = this.el.querySelector('#tpl-editor-area');
    if (!area) return;
    area.innerHTML = /* html */ `
      <div class="tpl-empty-state">
        ${ICONS.code}
        <h3>No models found</h3>
        <p>Select a model from the sidebar or create a new one.</p>
      </div>
    `;
  }

  private createNewTemplate() {
    this.isEditing = true;
    this.activeTemplate = null;
    this.draftName = 'New Model';
    this.draftTag = 'new_model';
    this.draftContent = '';
    
    // Deselect list
    this.el.querySelectorAll('.tpl-card').forEach(c => c.classList.remove('active'));
    this.renderEditor();
  }

  private selectTemplate(template: Template) {
    this.activeTemplate = template;
    this.draftName = template.name;
    this.draftTag = template.tag;
    this.draftContent = template.content;
    
    // Update active class
    this.el.querySelectorAll('.tpl-card').forEach(c => {
      if ((c as HTMLElement).dataset.id === template.id) c.classList.add('active');
      else c.classList.remove('active');
    });

    this.renderEditor();
  }

  private countTemplateUsage(tag: string): Flow[] {
    const tokenStr = `{{modelo:${tag}}}`;
    const affectedFlows: Flow[] = [];
    for (const flow of this.flows) {
      for (const block of flow.blocks) {
        if (block.type === 'action') {
          if ((block as ActionBlock).content.includes(tokenStr)) {
            affectedFlows.push(flow);
            break;
          }
        }
      }
    }
    return affectedFlows;
  }

  private renderEditor() {
    const area = this.el.querySelector('#tpl-editor-area');
    if (!area) return;

    let usagesHtml = '';
    let usagesCount = 0;
    
    if (this.activeTemplate) {
      const affected = this.countTemplateUsage(this.activeTemplate.tag);
      usagesCount = affected.length;
      usagesHtml = /* html */ `
        <div class="mt-4 p-3 bg-neutral-900 border border-neutral-800 rounded-lg flex items-start gap-2" style="margin-top: 1rem; padding: 0.75rem; background-color: #171717; border: 1px solid #262626; border-radius: 0.5rem; display: flex; align-items: flex-start; gap: 0.5rem;">
          <div style="color: #737373; margin-top: 0.125rem;">${ICONS.info}</div>
          <p style="color: #737373; font-size: 0.75rem; margin: 0;">
            This model is embedded in <span style="color: #d4d4d4;">${usagesCount} active flow(s)</span>. Saving changes here will update all instances automatically.
          </p>
        </div>
      `;
    }

    area.innerHTML = /* html */ `
      <div class="tpl-form">
        <div class="tpl-form-header">
          <h2>${this.activeTemplate ? 'Edit Model' : 'Create Model'}</h2>
          <div class="tpl-form-actions">
            ${this.activeTemplate ? `<button class="btn-danger" id="btn-delete-tpl" title="Delete Model">${ICONS.trash} Delete</button>` : ''}
            <button class="btn-primary" id="btn-save-tpl">
              ${ICONS.save}
              Save Model
            </button>
          </div>
        </div>
        
        <div style="display: flex; gap: 1rem;">
          <div class="form-group" style="flex: 1;">
            <label class="form-label">Model Name</label>
            <input type="text" id="tpl-name" class="form-input" value="${this.escapeHTML(this.draftName)}" placeholder="E.g. Support Signature" />
          </div>
          <div class="form-group" style="flex: 1;">
            <label class="form-label">Embed Tag</label>
            <div style="display: flex; align-items: center; gap: 0.5rem; background-color: #171717; border: 1px solid #262626; border-radius: 0.5rem; padding: 0 0.5rem;">
              <span style="color: #737373; padding-left: 0.5rem;">{{modelo:</span>
              <input type="text" id="tpl-tag" style="background: transparent; border: none; outline: none; color: #fff; padding: 0.75rem 0; width: 100%; font-size: 0.875rem;" value="${this.escapeHTML(this.draftTag)}" placeholder="signature" />
              <span style="color: #737373; padding-right: 0.5rem;">}}</span>
              ${this.activeTemplate ? `
              <button id="btn-copy-tag" style="background: transparent; border: none; color: #737373; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0.5rem;" title="Copy to clipboard">
                ${ICONS.copy}
              </button>
              ` : ''}
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Content</label>
          <div class="tpl-action-block-wrapper">
            <!-- Extremely simple richtext editor placeholder since ActionBlock component doesn't easily decouple here, or rather I will just use contenteditable div -->
            <div style="background-color: #0a0a0a; border: 1px solid #262626; border-radius: 0.5rem; padding: 1rem; min-height: 200px;" id="tpl-content-editor" contenteditable="true">${this.draftContent}</div>
          </div>
        </div>

        ${usagesHtml}
      </div>
    `;

    // Bind inputs
    const inputName = area.querySelector<HTMLInputElement>('#tpl-name')!;
    const inputTag = area.querySelector<HTMLInputElement>('#tpl-tag')!;
    const editor = area.querySelector<HTMLDivElement>('#tpl-content-editor')!;
    
    inputTag.addEventListener('input', () => {
      inputTag.value = inputTag.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    });

    area.querySelector('#btn-save-tpl')?.addEventListener('click', async () => {
      const name = inputName.value.trim();
      const tag = inputTag.value.trim();
      const content = editor.innerHTML.trim();

      if (!name || !tag) return alert('Name and Tag are required');

      // Check unique tag
      if ((!this.activeTemplate || this.activeTemplate.tag !== tag) && this.templates.some(t => t.tag === tag)) {
        return alert('This tag is already in use by another model.');
      }

      const newTpl: Template = {
        id: this.activeTemplate?.id || crypto.randomUUID(),
        name,
        tag,
        content,
        format: 'richtext',
        updatedAt: Date.now()
      };

      await storage.saveTemplate(newTpl);
      
      const idx = this.templates.findIndex(t => t.id === newTpl.id);
      if (idx !== -1) {
        this.templates[idx] = newTpl;
      } else {
        this.templates.push(newTpl);
      }
      
      this.isEditing = false;
      this.applySearch();
      this.selectTemplate(newTpl);
    });

    area.querySelector('#btn-delete-tpl')?.addEventListener('click', () => {
      if (this.activeTemplate) {
        this.openDeleteModal(this.activeTemplate);
      }
    });

    area.querySelector('#btn-copy-tag')?.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLElement;
      navigator.clipboard.writeText(`{{modelo:${inputTag.value}}}`);
      const og = btn.innerHTML;
      btn.innerHTML = `<span style="color: #4ade80; font-size: 0.75rem;">Copied!</span>`;
      setTimeout(() => btn.innerHTML = og, 1500);
    });
  }

  private openDeleteModal(template: Template) {
    const affectedFlows = this.countTemplateUsage(template.tag);

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    
    let warningHtml = '';
    if (affectedFlows.length > 0) {
      warningHtml = /* html */ `
        <div style="background-color: #3f2c2c; border: 1px solid #dc2626; border-radius: 0.5rem; padding: 1rem; margin-top: 1rem;">
          <p style="color: #fca5a5; font-size: 0.875rem; font-weight: bold; margin: 0 0 0.5rem 0;">
            Warning: This model is currently embedded in ${affectedFlows.length} flow(s)!
          </p>
          <div class="affected-flows-list">
            ${affectedFlows.map(f => `<div class="affected-flows-item">${this.escapeHTML(f.name)}</div>`).join('')}
          </div>
          <p style="color: #fca5a5; font-size: 0.75rem; margin: 0.5rem 0 0 0;">
            Deleting this model will break these flows (the raw tags will be injected instead).
          </p>
        </div>
      `;
    }

    modal.innerHTML = /* html */ `
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">Delete Model?</h2>
          <p class="modal-desc">Are you sure you want to delete <span style="background-color: #262626; padding: 0.125rem 0.25rem; border-radius: 0.25rem; color: #d4d4d4;">{{modelo:${template.tag}}}</span>? This action cannot be undone.</p>
        </div>
        ${warningHtml}
        <div class="modal-footer">
          <button class="btn-secondary" id="modal-cancel">Cancel</button>
          <button class="btn-danger-solid" id="modal-confirm">Yes, Delete</button>
        </div>
      </div>
    `;
    this.el.appendChild(modal);

    modal.querySelector('#modal-cancel')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#modal-confirm')?.addEventListener('click', async () => {
      await storage.deleteTemplate(template.id);
      this.templates = this.templates.filter(t => t.id !== template.id);
      this.activeTemplate = null;
      this.applySearch();
      modal.remove();
    });
  }

  private escapeHTML(str: string): string {
    return str.replace(/[&<>'"]/g, 
      tag => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#39;',
          '"': '&quot;'
        }[tag] || tag)
    );
  }
}

export const page = new TemplatesPage();
