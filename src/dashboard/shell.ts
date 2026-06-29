/**
 * src/dashboard/shell.ts — Dashboard Shell
 *
 * Renders the complete layout (sidebar + header + content area) extracted
 * pixel-perfectly from ref_pages/SOTE/home.htm.
 *
 * Responsible for:
 *  - Building the DOM structure once on startup
 *  - Highlighting the active nav item when the route changes
 *  - Showing a skeleton loader between page swaps
 *  - Calling page.mount() / page.unmount() correctly
 */

import { router, type ResolvedRoute } from './router.js';
import { loadPage, type Page } from './pages/index.js';
import { t } from '../shared/i18n/index.js';


// ---------------------------------------------------------------------------
// SVG icons (inline — same paths as extracted from home.htm)
// ---------------------------------------------------------------------------

const ICONS = {
  bolt: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" aria-hidden="true" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>`,
  globe: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor"><path d="M352 256c0 22.2-1.2 43.6-3.3 64H163.3c-2.2-20.4-3.3-41.8-3.3-64s1.2-43.6 3.3-64H348.7c2.2 20.4 3.3 41.8 3.3 64zm28.8-64H503.9c5.3 20.5 8.1 41.9 8.1 64s-2.8 43.5-8.1 64H380.8c2.1-20.6 3.2-42 3.2-64s-1.1-43.4-3.2-64zm112.6-32H376.7c-10-63.9-29.8-117.4-55.3-151.6c78.3 20.7 142 77.5 171.9 151.6zm-149.1 0H167.7c6.1-36.4 15.5-68.6 27-94.7c10.5-23.6 22.2-40.7 33.5-51.5C239.4 3.2 248.7 0 256 0s16.6 3.2 27.8 13.8c11.3 10.8 23 27.9 33.5 51.5c11.6 26 20.9 58.2 27 94.7zm-209 0H18.6C48.6 85.9 112.2 29.1 190.6 8.4C165.1 42.6 145.3 96.1 135.3 160zM8.1 192H131.2c-2.1 20.6-3.2 42-3.2 64s1.1 43.4 3.2 64H8.1C2.8 299.5 0 278.1 0 256s2.8-43.5 8.1-64zM194.7 446.6c-11.6-26-20.9-58.2-27-94.6H344.3c-6.1 36.4-15.5 68.6-27 94.6c-10.5 23.6-22.2 40.7-33.5 51.5C272.6 508.8 263.3 512 256 512s-16.6-3.2-27.8-13.8c-11.3-10.8-23-27.9-33.5-51.5zM135.3 352c10 63.9 29.8 117.4 55.3 151.6C112.2 482.9 48.6 426.1 18.6 352H135.3zm358.1 0c-30 74.1-93.6 130.9-171.9 151.6c25.5-34.2 45.2-87.7 55.3-151.6H493.4z"/></svg>`,
  gear: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor"><path d="M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z"/></svg>`,
  folderOpen: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" aria-hidden="true" fill="currentColor"><path d="M88.7 223.8L0 375.8V96C0 60.7 28.7 32 64 32H181.5c17 0 33.3 6.7 45.3 18.7l26.5 26.5c12 12 28.3 18.7 45.3 18.7H416c35.3 0 64 28.7 64 64v32H144c-22.8 0-43.8 12.1-55.3 31.8zm27.6 16.1C122.1 230 132.6 224 144 224H544c11.5 0 22 6.1 27.7 16.1s5.7 22.2-.1 32.1l-112 192C453.9 474 443.4 480 432 480H32c-11.5 0-22-6.1-27.7-16.1s-5.7-22.2 .1-32.1l112-192z"/></svg>`,
  chartBar: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor"><path d="M32 32c17.7 0 32 14.3 32 32V400c0 8.8 7.2 16 16 16H480c17.7 0 32 14.3 32 32s-14.3 32-32 32H80c-44.2 0-80-35.8-80-80V64C0 46.3 14.3 32 32 32zm96 96c0-17.7 14.3-32 32-32l192 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-192 0c-17.7 0-32-14.3-32-32zm32 64H288c17.7 0 32 14.3 32 32s-14.3 32-32 32H160c-17.7 0-32-14.3-32-32s14.3-32 32-32zm0 96H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H160c-17.7 0-32-14.3-32-32s14.3-32 32-32z"/></svg>`,
  ellipsisV: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 512" aria-hidden="true" fill="currentColor"><path d="M64 360a56 56 0 1 0 0 112 56 56 0 1 0 0-112zm0-160a56 56 0 1 0 0 112 56 56 0 1 0 0-112zM120 96A56 56 0 1 0 8 96a56 56 0 1 0 112 0z"/></svg>`,
  search: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor"><path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"/></svg>`,
  plus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" aria-hidden="true" fill="currentColor"><path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z"/></svg>`,
  sortDesc: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" aria-hidden="true" fill="currentColor"><path d="M151.6 42.4C145.5 35.8 137 32 128 32s-17.5 3.8-23.6 10.4l-88 96c-11.9 13-11.1 33.3 2 45.2s33.3 11.1 45.2-2L96 146.3V448c0 17.7 14.3 32 32 32s32-14.3 32-32V146.3l32.4 35.4c11.9 13 32.2 13.9 45.2 2s13.9-32.2 2-45.2l-88-96zM320 480h32c17.7 0 32-14.3 32-32s-14.3-32-32-32H320c-17.7 0-32 14.3-32 32s14.3 32 32 32zm0-128h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H320c-17.7 0-32 14.3-32 32s14.3 32 32 32zm0-128H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H320c-17.7 0-32 14.3-32 32s14.3 32 32 32zm0-128H544c17.7 0 32-14.3 32-32s-14.3-32-32-32H320c-17.7 0-32 14.3-32 32s14.3 32 32 32z"/></svg>`,
  filter: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor"><path d="M3.9 54.9C10.5 40.9 24.5 32 40 32H472c15.5 0 29.5 8.9 36.1 22.9s4.6 30.5-5.2 42.5L320 320.9V448c0 12.1-6.8 23.2-17.7 28.6s-23.8 4.3-33.5-3l-64-48c-8.1-6-12.8-15.5-12.8-25.6V320.9L9 97.3C-.7 85.4-2.8 68.8 3.9 54.9z"/></svg>`,
  chevronDown: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor"><path d="M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z"/></svg>`,
};

