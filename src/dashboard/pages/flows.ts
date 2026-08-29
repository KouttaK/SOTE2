/**
 * src/dashboard/pages/flows.ts — Flows Page Implementation
 */

import type { Page } from './index.js';
import { storage } from '../../shared/storage/StorageService.js';
import type { Flow, Folder, Variable } from '../../shared/types/index.js';
import { router } from '../router.js';
import { t, getLanguage } from '../../shared/i18n/index.js';
import { escapeHtml, htmlToPreviewText } from '../../shared/utils/dom.js';
import { resolveVariablesInText } from '../../shared/utils/variableResolver.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
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
 * Replaces every `{{KEY}}` placeholder in plain text with the matching
 * Global Variable's value — same substitution content.ts performs at
 * runtime and PreviewModal.ts performs in the editor's Preview modal.
 * Unknown keys are left untouched.
 */
function resolveVariablesText(text: string, variables: Variable[]): string {
  return resolveVariablesInText(text, false, variables);
}

/** Formats a count with a "k" suffix past 1000 (e.g. 1240 -> "1.2k"), matching
 * the "1.2k runs" style used in the reference table rows. */
function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

/** Formats a past timestamp as a short relative label ("2h atrás", "Ontem",
 * "3 dias atrás") matching the reference table's last-activity column.
 * Falls back to a locale-agnostic "—" when there's no timestamp yet. */
