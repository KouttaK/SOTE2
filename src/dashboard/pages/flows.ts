/**
 * src/dashboard/pages/flows.ts — Flows Page Implementation
 */

import type { Page } from './index.js';
import { storage } from '../../shared/storage/StorageService.js';
import type { Flow, Folder, Variable } from '../../shared/types/index.js';
import { router } from '../router.js';
import { t } from '../../shared/i18n/index.js';
import './flows.css';

// ---------------------------------------------------------------------------
// SVGs
// ---------------------------------------------------------------------------
const ICONS_LOCAL = {
  clock: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M256 0a256 256 0 1 1 0 512A256 256 0 1 1 256 0zM232 120V256c0 8 4 15.5 10.7 20l96 64c11 7.4 25.9 4.4 33.3-6.7s4.4-25.9-6.7-33.3L280 243.2V120c0-13.3-10.7-24-24-24s-24 10.7-24 24z"/></svg>`,
  bolt: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>`,
  fire: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M159.3 5.4c7.8-7.3 19.9-7.2 27.7 .1c27.6 25.9 53.5 53.8 77.7 84c11-14.4 23.5-30.1 37-42.9c7.9-7.4 20.1-7.4 28 .1c34.6 33 63.9 76.6 84.5 118c20.3 40.8 33.8 82.5 33.8 111.9C448 404.2 348.2 512 224 512C98.4 512 0 404.1 0 276.5c0-38.4 17.8-85.3 45.4-131.7C73.3 97.7 112.7 48.6 159.3 5.4zM225.7 416c25.3 0 47.7-7 68.8-21c42.1-29.4 53.4-88.2 28.1-134.4c-4.5-9-16-9.6-22.5-2l-25.2 29.3c-6.6 7.6-18.5 7.4-24.7-.5c-16.5-21-46-58.5-62.8-79.8c-6.3-8-18.3-8.1-24.7-.1c-33.8 42.5-50.8 69.3-50.8 99.4C112 375.4 162.6 416 225.7 416z"/></svg>`,
  trendUp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor"><path d="M384 160c-17.7 0-32-14.3-32-32s14.3-32 32-32H544c17.7 0 32 14.3 32 32V288c0 17.7-14.3 32-32 32s-32-14.3-32-32V205.3L342.6 374.6c-12.5 12.5-32.8 12.5-45.3 0L192 269.3 54.6 406.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l160-160c12.5-12.5 32.8-12.5 45.3 0L320 306.7 466.7 160H384z"/></svg>`,
  plus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z"/></svg>`,
  edit: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M441 58.9L453.1 71c9.4 9.4 9.4 24.6 0 33.9L424 134.1 377.9 88 407 58.9c9.4-9.4 24.6-9.4 33.9 0zM209.8 256.2L344 121.9 390.1 168 255.8 302.2c-2.9 2.9-6.5 5-10.4 6.1l-58.5 16.7 16.7-58.5c1.1-3.9 3.2-7.5 6.1-10.4zM373.1 25L175.8 222.2c-8.7 8.7-15 19.4-18.3 31.1l-28.6 100c-2.4 8.4-.1 17.4 6.1 23.6s15.2 8.5 23.6 6.1l100-28.6c11.8-3.4 22.5-9.7 31.1-18.3L487 138.9c28.1-28.1 28.1-73.7 0-101.8L474.9 25C446.8-3.1 401.2-3.1 373.1 25zM88 64C39.4 64 0 103.4 0 152V424c0 48.6 39.4 88 88 88H360c48.6 0 88-39.4 88-88V312c0-13.3-10.7-24-24-24s-24 10.7-24 24V424c0 22.1-17.9 40-40 40H88c-22.1 0-40-17.9-40-40V152c0-22.1 17.9-40 40-40H200c13.3 0 24-10.7 24-24s-10.7-24-24-24H88z"/></svg>`,
  trash: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M170.5 51.6L151.5 80h145l-19-28.4c-1.5-2.2-4-3.6-6.7-3.6H177.1c-2.7 0-5.2 1.3-6.7 3.6zm147-26.6L354.2 80H368h48 8c13.3 0 24 10.7 24 24s-10.7 24-24 24h-8V432c0 44.2-35.8 80-80 80H112c-44.2 0-80-35.8-80-80V128H24c-13.3 0-24-10.7-24-24S10.7 80 24 80h8H80 93.8l36.7-55.1C140.9 9.4 158.4 0 177.1 0h93.7c18.7 0 36.2 9.4 46.6 24.9zM80 128V432c0 17.7 14.3 32 32 32H336c17.7 0 32-14.3 32-32V128H80zm80 64V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16zm80 0V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16zm80 0V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16z"/></svg>`,
  folder: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M64 480H448c35.3 0 64-28.7 64-64V160c0-35.3-28.7-64-64-64H288c-18.9 0-36.8-7.3-50.5-20.4L205.8 44.1C196.2 34.1 182.7 28 168.4 28H64C28.7 28 0 56.7 0 92v324c0 35.3 28.7 64 64 64z"/></svg>`
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts the rich HTML produced by the Action-block contenteditable
 * editor (e.g. "<p>Hello</p><p>World</p>") into a single line of plain
 * text ("Hello World") suitable for the flows-table row preview. Block
 * elements (paragraphs, list items) are joined with a space instead of
 * being concatenated raw, which is what previously caused the browser to
 * render nested/adjacent <p> tags as separate lines.
 */
function htmlToPreviewText(html: string): string {
  // textContent concatenates block elements with no separator at all
  // ("<p>Hello</p><p>World</p>" -> "HelloWorld"), so insert a space at
  // each block boundary/line-break before reading it back out as text.
  const withBreaks = (html || '').replace(/<\/(p|div|li|h[1-6])>|<br\s*\/?>/gi, ' $&');
  const div = document.createElement('div');
  div.innerHTML = withBreaks;
  return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
}

/**
 * Replaces every `{{KEY}}` placeholder in plain text with the matching
 * Global Variable's value — same substitution content.ts performs at
 * runtime and PreviewModal.ts performs in the editor's Preview modal.
 * Unknown keys are left untouched.
 */
function resolveVariablesText(text: string, variables: Variable[]): string {
  if (!variables.length || !text.includes('{{')) return text;
  const map = new Map(variables.map((v) => [v.key, v.value]));
  return text.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    const value = map.get(key);
    return value === undefined ? match : value;
  });
}