// ---------------------------------------------------------------------------
// Navigation items — matching home.htm sidebar exactly
// ---------------------------------------------------------------------------

interface NavItem {
  label: string;
  path: string;
  pattern: string;
  icon: string;
  badge?: number;
}

const PRIMARY_NAV: NavItem[] = [
  { label: 'sidebar.flows',         path: '/flows',     pattern: '/flows',      icon: ICONS.bolt },
  { label: 'sidebar.variables', path: '/variables', pattern: '/variables',  icon: ICONS.globe },
  { label: 'sidebar.settings',         path: '/settings',  pattern: '/settings',   icon: ICONS.gear },
];

const WORKSPACE_NAV: NavItem[] = [
  { label: 'sidebar.templates',  path: '/templates',  pattern: '/templates',  icon: ICONS.folderOpen },
  { label: 'sidebar.analytics',  path: '/analytics',  pattern: '/analytics',  icon: ICONS.chartBar },
];

// ---------------------------------------------------------------------------
// Shell class
// ---------------------------------------------------------------------------

export class Shell {
  private root: HTMLElement;
  private contentArea!: HTMLElement;
  private navLinks: Map<string, HTMLAnchorElement> = new Map();
  private currentPage: Page | null = null;
  private currentPageEl: HTMLElement | null = null;
  private unsubscribeRouter: (() => void) | null = null;
  private flowsBadge: HTMLSpanElement | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  // ── Boot ──────────────────────────────────────────────────────────────────

  async boot(): Promise<void> {
    this._renderLayout();

    // Subscribe to route changes.
    this.unsubscribeRouter = router.onRouteChange((route) => {
      this._onRouteChange(route);
    });

    // Render the initial route immediately.
    await this._onRouteChange(router.current);
  }

  destroy(): void {
    this.unsubscribeRouter?.();
    this.currentPage?.unmount();
  }