function formatRelativeTime(ts: number | undefined, locale: 'pt' | 'en'): string {
  if (!ts) return '—';
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (locale === 'pt') {
    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `${diffMin}min atrás`;
    if (diffH < 24) return `${diffH}h atrás`;
    if (diffD === 1) return 'Ontem';
    if (diffD < 30) return `${diffD} dias atrás`;
    return new Date(ts).toLocaleDateString('pt-BR');
  }
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}min ago`;
  if (diffH < 24) return `${diffH}h ago`;
  if (diffD === 1) return 'Yesterday';
  if (diffD < 30) return `${diffD} days ago`;
  return new Date(ts).toLocaleDateString('en-US');
}

const EXTRA_ICONS = {
  chevronRight: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" fill="currentColor"><path d="M310.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256 73.4 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z"/></svg>`,
  refresh: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M386.3 160H352c-17.7 0-32 14.3-32 32s14.3 32 32 32H478.3c17.7 0 32-14.3 32-32V64c0-17.7-14.3-32-32-32s-32 14.3-32 32v35.2L414.4 97.6c-87.5-87.5-229.3-87.5-316.8 0C73.2 122 55.6 150.7 44.8 181.4c-5.9 16.7 2.9 34.9 19.5 40.8s34.9-2.9 40.8-19.5c7.7-21.8 20.2-42.3 37.8-59.8c62.5-62.5 163.8-62.5 226.3 0zM125.7 352H33.7C16 352 1.7 366.3 1.7 384v96c0 17.7 14.3 32 32 32s32-14.3 32-32V444.8l17.9 17.9c87.5 87.5 229.3 87.5 316.8 0c24.5-24.5 42.1-53.2 52.9-83.8c5.9-16.7-2.9-34.9-19.5-40.8s-34.9 2.9-40.8 19.5c-7.7 21.8-20.2 42.3-37.8 59.8c-62.5 62.5-163.8 62.5-226.3 0L97.6 384h28.1c17.7 0 32-14.3 32-32s-14.3-32-32-32z"/></svg>`,
  funnel: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M3.9 54.9C10.5 40.9 24.5 32 40 32H472c15.5 0 29.5 8.9 36.1 22.9s4.6 30.5-5.2 42.5L320 320.9V448c0 12.1-6.8 23.2-17.7 28.6s-23.8 4.3-33.5-3l-64-48c-8.1-6-12.8-15.5-12.8-25.6V320.9L9 97.3C-.7 85.4-2.8 68.8 3.9 54.9z"/></svg>`,
  pulse: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h4l2-7 4 14 3-9 2 4h5"/></svg>`,
};

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


  render(): HTMLElement {
    this.el = document.createElement('div');
    this.el.id = 'page-flows';
    


    this.el.innerHTML = /* html */ `
      <div class="dash-page-inner">
        <div class="flows-header">
          <div>
            <div class="dash-breadcrumb">
              <span>/workspace</span>${EXTRA_ICONS.chevronRight}<span class="is-current">${t('flows.breadcrumb')}</span>
            </div>
            <h1 class="flows-title">${t('flows.title')}</h1>
            <p class="flows-subtitle">${t('flows.subtitle')}</p>
          </div>
          <div class="flows-header-actions">
            <button class="dash-header-btn" id="flows-filters-btn">
              ${EXTRA_ICONS.funnel} <span>${t('flows.header.filters')}</span> ${EXTRA_ICONS.chevronRight}
            </button>
            <button class="dash-header-btn" id="flows-refresh-btn">
              ${EXTRA_ICONS.refresh} <span>${t('flows.header.refresh')}</span>
            </button>
          </div>
        </div>

        <!-- Stats Row + Workspace Summary -->
        <section class="flows-stats-section">
          <div class="flows-stats" id="flows-stats-container"><!-- Rendered dynamically --></div>
          <div class="flows-workspace-card" id="flows-workspace-card"><!-- Rendered dynamically --></div>
        </section>

        <!-- Folder Tabs -->
        <div class="flows-folders" id="flows-folders-container"></div>

        <!-- Table -->
        <div class="flows-table-wrap">
          <div class="flows-th">
            <div class="th-col">${t('flows.th.on')}</div>
            <div class="th-col">${t('flows.th.shortcut')}</div>
            <div class="th-col">${t('flows.th.category')}</div>
            <div class="th-col">${t('flows.th.preview')}</div>
            <div class="th-col">${t('flows.th.created')}</div>
            <div class="th-col">${t('flows.th.usage')}</div>
            <div class="th-col" style="justify-content: flex-end">${t('flows.th.actions')}</div>
          </div>
          <div id="flows-tbody"></div>
        </div>
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
    this.renderWorkspaceCard();
    this.renderFolders();
    this.renderList();

    // 4. Header action buttons
    const foldersEl = this.el.querySelector<HTMLElement>('#flows-folders-container');
    this.el.querySelector('#flows-filters-btn')?.addEventListener('click', () => {
      if (foldersEl) foldersEl.style.display = foldersEl.style.display === 'none' ? '' : 'none';
    });
    this.el.querySelector('#flows-refresh-btn')?.addEventListener('click', async () => {
      const btn = this.el.querySelector('#flows-refresh-btn');
      btn?.classList.add('is-spinning');
      const [flows, folders, variables] = await Promise.all([
        storage.getFlows(),
        storage.getFolders(),
        storage.getVariables(),
      ]);
      this.allFlows = flows;
      this.allFolders = folders;
      this.allVariables = variables;
      this.renderStats();
      this.renderWorkspaceCard();
      this.renderFolders();
      this.renderList();
      setTimeout(() => btn?.classList.remove('is-spinning'), 400);
    });
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
    const activeFlows = this.allFlows.filter(f => f.enabled).length;
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
        <p class="stat-label">${t('flows.stats.total_executions')}</p>
        <div class="stat-value-row"><span class="stat-value">${formatCount(totalUsage)}</span></div>
      </div>
      <div class="stat-card">
        <p class="stat-label">${t('flows.stats.active_flows')}</p>
        <div class="stat-value-row"><span class="stat-value">${activeFlows}</span></div>
        <p class="stat-sub">${t('flows.stats.of_total', { total: totalFlows })}</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">${t('flows.stats.time_saved')}</p>
        <div class="stat-value-row"><span class="stat-value">${t('flows.stats.hrs_value', { hrs: hrsSaved })}</span></div>
        <p class="stat-sub">${t('flows.stats.based_on_keys')}</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">${t('flows.stats.most_used')}</p>
        <div class="stat-value-row"><span class="stat-value stat-value-mono">${escapeHtml(mostUsedShortcut)}</span></div>
        <p class="stat-sub">${t('flows.usage_count', { count: mostUsed?.stats.usageCount || 0 })}</p>
      </div>
    `;
  }

  /** Real "workspace summary" card — replaces the reference mock's fake
   * CPU/memory system-health widget with figures actually derived from
   * storage (no invented telemetry): share of flows enabled, plus counts
   * of variables/folders that make up the current workspace. */
  private renderWorkspaceCard() {
    const container = this.el.querySelector('#flows-workspace-card');
    if (!container) return;

    const total = this.allFlows.length;
    const active = this.allFlows.filter(f => f.enabled).length;
    const activePct = total > 0 ? Math.round((active / total) * 100) : 0;
    const varCount = this.allVariables.length;
    const maxVarBar = Math.max(varCount, 10);
    const varPct = Math.min(100, Math.round((varCount / maxVarBar) * 100));

    container.innerHTML = /* html */ `
      <div class="workspace-card-glow"></div>
      <div class="workspace-card-body">
        <div class="workspace-card-head">
          <div class="workspace-card-title">${EXTRA_ICONS.pulse} ${t('flows.workspace.title')}</div>
          <span class="workspace-card-status"><span class="status-dot"></span> ${t('flows.workspace.online')}</span>
        </div>
        <div class="workspace-card-metrics">
          <div class="wc-row"><span>${t('flows.workspace.active_flows')}</span><span class="wc-mono">${active}/${total} (${activePct}%)</span></div>
          <div class="wc-bar"><div class="wc-bar-fill" style="width:${activePct}%"></div></div>
          <div class="wc-row"><span>${t('flows.workspace.variables')}</span><span class="wc-mono">${varCount}</span></div>
          <div class="wc-bar"><div class="wc-bar-fill wc-bar-fill-soft" style="width:${varPct}%"></div></div>
        </div>
      </div>
      <div class="workspace-card-foot">
        ${ICONS_LOCAL.folder}
        <p>${t('flows.workspace.hint')}</p>
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
      btn.innerHTML = `${escapeHtml(folder.name)} <span class="folder-count">${count}</span>`;
      btn.onclick = () => {
        this.currentFolderFilter = folder.id;
        this.renderFolders();
        this.renderList();
      };
      // Right click to delete
      btn.oncontextmenu = async (e) => {
        e.preventDefault();
        ConfirmModal.show({
          title: t('confirm_modal.delete_folder_title'),
          message: t('flows.folder.delete_confirm', { name: folder.name }),
          confirmLabel: t('common.delete'),
          onConfirm: async () => {
            await storage.deleteFolder(folder.id);
            this.allFolders = this.allFolders.filter(f => f.id !== folder.id);
            if (this.currentFolderFilter === folder.id) this.currentFolderFilter = null;
            this.renderFolders();
            this.renderList();
          },
        });
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
      const shortcutText = escapeHtml(trigger ? (trigger.data as any).shortcut : flow.name);
      // action.content is rich HTML (e.g. "<p>Hello</p><p>World</p>") coming
      // straight out of the contenteditable Action-block editor. Slicing
      // that HTML as if it were plain text and dropping it into another
      // <p class="row-preview"> produced nested <p> tags, which the browser
      // auto-closes into two separate block-level paragraphs — that's what
      // made the preview render on two lines no matter what CSS was applied
      // to .row-preview. Strip tags down to plain text first so there's only
      // ever a single text node to truncate and display.
      const previewText = action
        ? escapeHtml(resolveVariablesText(htmlToPreviewText((action.data as any).content), this.allVariables).slice(0, 50))
        : t('flows.preview_empty');
      
      const folder = this.allFolders.find(f => f.id === flow.folderId);
      const folderName = escapeHtml(folder ? folder.name : t('flows.folder.none'));
      
      const usagePct = ((flow.stats.usageCount || 0) / maxUsage) * 100;
      const locale: 'pt' | 'en' = getLanguage() === 'pt-BR' ? 'pt' : 'en';
      const relTime = formatRelativeTime(flow.stats.lastUsed || flow.updatedAt, locale);
      const createdTime = formatRelativeTime(flow.createdAt, locale);

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
        <!-- Created -->
        <div>
          <span class="row-created">${createdTime}</span>
        </div>
        <!-- Usage -->
        <div class="row-usage">
          <div class="usage-track">
            <div class="usage-fill" style="width: ${usagePct}%"></div>
          </div>
          <span class="usage-count">${formatCount(flow.stats.usageCount || 0)}<span class="usage-count-suffix"> ${t('flows.usage_suffix')}</span></span>
          <span class="usage-time">${relTime}</span>
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
        this.renderWorkspaceCard();
      });

      const btnEdit = row.querySelector('.btn-edit')!;
      btnEdit.addEventListener('click', () => {
        router.navigate(`/editor/${flow.id}`);
      });

      const btnDelete = row.querySelector('.btn-delete')!;
      btnDelete.addEventListener('click', async () => {
        ConfirmModal.show({
          title: t('confirm_modal.delete_shortcut_title'),
          message: t('flows.delete_confirm_named', { shortcut: shortcutText }),
          confirmLabel: t('common.delete'),
          onConfirm: async () => {
            await storage.deleteFlow(flow.id);
            this.allFlows = this.allFlows.filter(f => f.id !== flow.id);
            this.renderList();
            this.renderStats();
            this.renderWorkspaceCard();
            this.renderFolders();
          },
        });
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


