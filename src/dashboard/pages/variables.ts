/**
 * src/dashboard/pages/variables.ts — Global Variables page
 */
import type { Page } from './index.js';
import { storage } from '../../shared/storage/StorageService.js';
import type { Variable, Flow, Block, ActionBlock } from '../../shared/types/index.js';
import './variables.css';

const ICONS = {
  search: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor"><path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"/></svg>`,
  plus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" aria-hidden="true" fill="currentColor"><path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z"/></svg>`,
  globe: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor"><path d="M352 256c0 22.2-1.2 43.6-3.3 64H163.3c-2.2-20.4-3.3-41.8-3.3-64s1.2-43.6 3.3-64H348.7c2.2 20.4 3.3 41.8 3.3 64zm28.8-64H503.9c5.3 20.5 8.1 41.9 8.1 64s-2.8 43.5-8.1 64H380.8c2.1-20.6 3.2-42 3.2-64s-1.1-43.4-3.2-64zm112.6-32H376.7c-10-63.9-29.8-117.4-55.3-151.6c78.3 20.7 142 77.5 171.9 151.6zm-149.1 0H167.7c6.1-36.4 15.5-68.6 27-94.7c10.5-23.6 22.2-40.7 33.5-51.5C239.4 3.2 248.7 0 256 0s16.6 3.2 27.8 13.8c11.3 10.8 23 27.9 33.5 51.5c11.6 26 20.9 58.2 27 94.7zm-209 0H18.6C48.6 85.9 112.2 29.1 190.6 8.4C165.1 42.6 145.3 96.1 135.3 160zM8.1 192H131.2c-2.1 20.6-3.2 42-3.2 64s1.1 43.4 3.2 64H8.1C2.8 299.5 0 278.1 0 256s2.8-43.5 8.1-64zM194.7 446.6c-11.6-26-20.9-58.2-27-94.6H344.3c-6.1 36.4-15.5 68.6-27 94.6c-10.5 23.6-22.2 40.7-33.5 51.5C272.6 508.8 263.3 512 256 512s-16.6-3.2-27.8-13.8c-11.3-10.8-23-27.9-33.5-51.5zM135.3 352c10 63.9 29.8 117.4 55.3 151.6C112.2 482.9 48.6 426.1 18.6 352H135.3zm358.1 0c-30 74.1-93.6 130.9-171.9 151.6c25.5-34.2 45.2-87.7 55.3-151.6H493.4z"/></svg>`,
  code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" aria-hidden="true" fill="currentColor"><path d="M392.8 1.2c-17-4.9-34.7 5-39.6 22l-128 448c-4.9 17 5 34.7 22 39.6s34.7-5 39.6-22l128-448c4.9-17-5-34.7-22-39.6zm80.6 120.1c-12.5 12.5-12.5 32.8 0 45.3L562.7 256l-89.4 89.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l112-112c12.5-12.5 12.5-32.8 0-45.3l-112-112c-12.5-12.5-32.8-12.5-45.3 0zm-306.7 0c-12.5-12.5-32.8-12.5-45.3 0l-112 112c-12.5 12.5-12.5 32.8 0 45.3l112 112c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256l89.4-89.4c12.5-12.5 12.5-32.8 0-45.3z"/></svg>`,
  pencil: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor"><path d="M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z"/></svg>`,
  trash: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" aria-hidden="true" fill="currentColor"><path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"/></svg>`,
  times: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" aria-hidden="true" fill="currentColor"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></svg>`,
  check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" aria-hidden="true" fill="currentColor"><path d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/></svg>`,
  database: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" aria-hidden="true" fill="currentColor"><path d="M448 80v48c0 44.2-100.3 80-224 80S0 172.2 0 128V80C0 35.8 100.3 0 224 0S448 35.8 448 80zM393.2 214.7c20.8-7.4 39.2-16.9 54.8-28.6V288c0 44.2-100.3 80-224 80S0 332.2 0 288V186.1c15.6 11.7 34 21.2 54.8 28.6C111.8 236.6 165 240 224 240s112.2-3.4 169.2-25.3zM0 346.1c15.6 11.7 34 21.2 54.8 28.6C111.8 396.6 165 400 224 400s112.2-3.4 169.2-25.3c20.8-7.4 39.2-16.9 54.8-28.6V432c0 44.2-100.3 80-224 80S0 476.2 0 432V346.1z"/></svg>`,
  network: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" aria-hidden="true" fill="currentColor"><path d="M312 32c-13.3 0-24 10.7-24 24s10.7 24 24 24h16c61.9 0 112 50.1 112 112v16H344c-13.3 0-24 10.7-24 24v128c0 13.3 10.7 24 24 24h96c13.3 0 24-10.7 24-24V232c0-13.3-10.7-24-24-24h-96v-16c0-44.2-35.8-80-80-80h-16c-13.3 0-24-10.7-24-24s10.7-24 24-24h16c79.5 0 144 64.5 144 144v16h24c13.3 0 24 10.7 24 24v128c0 13.3-10.7 24-24 24H344c-13.3 0-24-10.7-24-24V232c0-13.3 10.7-24 24-24h24v-16c0-61.9-50.1-112-112-112h-16zm-88 0c-13.3 0-24 10.7-24 24s10.7 24 24 24h16c61.9 0 112 50.1 112 112v16h-96c-13.3 0-24 10.7-24 24v128c0 13.3 10.7 24 24 24h96c13.3 0 24-10.7 24-24V232c0-13.3-10.7-24-24-24h-96v-16c0-44.2 35.8-80 80-80h16c13.3 0 24-10.7 24-24s-10.7-24-24-24h-16C156.5 32 92 96.5 92 176v16H68c-13.3 0-24 10.7-24 24v128c0 13.3 10.7 24 24 24h96c13.3 0 24-10.7 24-24V232c0-13.3-10.7-24-24-24H140v-16c0-61.9 50.1-112 112-112h16z"/></svg>`,
};