  // ── Layout (pixel-exact from home.htm) ───────────────────────────────────

  private _renderLayout(): void {
    this.root.innerHTML = '';
    this.root.className = 'dash-root';

    // ── Sidebar ──
    const sidebar = this._buildSidebar();

    // ── Main column ──
    const mainCol = document.createElement('div');
    mainCol.className = 'dash-main-col';

    // ── Header ──
    const header = this._buildHeader();

    // ── Content area ──
    this.contentArea = document.createElement('main');
    this.contentArea.id = 'dash-content';
    this.contentArea.className = 'dash-content';

    mainCol.appendChild(header);
    mainCol.appendChild(this.contentArea);

    this.root.appendChild(sidebar);
    this.root.appendChild(mainCol);
  }

  /** Sidebar — w-64 bg-neutral-900 border-r border-neutral-800 fixed */
  private _buildSidebar(): HTMLElement {
    const aside = document.createElement('aside');
    aside.id = 'dash-sidebar';
    aside.className = 'dash-sidebar';

    // Logo block — px-6 py-5 border-b border-neutral-800 flex items-center gap-3
    aside.innerHTML = /* html */ `
      <div class="dash-sidebar-logo">
        <div class="dash-logo-icon"><span>S</span></div>
        <span class="dash-logo-wordmark">SOTE</span>
      </div>
    `;

    // Nav
    const nav = document.createElement('nav');
    nav.className = 'dash-sidebar-nav';

    // Primary nav items
    for (const item of PRIMARY_NAV) {
      nav.appendChild(this._buildNavLink(item));
    }

    // Workspace section
    const workspaceDivider = document.createElement('div');
    workspaceDivider.className = 'dash-nav-divider';
    workspaceDivider.innerHTML = `<p class="dash-nav-section-label">Workspace</p>`;
    nav.appendChild(workspaceDivider);

    for (const item of WORKSPACE_NAV) {
      nav.appendChild(this._buildNavLink(item));
    }

    aside.appendChild(nav);

    // Removed user block as requested

    // Re-append nav after innerHTML reset trick (use proper DOM)
    aside.innerHTML = '';

    const logoBlock = document.createElement('div');
    logoBlock.className = 'dash-sidebar-logo';
    logoBlock.innerHTML = /* html */ `
      <div class="dash-logo-icon"><span>S</span></div>
      <span class="dash-logo-wordmark">SOTE</span>
    `;
    aside.appendChild(logoBlock);
    aside.appendChild(nav);

    // Removed user block as requested

    return aside;
  }

  /** Single nav link element */
  private _buildNavLink(item: NavItem): HTMLAnchorElement {
    const a = document.createElement('a');
    a.href = `#${item.path}`;
    a.className = 'dash-nav-link';
    a.dataset['pattern'] = item.pattern;
    a.setAttribute('role', 'menuitem');

    a.innerHTML = /* html */ `
      <div class="dash-nav-icon">${item.icon}</div>
      <span class="dash-nav-label">${t(item.label)}</span>
      ${item.badge ? `<span class="dash-nav-badge">${item.badge}</span>` : ''}
    `;

    // Store badge ref for /flows
    if (item.pattern === '/flows') {
      this.flowsBadge = a.querySelector<HTMLSpanElement>('.dash-nav-badge');
    }

    // SPA navigation — prevent full reload
    a.addEventListener('click', (e) => {
      e.preventDefault();
      router.navigate(item.path);
    });

    this.navLinks.set(item.pattern, a);
    return a;
  }