// ---------------------------------------------------------------------------
// Page Class
// ---------------------------------------------------------------------------
export default class FlowsPage implements Page {
  private el!: HTMLElement;
  private allFlows: Flow[] = [];
  private allFolders: Folder[] = [];
  private allVariables: Variable[] = [];
  private currentFolderFilter: string | null = null;
  private currentSearchQuery = '';

  private searchInput: HTMLInputElement | null = null;
  private searchHandler!: (e: Event) => void;
  private sortHandler!: (e: Event) => void;
  private currentSort: 'Category' | 'Name' | 'Usage' | 'Date' = 'Category';

  /** Escapes HTML-significant characters before interpolating user-controlled
   * strings (flow/folder names, shortcuts, variable values) into innerHTML. */
  private escapeHTML(str: string): string {
    return str.replace(
      /[&<>'"]/g,
      (tag) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#39;',
          '"': '&quot;',
        }[tag] || tag),
    );
  }

  render(): HTMLElement {
    this.el = document.createElement('div');
    this.el.id = 'page-flows';
    


    this.el.innerHTML = /* html */ `
      <div class="flows-header">
        <div>
          <h1 class="flows-title">${t('flows.title')}</h1>
          <p class="flows-subtitle">${t('flows.subtitle')}</p>
        </div>
      </div>

      <!-- Stats Row -->
      <div class="flows-stats" id="flows-stats-container">
        <!-- Rendered dynamically -->
      </div>

      <!-- Folder Tabs -->
      <div class="flows-folders" id="flows-folders-container">
        <!-- Rendered dynamically -->
      </div>

      <!-- Table -->
      <div class="flows-table-wrap">
        <div class="flows-th">
          <div class="th-col">${t('flows.th.on')}</div>
          <div class="th-col">${t('flows.th.shortcut')}</div>
          <div class="th-col">${t('flows.th.category')}</div>
          <div class="th-col">${t('flows.th.preview')}</div>
          <div class="th-col">${t('flows.th.usage')}</div>
          <div class="th-col" style="justify-content: flex-end">${t('flows.th.actions')}</div>
        </div>
        <div id="flows-tbody"></div>
      </div>
    `;

    return this.el;
  }

  async mount(): Promise<void> {
    // 1. Fetch data
    const [flows, folders, variables] = await Promise.all([
      storage.getFlows(),
      storage.getFolders(),
      storage.getVariables()
    ]);
    
    this.allFlows = flows;
    this.allFolders = folders;
    this.allVariables = variables;

    // 2. Bind global search input (from shell)
    this.searchInput = document.getElementById('dash-search-input') as HTMLInputElement | null;
    if (this.searchInput) {
      let debounceTimer: ReturnType<typeof setTimeout>;
      this.searchHandler = (e: Event) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.currentSearchQuery = (e.target as HTMLInputElement).value.toLowerCase();
          this.renderList();
        }, 200);
      };
      this.searchInput.addEventListener('input', this.searchHandler);
      this.searchInput.value = ''; // clear on mount
    }

    const sortBtn = document.getElementById('dash-sort-btn');
    if (sortBtn) {
      this.sortHandler = () => {
        if (this.currentSort === 'Category') this.currentSort = 'Name';
        else if (this.currentSort === 'Name') this.currentSort = 'Usage';
        else if (this.currentSort === 'Usage') this.currentSort = 'Date';
        else this.currentSort = 'Category';

        const sortKey = this.currentSort === 'Name' ? 'header.sort_by.name'
          : this.currentSort === 'Usage' ? 'header.sort_by.usage'
          : this.currentSort === 'Date' ? 'header.sort_by.date'
          : 'header.sort_by.category';
        const label = sortBtn.querySelector('.dash-header-btn-label');
        if (label) label.textContent = t('header.sort_by', { value: t(sortKey) });

        this.renderList();
      };
      sortBtn.addEventListener('click', this.sortHandler);
    }

    // 3. Render everything
    this.renderStats();
    this.renderFolders();
    this.renderList();
  }

  unmount(): void {
    if (this.searchInput && this.searchHandler) {
      this.searchInput.removeEventListener('input', this.searchHandler);
    }
    const sortBtn = document.getElementById('dash-sort-btn');
    if (sortBtn && this.sortHandler) {
      sortBtn.removeEventListener('click', this.sortHandler);
    }
  }

  // ── Renderers ────────────────────────────────────────────────────────────

  private renderStats() {
    const container = this.el.querySelector('#flows-stats-container')!;
    
    const totalFlows = this.allFlows.length;
    const totalUsage = this.allFlows.reduce((sum, f) => sum + (f.stats.usageCount || 0), 0);
    const totalKeys = this.allFlows.reduce((sum, f) => sum + (f.stats.keysSaved || 0), 0);
    
    // Most used flow
    let mostUsed = this.allFlows[0];
    for (const f of this.allFlows) {
      if ((f.stats.usageCount || 0) > (mostUsed?.stats.usageCount || 0)) mostUsed = f;
    }
    const mostUsedShortcut = mostUsed 
      ? `/${(mostUsed.blocks.find(b => b.type === 'trigger')?.data as any)?.shortcut || mostUsed.name}` 
      : t('flows.stats.none');
    
    const hrsSaved = (totalKeys * 250 / 1000 / 60 / 60).toFixed(1);

    container.innerHTML = /* html */ `
      <div class="stat-card">
        <div class="stat-header">
          <div>
            <p class="stat-label">${t('flows.stats.time_saved')}</p>
            <p class="stat-value">${t('flows.stats.hrs_value', { hrs: hrsSaved })}</p>
            <p class="stat-sub">${t('flows.stats.estimated')}</p>
          </div>
          <div class="stat-icon">${ICONS_LOCAL.clock}</div>
        </div>
        <div class="stat-footer">
          ${ICONS_LOCAL.trendUp}
          <span>${t('flows.stats.based_on_keys')}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-header">
          <div>
            <p class="stat-label">${t('flows.stats.total_shortcuts')}</p>
            <p class="stat-value">${totalFlows}</p>
            <p class="stat-sub">${t('flows.stats.across_folders', { count: this.allFolders.length })}</p>
          </div>
          <div class="stat-icon">${ICONS_LOCAL.bolt}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-header">
          <div>
            <p class="stat-label">${t('flows.stats.most_used')}</p>
            <p class="stat-value">${mostUsedShortcut}</p>
            <p class="stat-sub">${t('flows.usage_count', { count: mostUsed?.stats.usageCount || 0 })}</p>
          </div>
          <div class="stat-icon">${ICONS_LOCAL.fire}</div>
        </div>
      </div>
    `;
  }

  private renderFolders() {
    const container = this.el.querySelector('#flows-folders-container')!;
    container.innerHTML = '';

    // "All" tab
    const allBtn = document.createElement('button');
    allBtn.className = `folder-tab ${this.currentFolderFilter === null ? 'is-active' : ''}`;
    allBtn.innerHTML = `${t('flows.folder.all')} <span class="folder-count">${this.allFlows.length}</span>`;
    allBtn.onclick = () => {
      this.currentFolderFilter = null;
      this.renderFolders();
      this.renderList();
    };
    container.appendChild(allBtn);

    // "Uncategorised" tab if there are flows without folder
    const uncategorisedCount = this.allFlows.filter(f => !f.folderId).length;
    if (uncategorisedCount > 0) {
      const uncatBtn = document.createElement('button');
      uncatBtn.className = `folder-tab ${this.currentFolderFilter === 'uncategorised' ? 'is-active' : ''}`;
      uncatBtn.innerHTML = `${t('flows.folder.none')} <span class="folder-count">${uncategorisedCount}</span>`;
      uncatBtn.onclick = () => {
        this.currentFolderFilter = 'uncategorised';
        this.renderFolders();
        this.renderList();
      };
      container.appendChild(uncatBtn);
    }

    // Dynamic folders
    this.allFolders.forEach(folder => {
      const count = this.allFlows.filter(f => f.folderId === folder.id).length;
      const btn = document.createElement('button');
      btn.className = `folder-tab ${this.currentFolderFilter === folder.id ? 'is-active' : ''}`;
      btn.innerHTML = `${this.escapeHTML(folder.name)} <span class="folder-count">${count}</span>`;
      btn.onclick = () => {
        this.currentFolderFilter = folder.id;
        this.renderFolders();
        this.renderList();
      };
      // Right click to delete
      btn.oncontextmenu = async (e) => {
        e.preventDefault();
        if (confirm(t('flows.folder.delete_confirm', { name: folder.name }))) {
          await storage.deleteFolder(folder.id);
          this.allFolders = this.allFolders.filter(f => f.id !== folder.id);
          if (this.currentFolderFilter === folder.id) this.currentFolderFilter = null;
          this.renderFolders();
          this.renderList();
        }
      };
      container.appendChild(btn);
    });

    // Add button
    const addBtn = document.createElement('button');
    addBtn.className = 'folder-add-btn';
    addBtn.innerHTML = ICONS_LOCAL.plus;
    addBtn.title = t('flows.folder.create_title');
    addBtn.onclick = async () => {
      const name = prompt(t('flows.folder.prompt_name'));
      if (name) {
        await storage.saveFolder({ id: crypto.randomUUID(), name, color: '#3b82f6', order: this.allFolders.length });
        this.allFolders = await storage.getFolders();
        this.renderFolders();
      }
    };
    container.appendChild(addBtn);
  }

  private renderList() {
    const tbody = this.el.querySelector('#flows-tbody')!;
    tbody.innerHTML = '';

    // Filter — always start from a fresh copy so sorting never mutates the
    // underlying allFlows array as a side effect (it used to: when neither
    // a folder nor a search filter was active, `filtered` was literally the
    // same array reference as `this.allFlows`, so `.sort()` reordered the
    // master list in place).
    let filtered = [...this.allFlows];
    
    // By Folder
    if (this.currentFolderFilter === 'uncategorised') {
      filtered = filtered.filter(f => !f.folderId);
    } else if (this.currentFolderFilter !== null) {
      filtered = filtered.filter(f => f.folderId === this.currentFolderFilter);
    }

    // By Search
    if (this.currentSearchQuery) {
      filtered = filtered.filter(f => {
        const trigger = f.blocks.find(b => b.type === 'trigger');
        const shortcut = trigger ? (trigger.data as any).shortcut.toLowerCase() : '';
        return f.name.toLowerCase().includes(this.currentSearchQuery) || shortcut.includes(this.currentSearchQuery);
      });
    }

    // Sort — every branch always falls back to a name comparison so ties
    // (e.g. several flows that all have 0 uses, or all sit in the same/no
    // folder — very common right after creating a batch of flows) still
    // produce a deterministic, visibly-different order instead of leaving
    // everything in place and looking like Sort By did nothing.
    filtered.sort((a, b) => {
      if (this.currentSort === 'Usage') {
        const usageA = a.stats.usageCount || 0;
        const usageB = b.stats.usageCount || 0;
        if (usageA !== usageB) return usageB - usageA;
        return a.name.localeCompare(b.name);
      } else if (this.currentSort === 'Date') {
        // Most recently created first; fall back to name on ties (e.g.
        // flows imported/created in the same batch/millisecond).
        const createdA = a.createdAt || 0;
        const createdB = b.createdAt || 0;
        if (createdA !== createdB) return createdB - createdA;
        return a.name.localeCompare(b.name);
      } else if (this.currentSort === 'Name') {
        return a.name.localeCompare(b.name);
      } else {
        // Category
        const folderA = this.allFolders.find(f => f.id === a.folderId)?.name || t('flows.folder.none');
        const folderB = this.allFolders.find(f => f.id === b.folderId)?.name || t('flows.folder.none');
        if (folderA === folderB) {
          return a.name.localeCompare(b.name);
        }
        return folderA.localeCompare(folderB);
      }
    });

    if (filtered.length === 0) {
      tbody.innerHTML = /* html */ `
        <div class="flows-empty">
          ${ICONS_LOCAL.folder}
          <h3>${t('flows.empty_title')}</h3>
          <p>${t('flows.empty_desc')}</p>
        </div>
      `;
      return;
    }

    // Find highest usage for the progress bar max
    const maxUsage = Math.max(...filtered.map(f => f.stats.usageCount || 0), 1);

    filtered.forEach(flow => {
      const row = document.createElement('div');
      row.className = 'flows-row';

      const trigger = flow.blocks.find(b => b.type === 'trigger');
      const action = flow.blocks.find(b => b.type === 'action');
      const shortcutText = this.escapeHTML(trigger ? (trigger.data as any).shortcut : flow.name);
      // action.content is rich HTML (e.g. "<p>Hello</p><p>World</p>") coming
      // straight out of the contenteditable Action-block editor. Slicing
      // that HTML as if it were plain text and dropping it into another
      // <p class="row-preview"> produced nested <p> tags, which the browser
      // auto-closes into two separate block-level paragraphs — that's what
      // made the preview render on two lines no matter what CSS was applied
      // to .row-preview. Strip tags down to plain text first so there's only
      // ever a single text node to truncate and display.
      const previewText = action
        ? this.escapeHTML(resolveVariablesText(htmlToPreviewText((action.data as any).content), this.allVariables).slice(0, 50))
        : t('flows.preview_empty');
      
      const folder = this.allFolders.find(f => f.id === flow.folderId);
      const folderName = this.escapeHTML(folder ? folder.name : t('flows.folder.none'));
      
      const usagePct = ((flow.stats.usageCount || 0) / maxUsage) * 100;

      // Highlighting logic
      const highlight = (text: string) => {
        if (!this.currentSearchQuery) return text;
        const regex = new RegExp(`(${this.currentSearchQuery})`, 'gi');
        return text.replace(regex, '<span class="row-preview-highlight">$1</span>');
      };

      row.innerHTML = /* html */ `
        <!-- On/Off -->
        <div>
          <div class="row-toggle ${flow.enabled ? 'is-on' : ''}" data-id="${flow.id}" title="${flow.enabled ? t('flows.toggle.disable') : t('flows.toggle.enable')}"></div>
        </div>
        <!-- Shortcut -->
        <div>
          <span class="row-shortcut">/${highlight(shortcutText)}</span>
        </div>
        <!-- Category (Folder/Tags) -->
        <div>
          <span class="row-tag" style="cursor:pointer;" data-folder="${flow.folderId || 'uncategorised'}">
            ${ICONS_LOCAL.folder}
            ${folderName}
          </span>
        </div>
        <!-- Preview -->
        <div>
          <p class="row-preview">${highlight(previewText)}</p>
        </div>
        <!-- Usage -->
        <div class="row-usage">
          <div class="usage-track">
            <div class="usage-fill" style="width: ${usagePct}%"></div>
          </div>
          <span class="usage-count">${flow.stats.usageCount || 0}</span>
        </div>
        <!-- Actions -->
        <div class="row-actions">
          <button class="action-btn btn-edit" title="${t('flows.action.edit')}">${ICONS_LOCAL.edit}</button>
          <button class="action-btn btn-delete" title="${t('flows.action.delete')}">${ICONS_LOCAL.trash}</button>
        </div>
      `;

      // Events
      const toggle = row.querySelector('.row-toggle')!;
      toggle.addEventListener('click', async () => {
        flow.enabled = !flow.enabled;
        toggle.classList.toggle('is-on', flow.enabled);
        (toggle as HTMLElement).title = flow.enabled ? t('flows.toggle.disable') : t('flows.toggle.enable');
        await storage.saveFlow(flow);
      });

      const btnEdit = row.querySelector('.btn-edit')!;
      btnEdit.addEventListener('click', () => {
        router.navigate(`/editor/${flow.id}`);
      });

      const btnDelete = row.querySelector('.btn-delete')!;
      btnDelete.addEventListener('click', async () => {
        if (confirm(t('flows.delete_confirm_named', { shortcut: shortcutText }))) {
          await storage.deleteFlow(flow.id);
          this.allFlows = this.allFlows.filter(f => f.id !== flow.id);
          this.renderList();
          this.renderStats();
          this.renderFolders();
        }
      });

      const tag = row.querySelector('.row-tag')!;
      tag.addEventListener('click', () => {
        this.currentFolderFilter = (tag as HTMLElement).dataset.folder!;
        this.renderFolders();
        this.renderList();
      });

      tbody.appendChild(row);
    });
  }
}