class VariablesPage implements Page {
  private el: HTMLElement;
  private variables: Variable[] = [];
  private filteredVars: Variable[] = [];
  private searchQuery = '';
  private flows: Flow[] = [];

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'page-variables';
  }

  render(): HTMLElement {
    this.el.innerHTML = /* html */ `
      <header class="vars-header">
        <div>
          <h1 class="vars-header-title">Global Variables</h1>
          <p class="vars-header-subtitle">Manage shared key-value pairs used across all flows</p>
        </div>
        <div class="vars-actions">
          <div class="vars-search">
            ${ICONS.search}
            <input type="text" id="vars-search-input" placeholder="Search variables..." />
          </div>
          <div class="vars-divider"></div>
          <button class="btn-primary" id="btn-create-var">
            ${ICONS.plus}
            Create Variable
          </button>
        </div>
      </header>

      <main class="vars-main">
        <!-- Banner -->
        <div class="vars-banner" id="vars-banner">
          <div class="vars-banner-icon">${ICONS.globe}</div>
          <div class="vars-banner-content">
            <p class="title">How it works</p>
            <p class="desc">
              Global variables let you define a value once and reuse it in multiple flows using the syntax <span class="tag">{{YOUR_VARIABLE_KEY}}</span>.
              If you update the variable here, it will automatically update in all flows where it's used.
            </p>
          </div>
          <button class="vars-banner-close" id="btn-close-banner">${ICONS.times}</button>
        </div>

        <!-- Stats -->
        <div class="vars-stats">
          <div class="vars-stat-card">
            <div class="vars-stat-icon">${ICONS.database}</div>
            <div class="vars-stat-info">
              <p class="val" id="stat-total-vars">0</p>
              <p class="lbl">Total Variables</p>
            </div>
          </div>
          <div class="vars-stat-card">
            <div class="vars-stat-icon">${ICONS.network}</div>
            <div class="vars-stat-info">
              <p class="val" id="stat-total-uses">0</p>
              <p class="lbl">Total Usages in Flows</p>
            </div>
          </div>
        </div>

        <!-- Table -->
        <div class="vars-table-wrap">
          <div class="vars-table-header">
            <span class="col-3">Key</span>
            <span class="col-5">Value</span>
            <span class="col-1 text-center">Flows</span>
            <span class="col-2 text-right">Last Updated</span>
            <span class="col-1"></span>
          </div>
          <div id="vars-table-body">
            <!-- Rendered list -->
          </div>
        </div>
      </main>
    `;
    return this.el;
  }

  async mount() {
    this.variables = await storage.getVariables();
    this.flows = await storage.getFlows();
    this.applySearch();

    this.el.querySelector('#vars-search-input')?.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value.trim().toLowerCase();
      this.applySearch();
    });

    this.el.querySelector('#btn-create-var')?.addEventListener('click', () => {
      this.openVarModal();
    });

    this.el.querySelector('#btn-close-banner')?.addEventListener('click', (e) => {
      (e.currentTarget as HTMLElement).closest('.vars-banner')?.remove();
    });
  }

  unmount() {
    // GC
  }

  private applySearch() {
    if (!this.searchQuery) {
      this.filteredVars = [...this.variables];
    } else {
      this.filteredVars = this.variables.filter(
        (v) =>
          v.key.toLowerCase().includes(this.searchQuery) ||
          v.value.toLowerCase().includes(this.searchQuery) ||
          (v.description && v.description.toLowerCase().includes(this.searchQuery))
      );
    }
    this.renderTable();
  }

  private countVarUsage(key: string): number {
    const tokenStr = `{{${key}}}`;
    let count = 0;
    for (const flow of this.flows) {
      let flowUsed = false;
      for (const block of flow.blocks) {
        if (block.type === 'action') {
          if ((block as ActionBlock).content.includes(tokenStr)) {
            flowUsed = true;
          }
        }
      }
      if (flowUsed) count++;
    }
    return count;
  }

  private renderTable() {
    const tbody = this.el.querySelector('#vars-table-body');
    if (!tbody) return;

    this.el.querySelector('#stat-total-vars')!.textContent = this.variables.length.toString();
    
    let totalUses = 0;
    
    tbody.innerHTML = this.filteredVars
      .map((v) => {
        const usageCount = this.countVarUsage(v.key);
        totalUses += usageCount;

        const date = new Date(v.updatedAt || Date.now());
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        return /* html */ `
          <div class="vars-table-row">
            <div class="col-3">
              <button class="var-key-pill" data-key="${v.key}" title="Copy to clipboard">
                ${ICONS.code}
                <span class="var-key-text">{{${v.key}}}</span>
              </button>
            </div>
            <div class="col-5">
              <p class="var-value-text">${this.escapeHTML(v.value)}</p>
            </div>
            <div class="col-1 text-center">
              <span class="var-used-badge">${usageCount}</span>
            </div>
            <div class="col-2 text-right">
              <span class="var-date">${dateStr}</span>
            </div>
            <div class="col-1 var-actions">
              <button class="btn-icon" data-edit="${v.id}" title="Edit Variable">
                ${ICONS.pencil}
              </button>
              <button class="btn-icon danger" data-delete="${v.id}" title="Delete Variable">
                ${ICONS.trash}
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    this.el.querySelector('#stat-total-uses')!.textContent = totalUses.toString();

    // Attach listeners
    tbody.querySelectorAll('.var-key-pill').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const key = (e.currentTarget as HTMLElement).dataset.key;
        if (key) {
          navigator.clipboard.writeText(`{{${key}}}`);
          // visual feedback
          const original = btn.innerHTML;
          btn.innerHTML = ICONS.check + '<span class="var-key-text">Copied</span>';
          setTimeout(() => (btn.innerHTML = original), 1500);
        }
      });
    });

    tbody.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.edit;
        const v = this.variables.find((v) => v.id === id);
        if (v) this.openVarModal(v);
      });
    });

    tbody.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.delete;
        const v = this.variables.find((v) => v.id === id);
        if (v) this.openDeleteModal(v);
      });
    });
  }

  private openVarModal(variable?: Variable) {
    const isEdit = !!variable;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = /* html */ `
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">${isEdit ? 'Edit Variable' : 'Create Global Variable'}</h2>
          <p class="modal-desc">${isEdit ? 'Update the value for all your flows.' : 'Define a new reusable key-value pair.'}</p>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Key</label>
            <input type="text" class="form-input uppercase" id="var-key" placeholder="E.g. COMPANY_NAME" value="${variable?.key || ''}" ${isEdit ? 'disabled' : ''} />
          </div>
          <div class="form-group">
            <label class="form-label">Value</label>
            <textarea class="form-textarea" id="var-value" placeholder="Enter the value to inject...">${variable?.value || ''}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Description (Optional)</label>
            <input type="text" class="form-input" id="var-desc" placeholder="What is this used for?" value="${variable?.description || ''}" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" id="modal-cancel">Cancel</button>
          <button class="btn-primary" id="modal-save">Save Variable</button>
        </div>
      </div>
    `;
    this.el.appendChild(modal);

    const inputKey = modal.querySelector<HTMLInputElement>('#var-key')!;
    const inputValue = modal.querySelector<HTMLTextAreaElement>('#var-value')!;
    const inputDesc = modal.querySelector<HTMLInputElement>('#var-desc')!;

    // Force uppercase and allowed chars for key
    inputKey.addEventListener('input', () => {
      inputKey.value = inputKey.value.toUpperCase().replace(/[^A-Z0-9_]/g, '');
    });

    modal.querySelector('#modal-cancel')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#modal-save')?.addEventListener('click', async () => {
      const key = inputKey.value.trim();
      const value = inputValue.value;
      const desc = inputDesc.value.trim();

      if (!key) return alert('Key is required');
      if (!value) return alert('Value is required');

      // Check unique key on create
      if (!isEdit && this.variables.some((v) => v.key === key)) {
        return alert('This key already exists.');
      }

      const newVar: Variable = {
        id: isEdit ? variable.id : crypto.randomUUID(),
        key,
        value,
        description: desc,
        updatedAt: Date.now(),
      };

      await storage.saveVariable(newVar);
      // Wait, we need to refresh local list since onChanged doesn't auto-refresh our dashboard variables instance yet, or we just manually update it.
      if (isEdit) {
        const idx = this.variables.findIndex(v => v.id === newVar.id);
        if (idx !== -1) this.variables[idx] = newVar;
      } else {
        this.variables.push(newVar);
      }
      
      this.applySearch();
      modal.remove();
    });
  }

  private openDeleteModal(variable: Variable) {
    // Check usages
    const tokenStr = `{{${variable.key}}}`;
    const affectedFlows: Flow[] = [];
    for (const flow of this.flows) {
      for (const block of flow.blocks) {
        if (block.type === 'action' && (block as ActionBlock).content.includes(tokenStr)) {
          affectedFlows.push(flow);
          break; // once per flow
        }
      }
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    
    let warningHtml = '';
    if (affectedFlows.length > 0) {
      warningHtml = /* html */ `
        <div style="background-color: #3f2c2c; border: 1px solid #dc2626; border-radius: 0.5rem; padding: 1rem; margin-top: 1rem;">
          <p style="color: #fca5a5; font-size: 0.875rem; font-weight: bold; margin: 0 0 0.5rem 0;">
            Warning: This variable is currently used in ${affectedFlows.length} flow(s)!
          </p>
          <div class="affected-flows-list">
            ${affectedFlows.map(f => `<div class="affected-flows-item">${this.escapeHTML(f.name)}</div>`).join('')}
          </div>
          <p style="color: #fca5a5; font-size: 0.75rem; margin: 0.5rem 0 0 0;">
            Deleting this variable will break these flows (the raw tags will be injected instead).
          </p>
        </div>
      `;
    }

    modal.innerHTML = /* html */ `
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">Delete Variable?</h2>
          <p class="modal-desc">Are you sure you want to delete <span class="tag">{{${variable.key}}}</span>? This action cannot be undone.</p>
        </div>
        ${warningHtml}
        <div class="modal-footer">
          <button class="btn-secondary" id="modal-cancel">Cancel</button>
          <button class="btn-danger" id="modal-confirm">Yes, Delete</button>
        </div>
      </div>
    `;
    this.el.appendChild(modal);

    modal.querySelector('#modal-cancel')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#modal-confirm')?.addEventListener('click', async () => {
      await storage.deleteVariable(variable.id);
      this.variables = this.variables.filter(v => v.id !== variable.id);
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

export const page = new VariablesPage();