  /** Top header — bg-neutral-900 border-b border-neutral-800 px-8 py-4 sticky */
  private _buildHeader(): HTMLElement {
    const header = document.createElement('header');
    header.id = 'dash-header';
    header.className = 'dash-header';

    header.innerHTML = /* html */ `
      <!-- Search -->
      <div class="dash-search-bar">
        <span class="dash-search-icon">${ICONS.search}</span>
        <input
          id="dash-search-input"
          type="text"
          class="dash-search-input"
          placeholder="${t('search.placeholder')}"
          autocomplete="off"
          spellcheck="false"
        />
        <span class="dash-search-kbd">⌘K</span>
      </div>

      <div class="dash-header-actions">
        <!-- Sync -->
        <button class="dash-icon-btn" title="${t('sync.tooltip')}">
          ${ICONS.globe}
        </button>

        <!-- Sort -->
        <div class="dash-header-btn" id="dash-sort-btn">
          <span class="dash-header-btn-icon">${ICONS.sortDesc}</span>
          <span class="dash-header-btn-label">Sort by: Category</span>
          <span class="dash-header-btn-icon-sm">${ICONS.chevronDown}</span>
        </div>

        <!-- Filter -->
        <div class="dash-header-btn" id="dash-filter-btn">
          <span class="dash-header-btn-icon">${ICONS.filter}</span>
          <span class="dash-header-btn-label">Filter</span>
        </div>

        <!-- Divider -->
        <div class="dash-header-divider"></div>

        <!-- Create New Flow CTA -->
        <button id="dash-create-btn" class="dash-cta-btn" type="button">
          <span class="dash-cta-icon">${ICONS.plus}</span>
          Create New Flow
        </button>
      </div>
    `;

    // Create New Flow → navigate to /flows (editor page TBD)
    header.querySelector<HTMLButtonElement>('#dash-create-btn')?.addEventListener('click', () => {
      router.navigate('/editor/new');
    });

    return header;
  }

  // ── Routing ───────────────────────────────────────────────────────────────

  private async _onRouteChange(route: ResolvedRoute): Promise<void> {
    // Update active nav state immediately (no wait for page load).
    this._updateActiveNav(route);

    // Show skeleton while loading.
    this._showSkeleton();


    // Unmount previous page.
    if (this.currentPage) {
      try { this.currentPage.unmount(); } catch (e) { console.error(e); }
      this.currentPage = null;
    }

    // Remove old page element.
    if (this.currentPageEl && this.currentPageEl.parentNode === this.contentArea) {
      this.contentArea.removeChild(this.currentPageEl);
    }
    this.currentPageEl = null;

    // Dynamically load + render new page.
    try {
      const page = await loadPage(route.pattern);
      const el   = page.render();

      this._hideSkeleton();

      this.contentArea.appendChild(el);
      this.currentPage   = page;
      this.currentPageEl = el;

      page.mount(route.params);
    } catch (err) {
      console.error('[SOTE Shell] Page load failed:', err);
      this._hideSkeleton();
      this._showError(String(err));
    }
  }

  /** Highlights the nav link matching the current route pattern. */
  private _updateActiveNav(route: ResolvedRoute): void {
    for (const [pattern, link] of this.navLinks) {
      if (pattern === route.pattern) {
        link.classList.add('is-active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('is-active');
        link.removeAttribute('aria-current');
      }
    }
  }

  // ── Skeleton / loading state ──────────────────────────────────────────────

  private _showSkeleton(): void {
    // Remove any existing skeleton first.
    this.contentArea.querySelectorAll('.dash-skeleton-wrap').forEach((el) => el.remove());

    const skeleton = document.createElement('div');
    skeleton.className = 'dash-skeleton-wrap';
    skeleton.innerHTML = /* html */ `
      <div class="dash-skeleton-header">
        <div class="dash-skeleton-block" style="width:180px;height:24px;"></div>
        <div class="dash-skeleton-block" style="width:280px;height:16px;margin-top:8px;"></div>
      </div>
      <div class="dash-skeleton-row"></div>
      <div class="dash-skeleton-row" style="opacity:.7;"></div>
      <div class="dash-skeleton-row" style="opacity:.5;"></div>
      <div class="dash-skeleton-row" style="opacity:.3;"></div>
    `;
    this.contentArea.appendChild(skeleton);
  }

  private _hideSkeleton(): void {
    this.contentArea.querySelectorAll('.dash-skeleton-wrap').forEach((el) => el.remove());
  }

  private _showError(msg: string): void {
    const el = document.createElement('div');
    el.className = 'dash-error';
    el.textContent = `Error loading page: ${msg}`;
    this.contentArea.appendChild(el);
  }
}
