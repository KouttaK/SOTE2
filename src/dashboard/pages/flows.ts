/**
 * src/dashboard/pages/flows.ts — Flows Page Implementation
 */

import type { Page } from './index.js';
import { storage } from '../../shared/storage/StorageService.js';
import type { Flow, Folder, Variable } from '../../shared/types/index.js';
import { router } from '../router.js';
import { t, getLanguage } from '../../shared/i18n/index.js';
import { escapeHtml, htmlToPreviewText } from '../../shared/utils/dom.js';
import { extractFlowPreviewText, isComplexFlow } from '../../shared/utils/flowSummary.js';
import { openFlowPreviewModal } from '../components/PreviewModal.js';
import { ConflictsModal } from '../components/ConflictsModal.js';
import { detectAllConflicts } from '../../shared/utils/conflictDetector.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import { PromptModal } from '../components/PromptModal.js';
import { showToast } from '../../shared/components/Toast.js';
import { validateImport } from '../../shared/utils/importValidator.js';
import './flows.css';

// ---------------------------------------------------------------------------
// SVGs
// ---------------------------------------------------------------------------
const ICONS_LOCAL = {
  eye: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor"><path d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z"/></svg>`,
  download: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32V274.7l-73.4-73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l128 128c12.5 12.5 32.8 12.5 45.3 0l128-128c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 274.7V32zM64 352c-17.7 0-32 14.3-32 32v64c0 35.3 28.7 64 64 64H416c35.3 0 64-28.7 64-64V384c0-17.7-14.3-32-32-32s-14.3 32-32 32v64c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V384c0-17.7-14.3-32-32-32z"/></svg>`,
  upload: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M288 109.3V352c0 17.7-14.3 32-32 32s-32-14.3-32-32V109.3l-73.4 73.4c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l128-128c12.5-12.5 32.8-12.5 45.3 0l128 128c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L288 109.3zM64 352c-17.7 0-32 14.3-32 32v64c0 35.3 28.7 64 64 64H416c35.3 0 64-28.7 64-64V384c0-17.7-14.3-32-32-32s-14.3 32-32 32v64c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V384c0-17.7-14.3-32-32-32z"/></svg>`,
  clock: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M256 0a256 256 0 1 1 0 512A256 256 0 1 1 256 0zM232 120V256c0 8 4 15.5 10.7 20l96 64c11 7.4 25.9 4.4 33.3-6.7s4.4-25.9-6.7-33.3L280 243.2V120c0-13.3-10.7-24-24-24s-24 10.7-24 24z"/></svg>`,
  bolt: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>`,
  fire: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M159.3 5.4c7.8-7.3 19.9-7.2 27.7 .1c27.6 25.9 53.5 53.8 77.7 84c11-14.4 23.5-30.1 37-42.9c7.9-7.4 20.1-7.4 28 .1c34.6 33 63.9 76.6 84.5 118c20.3 40.8 33.8 82.5 33.8 111.9C448 404.2 348.2 512 224 512C98.4 512 0 404.1 0 276.5c0-38.4 17.8-85.3 45.4-131.7C73.3 97.7 112.7 48.6 159.3 5.4zM225.7 416c25.3 0 47.7-7 68.8-21c42.1-29.4 53.4-88.2 28.1-134.4c-4.5-9-16-9.6-22.5-2l-25.2 29.3c-6.6 7.6-18.5 7.4-24.7-.5c-16.5-21-46-58.5-62.8-79.8c-6.3-8-18.3-8.1-24.7-.1c-33.8 42.5-50.8 69.3-50.8 99.4C112 375.4 162.6 416 225.7 416z"/></svg>`,
  trendUp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor"><path d="M384 160c-17.7 0-32-14.3-32-32s14.3-32 32-32H544c17.7 0 32 14.3 32 32V288c0 17.7-14.3 32-32 32s-32-14.3-32-32V205.3L342.6 374.6c-12.5 12.5-32.8 12.5-45.3 0L192 269.3 54.6 406.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l160-160c12.5-12.5 32.8-12.5 45.3 0L320 306.7 466.7 160H384z"/></svg>`,
  plus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z"/></svg>`,
  edit: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M441 58.9L453.1 71c9.4 9.4 9.4 24.6 0 33.9L424 134.1 377.9 88 407 58.9c9.4-9.4 24.6-9.4 33.9 0zM209.8 256.2L344 121.9 390.1 168 255.8 302.2c-2.9 2.9-6.5 5-10.4 6.1l-58.5 16.7 16.7-58.5c1.1-3.9 3.2-7.5 6.1-10.4zM373.1 25L175.8 222.2c-8.7 8.7-15 19.4-18.3 31.1l-28.6 100c-2.4 8.4-.1 17.4 6.1 23.6s15.2 8.5 23.6 6.1l100-28.6c11.8-3.4 22.5-9.7 31.1-18.3L487 138.9c28.1-28.1 28.1-73.7 0-101.8L474.9 25C446.8-3.1 401.2-3.1 373.1 25zM88 64C39.4 64 0 103.4 0 152V424c0 48.6 39.4 88 88 88H360c48.6 0 88-39.4 88-88V312c0-13.3-10.7-24-24-24s-24 10.7-24 24V424c0 22.1-17.9 40-40 40H88c-22.1 0-40-17.9-40-40V152c0-22.1 17.9-40 40-40H200c13.3 0 24-10.7 24-24s-10.7-24-24-24H88z"/></svg>`,
  trash: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M170.5 51.6L151.5 80h145l-19-28.4c-1.5-2.2-4-3.6-6.7-3.6H177.1c-2.7 0-5.2 1.3-6.7 3.6zm147-26.6L354.2 80H368h48 8c13.3 0 24 10.7 24 24s-10.7 24-24 24h-8V432c0 44.2-35.8 80-80 80H112c-44.2 0-80-35.8-80-80V128H24c-13.3 0-24-10.7-24-24S10.7 80 24 80h8H80 93.8l36.7-55.1C140.9 9.4 158.4 0 177.1 0h93.7c18.7 0 36.2 9.4 46.6 24.9zM80 128V432c0 17.7 14.3 32 32 32H336c17.7 0 32-14.3 32-32V128H80zm80 64V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16zm80 0V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16zm80 0V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16z"/></svg>`,
  folder: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M64 480H448c35.3 0 64-28.7 64-64V160c0-35.3-28.7-64-64-64H288c-18.9 0-36.8-7.3-50.5-20.4L205.8 44.1C196.2 34.1 182.7 28 168.4 28H64C28.7 28 0 56.7 0 92v324c0 35.3 28.7 64 64 64z"/></svg>`,
  sparkle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/></svg>`
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
  private currentStatusFilter: 'all' | 'active' | 'inactive' = 'all';
  private currentSearchQuery = '';
  private selectedFlowIds = new Set<string>();

  private searchInput: HTMLInputElement | null = null;
  private searchHandler!: (e: Event) => void;
  private documentClickHandler!: (e: MouseEvent) => void;
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
        </div>

        <!-- One-time Notice Container -->
        <div id="flows-notice-container"></div>

        <!-- Stats Row (Moved ABOVE header actions) -->
        <div class="flows-stats" id="flows-stats-container"><!-- Rendered dynamically --></div>

        <!-- Actions Bar -->
        <div class="flows-header-actions">
          <button class="dash-header-btn" id="flows-export-btn" title="${t('flows.export_selected')}">
            ${ICONS_LOCAL.download} <span id="flows-export-label">${t('flows.export_selected')}</span>
          </button>
          <button class="dash-header-btn" id="flows-import-btn" title="${t('flows.import')}">
            ${ICONS_LOCAL.upload} <span>${t('flows.import')}</span>
          </button>
          <input type="file" id="flows-import-input" accept=".json,application/json" style="display: none;" />
          <div class="flows-filters-wrap">
            <button class="dash-header-btn" id="flows-filters-btn">
              ${EXTRA_ICONS.funnel} <span>${t('flows.header.filters')}</span> ${EXTRA_ICONS.chevronRight}
            </button>
            <div class="flows-filters-dropdown" id="flows-filters-dropdown" style="display: none;"></div>
          </div>
          <button class="dash-header-btn" id="flows-conflicts-btn" title="${t('conflicts.title')}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor" style="width: 0.75rem; height: 0.75rem;"><path d="M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c7.3 12.4 7.3 27.7 .2 40.1S486.3 480 472 480H40c-14.3 0-27.6-7.7-34.7-20.1s-7-27.8 .2-40.1l216-368C228.7 39.5 241.8 32 256 32zm0 128c-13.3 0-24 10.7-24 24V296c0 13.3 10.7 24 24 24s24-10.7 24-24V184c0-13.3-10.7-24-24-24zm32 224a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z"/></svg>
            <span id="flows-conflicts-label">${t('conflicts.button_label')}</span>
          </button>
          <button class="dash-header-btn" id="flows-refresh-btn" title="${t('flows.header.refresh')}">
            ${EXTRA_ICONS.refresh} <span>${t('flows.header.refresh')}</span>
          </button>
        </div>

        <!-- Folder Tabs -->
        <div class="flows-folders" id="flows-folders-container"></div>

        <!-- Table -->
        <div class="flows-table-wrap">
          <div class="flows-th">
            <div class="th-col" style="justify-content: center;"><input type="checkbox" id="flows-select-all" class="flows-checkbox" title="Select all"></div>
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

    // 3. Render everything
    await this.renderWordBoundaryNotice();
    this.renderStats();
    this.renderFolders();
    this.renderFiltersDropdown();
    this.renderList();

    // 4. Header action buttons
    const filtersBtn = this.el.querySelector('#flows-filters-btn');
    const dropdown = this.el.querySelector<HTMLElement>('#flows-filters-dropdown');
    filtersBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (dropdown) {
        dropdown.style.display = dropdown.style.display === 'none' ? '' : 'none';
      }
    });

    this.documentClickHandler = (e: MouseEvent) => {
      if (dropdown && dropdown.style.display !== 'none') {
        if (!dropdown.contains(e.target as Node) && !filtersBtn?.contains(e.target as Node)) {
          dropdown.style.display = 'none';
        }
      }
    };
    document.addEventListener('click', this.documentClickHandler);

    this.el.querySelector('#flows-refresh-btn')?.addEventListener('click', async () => {
      const btn = this.el.querySelector('#flows-refresh-btn');
      btn?.classList.add('is-spinning');
      try {
        const [flows, folders, variables] = await Promise.all([
          storage.getFlows(),
          storage.getFolders(),
          storage.getVariables(),
        ]);
        this.allFlows = flows;
        this.allFolders = folders;
        this.allVariables = variables;
        this.renderStats();
        this.renderFolders();
        this.renderFiltersDropdown();
        this.renderList();
        this.updateConflictsCount();
        showToast(t('flows.refresh_success'), 'success');
      } catch (err) {
        console.error('[FlowsPage] Refresh failed:', err);
      } finally {
        setTimeout(() => btn?.classList.remove('is-spinning'), 400);
      }
    });

    // 4b. Conflicts button
    this.el.querySelector('#flows-conflicts-btn')?.addEventListener('click', async () => {
      await ConflictsModal.show(async () => {
        this.allFlows = await storage.getFlows();
        this.renderStats();
        this.renderList();
        this.updateConflictsCount();
      });
    });
    this.updateConflictsCount();

    // 5. Export button
    this.el.querySelector('#flows-export-btn')?.addEventListener('click', () => {
      let toExport: Flow[] = [];
      if (this.selectedFlowIds.size > 0) {
        toExport = this.allFlows.filter(f => this.selectedFlowIds.has(f.id));
      } else {
        toExport = this.getCurrentlyFilteredFlows();
      }
      if (toExport.length === 0) {
        toExport = this.allFlows;
      }
      this.exportFlows(toExport);
    });

    // 6. Import button & file input
    const importBtn = this.el.querySelector('#flows-import-btn');
    const importInput = this.el.querySelector<HTMLInputElement>('#flows-import-input');
    if (importBtn && importInput) {
      importBtn.addEventListener('click', () => {
        importInput.click();
      });

      importInput.addEventListener('change', () => {
        const file = importInput.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            let text = e.target?.result as string;
            if (!text) {
              showToast(t('flows.import_error'), 'error');
              return;
            }
            try {
              const parsed = JSON.parse(text);
              if (Array.isArray(parsed)) {
                text = JSON.stringify({ flows: parsed });
              }
            } catch {
              showToast(t('flows.import_error'), 'error');
              return;
            }

            const validation = validateImport(text, false);

            if (!validation.valid || !validation.data?.flows || validation.data.flows.length === 0) {
              showToast(t('flows.import_no_valid'), 'error');
              return;
            }

            const existingFlows = await storage.getFlows();
            const existingIds = new Set(existingFlows.map(f => f.id));
            const getShortcut = (f: Flow) => {
              const trig = f.blocks?.find(b => b.type === 'trigger');
              return (trig?.data as any)?.shortcut?.toLowerCase().trim() || '';
            };
            const existingShortcuts = new Set(existingFlows.map(getShortcut).filter(Boolean));

            let importedCount = 0;
            let skippedCount = 0;
            const flowsToAdd: Flow[] = [];

            for (const flow of (validation.data.flows as Flow[])) {
              const sc = getShortcut(flow);
              if (existingIds.has(flow.id) || (sc && existingShortcuts.has(sc))) {
                skippedCount++;
                continue;
              }
              existingIds.add(flow.id);
              if (sc) existingShortcuts.add(sc);
              flowsToAdd.push(flow);
              importedCount++;
            }

            for (const f of flowsToAdd) {
              await storage.saveFlow(f);
            }

            this.allFlows = await storage.getFlows();
            this.renderStats();
            this.renderFolders();
            this.renderList();

            showToast(
              t('flows.import_success', { imported: importedCount, skipped: skippedCount }),
              importedCount > 0 ? 'success' : 'info'
            );
          } catch (err) {
            console.error('[FlowsPage] Import failed:', err);
            showToast(t('flows.import_error'), 'error');
          } finally {
            importInput.value = '';
          }
        };
        reader.readAsText(file);
      });
    }
  }

  unmount(): void {
    if (this.searchInput && this.searchHandler) {
      this.searchInput.removeEventListener('input', this.searchHandler);
    }
    if (this.documentClickHandler) {
      document.removeEventListener('click', this.documentClickHandler);
    }
  }

  // ── Renderers ────────────────────────────────────────────────────────────

  private async renderWordBoundaryNotice() {
    const container = this.el.querySelector('#flows-notice-container');
    if (!container) return;

    const settings = await storage.getSettings();
    if (settings.seenWordBoundaryNotice === true) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = /* html */ `
      <div class="flows-notice" id="word-boundary-notice">
        <div class="flows-notice-icon">${ICONS_LOCAL.sparkle}</div>
        <div class="flows-notice-content">
          <p class="title">${t('notice.wordboundary.title')}</p>
          <p class="desc">${t('notice.wordboundary.desc')}</p>
        </div>
        <div class="flows-notice-actions">
          <button class="flows-notice-btn flows-notice-btn-secondary" id="btn-notice-settings">
            ${t('notice.wordboundary.go_to_settings')}
          </button>
          <button class="flows-notice-btn flows-notice-btn-primary" id="btn-notice-dismiss">
            ${t('notice.wordboundary.dismiss')}
          </button>
        </div>
      </div>
    `;

    const dismissNotice = async () => {
      container.innerHTML = '';
      await storage.saveSettings({ seenWordBoundaryNotice: true });
    };

    container.querySelector('#btn-notice-dismiss')?.addEventListener('click', dismissNotice);
    container.querySelector('#btn-notice-settings')?.addEventListener('click', async () => {
      await dismissNotice();
      sessionStorage.setItem('sote_highlight_setting', 'settings-wordboundary-group');
      router.navigate('/settings');
    });
  }

  private renderStats() {
    const container = this.el.querySelector('#flows-stats-container')!;

    const totalFlows = this.allFlows.length;
    const activeFlows = this.allFlows.filter(f => f.enabled).length;
    const totalUsage = this.allFlows.reduce((sum, f) => sum + (f.stats?.usageCount || 0), 0);
    const totalKeys = this.allFlows.reduce((sum, f) => sum + (f.stats?.keysSaved || 0), 0);

    // Most used flow
    let mostUsed = this.allFlows[0];
    for (const f of this.allFlows) {
      if ((f.stats?.usageCount || 0) > (mostUsed?.stats?.usageCount || 0)) mostUsed = f;
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

  private renderFiltersDropdown() {
    const dropdown = this.el.querySelector('#flows-filters-dropdown');
    if (!dropdown) return;

    dropdown.innerHTML = /* html */ `
      <div class="flows-filters-section-title">${t('flows.filters.sort_section')}</div>
      <button type="button" class="flows-filter-option ${this.currentSort === 'Category' ? 'is-selected' : ''}" data-sort="Category">
        <span>${t('header.sort_by.category')}</span>
        ${this.currentSort === 'Category' ? '<span>✓</span>' : ''}
      </button>
      <button type="button" class="flows-filter-option ${this.currentSort === 'Name' ? 'is-selected' : ''}" data-sort="Name">
        <span>${t('header.sort_by.name')}</span>
        ${this.currentSort === 'Name' ? '<span>✓</span>' : ''}
      </button>
      <button type="button" class="flows-filter-option ${this.currentSort === 'Usage' ? 'is-selected' : ''}" data-sort="Usage">
        <span>${t('header.sort_by.usage')}</span>
        ${this.currentSort === 'Usage' ? '<span>✓</span>' : ''}
      </button>
      <button type="button" class="flows-filter-option ${this.currentSort === 'Date' ? 'is-selected' : ''}" data-sort="Date">
        <span>${t('header.sort_by.date')}</span>
        ${this.currentSort === 'Date' ? '<span>✓</span>' : ''}
      </button>

      <div class="flows-filter-divider"></div>

      <div class="flows-filters-section-title">${t('flows.filters.status_section')}</div>
      <button type="button" class="flows-filter-option ${this.currentStatusFilter === 'all' ? 'is-selected' : ''}" data-status="all">
        <span>${t('flows.filters.status_all')}</span>
        ${this.currentStatusFilter === 'all' ? '<span>✓</span>' : ''}
      </button>
      <button type="button" class="flows-filter-option ${this.currentStatusFilter === 'active' ? 'is-selected' : ''}" data-status="active">
        <span>${t('flows.filters.status_active')}</span>
        ${this.currentStatusFilter === 'active' ? '<span>✓</span>' : ''}
      </button>
      <button type="button" class="flows-filter-option ${this.currentStatusFilter === 'inactive' ? 'is-selected' : ''}" data-status="inactive">
        <span>${t('flows.filters.status_inactive')}</span>
        ${this.currentStatusFilter === 'inactive' ? '<span>✓</span>' : ''}
      </button>
    `;

    dropdown.querySelectorAll('[data-sort]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.currentSort = (btn as HTMLElement).dataset.sort as any;
        this.renderFiltersDropdown();
        this.renderList();
      });
    });

    dropdown.querySelectorAll('[data-status]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.currentStatusFilter = (btn as HTMLElement).dataset.status as any;
        this.renderFiltersDropdown();
        this.renderList();
      });
    });
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
            // B-06: Clear folderId from flows that belonged to this folder so
            // the local allFlows array stays consistent with the deleted folder.
            // (Storage already removed the folder; flows retain their folderId
            // in storage but it simply becomes orphaned — the UI treats them as
            // uncategorised. We update in-memory objects to match.)
            for (const f of this.allFlows) {
              if (f.folderId === folder.id) f.folderId = undefined;
            }
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
    addBtn.onclick = () => {
      PromptModal.show({
        title: t('flows.folder.create_title'),
        placeholder: t('flows.folder.prompt_name'),
        confirmLabel: t('common.create') || 'Criar',
        onConfirm: async (rawName) => {
          const name = rawName.trim();
          if (name) {
            await storage.saveFolder({ id: crypto.randomUUID(), name, color: '#3b82f6', order: this.allFolders.length });
            this.allFolders = await storage.getFolders();
            this.renderFolders();
          }
        },
      });
    };
    container.appendChild(addBtn);
  }

  private getCurrentlyFilteredFlows(): Flow[] {
    let filtered = [...this.allFlows];

    // By Folder
    if (this.currentFolderFilter === 'uncategorised') {
      filtered = filtered.filter(f => !f.folderId);
    } else if (this.currentFolderFilter !== null) {
      filtered = filtered.filter(f => f.folderId === this.currentFolderFilter);
    }

    // By Status
    if (this.currentStatusFilter === 'active') {
      filtered = filtered.filter(f => f.enabled);
    } else if (this.currentStatusFilter === 'inactive') {
      filtered = filtered.filter(f => !f.enabled);
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
    // produce a deterministic, visibly-different order.
    filtered.sort((a, b) => {
      if (this.currentSort === 'Usage') {
        const usageA = a.stats?.usageCount || 0;
        const usageB = b.stats?.usageCount || 0;
        if (usageA !== usageB) return usageB - usageA;
        return a.name.localeCompare(b.name);
      } else if (this.currentSort === 'Date') {
        const createdA = a.createdAt || 0;
        const createdB = b.createdAt || 0;
        if (createdA !== createdB) return createdB - createdA;
        return a.name.localeCompare(b.name);
      } else if (this.currentSort === 'Name') {
        return a.name.localeCompare(b.name);
      } else {
        const folderA = this.allFolders.find(f => f.id === a.folderId)?.name || t('flows.folder.none');
        const folderB = this.allFolders.find(f => f.id === b.folderId)?.name || t('flows.folder.none');
        if (folderA === folderB) {
          return a.name.localeCompare(b.name);
        }
        return folderA.localeCompare(folderB);
      }
    });

    return filtered;
  }

  private updateSelectAllCheckbox(filtered: Flow[]) {
    const selectAll = this.el.querySelector<HTMLInputElement>('#flows-select-all');
    if (!selectAll || filtered.length === 0) {
      if (selectAll) { selectAll.checked = false; selectAll.indeterminate = false; }
      return;
    }
    const allSelected = filtered.every(f => this.selectedFlowIds.has(f.id));
    const someSelected = filtered.some(f => this.selectedFlowIds.has(f.id));
    selectAll.checked = allSelected;
    selectAll.indeterminate = !allSelected && someSelected;
  }

  private async updateConflictsCount() {
    const settings = await storage.getSettings();
    const conflicts = detectAllConflicts(this.allFlows, settings);
    const labelEl = this.el.querySelector('#flows-conflicts-label');
    const btnEl = this.el.querySelector<HTMLElement>('#flows-conflicts-btn');
    if (labelEl) {
      if (conflicts.length > 0) {
        labelEl.textContent = t('conflicts.tab_label', { count: conflicts.length });
        btnEl?.classList.add('has-conflicts');
      } else {
        labelEl.textContent = t('conflicts.button_label');
        btnEl?.classList.remove('has-conflicts');
      }
    }
  }

  private updateExportBtnLabel() {
    const labelEl = this.el.querySelector('#flows-export-label');
    if (labelEl) {
      if (this.selectedFlowIds.size > 0) {
        labelEl.textContent = `${t('flows.export_selected')} (${this.selectedFlowIds.size})`;
      } else {
        labelEl.textContent = t('flows.export_selected');
      }
    }
  }

  private exportFlows(flowsToExport: Flow[]) {
    if (flowsToExport.length === 0) return;
    const data = {
      version: 2,
      exportedAt: new Date().toISOString(),
      flows: flowsToExport,
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const folderName = this.currentFolderFilter
      ? (this.allFolders.find(f => f.id === this.currentFolderFilter)?.name || 'folder')
      : 'all';
    a.download = `sote-flows-${folderName}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private renderList() {
    const tbody = this.el.querySelector('#flows-tbody')!;
    tbody.innerHTML = '';

    const filtered = this.getCurrentlyFilteredFlows();
    this.updateExportBtnLabel();

    const selectAll = this.el.querySelector<HTMLInputElement>('#flows-select-all');
    if (selectAll) {
      this.updateSelectAllCheckbox(filtered);
      selectAll.onchange = () => {
        if (selectAll.checked) {
          filtered.forEach(f => this.selectedFlowIds.add(f.id));
        } else {
          filtered.forEach(f => this.selectedFlowIds.delete(f.id));
        }
        this.renderList();
        this.updateExportBtnLabel();
      };
    }

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
      row.className = 'flows-row flow-row';

      const trigger = flow.blocks.find(b => b.type === 'trigger');
      const action = flow.blocks.find(b => b.type === 'action');
      const shortcutText = escapeHtml(trigger ? (trigger.data as any).shortcut : flow.name);

      // Highlighting logic — escape regex metacharacters in the query so
      // typing '(' or '[' doesn't throw a SyntaxError and blank the list.
      const highlight = (text: string) => {
        if (!this.currentSearchQuery) return text;
        const escaped = this.currentSearchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escaped})`, 'gi');
        return text.replace(regex, '<span class="row-preview-highlight">$1</span>');
      };

      const isComplex = isComplexFlow(flow);
      let previewCellHtml = '';

      if (isComplex) {
        previewCellHtml = `
          <button type="button" class="btn-preview-modal row-preview-btn" data-flow-id="${flow.id}" title="${t('flows.preview_full_tooltip')}" aria-label="${t('flows.preview_full_tooltip')}">
            ${ICONS_LOCAL.eye}
            <span>${t('flows.preview_visualize')}</span>
          </button>
        `;
      } else {
        const previewText = escapeHtml(extractFlowPreviewText(flow, this.allVariables, 50));
        previewCellHtml = `<p class="row-preview">${highlight(previewText)}</p>`;
      }
      
      const folder = this.allFolders.find(f => f.id === flow.folderId);
      const folderName = escapeHtml(folder ? folder.name : t('flows.folder.none'));
      
      const usagePct = ((flow.stats.usageCount || 0) / maxUsage) * 100;
      const locale: 'pt' | 'en' = getLanguage() === 'pt-BR' ? 'pt' : 'en';
      const relTime = formatRelativeTime(flow.stats.lastUsed || flow.updatedAt, locale);
      const createdTime = formatRelativeTime(flow.createdAt, locale);

      row.innerHTML = /* html */ `
        <!-- Selection checkbox -->
        <div style="display: flex; align-items: center; justify-content: center;">
          <input type="checkbox" class="flows-checkbox flow-row-checkbox" data-id="${flow.id}" ${this.selectedFlowIds.has(flow.id) ? 'checked' : ''}>
        </div>
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
          ${previewCellHtml}
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
          <span class="usage-count">${formatCount(flow.stats?.usageCount || 0)}<span class="usage-count-suffix"> ${t('flows.usage_suffix')}</span></span>
          <span class="usage-time">${relTime}</span>
        </div>
        <!-- Actions -->
        <div class="row-actions">
          <button class="action-btn btn-edit" title="${t('flows.action.edit')}">${ICONS_LOCAL.edit}</button>
          <button class="action-btn btn-delete" title="${t('flows.action.delete')}">${ICONS_LOCAL.trash}</button>
        </div>
      `;

      // Events
      const rowCheckbox = row.querySelector<HTMLInputElement>('.flow-row-checkbox');
      rowCheckbox?.addEventListener('change', () => {
        if (rowCheckbox.checked) {
          this.selectedFlowIds.add(flow.id);
        } else {
          this.selectedFlowIds.delete(flow.id);
        }
        this.updateExportBtnLabel();
        this.updateSelectAllCheckbox(filtered);
      });

      const toggle = row.querySelector('.row-toggle')!;
      toggle.addEventListener('click', async () => {
        // Optimistically update the UI first.
        const previousEnabled = flow.enabled;
        flow.enabled = !flow.enabled;
        toggle.classList.toggle('is-on', flow.enabled);
        (toggle as HTMLElement).title = flow.enabled ? t('flows.toggle.disable') : t('flows.toggle.enable');
        try {
          await storage.saveFlow(flow);
          this.renderStats(); // B-07: keep active-flow count accurate
        } catch {
          // A-15: Rollback UI to keep it consistent with storage on failure.
          flow.enabled = previousEnabled;
          toggle.classList.toggle('is-on', flow.enabled);
          (toggle as HTMLElement).title = flow.enabled ? t('flows.toggle.disable') : t('flows.toggle.enable');
        }
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

      if (isComplex) {
        const previewBtn = row.querySelector<HTMLButtonElement>('.btn-preview-modal');
        previewBtn?.addEventListener('click', async (e) => {
          e.stopPropagation();
          await openFlowPreviewModal(flow);
        });
      }

      tbody.appendChild(row);
    });
  }
}


